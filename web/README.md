# Arith Web Frontend

React + Vite frontend for the Arith math learning companion.

## Stack

- React 19, TypeScript 7, Vite 8
- Tailwind CSS 4
- Framer Motion 13 (spring-physics animations)
- Lucide React (icons)
- Web Speech API (TTS + STT)

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # preview production build
npm run lint       # oxlint
```

## Environment

Copy `.env.example` to `.env` (or run `python ../langflow/setup_langflow.py` to auto-generate):

| Variable | Default | Description |
|---|---|---|
| `VITE_LANGFLOW_FLOW_ID` | _(none)_ | Langflow flow UUID |
| `VITE_LANGFLOW_BASE_URL` | `http://localhost:7860` | Langflow API URL |

Without a Langflow connection, the app runs in **demo mode** with bundled sample questions.

## Structure

```
src/
├── screens/         Full-page views (Splash, Login, Home, Question, Summary)
├── components/      Reusable UI (BlockCube, NumberPad, SpeechBubble, etc.)
├── hooks/           useLangflow, useTTS, useSTT
├── utils/           Langflow client, demo mode, sample data, spring presets
└── assets/          Static images
```

## Notes

- All animations use spring physics via Framer Motion. Preset configs are in `src/utils/springs.ts`.
- The Langflow client in `src/utils/langflowClient.ts` handles API calls. Response validation uses `src/utils/arithResponseValidation.mjs`.
- TTS reads instructions aloud using the browser's SpeechSynthesis API. STT captures voice answers via SpeechRecognition.
