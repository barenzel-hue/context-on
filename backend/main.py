import json
import os
import subprocess
from pathlib import Path

import httpx
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
    "You are an AI Developer Onboarding Coach. "
    "You will receive four layers of context: the project overview, the feature/task context, human notes from the team, and the code change. "
    "The code change is supporting evidence only — it is not the main source of truth. "
    "The main sources of truth are the task context and human notes, which explain the real reason this change exists. "
    "Your job is to explain why this change exists at the system and feature level: "
    "what product problem it solves, what constraints or decisions shaped it, and what a developer should watch out for. "
    "Explain this at a system/feature level, not as a commit summary. "
    "Do NOT describe what lines changed, do NOT summarize the diff, do NOT lead with the code. "
    "Lead with the product problem. Use the code only to illustrate decisions that were already explained by the context."
)

CHAT_SYSTEM_PROMPT = (
    "You are a developer assistant embedded in a codebase. "
    "You have access to four sources of context: "
    "(1) project overview and structure, "
    "(2) feature and task context explaining why changes were requested, "
    "(3) human notes with warnings, constraints, and team decisions, "
    "(4) the code change itself as supporting evidence. "
    "When answering questions: "
    "always explain WHY something exists in the system, not just what it does; "
    "combine all available context sources into one coherent answer; "
    "prefer feature and product reasoning over commit-level technical details; "
    "maintain the thread of the conversation — if the developer is drilling into a topic, go deeper; "
    "flag technical debt, risks, and temporary decisions whenever they are relevant; "
    "keep answers developer-friendly: clear, direct, and honest."
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
_runtime_config: dict = {}


def load_mock_data() -> dict:
    files = {
        "git_diff": "git_diff.json",
        "monday_task": "monday_task.json",
        "prd_section": "prd_section.json",
        "human_note": "human_note.json",
        "services": "services.json",
    }
    data = {}
    for key, filename in files.items():
        path = MOCK_DATA_DIR / filename
        if not path.exists():
            raise FileNotFoundError(f"Mock data file not found: {path}")
        with open(path, encoding="utf-8") as f:
            data[key] = json.load(f)
    return data


def _format_human_notes(human) -> str:
    notes = human if isinstance(human, list) else [human]
    lines = []
    for n in notes:
        tags = ", ".join(n.get("tags", []))
        lines.append(
            f"{n.get('author', 'unknown')} ({n.get('date', '')}):\n"
            f"{n.get('note', '')}\n"
            + (f"Tags: {tags}" if tags else "")
        )
    return "\n\n".join(lines)


def _format_services(services: dict) -> str:
    lines = []
    for name, info in services.items():
        task = info.get("task", {})
        lines.append(
            f"- {name}: {info.get('code', '')}\n"
            f"  PRD: {info.get('prd', '')}\n"
            f"  Linked task ({task.get('id', '—')}): {task.get('description', '')}\n"
            f"  Recent change: {info.get('recent_change', '')}\n"
            f"  Team note: {info.get('team_note', '')}"
        )
    return "\n\n".join(lines)


def build_context_string(data: dict) -> str:
    git = data["git_diff"]
    monday = data["monday_task"]
    prd = data["prd_section"]
    human = data["human_note"]
    services = data.get("services", {})

    services_block = _format_services(services) if services else "No service map available."

    open_q = prd.get("open_questions", [])
    non_goals = prd.get("non_goals", [])
    open_q_str = "\n".join(f"  - {q}" for q in open_q) if open_q else "  None listed."
    non_goals_str = "\n".join(f"  - {g}" for g in non_goals) if non_goals else "  None listed."

    linked = monday.get("linked_tasks", [])
    linked_str = "\n".join(
        f"  - Task {t['id']}: {t['title']} [{t['status']}]" + (f" — {t['note']}" if t.get("note") else "")
        for t in linked
    ) if linked else "  None listed."

    comments = monday.get("comments", [])
    comments_str = "\n".join(
        f"  {c['author']} ({c.get('date', '')}): {c['text']}"
        for c in comments
    ) if comments else "  None."

    return f"""## Layer 0: Codebase Service Map
This is a directory of the key services in the codebase — what each one does, why it exists, and what recently changed.

{services_block}

## Layer 1: Project & Product Context
Product: {prd.get('document', 'Unknown')}
Feature: {prd.get('section', '')} — {prd.get('title', '')}
Stakeholder: {prd.get('stakeholder', '')}
Goal: {prd.get('content', '')}
Acceptance criteria:
{chr(10).join(f"  - {c}" for c in prd.get('acceptance_criteria', []))}
Open questions (deferred):
{open_q_str}
Explicitly out of scope:
{non_goals_str}

## Layer 2: Task & Business Context
Task #{monday.get('task_id', '—')}: {monday.get('title', '')}
Epic: {monday.get('epic', '—')} | Sprint: {monday.get('sprint', '—')}
Priority: {monday.get('priority', '')} | Status: {monday.get('status', '')}
Assignee: {monday.get('assignee', '')} | Due: {monday.get('due_date', '')}
Why this task existed: {monday.get('description', '')}
Linked tasks:
{linked_str}
Discussion thread:
{comments_str}

## Layer 3: Human Notes & Warnings
{_format_human_notes(human)}

## Layer 4: Code Change (supporting evidence only)
File: {git.get('file', 'unknown')}
Author: {git.get('author', 'unknown')}
Summary: {git.get('message', '')}

```diff
{git.get('diff', '')}
```
"""


def get_gemini_client() -> genai.Client | None:
    api_key = _runtime_config.get("gemini_api_key") or os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


def get_model() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


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
        return _fallback_response(user_content, messages)

    config = get_generation_config(system)

    try:
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
    except Exception:
        return _fallback_response(user_content, messages)


DEMO_STORY = """## Why This Change Was Made

**The short answer:** Yossi's hotfix in `auth.js` bypassed OAuth `state`-parameter validation to unblock Android users from an infinite login loop — 4 days before a live conference demo.

---

### The Business Pressure

Task #402 landed as a **P0 emergency** on June 17th. Android users on Samsung Galaxy S24 and Pixel 8 running Android 14+ were completely unable to log in via Google OAuth. They'd tap "Sign in with Google," get redirected back to the app — and immediately get sent out again, in an endless loop.

The timing was critical: the Germany conference demo was booked for **June 22nd**, with the sales team planning to demo live sign-up flow to enterprise prospects. Signup completion was sitting at 62% — and the PRD target was 78%. A broken Android login wasn't just a bug. It was a risk to the deal.

---

### Root Cause: A Platform Bug, Not a Code Bug

Yossi traced the loop to **Android WebView silently stripping the `state` parameter** on OAuth redirects. The original `handleOAuthCallback` required both `code` and `state` — correct security behaviour. But WebView was dropping `state`, the handler threw `AuthError('Missing OAuth parameters')`, the app retried, WebView redirected again... indefinitely.

This is a known Android WebView behaviour, not something fixable inside the app in 48 hours.

---

### What Yossi Actually Changed

Three targeted edits to `auth.js`:

1. **Split the validation path** — `state` is now optional. If present, it's validated normally via `exchangeCodeForTokens(code, state)`. If missing (Android path), the exchange runs with `skipStateCheck: true`.

2. **Added a session flag** — `sessionStorage.setItem('oauth_bypass_active', 'true')` is set when `isAndroid()` is true. This prevents the refresh token cycle from re-triggering the loop on the next page load.

3. **Short-circuited `refreshAccessToken`** — if `oauth_bypass_active` is in sessionStorage, the function returns the stored token directly and skips the full refresh cycle that would re-enter the broken loop.

---

### The Security Trade-off

Skipping `state` validation weakens **CSRF protection** on the OAuth callback. The `state` parameter ties a callback to the specific browser session that initiated the login — without it, a forged or intercepted redirect could potentially be replayed.

David (Team Lead) accepted this trade-off deliberately:
- The attack window requires a targeted, active redirect exploit — not a passive risk
- The bypass is Android-only, gated behind `isAndroid()`
- This is flagged as intentional tech debt with a **security review booked for July 2026**

---

### What to Watch Out For

> **Do not copy `skipStateCheck: true` into any new auth flow.** This pattern is a one-time emergency patch, not an approved pattern.

- **Don't remove `oauth_bypass_active`** without updating `refreshAccessToken` — the flag stops the loop from re-triggering
- **Ping Yossi** before touching `auth.js` — he knows where the other edge cases are
- This change is tracked under tags `tech-debt`, `android`, `oauth`, `conference-demo` in Monday
- The proper fix involves patching the OAuth redirect URI to preserve `state` via a server-side relay — scoped for Q3"""


DEMO_CHAT_RESPONSES = {
    "try-catch": """**Why no try-catch around `exchangeCodeForTokens`?**

Yossi made a deliberate call here: the surrounding `handleOAuthCallback` function already has error handling at the call site (the router that calls it catches `AuthError` and redirects to an error screen). Adding a nested try-catch inside `handleOAuthCallback` would have caught errors silently and made debugging harder under time pressure.

The risk Yossi accepted: if `exchangeCodeForTokens` throws something unexpected on the Android path, the user sees an error screen — but at least it fails loudly rather than silently swallowing a broken token.

Under normal circumstances this would warrant a more defensive pattern. Given 48 hours to ship, Yossi kept the change surface minimal.""",

    "security": """**Security risks from `skipStateCheck: true`**

The `state` parameter in OAuth is a CSRF token — it binds the callback to the exact browser session that started the login. Skipping it means:

1. **Authorization code injection** — an attacker who can forge a redirect to your OAuth callback (e.g. via an open redirector on your domain) could potentially exchange someone else's authorization code under a victim's session
2. **Session fixation edge cases** — without state, you can't verify the callback corresponds to the flow the current user actually initiated

**In practice, the risk here is limited** because:
- The bypass only triggers when `state` is literally missing, not when it's present and wrong
- It's gated behind `isAndroid()`, which checks the user agent
- An attacker would need to control a redirect on your domain

David accepted this in exchange for unblocking the demo. **A security review is scheduled for July 2026.** The proper fix is a server-side OAuth relay that re-attaches the `state` before the WebView sees the redirect.""",

    "refactor": """**What the Q3 refactor needs to do**

The root problem is that Android WebView strips the `state` parameter before the app sees the redirect. The bypass works around this in the client — the right fix moves the problem to the server.

The planned approach:
1. **Server-side OAuth relay** — instead of redirecting straight to the app's deep link, the OAuth provider redirects to a backend endpoint (`/auth/callback`) that reads `code` and `state` from query params (server receives both fine), stores the state in a short-lived server session, then redirects to the mobile deep link with just the `code`
2. The app exchanges `code` at the backend, which validates state server-side — WebView never touches it
3. Remove `skipStateCheck`, `oauth_bypass_active`, and the `isAndroid()` bypass entirely

Until that ships: leave `oauth_bypass_active` in place and don't modify the refresh logic without understanding the loop it prevents.""",

    "android": """**How `isAndroid()` works — and can it be spoofed?**

`isAndroid()` almost certainly reads `navigator.userAgent` and checks for the string `"Android"`. That means yes — a desktop browser with a spoofed user agent would hit the bypass path.

However: the bypass is only harmful if `state` is also missing. On desktop browsers, the OAuth provider correctly preserves `state` through the redirect, so the `else` branch (`skipStateCheck: true`) would never trigger even if `isAndroid()` returned true — because `state` would be present and the code takes the normal path.

The real protection here is `if (!state)`, not `isAndroid()`. The Android check is belt-and-suspenders to limit the blast radius of the bypass.""",

    "sessionstorage": """**Why `sessionStorage` and not a cookie or `localStorage`?**

`sessionStorage` was the right call here for two specific reasons:

1. **Tab-scoped** — sessionStorage is cleared when the tab closes. If the user opens a new tab and logs in there, it starts fresh without the bypass flag. A cookie or localStorage would persist and potentially carry the bypass into future unrelated sessions.

2. **No server round-trip** — the refresh loop happens client-side. Yossi needed a flag the client could check synchronously in `refreshAccessToken` without an async call. sessionStorage reads are instant.

The downside: if the user background-refreshes the tab (not close+reopen, just reload), sessionStorage persists — which is exactly the behaviour Yossi needed to prevent the loop from re-triggering on page reload.""",

    "state": """**Why does Android WebView drop the `state` parameter?**

This is a long-standing WebView behaviour where certain custom URI scheme redirects (like `myapp://oauth/callback?code=xxx&state=yyy`) get processed by the Android intent system, which can strip or re-encode query parameters depending on how the intent filter is defined.

Specifically, if the app's `AndroidManifest.xml` intent filter doesn't explicitly declare `android:scheme` with full parameter passthrough, the Android OS may reconstruct the URI from components — dropping parameters it doesn't recognise as part of the scheme definition.

Some apps work around this by using `https://` deep links (App Links) instead of custom schemes, which Android handles more faithfully. That's another option for the Q3 refactor.""",

    "default": """**Good question.** Based on the full context — the git diff, Monday task, PRD section, and David's note — here's what I can tell you:

This change was a calculated short-term fix under significant time pressure. Yossi had 48 hours, a platform bug he couldn't fix, and a conference demo that couldn't slip. The technical debt is real and documented — David's note is explicit that this isn't a pattern to copy.

If you're trying to understand whether it's safe to modify this code: the answer is "carefully, and talk to Yossi first." The three parts of the change (split validation, session flag, short-circuited refresh) are coupled — changing one without understanding the others can re-trigger the infinite redirect loop.

Is there something specific about the change you'd like me to dig into?""",
}


def _fallback_response(context: str, messages: list[dict] | None) -> str:
    if messages is None:
        return DEMO_STORY

    last_message = messages[-1]["content"].lower() if messages else ""

    for keyword, response in DEMO_CHAT_RESPONSES.items():
        if keyword == "default":
            continue
        if keyword in last_message:
            return response

    keyword_map = {
        "csrf": "security",
        "risk": "security",
        "attack": "security",
        "exploit": "security",
        "vulnerable": "security",
        "q3": "refactor",
        "fix": "refactor",
        "proper": "refactor",
        "debt": "refactor",
        "scheduled": "refactor",
        "android": "android",
        "isandroid": "android",
        "spoof": "android",
        "user agent": "android",
        "session": "sessionstorage",
        "storage": "sessionstorage",
        "localstorage": "sessionstorage",
        "cookie": "sessionstorage",
        "bypass_active": "sessionstorage",
        "webview": "state",
        "drops": "state",
        "strip": "state",
        "parameter": "state",
        "catch": "try-catch",
        "error handling": "try-catch",
        "exception": "try-catch",
    }

    for phrase, key in keyword_map.items():
        if phrase in last_message:
            return DEMO_CHAT_RESPONSES[key]

    return DEMO_CHAT_RESPONSES["default"]


class RuntimeConfigRequest(BaseModel):
    monday_api_key: str = ""
    repo_path: str = ""
    gemini_api_key: str = ""


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


class ChatResponse(BaseModel):
    reply: str


class ContextStoryResponse(BaseModel):
    story: str
    raw_sources: dict


class AnalyzeRequest(BaseModel):
    git_diff: str
    task: str = ""
    notes: str = ""


class AnalyzeResponse(BaseModel):
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


def build_custom_context_string(req: AnalyzeRequest) -> str:
    parts = []

    if req.task.strip():
        parts.append(f"## Layer 2: Feature & Task Context\nWhy this change was made: {req.task}")
    else:
        parts.append("## Layer 2: Feature & Task Context\nNo task context provided.")

    if req.notes.strip():
        parts.append(f"## Layer 3: Human Notes & Warnings\n{req.notes}")
    else:
        parts.append("## Layer 3: Human Notes & Warnings\nNo team notes provided.")

    parts.append(f"## Layer 4: Code Change (supporting evidence only)\n```diff\n{req.git_diff}\n```")

    return "\n\n".join(parts)


# ── Repo integration ─────────────────────────────────────────────────────────

def get_repo_path() -> Path | None:
    p = (_runtime_config.get("repo_path") or os.getenv("REPO_PATH", "")).strip()
    if not p:
        return None
    path = Path(p).expanduser().resolve()
    return path if path.is_dir() else None


def get_monday_key() -> str:
    return (_runtime_config.get("monday_api_key") or os.getenv("MONDAY_API_KEY", "")).strip()


MONDAY_API_URL = "https://api.monday.com/v2"


def monday_query(api_key: str, query: str) -> dict:
    try:
        r = httpx.post(
            MONDAY_API_URL,
            headers={"Authorization": api_key, "Content-Type": "application/json"},
            json={"query": query},
            timeout=10,
        )
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Monday API error: {e.response.text}") from e
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Could not reach Monday.com: {e}") from e


def run_git(repo: Path, *args) -> str:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=str(repo),
            capture_output=True,
            text=True,
            timeout=15,
        )
        return result.stdout.strip()
    except Exception:
        return ""


