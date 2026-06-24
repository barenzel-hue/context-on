# ContextOn — Project Summary

## What It Does

ContextOn is a local developer tool that helps you understand **why code was written the way it was**.

Paste any code change — a git diff, a snippet, a confusing function — along with optional context like a task description or team notes, and get an AI explanation of the logic, constraints, and decisions behind it. Then ask follow-up questions in a chat.

The tool is not specifically about git commits. Git is just one convenient way to bring code in. The core purpose is: *I'm reading this code and I don't understand why it's written this way — explain it to me.*

---

## The Demo Scenario

The app ships with a realistic fictional scenario about a real-looking code change:

> **Yossi Cohen** modified `src/auth/auth.js` to bypass OAuth `state`-parameter validation for Android WebView — which was silently stripping the parameter and causing an infinite login loop. This was a P0 hotfix 4 days before a Germany conference demo. The team lead flagged it as intentional technical debt, with a security review booked for July 2026.

The four mock data files powering this demo live in `mock_data/`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, uvicorn |
| AI | Google Gemini (`gemini-2.0-flash` by default) |
| Frontend | React 18, Vite, Tailwind CSS v3 |
| Markdown rendering | react-markdown |
| Fonts | Inter (body), JetBrains Mono (code) |

No database. Context comes from JSON files or user input. Chat history persists in `localStorage`.

---

## Project Structure

```
contexton/
├── .env                       # GEMINI_API_KEY, GEMINI_MODEL (gitignored)
├── .env.example               # Template
├── mock_data/
│   ├── git_diff.json          # Simulated diff + commit metadata
│   ├── monday_task.json       # Task #402 — Android login hotfix
│   ├── prd_section.json       # PRD 3.2 — Seamless OAuth (used by backend only)
│   └── human_note.json        # Team lead note from David
├── backend/
│   ├── main.py                # All backend logic (FastAPI app)
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── vite.config.js          # Proxies /api → localhost:8000
    ├── tailwind.config.js
    └── src/
        ├── App.jsx             # Root layout, tab logic, context strip
        ├── api.js              # Fetch helpers
        ├── index.css           # Tailwind + markdown prose styles
        └── components/
            ├── AnalyzeForm.jsx    # Paste-your-own-code form
            ├── ContextStory.jsx   # AI explanation panel + copy button
            └── ChatPanel.jsx      # Q&A chat with localStorage persistence
```

---

## How to Run

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Optionally add a Gemini API key for live AI responses:
```bash
cp .env.example .env
# Edit .env → GEMINI_API_KEY=AIza...
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## API Endpoints

| Method | Endpoint | What it does |
|---|---|---|
| GET | `/api/health` | Status — confirms if LLM is configured |
| GET | `/api/sources` | Raw JSON for all 4 mock data files |
| GET | `/api/context-story` | Loads mock data, generates AI explanation, returns `{story, raw_sources}` |
| POST | `/api/chat` | `{message}` → `{reply}` — Q&A using current context |
| POST | `/api/analyze` | `{git_diff, task?, notes?}` → `{story, raw_sources}` — explain custom code |

---

## How the AI Works

### Explanation generation (`/api/context-story` or `/api/analyze`)
All available context (code change, task, notes) is formatted into one string and sent to Gemini with a system prompt framing it as a "Developer Onboarding Coach." The model returns a markdown narrative covering the business reason, technical decisions, constraints, and risks.

### Chat (`/api/chat`)
The full context is injected as the first two messages on every request (user sends context, assistant acknowledges). The real question is appended as the third message. No server-side session is maintained — context is re-sent each time.

### Demo mode
If no valid `GEMINI_API_KEY` is set, or if the API call fails for any reason, the backend falls back to rich pre-built responses:
- **Explanation** — a detailed multi-section narrative about the demo scenario
- **Chat** — keyword-based responses that answer common questions about the code intelligently (detects: "security", "try-catch", "refactor", "android", "sessionStorage", "state", "webview", etc.)

---

## Frontend Layout

The app is a single-page tab interface — no sidebar, no split panels.

```
┌─────────────────────────────────────────────────────┐
│ ContextOn  Paste code, get the logic — why it was   │
│            written this way          [Analyze a      │
│                                       code change]   │
├─────────────────────────────────────────────────────┤
│ Analyzing · auth.js — "hotfix: bypass token…"  a3f8 │  ← context strip
├─────────────────────────────────────────────────────┤
│ [Explanation] [Ask About This Code] [Code Change]   │  ← tabs
│ [Related Task] [Team Note]                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│           active tab content                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Tabs
| Tab | What it shows |
|---|---|
| **Explanation** | AI-generated narrative — the main view |
| **Ask About This Code** | Chat panel with localStorage persistence |
| **Code Change** | The raw code diff |
| **Related Task** | The ticket/task (Monday, Jira, etc.) |
| **Team Note** | Human context from the team lead |

### Key behaviours
- **Context strip** always shows what's being analyzed regardless of active tab
- **"Analyze a code change"** button opens the form; submitting replaces the current explanation and resets chat
- **Chat** persists across page refreshes via `localStorage`; resets automatically when a new analysis is loaded
- **Copy button** on the Explanation tab copies the full narrative to clipboard

### AnalyzeForm
Three fields:
1. **Code change** (required) — paste a diff, snippet, or any code
2. **Why was this written?** (optional) — paste a ticket, task description, or just describe it in plain text
3. **Any extra context?** (optional) — team notes, Slack messages, caveats

---

## Demo Mode Chat — Keyword Responses

The built-in chat recognises these topics and returns detailed pre-written answers:

| Keywords detected | Topic covered |
|---|---|
| `security`, `csrf`, `risk`, `attack` | CSRF risk from skipping state validation |
| `try-catch`, `catch`, `exception` | Why no error handling was added |
| `refactor`, `q3`, `fix`, `debt` | What the planned Q3 refactor involves |
| `android`, `isandroid`, `spoof` | How Android detection works and its limits |
| `session`, `storage`, `cookie` | Why sessionStorage was chosen over cookies |
| `webview`, `drops`, `strip`, `state` | Why Android WebView drops the state param |
| anything else | Thoughtful generic response |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | — | Google AI Studio key (`AIza...`). App works without it — falls back to demo mode. |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model to use. |

---

## Known Limitations

- **One analysis at a time** — the backend holds one context in memory; loading a new change replaces it
- **No real integrations** — data is mocked JSON or pasted manually; no live GitHub / Jira / Confluence
- **Chat re-injects context every call** — no persistent server-side session
- **Single user, local only** — no auth, no multi-user support
