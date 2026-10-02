# Arith Langflow Implementation

> Reference: [`Langflow-Architecture-Arith.md`](../Langflow-Architecture-Arith.md)  
> Target Langflow version: **1.11.5** (local) / tested against 1.12.x docs  
> Flow endpoint: `POST /api/v1/run/arith-teaching-planner`

---

## Directory layout

```
langflow/
├── components/                  # Six custom Python components
│   ├── arith_request_gateway.py
│   ├── arith_lesson_engine.py
│   ├── support_context_builder.py
│   ├── teaching_strategy_catalog.py
│   ├── arith_plan_guard.py
│   └── arith_response_serializer.py
└── flow/
    └── arith-teaching-planner.json   # Importable Langflow flow graph
```

---

## Custom components

| File | Class | Spec § | Uses LLM |
|---|---|:---:|:---:|
| `arith_request_gateway.py` | `ArithRequestGateway` | §2, §5, §17 | No |
| `arith_lesson_engine.py` | `ArithLessonEngine` | §6, §12, §13 | No |
| `support_context_builder.py` | `SupportContextBuilder` | §7, §10, §12 | No |
| `teaching_strategy_catalog.py` | `TeachingStrategyCatalog` | §8 | No |
| `arith_plan_guard.py` | `ArithPlanGuard` | §11, §12 | No |
| `arith_response_serializer.py` | `ArithResponseSerializer` | §14, §15 | No |

---

## How to load into Langflow

### Option A — Import the flow JSON

1. Open Langflow UI → **My Flows** → **Import**.
2. Select `langflow/flow/arith-teaching-planner.json`.
3. For each `CustomComponent` node, paste the matching component source from `langflow/components/` into the code field.
4. Set the **DeepSeek** node's `api_key` via a Langflow global variable (never hardcode).
5. Save and run.

### Option B — Load components via custom-components path

Add `langflow/components/` to Langflow's `LANGFLOW_COMPONENTS_PATH` environment variable.  
All six classes will appear in the component panel under **Custom**.

```bash
export LANGFLOW_COMPONENTS_PATH=/path/to/langflow/components
langflow run
```

---

## Event routing

```
Chat Input (JSON string)
    └─► Arith Request Gateway
            ├─ PROBLEM_REQUESTED  → Lesson Engine (INITIAL) → Plan Guard → Serializer → Chat Output
            ├─ SUPPORT_REQUESTED  → Strategy Catalog ─┐
            │                       Context Builder ───┴► Teaching Planner Agent
            │                                               └─ valid ──────────────► Serializer → Chat Output
            │                                               └─ invalid → Repair Agent
            │                                                              └─ valid ─► Serializer → Chat Output
            │                                                              └─ invalid → Fallback Engine → Serializer → Chat Output
            ├─ TRANSFER_REQUESTED → Lesson Engine (TRANSFER) → Plan Guard → Serializer → Chat Output
            └─ INVALID            → Error Serializer → Chat Output
```

---

## Build order (spec §19)

| Stage | Components to wire |
|---|---|
| **1 — Deterministic** | Chat Input → Gateway → Lesson Engine (INITIAL) → Plan Guard → Serializer → Chat Output |
| **2 — Support agent** | DeepSeek → Strategy Catalog → Context Builder → Agent → Plan Guard pass-1 |
| **3 — Reliability** | Repair Agent → Fallback Engine → error/timeout paths |
| **4 — Transfer** | Lesson Engine (TRANSFER) → Plan Guard → Serializer |

---

## Canvas colour conventions (spec §18)

| Colour | Node group |
|---|---|
| 🔵 Blue | Chat Input / Chat Output |
| 🟢 Green | Deterministic components (Gateway, Lesson Engine, Catalog, Serializer) |
| 🟣 Purple | AI / LLM (DeepSeek, Teaching Planner Agent, Repair Agent) |
| 🟠 Orange | Validation / Fallback (Plan Guard, Fallback Engine) |
| ⚫ Gray | Internal context builders |

---

## Demo seeds

| Event | Demo operands | Source |
|---|---|---|
| `PROBLEM_REQUESTED` | **8 + 5 = 13** | spec §6 |
| `TRANSFER_REQUESTED` | **9 + 4 = 13** | spec §13 |

Set `Demo Seed = OFF` on both `ArithLessonEngine` instances for random operands in production.

---

## DeepSeek agent settings (spec §9)

| Parameter | Value |
|---|---|
| Model | `deepseek-chat` |
| Temperature | `0.2` |
| Max tokens | `1600` |
| Seed (demo) | `42` |
| Output port | **Structured Response only** |
| Chat history messages | `0` |
| Tools | None (P0) |

---

## Response envelope (spec §15)

```json
{
  "schema_version": "1",
  "request_id": "...",
  "session_id": "...",
  "status": "OK | FALLBACK | ERROR",
  "source": "DETERMINISTIC | AI_VALIDATED",
  "event_type": "PROBLEM_PLAN | SUPPORT_PLAN | TRANSFER_PLAN | ERROR_RESPONSE",
  "payload": { "...plan fields..." }
}
```

---

## P0 acceptance criteria (spec §20)

- [ ] Single endpoint accepts all three v1 events.
- [ ] `PROBLEM_REQUESTED` and `TRANSFER_REQUESTED` make zero LLM calls.
- [ ] `SUPPORT_REQUESTED` calls at most one planner + one repair agent.
- [ ] Only Structured Response port wired on both agents.
- [ ] Agent cannot overwrite canonical problem fields.
- [ ] Every support plan passes Plan Guard before serialization.
- [ ] Every invalid path has a fallback.
- [ ] API returns pure JSON — no prose outside the envelope.
- [ ] Flow JSON exports without DeepSeek API key embedded.