def read_project_overview(repo: Path) -> str:
    parts = []
    for name in ["README.md", "README.txt", "README"]:
        p = repo / name
        if p.exists():
            text = p.read_text(encoding="utf-8", errors="ignore")[:1500]
            parts.append(f"Project README:\n{text}")
            break
    for name in ["package.json"]:
        p = repo / name
        if p.exists():
            try:
                d = json.loads(p.read_text())
                if d.get("name") or d.get("description"):
                    parts.append(f"Project: {d.get('name', '')} — {d.get('description', '')}")
            except Exception:
                pass
    return "\n\n".join(parts) or "No project overview found."


def list_commits(repo: Path, limit: int = 30) -> list[dict]:
    out = run_git(repo, "log", f"-{limit}", "--pretty=format:%H|%an|%ad|%s", "--date=short")
    commits = []
    for line in out.splitlines():
        parts = line.split("|", 3)
        if len(parts) == 4:
            h, author, date, msg = parts
            commits.append({
                "hash": h[:7],
                "full_hash": h,
                "author": author,
                "date": date,
                "message": msg,
            })
    return commits


def get_commit_detail(repo: Path, commit_hash: str) -> dict:
    meta = run_git(repo, "log", "-1", "--pretty=format:%an|%ad|%s|%b", "--date=short", commit_hash)
    parts = meta.split("|", 3)
    author = parts[0] if len(parts) > 0 else ""
    date = parts[1] if len(parts) > 1 else ""
    subject = parts[2] if len(parts) > 2 else ""
    body = (parts[3] or "").strip() if len(parts) > 3 else ""

    files_out = run_git(repo, "show", "--name-only", "--pretty=format:", commit_hash)
    file_list = [f for f in files_out.splitlines() if f.strip()]

    diff = run_git(repo, "show", commit_hash, "--unified=5")

    return {
        "hash": commit_hash[:7],
        "full_hash": commit_hash,
        "author": author,
        "date": date,
        "message": subject,
        "body": body,
        "files": file_list,
        "diff": diff,
    }


