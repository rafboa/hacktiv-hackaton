# Langflow setup status

## Model provider

The flow graph is provider-neutral. Configure an OpenAI-compatible endpoint in Langflow under **Settings → Model Providers → OpenAI Compatible**, enter the base URL and API key, then select an available model in both Agent nodes. Credentials stay in Langflow and are not part of the exported flow JSON or browser bundle.

Langflow's OpenAI-compatible provider uses the OpenAI chat completions protocol and model discovery endpoint. A provider that uses another API protocol needs a provider-specific Langflow integration.

## Text reasoning input

The web collects a typed explanation after an incorrect answer and sends it in `SUPPORT_REQUESTED` as `payload.attempt.reasoning.mode = TEXT`. The request gateway maps the v1 payload to the flat fields used by the catalog, context builder, and plan guard. The child can skip the explanation. STT is not enabled in this iteration; TTS remains in the browser.

## Setup

1. Start Langflow with the Arith custom components available.
2. Configure the OpenAI-compatible model provider and select a model in Teaching Planner Agent and Repair Planner Agent.
3. Run `python langflow/setup_langflow.py` to upload the flow and write its ID to `web/.env`.
4. Restart the Vite development server.
