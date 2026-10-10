# Arith: Pendamping Belajar Matematika

Math learning companion for elementary school children (grades 1-3) with dyscalculia and dyslexia. Built for the Hacktiv Hackathon.

The app presents arithmetic problems with animated block visuals, reads instructions aloud via TTS, and provides tiered hints powered by an LLM planning flow. No timers, no red marks, no pressure.

## Architecture

```
hacktiv_hackaton/
├── web/              React + Vite frontend (Framer Motion, Tailwind, TTS/STT)
├── langflow/         Langflow custom components and flow graph
├── mcp-server/       MCP server for GitHub and Langflow integrations
└── .env.example      Required environment variables
```

```
┌──────────────┐     POST /api/v1/run/:id     ┌──────────────────┐
│              │ ───────────────────────────── │                  │
│   web/       │                               │   Langflow       │
│   (React)    │ ◄──── JSON response ───────── │   (Python)       │
│              │                               │                  │
└──────────────┘                               └──────────────────┘
       │                                              │
       │ TTS / STT (browser APIs)              LLM (OpenAI-compat)
       ▼                                              ▼
   Speaker / Mic                              Gemini / DeepSeek / etc.
```

### Request Flow

1. **`PROBLEM_REQUESTED`** / **`TRANSFER_REQUESTED`**: deterministic math engine generates operands and correct answer. No LLM call.
2. **`SUPPORT_REQUESTED`** (child answered wrong): Teaching Planner Agent builds a hint plan using the LLM, validated by Plan Guard, with a one-shot Repair Agent fallback.

## Modules

### `web/` - Frontend

React 19, Vite 8, TypeScript, Tailwind CSS 4, Framer Motion.

**Screens:** Splash, Login, Home (mode select), Question (block visuals + number pad), Feedback overlay, Summary.

**Components:** BlockCube, NumberLine, NumberPad, WobbleButton, JiggleCard, SpeechBubble, HintCard, CornerBar, Mascot, ProgressDots, ReasoningInput.

**Hooks:** `useLangflow` (API calls), `useTTS` (text-to-speech), `useSTT` (speech-to-text).

Features:
- Spring-physics animations (jiggle, bounce, wobble) on all interactive elements
- Voice-first: instructions are read aloud before text appears
- Color-coded operations: blue = addition, orange = subtraction, green = correct
- Tiered hint system (3 levels, from gentle nudge to animated walkthrough)
- Demo mode with sample questions for offline use

### `langflow/` - AI Backend

Custom Langflow components forming the `arith-teaching-planner` flow. The flow is provider-neutral: configure any OpenAI-compatible endpoint (Gemini, DeepSeek, OpenRouter) in Langflow settings.

**Components:**
| Component | Role |
|---|---|
| `arith_request_gateway` | Routes incoming requests by event type |
| `arith_lesson_engine` | Generates math problems (deterministic) |
| `teaching_strategy_catalog` | Provides pedagogical strategies for the LLM |
| `support_context_builder` | Builds context from the child's attempt history |
| `arith_plan_guard` | Validates LLM output structure |
| `arith_response_serializer` | Wraps output into the API envelope |

### `mcp-server/` - MCP Integration

TypeScript MCP server exposing tools for AI coding assistants:

- **GitHub:** repo info, list/create issues, list PRs, read files
- **Langflow:** run flows, list flows, get flow details

Credentials are injected via environment variables, never hardcoded.

## Setup

### Prerequisites

- Node.js 20+
- Python 3.10+ with Langflow installed
- An OpenAI-compatible LLM endpoint (API key required)

### 1. Clone and install

```bash
git clone <repo-url>
cd hacktiv_hackaton

# Web frontend
cd web
npm install
cd ..

# MCP server (optional)
cd mcp-server
npm install
npm run build
cd ..
```

### 2. Configure Langflow

1. Start Langflow with the custom component path:
   ```bash
   export LANGFLOW_COMPONENTS_PATH=./langflow/components
   langflow run
   ```
2. In Langflow: **Settings > Model Providers > OpenAI Compatible**. Enter your provider's base URL and API key.
3. Upload the flow and write the flow ID to `web/.env`:
   ```bash
   python langflow/setup_langflow.py
   ```
4. Select the configured model in both **Teaching Planner Agent** and **Repair Planner Agent** nodes.

### 3. Run the frontend

```bash
cd web
npm run dev
```

The app runs at `http://localhost:5173`. Without a running Langflow instance, it falls back to demo mode with sample questions.

### 4. MCP server (optional)

Add to your MCP client config (e.g. `mcp.json`):
```json
{
  "hacktiv-mcp-server": {
    "command": "node",
    "args": ["./mcp-server/build/index.js"],
    "env": {
      "GITHUB_TOKEN": "<your-token>",
      "GITHUB_REPO": "owner/repo",
      "LANGFLOW_BASE_URL": "http://localhost:7860",
      "LANGFLOW_API_KEY": "<your-key>"
    }
  }
}
```

## Environment Variables

| Variable | Used by | Description |
|---|---|---|
| `VITE_LANGFLOW_FLOW_ID` | web | Langflow flow UUID (written by `setup_langflow.py`) |
| `VITE_LANGFLOW_BASE_URL` | web | Langflow API URL (default: `http://localhost:7860`) |
| `LANGFLOW_COMPONENTS_PATH` | langflow | Path to custom components directory |
| `LANGFLOW_SSRF_ALLOWED_HOSTS` | langflow | Allowlisted hosts for SSRF protection (if LLM runs locally) |
| `GITHUB_TOKEN` | mcp-server | GitHub personal access token |
| `GITHUB_REPO` | mcp-server | Default repo in `owner/repo` format |
| `LANGFLOW_BASE_URL` | mcp-server | Langflow instance URL |
| `LANGFLOW_API_KEY` | mcp-server | Langflow API key |

## Design Principles

1. **One thing per screen.** No scrolling. Each state fills the viewport.
2. **Voice first.** Instructions are spoken aloud; text is secondary.
3. **Color = meaning.** Blue is always "add", orange is always "subtract", green is always "correct".
4. **No pressure.** No timers, no red X marks, no score penalties.
5. **Jiggle = alive.** Every interactive element uses spring physics so the UI feels responsive.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 7, Vite 8, Tailwind CSS 4 |
| Animation | Framer Motion 13 |
| Icons | Lucide React |
| AI backend | Langflow 1.11.5 (self-hosted) |
| LLM | Any OpenAI-compatible endpoint |
| MCP server | TypeScript, `@modelcontextprotocol/sdk` |
| Voice | Web Speech API (TTS + STT) |

## License

Hackathon project. Not yet licensed.