def build_repo_context_string(overview: str, detail: dict) -> str:
    files_str = "\n".join(f"  - {f}" for f in detail["files"]) or "  (no files listed)"
    body_line = f"Details: {detail['body']}" if detail.get("body") else ""
    return f"""## Layer 1: Project Overview
{overview}

## Layer 2: Feature & Task Context
Commit by {detail['author']} on {detail['date']}
Summary: {detail['message']}
{body_line}
Files changed:
{files_str}

## Layer 3: Human Notes & Warnings
No linked task or team notes available for this commit. Infer intent from the commit message, the project context, and the code.

## Layer 4: Code Change (supporting evidence only)
```diff
{detail['diff']}
```
"""


@app.get("/api/repo/status")
def repo_status():
    repo = get_repo_path()
    if not repo:
        return {"connected": False}
    toplevel = run_git(repo, "rev-parse", "--show-toplevel")
    if not toplevel:
        return {"connected": False, "error": "Not a git repository"}
    branch = run_git(repo, "rev-parse", "--abbrev-ref", "HEAD")
    return {
        "connected": True,
        "path": str(repo),
        "name": Path(toplevel).name,
        "branch": branch,
    }


@app.get("/api/repo/commits")
def get_repo_commits(limit: int = 30):
    repo = get_repo_path()
    if not repo:
        raise HTTPException(status_code=400, detail="No repository configured. Set REPO_PATH in .env")
    return {"commits": list_commits(repo, limit)}


