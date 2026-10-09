# Arith Langflow Implementation

> Architecture: [`Langflow-Architecture-Arith.md`](../Langflow-Architecture-Arith.md)
> Target Langflow version: **1.11.5** (local)
> Flow endpoint: `POST /api/v1/run/{flow_id}`

## Components

```text
langflow/
├── components/
│   ├── arith_request_gateway.py
│   ├── arith_lesson_engine.py
│   ├── support_context_builder.py
│   ├── teaching_strategy_catalog.py
│   ├── arith_plan_guard.py
│   └── arith_response_serializer.py
├── flow/arith-teaching-planner.json
└── setup_langflow.py
```

The model provider is configured in Langflow rather than embedded in the flow. This keeps the flow graph provider-neutral and keeps provider credentials on the Langflow server.

## Configure an LLM endpoint

The flow supports providers that expose an **OpenAI-compatible chat completions API**. In Langflow, open **Settings → Model Providers → OpenAI Compatible**, then enter the provider's base URL and API key. Langflow discovers models from the endpoint's `/v1/models` route. After saving, enable the model you want, then select it in the `Agent LLM` input on both **Teaching Planner Agent** and **Repair Planner Agent**.

This works with compatible endpoints such as Gemini's OpenAI-compatible API, DeepSeek, OpenRouter, and compatible self-hosted servers. Provider APIs that use a different request protocol need a provider-specific Langflow integration. Do not put model provider API keys in the React app, request JSON, or flow JSON.

For an endpoint running on the same machine or a private network, Langflow's SSRF protection may require the hostname/IP to be allowlisted in `LANGFLOW_SSRF_ALLOWED_HOSTS`.

## Import the flow

1. Start Langflow with the custom component folder available if it is not already configured:
   ```bash
   export LANGFLOW_COMPONENTS_PATH=/path/to/langflow/components
   langflow run
   ```
2. Configure the OpenAI-compatible provider as described above.
3. Build/import the flow:
   ```bash
   python langflow/setup_langflow.py
   ```
   The script compiles the Python components, builds the Langflow graph, uploads it, and writes the flow ID to `web/.env`. It requires the `requests` Python package.
4. Open the flow in Langflow and select the configured model in both Agent nodes. The same provider/model can be used for planning and the one-time repair call.
5. Restart the Vite development server so it loads the flow ID from `web/.env`.

The script replaces an existing flow named `arith-teaching-planner` before uploading the generated graph.

## Request routing

```text
Chat Input → Request Gateway
  PROBLEM_REQUESTED  → deterministic Lesson Engine → Plan Guard → Serializer
  SUPPORT_REQUESTED  → Strategy Catalog + Context Builder → Teaching Planner Agent
                       valid plan → Serializer
                       invalid plan → one Repair Agent pass → fallback if still invalid
  TRANSFER_REQUESTED → deterministic Lesson Engine → Plan Guard → Serializer
  INVALID            → Error Serializer
```

Only the support and repair agents use the selected language model. The math engine remains responsible for operands and correct answers.

## Demo seed

| Event | Demo problem |
|---|---|
| `PROBLEM_REQUESTED` | `8 + 5 = 13` |
| `TRANSFER_REQUESTED` | `9 + 4 = 13` |

Set `Demo Seed = OFF` on the initial and transfer Lesson Engine instances to use generated operands.

## Agent settings

| Setting | Value |
|---|---|
| LLM | Select from Langflow's configured model providers |
| Output | Structured Response only |
| Chat history | 0 messages |
| Built-in tools | Disabled for P0 |
| Temperature | 0.2 where supported by the selected model |
| Max output | 1600 tokens where supported by the selected model |

The provider's supported parameters vary. Structured output is validated by the Arith Plan Guard before serialization.

## Response envelope

The serializer returns JSON as the Chat Output message. The current envelope contains `schema_version`, `request_id`, `session_id`, `status`, `source`, `event_type`, and `payload`.
