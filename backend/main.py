import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
MOCK_DATA_DIR = BASE_DIR / "mock_data"

load_dotenv(BASE_DIR / ".env")

SYSTEM_PROMPT = (
    "You are an AI Developer Onboarding Coach. Analyze the provided Git Diff, "
    "Monday Task, PRD section, and Human Note. Generate a coherent, human-readable "
    "narrative explaining WHY this code was changed, what constraints the developer "
    "faced, and what the new developer should look out for."
)

CHAT_SYSTEM_PROMPT = (
    "You are an AI Developer Onboarding Coach helping a new developer understand "
    "a specific code change. You have full context from the Git diff, Monday task, "
    "PRD section, and a note from the team lead. Answer follow-up questions clearly, "
    "concisely, and honestly — including technical debt and risks when relevant."
)

app = FastAPI(title="ContextOn API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_context_cache: dict | None = None
_story_cache: str | None = None


def load_mock_data() -> dict:
    files = {
        "git_diff": "git_diff.json",
        "monday_task": "monday_task.json",
        "prd_section": "prd_section.json",
        "human_note": "human_note.json",
    }
    data = {}
    for key, filename in files.items():
        path = MOCK_DATA_DIR / filename
        if not path.exists():
            raise FileNotFoundError(f"Mock data file not found: {path}")
        with open(path, encoding="utf-8") as f:
            data[key] = json.load(f)
    return data


def build_context_string(data: dict) -> str:
    git = data["git_diff"]
    monday = data["monday_task"]
    prd = data["prd_section"]
    human = data["human_note"]

    return f"""## Git Diff
File: {git.get('file', 'unknown')}
Commit: {git.get('commit', 'unknown')} by {git.get('author', 'unknown')}
Message: {git.get('message', '')}

```diff
{git.get('diff', '')}
```

## Monday.com Task
{monday.get('summary', monday.get('title', ''))}
Status: {monday.get('status', '')} | Priority: {monday.get('priority', '')}
Description: {monday.get('description', '')}

## PRD Section
{prd.get('section', '')}: {prd.get('title', '')}
{prd.get('content', '')}
Acceptance criteria: {', '.join(prd.get('acceptance_criteria', []))}

## Human Note (Team Lead)
From {human.get('author', 'unknown')} ({human.get('date', '')}):
{human.get('note', '')}
"""


def get_gemini_client() -> genai.Client | None:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


def get_model() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-1.5-flash")


def get_generation_config(system: str) -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        system_instruction=system,
        temperature=0.7,
        max_output_tokens=1500,
    )


def to_gemini_history(messages: list[dict]) -> list[types.Content]:
    history: list[types.Content] = []
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content", "")
        if role == "user":
            history.append(types.UserContent(parts=[types.Part.from_text(text=content)]))
        elif role in ("assistant", "model"):
            history.append(types.ModelContent(parts=[types.Part.from_text(text=content)]))
    return history


def call_llm(system: str, user_content: str, messages: list[dict] | None = None) -> str:
    client = get_gemini_client()
    model = get_model()

    if client is None:
        return _fallback_response(user_content, messages is not None)

    config = get_generation_config(system)

    if messages:
        history = to_gemini_history(messages[:-1])
        last_message = messages[-1]["content"]
        chat = client.chats.create(model=model, config=config, history=history)
        response = chat.send_message(last_message)
    else:
        response = client.models.generate_content(
            model=model,
            contents=user_content,
            config=config,
        )

    return response.text or ""


def _fallback_response(context: str, is_chat: bool) -> str:
    if is_chat:
        return (
            "**Demo mode (no API key):** Set `GEMINI_API_KEY` in a `.env` file at the "
            "project root for live LLM answers. Based on the mock context: this change "
            "was a time-pressured Android OAuth bypass for the Germany conference demo. "
            "Yossi skipped strict state validation because Android WebView drops the "
            "`state` parameter, causing an infinite refresh loop."
        )

    return """## Why This Change Happened

**The business pressure:** Task #402 was a **P0 hotfix** — Android users on Samsung and Pixel devices were stuck in an infinite OAuth redirect loop. The Germany conference demo was 4 days away, and signup completion (PRD target: 78%) was at risk.

**What Yossi changed:** In `auth.js`, the OAuth callback handler was modified to:
1. **Skip `state` validation** when the parameter is missing (Android WebView bug)
2. **Call `exchangeCodeForTokens` with `skipStateCheck: true`** on the Android-only path
3. **Set `oauth_bypass_active` in sessionStorage** to prevent the refresh token loop from re-triggering

**Constraints the developer faced:**
- 48-hour deadline before the conference
- Platform bug in Android WebView (not fixable in-app quickly)
- PRD requires seamless OAuth in under 3 seconds — users couldn't afford error screens

**What you should watch out for:**
- This is **intentional technical debt** — David (team lead) flagged it for Q3 refactoring
- **Do not copy this pattern** for new auth flows
- Security review is scheduled for July — the `skipStateCheck` path weakens CSRF protection
- Ping Yossi before modifying `auth.js`

---
*Running in demo mode. Add `GEMINI_API_KEY` to `.env` for AI-generated narratives.*"""


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


class ContextStoryResponse(BaseModel):
    story: str
    raw_sources: dict


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "llm_configured": get_gemini_client() is not None,
        "provider": "gemini",
        "model": get_model(),
    }


@app.get("/api/sources")
def get_sources():
    return load_mock_data()


@app.get("/api/context-story", response_model=ContextStoryResponse)
def get_context_story():
    global _context_cache, _story_cache

    try:
        data = load_mock_data()
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    context = build_context_string(data)
    _context_cache = {"data": data, "context": context}

    story = call_llm(SYSTEM_PROMPT, context)
    _story_cache = story

    return ContextStoryResponse(story=story, raw_sources=data)


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    global _context_cache

    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if _context_cache is None:
        try:
            data = load_mock_data()
            context = build_context_string(data)
            _context_cache = {"data": data, "context": context}
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=str(e)) from e

    context = _context_cache["context"]
    messages = [
        {
            "role": "user",
            "content": f"Here is the full context about the code change:\n\n{context}",
        },
        {
            "role": "assistant",
            "content": "I've reviewed the Git diff, Monday task, PRD section, and team lead note. Ask me anything about this change.",
        },
        {"role": "user", "content": request.message},
    ]

    reply = call_llm(CHAT_SYSTEM_PROMPT, "", messages=messages)
    return ChatResponse(reply=reply)