@app.get("/api/repo/commits/{commit_hash}", response_model=ContextStoryResponse)
def explain_repo_commit(commit_hash: str):
    global _context_cache
    repo = get_repo_path()
    if not repo:
        raise HTTPException(status_code=400, detail="No repository configured. Set REPO_PATH in .env")

    detail = get_commit_detail(repo, commit_hash)
    overview = read_project_overview(repo)
    context = build_repo_context_string(overview, detail)

    raw_sources = {
        "git_diff": {
            "file": ", ".join(detail["files"][:3]) or detail["hash"],
            "commit": detail["hash"],
            "author": detail["author"],
            "date": detail["date"],
            "message": detail["message"],
            "diff": detail["diff"],
        },
        "monday_task": {
            "task_id": "—",
            "title": detail["message"],
            "priority": "—",
            "status": "—",
            "assignee": detail["author"],
            "due_date": detail["date"],
            "description": detail.get("body") or "No task linked to this commit.",
            "comments": [],
        },
        "human_note": {
            "author": "—",
            "date": detail["date"],
            "note": "No team notes available for this commit.",
            "tags": [],
        },
    }

    _context_cache = {"data": raw_sources, "context": context}
    story = call_llm(SYSTEM_PROMPT, context)
    return ContextStoryResponse(story=story, raw_sources=raw_sources)


