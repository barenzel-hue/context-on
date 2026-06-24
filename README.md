# ContextOn

A local developer onboarding dashboard that explains the **why** behind code changes by combining Git, Product (PRD), Project Management (Monday), and human context.

## Project Structure

```
├── mock_data/          # Simulated context sources (JSON)
├── backend/            # FastAPI server + LLM integration
└── frontend/           # React + Tailwind dashboard
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- Google Gemini API key (optional — demo fallback works without it)

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Copy the example env file and add your API key (optional):

```bash
cp ../.env.example ../.env
# Edit ../.env and set GEMINI_API_KEY=...
```

Start the server:

```bash
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/context-story` | GET | Loads all mock data, generates unified AI narrative |
| `/api/chat` | POST | Follow-up Q&A about the context (`{ "message": "..." }`) |
| `/api/sources` | GET | Raw mock data for all four sources |
| `/api/health` | GET | Health check + LLM configuration status |

## Demo Mode

Without a `GEMINI_API_KEY`, the backend returns a rich pre-built narrative and chat responses so you can demo the UI immediately.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Model for story + chat |
