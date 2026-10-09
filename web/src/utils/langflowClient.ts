/**
 * langflowClient — API client for the Langflow teaching planner flow.
 *
 * Calls POST /api/v1/run/<flow_id> on the Langflow server.
 * The frontend sends domain events (PROBLEM_REQUESTED, SUPPORT_REQUESTED,
 * TRANSFER_REQUESTED) and gets back structured lesson plans.
 *
 * Config:
 *   VITE_LANGFLOW_BASE_URL  — Langflow server URL (default: http://localhost:7860)
 *   VITE_LANGFLOW_FLOW_ID   — Flow UUID (required, set after importing the flow)
 */

const BASE_URL = import.meta.env.VITE_LANGFLOW_BASE_URL || 'http://localhost:7860';
const FLOW_ID = import.meta.env.VITE_LANGFLOW_FLOW_ID || '';

// ─── Types ───

export interface LangflowRequest {
  schema_version: '1.0';
  request_id: string;
  session_id: string;
  event_type: 'PROBLEM_REQUESTED' | 'SUPPORT_REQUESTED' | 'TRANSFER_REQUESTED';
  payload: Record<string, unknown>;
}

export interface LangflowEnvelope {
  schema_version: string;
  request_id: string;
  session_id: string;
  status: 'OK' | 'FALLBACK' | 'ERROR';
  source: 'DETERMINISTIC' | 'AI_VALIDATED';
  event_type: string;
  payload: Record<string, unknown>;
}

export interface ProblemPlan {
  question: string;
  operands: number[];
  operator: string;
  answer: number;
  visual: 'blocks' | 'numberline';
  steps: Array<{
    action: 'show' | 'add' | 'remove' | 'prompt';
    count?: number;
    color?: string;
    say: string;
  }>;
  hints: string[];
}

export interface SupportRequestPayload {
  learner_context: {
    support_level: number;
    effective_visuals: string[];
    recent_observations: Array<{ code: string; scope: string }>;
    preferences: { tts_enabled: boolean; input_mode: 'BUTTONS_AND_TEXT'; pace: string };
  };
  client_capabilities: {
    plan_version: 1;
    visuals: string[];
    input_modes: string[];
    supported_actions: string[];
    tts_available: boolean;
    stt_available: boolean;
    reduced_motion: boolean;
  };
  payload: {
    problem: {
      problem_id: string;
      type: 'ARITHMETIC';
      concept: string;
      operation: 'ADDITION' | 'SUBTRACTION';
      operands: [number, number];
      correct_answer: number;
      display_text: string;
      number_range: { min: number; max: number };
    };
    attempt: {
      attempt_id: string;
      attempt_number: number;
      submitted_answer: number;
      input_mode: 'BUTTONS';
      confirmed: true;
      reasoning: {
        mode: 'TEXT' | 'SKIPPED';
        text: string | null;
        transcript: null;
        option_code: null;
        skipped: boolean;
      };
    };
    current_plan: { plan_id: string; plan_version: 1 };
  };
}

// ─── Helpers ───

let _requestCounter = 0;

function generateRequestId(): string {
  _requestCounter += 1;
  return `req-${Date.now()}-${_requestCounter}`;
}

function getSessionId(): string {
  let id = sessionStorage.getItem('arith_session_id');
  if (!id) {
    id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('arith_session_id', id);
  }
  return id;
}

// ─── Core fetch ───

async function callLangflow(request: LangflowRequest): Promise<LangflowEnvelope> {
  if (!FLOW_ID) {
    throw new Error(
      'VITE_LANGFLOW_FLOW_ID not set. Import the flow into Langflow, ' +
      'copy its UUID, and add VITE_LANGFLOW_FLOW_ID=<uuid> to web/.env'
    );
  }

  const url = `${BASE_URL}/api/v1/run/${FLOW_ID}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input_value: JSON.stringify(request),
      input_type: 'chat',
      output_type: 'chat',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Langflow ${res.status}: ${text}`);
  }

  const data = await res.json();

  // Langflow wraps output in outputs[0].outputs[0].results.message.text
  const rawText =
    data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text ??
    data?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message ??
    null;

  if (!rawText) {
    throw new Error('No message in Langflow response');
  }

  return JSON.parse(rawText) as LangflowEnvelope;
}

// ─── Public API ───

/**
 * Request a new problem from the Langflow teaching planner.
 * Returns a structured plan the QuestionScreen can render.
 */
export async function requestProblem(
  difficulty?: 'easy' | 'medium' | 'hard'
): Promise<ProblemPlan> {
  const envelope = await callLangflow({
    schema_version: '1.0',
    request_id: generateRequestId(),
    session_id: getSessionId(),
    event_type: 'PROBLEM_REQUESTED',
    payload: { difficulty: difficulty ?? 'easy' },
  });

  if (envelope.status === 'ERROR') {
    throw new Error(`Langflow error: ${JSON.stringify(envelope.payload)}`);
  }

  return envelope.payload as unknown as ProblemPlan;
}

/**
 * Request support/hint when a student is stuck.
 * Sends the current question context + attempt history to the AI planner.
 */
export async function requestSupport(context: {
  payload: SupportRequestPayload['payload'];
  learner_context: SupportRequestPayload['learner_context'];
  client_capabilities: SupportRequestPayload['client_capabilities'];
}): Promise<LangflowEnvelope> {
  return callLangflow({
    schema_version: '1.0',
    request_id: generateRequestId(),
    session_id: getSessionId(),
    event_type: 'SUPPORT_REQUESTED',
    ...context,
  });
}

/**
 * Request a transfer problem (same concept, different numbers).
 */
export async function requestTransfer(context: {
  original_question: string;
  original_answer: number;
  operator: string;
}): Promise<ProblemPlan> {
  const envelope = await callLangflow({
    schema_version: '1.0',
    request_id: generateRequestId(),
    session_id: getSessionId(),
    event_type: 'TRANSFER_REQUESTED',
    payload: context,
  });

  if (envelope.status === 'ERROR') {
    throw new Error(`Langflow error: ${JSON.stringify(envelope.payload)}`);
  }

  return envelope.payload as unknown as ProblemPlan;
}

/**
 * Check whether Langflow is reachable and configured.
 */
export async function checkLangflowHealth(): Promise<{
  ok: boolean;
  flowId: string;
  baseUrl: string;
  error?: string;
}> {
  const result = { ok: false, flowId: FLOW_ID, baseUrl: BASE_URL, error: '' };

  if (!FLOW_ID) {
    result.error = 'VITE_LANGFLOW_FLOW_ID not set';
    return result;
  }

  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    result.ok = res.ok;
    if (!res.ok) result.error = `HTTP ${res.status}`;
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }

  return result;
}

export default {
  requestProblem,
  requestSupport,
  requestTransfer,
  checkLangflowHealth,
};