# ── End repo integration ──────────────────────────────────────────────────────


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    global _context_cache

    if not request.git_diff.strip():
        raise HTTPException(status_code=400, detail="git_diff is required")

    context = build_custom_context_string(request)
    raw_sources = {
        "git_diff": {
            "file": "custom input",
            "commit": "—",
            "author": "—",
            "date": "",
            "message": "",
            "diff": request.git_diff,
        },
        "monday_task": {
            "task_id": "—",
            "title": "Custom analysis",
            "priority": "—",
            "status": "—",
            "assignee": "—",
            "due_date": "—",
            "description": request.task or "No task description provided.",
            "comments": [],
        },
        "prd_section": {
            "document": "—",
            "stakeholder": "—",
            "section": "—",
            "title": "Not provided",
            "content": "No PRD section provided.",
            "acceptance_criteria": [],
        },
        "human_note": {
            "author": "—",
            "date": "",
            "note": request.notes or "No additional notes provided.",
            "tags": [],
        },
    }

    _context_cache = {"data": raw_sources, "context": context}
    story = call_llm(SYSTEM_PROMPT, context)
    return AnalyzeResponse(story=story, raw_sources=raw_sources)


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

    # Anchor: always inject the full context as the first exchange so the model
    # has all four layers on every turn, then replay the real conversation history.
    anchor = [
        {
            "role": "user",
            "content": (
                "Here is the full context for the code you will be asked about. "
                "It includes the project overview, feature/task context, human notes, "
                "and the code change as supporting evidence.\n\n"
                f"{context}"
            ),
        },
        {
            "role": "assistant",
            "content": (
                "I have reviewed all four context layers: the project overview, "
                "the feature and task context, the team notes, and the code change. "
                "Ask me anything — I'll explain why this code exists, what problem it solves, "
                "and any tradeoffs or constraints involved."
            ),
        },
    ]

    messages = anchor + request.history + [{"role": "user", "content": request.message}]

    reply = call_llm(CHAT_SYSTEM_PROMPT, "", messages=messages)
    return ChatResponse(reply=reply)


