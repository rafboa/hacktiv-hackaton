# AI Backend Shift & Next Steps

## 1. Resolved issues in current session

We successfully generated a Langflow graph (`arith-teaching-planner`) that is **fully renderable in the Langflow UI** without errors.

To achieve this:
1. **Node Schema Validation:** The `setup_langflow.py` script was completely rewritten. Instead of assembling a simplified "flat" JSON that Langflow cannot render, the script now:
   - Compiles our 6 Python custom components via `POST /api/v1/custom_component` to get the exact React Flow schemas Langflow needs.
   - Fetches the built-in node schemas (ChatInput, ChatOutput, Agent) from Langflow's `POST /api/v1/all` component catalog.
2. **Wiring and Edge Types:**
   - Edges are now encoded in the specific JSON-stringified format Langflow's frontend requires (handling type mapping for nodes like `Agent`).
   - Mismatched datatypes on the Agent node were fixed: `SupportContextBuilder` now correctly returns a `Message` (not a `Data` object) so it can connect to `Teaching Planner Agent.input_value`.
3. **Canvas visibility:**
   - Routers (`ArithRequestGateway` and `ArithPlanGuard`) now use `group_outputs=True` so all conditional branches (e.g. `PROBLEM_REQUESTED`, `SUPPORT_REQUESTED`, etc.) are visible at once on the canvas without needing manual dropdown selection.

## 2. API Key blocker

The flow graph successfully imports and starts to run, but fails with `HTTP 500` because the LLM node (`DeepSeek`) **does not have an API key**. (Note: Langflow evaluates the graph eagerly, meaning it tries to initialize the LLM node even for deterministic paths like `PROBLEM_REQUESTED` that don't actually trigger it).

**Decision:** We are pivoting the tech stack from **DeepSeek to Google Gemini**.

## 3. Next Steps (for the next session)

Since the user does not have a DeepSeek API key, the next session must swap the LLM node in the flow to Gemini.

### Task 1: Update the Flow Definition
1. Edit `langflow/flow/arith-teaching-planner.json`:
   - Find the node with `"id": "deepseek_lm"` and `"type": "DeepSeekModel"`.
   - Change its ID and type to a Gemini node. (The Langflow component name is typically `"GoogleGenerativeAIModel"` or `"ext:google:GoogleGenerativeAIModel"`).
   - Update its template fields to use `model_name = "gemini-3.6-flash"`.
   - Make sure its output name (`model_output` or similar) matches what the `Agent` node expects.
2. Update `langflow/setup_langflow.py`:
   - In the `BUILTIN_TYPES` map, change the `DeepSeekModel` entry to point to the correct Gemini component string from the Langflow catalog.
   - Update `HANDLE_ALIASES` if Gemini's output handle name differs.

### Task 2: Configure the API Key
1. The user will need a Gemini API key.
2. Store it securely in a Langflow Global Variable (or via `GOOGLE_API_KEY` in the environment) so the flow can execute.

### Task 3: Test the API Pipeline
1. Run `python scratch/run_flow_test.py <FLOW_ID>` to verify that `PROBLEM_REQUESTED` returns a valid JSON envelope.
2. Restart the Vite dev server (`npx vite`).
3. Connect the frontend: In `web/src/App.tsx` and `QuestionScreen.tsx`, replace the hardcoded `sampleQuestions` logic with calls to `useLangflow().fetchProblem()`.