# ── Runtime config ────────────────────────────────────────────────────────────


@app.post("/api/config")
def set_config(config: RuntimeConfigRequest):
    global _runtime_config
    _runtime_config = {
        "monday_api_key": config.monday_api_key.strip(),
        "repo_path": config.repo_path.strip(),
        "gemini_api_key": config.gemini_api_key.strip(),
    }
    return {"status": "ok"}


@app.get("/api/config/status")
def get_config_status():
    return {
        "monday_configured": bool(get_monday_key()),
        "repo_configured": bool(get_repo_path()),
        "gemini_configured": bool(
            _runtime_config.get("gemini_api_key") or os.getenv("GEMINI_API_KEY", "")
        ),
    }


# ── Monday.com integration ────────────────────────────────────────────────────


@app.get("/api/monday/test")
def test_monday_connection():
    key = get_monday_key()
    if not key:
        raise HTTPException(status_code=400, detail="Monday API key not configured")
    result = monday_query(key, "{ me { name email } }")
    errors = result.get("errors")
    if errors:
        raise HTTPException(status_code=401, detail=errors[0].get("message", "Auth failed"))
    me = result.get("data", {}).get("me", {})
    return {"ok": True, "name": me.get("name", ""), "email": me.get("email", "")}


@app.get("/api/monday/boards")
def get_monday_boards():
    key = get_monday_key()
    if not key:
        raise HTTPException(status_code=400, detail="Monday API key not configured")
    result = monday_query(
        key,
        "{ boards(limit: 50, order_by: used_at) { id name description board_kind } }",
    )
    errors = result.get("errors")
    if errors:
        raise HTTPException(status_code=400, detail=errors[0].get("message", "Query failed"))
    boards = result.get("data", {}).get("boards", [])
    return {"boards": boards}


@app.get("/api/monday/boards/{board_id}/items")
def get_monday_items(board_id: str):
    key = get_monday_key()
    if not key:
        raise HTTPException(status_code=400, detail="Monday API key not configured")
    query = f"""{{
      boards(ids: [{board_id}]) {{
        items_page(limit: 50) {{
          items {{
            id
            name
            state
            column_values {{
              id
              text
            }}
          }}
        }}
      }}
    }}"""
    result = monday_query(key, query)
    errors = result.get("errors")
    if errors:
        raise HTTPException(status_code=400, detail=errors[0].get("message", "Query failed"))
    boards = result.get("data", {}).get("boards", [])
    items = boards[0]["items_page"]["items"] if boards else []
    return {"items": items}
