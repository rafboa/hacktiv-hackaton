/**
 * langflowClient — API adapter for the Arith teaching planner flow.
 *
 * Sends Arith domain events (PROBLEM_REQUESTED, SUPPORT_REQUESTED,
 * TRANSFER_REQUESTED) to Langflow and returns validated domain responses.
 *
 * Contract: contracts/arith-json-contract-v1.md
 *
 * Config (web/.env):
 *   VITE_LANGFLOW_BASE_URL  — Langflow server URL (default: http://localhost:7860)
 *   VITE_LANGFLOW_FLOW_ID   — Flow UUID (required; copy after importing the flow)
 */

import { validateArithResponse } from './arithResponseValidation.mjs';
import { DEMO_SCENARIO_ID, isDemoMode } from './demoMode';

const BASE_URL = import.meta.env.VITE_LANGFLOW_BASE_URL || 'http://localhost:7860';
const FLOW_ID = import.meta.env.VITE_LANGFLOW_FLOW_ID || '';

/** Maximum ms to wait for a Langflow response (contract §16). */
const REQUEST_TIMEOUT_MS = 8_000;

// ─── v1 Action types (contract §14) ───────────────────────────────────────

export type V1Action =
  | 'CLEAR_STAGE'
  | 'SHOW_TEXT'
  | 'SPEAK'
  | 'SHOW_OBJECTS'
  | 'ADD_OBJECTS'
  | 'REMOVE_OBJECTS'
  | 'MOVE_OBJECTS'
  | 'GROUP_TO_TEN'
  | 'SHOW_NUMBER_LINE'
  | 'PLACE_MARKER'
  | 'MOVE_MARKER'
  | 'SHOW_EQUATION'
  | 'HIGHLIGHT'
  | 'ASK_QUESTION'
  | 'ASK_REASONING'
  | 'SHOW_FEEDBACK';

export interface PlanStep {
  step_id: string;
  action: V1Action;
  params: Record<string, unknown>;
  narration: { text: string; auto_play: boolean; can_repeat: boolean } | null;
  completion: 'ANIMATION' | 'NARRATION' | 'ANIMATION_AND_NARRATION' | 'USER_INPUT';
}

// ─── Domain response types (contract §9–§13) ──────────────────────────────

export interface ArithProblem {
  problem_id: string;
  type: 'ARITHMETIC';
  concept: string;
  operation: 'ADDITION' | 'SUBTRACTION';
  operands: [number, number];
  correct_answer: number;
  accepted_answers: number[];
  display_text: string;
  number_range: { min: number; max: number };
}

export interface ArithPlan {
  plan_id: string;
  plan_version: 1;
  purpose: string;
  strategy: string;
  support_level: number;
  pace: 'NORMAL' | 'SLOW' | 'FAST';
  steps: PlanStep[];
}

export interface ArithInference {
  hypothesis_code: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence_summary: string;
  strategy_code: string;
}

export interface LearningStatePatch {
  support_level: number;
  observations_to_append: Array<{ code: string; scope: string }>;
  effective_visuals_to_add: string[];
}

export interface ArithError {
  code: string;
  recoverable: boolean;
  user_message: string;
}

/** Full v1 domain response (contract §9). */
export interface ArithResponse {
  schema_version: string;
  request_id: string;
  session_id: string;
  response_type: 'PROBLEM_PLAN' | 'SUPPORT_PLAN' | 'TRANSFER_PLAN' | 'ERROR';
  status: 'OK' | 'FALLBACK' | 'ERROR';
  source: 'AI_VALIDATED' | 'DETERMINISTIC' | 'LOCAL_FALLBACK';
  problem_id: string;
  problem: ArithProblem | null;
  inference: ArithInference | null;
  plan: ArithPlan | null;
  learning_state_patch: LearningStatePatch | null;
  warnings: string[];
  error: ArithError | null;
}

// ─── Request payload types (contract §6–§8) ───────────────────────────────

export interface ClientCapabilities {
  plan_version: 1;
  visuals: string[];
  input_modes: string[];
  supported_actions: V1Action[];
  tts_available: boolean;
  stt_available: boolean;
  reduced_motion: boolean;
}

export const DEFAULT_CAPABILITIES: ClientCapabilities = {
  plan_version: 1,
  visuals: ['BLOCKS', 'NUMBER_LINE', 'EQUATION'],
  input_modes: ['BUTTONS', 'TEXT'],
  supported_actions: [
    'CLEAR_STAGE', 'SHOW_TEXT', 'SPEAK', 'SHOW_OBJECTS', 'ADD_OBJECTS', 'REMOVE_OBJECTS',
    'MOVE_OBJECTS', 'GROUP_TO_TEN', 'SHOW_NUMBER_LINE', 'PLACE_MARKER', 'MOVE_MARKER',
    'SHOW_EQUATION', 'HIGHLIGHT', 'ASK_QUESTION', 'ASK_REASONING', 'SHOW_FEEDBACK',
  ],
  tts_available: true,
  stt_available: false,
  reduced_motion: false,
};

export interface LearnerContext {
  support_level: number;
  effective_visuals: string[];
  recent_observations: Array<{ code: string; scope: string }>;
  preferences: { tts_enabled: boolean; input_mode: 'BUTTONS_AND_TEXT'; pace: string };
}

export const DEFAULT_LEARNER_CONTEXT: LearnerContext = {
  support_level: 0,
  effective_visuals: [],
  recent_observations: [],
  preferences: { tts_enabled: true, input_mode: 'BUTTONS_AND_TEXT', pace: 'NORMAL' },
};

/** Payload for PROBLEM_REQUESTED (contract §6). */
export interface ProblemRequestPayload {
  purpose: 'INITIAL' | 'NEXT' | 'SIMPLIFIED';
  concept: string;
  operation: 'ADDITION' | 'SUBTRACTION';
  number_range: { min: number; max: number };
  difficulty: 'FOUNDATION';
  exclude_problem_ids: string[];
}

/** Payload for TRANSFER_REQUESTED (contract §8). */
export interface TransferRequestPayload {
  purpose: 'TRANSFER';
  concept: string;
  operation: 'ADDITION' | 'SUBTRACTION';
  source_problem_id: string;
  avoid_same_operands: boolean;
  target_difficulty: 'SAME_CONCEPT';
  number_range: { min: number; max: number };
  previous_observation?: {
    hypothesis_code: string;
    strategy_used: string;
    support_level_used: number;
    guided_step_correct: boolean;
  };
}

/** Payload for SUPPORT_REQUESTED (contract §7). */
export interface SupportRequestPayload {
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
      mode: 'TEXT' | 'VOICE' | 'OPTION' | 'SKIPPED';
      text: string | null;
      transcript: null;
      option_code: null;
      skipped: boolean;
    };
  };
  current_plan: { plan_id: string; plan_version: 1 };
}

// ─── Domain request envelope (contract §5) ────────────────────────────────

interface DomainRequest {
  schema_version: '1.0';
  request_id: string;
  session_id: string;
  event_type: 'PROBLEM_REQUESTED' | 'SUPPORT_REQUESTED' | 'TRANSFER_REQUESTED';
  sent_at: string;
  demo_mode?: { enabled: boolean; scenario_id: string };
  client_capabilities: ClientCapabilities;
  learner_context: LearnerContext;
  payload: Record<string, unknown>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

let _requestCounter = 0;

export function generateRequestId(): string {
  _requestCounter += 1;
  return `req-${Date.now()}-${_requestCounter}`;
}

export function getSessionId(): string {
  let id = sessionStorage.getItem('arith_session_id');
  if (!id) {
    id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('arith_session_id', id);
  }
  return id;
}

// ─── Core fetch with timeout (contract §16) ───────────────────────────────

async function callLangflow(request: DomainRequest): Promise<ArithResponse> {
  if (!FLOW_ID) {
    throw new Error(
      'VITE_LANGFLOW_FLOW_ID not set. Import the flow into Langflow, ' +
      'copy its UUID, and add VITE_LANGFLOW_FLOW_ID=<uuid> to web/.env'
    );
  }

  const url = `${BASE_URL}/api/v1/run/${FLOW_ID}`;
  // Keep abort controller alive for the full operation including body read (contract §16).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          input_value: JSON.stringify(request),
          input_type: 'chat',
          output_type: 'chat',
          session_id: request.session_id,
        }),
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new Error('MODEL_TIMEOUT');
      throw new Error('NETWORK_ERROR');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Langflow HTTP ${res.status}: ${text}`);
    }

    // Body read is also covered by the abort signal (contract §16 — 8s total).
    let data: unknown;
    try {
      data = await res.json();
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new Error('MODEL_TIMEOUT');
      throw new Error('MODEL_OUTPUT_INVALID: could not parse response body as JSON');
    }

    // Extract text from Langflow output envelope (contract §2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any;
    const rawText: string | null =
      d?.outputs?.[0]?.outputs?.[0]?.results?.message?.text ??
      d?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message ??
      null;

    if (!rawText) throw new Error('No message text in Langflow response');

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error('MODEL_OUTPUT_INVALID: response is not valid JSON');
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('MODEL_OUTPUT_INVALID: response is not a JSON object');
    }

    const supportProblem = request.payload.problem as { problem_id?: string } | undefined;
    const sourceProblemId = request.payload.source_problem_id;
    return validateArithResponse(parsed, {
      requestId: request.request_id,
      sessionId: request.session_id,
      eventType: request.event_type,
      expectedProblemId: request.event_type === 'SUPPORT_REQUESTED'
        ? supportProblem?.problem_id
        : undefined,
      sourceProblemId: request.event_type === 'TRANSFER_REQUESTED' && typeof sourceProblemId === 'string'
        ? sourceProblemId
        : undefined,
    });

  } finally {
    clearTimeout(timer);
  }
}

// ─── Staleness guard (contract §17) ───────────────────────────────────────

/** Track the most recently sent request_id per event_type. */
const _latestRequestId: Partial<Record<DomainRequest['event_type'], string>> = {};

function isStale(eventType: DomainRequest['event_type'], requestId: string): boolean {
  return _latestRequestId[eventType] !== requestId;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Request a new problem from the Langflow teaching planner (contract §6).
 * Returns the validated ArithResponse on success.
 */
export async function requestProblem(options?: {
  purpose?: 'INITIAL' | 'NEXT' | 'SIMPLIFIED';
  learnerContext?: Partial<LearnerContext>;
}): Promise<ArithResponse> {
  const requestId = generateRequestId();
  _latestRequestId['PROBLEM_REQUESTED'] = requestId;

  const payload: ProblemRequestPayload = {
    purpose: options?.purpose ?? 'INITIAL',
    concept: 'ADDITION_CROSSING_TEN',
    operation: 'ADDITION',
    number_range: { min: 0, max: 20 },
    difficulty: 'FOUNDATION',
    exclude_problem_ids: [],
  };

  const request: DomainRequest = {
    schema_version: '1.0',
    request_id: requestId,
    session_id: getSessionId(),
    event_type: 'PROBLEM_REQUESTED',
    sent_at: new Date().toISOString(),
    ...(isDemoMode() ? { demo_mode: { enabled: true, scenario_id: DEMO_SCENARIO_ID } } : {}),
    client_capabilities: DEFAULT_CAPABILITIES,
    learner_context: { ...DEFAULT_LEARNER_CONTEXT, ...(options?.learnerContext ?? {}) },
    payload: payload as unknown as Record<string, unknown>,
  };

  const response = await callLangflow(request);

  // Discard stale responses (contract §17)
  if (isStale('PROBLEM_REQUESTED', requestId)) {
    throw new Error('STALE_RESPONSE');
  }

  if (response.status === 'ERROR') {
    throw new Error(`Langflow error: ${response.error?.code ?? 'UNKNOWN'}`);
  }

  return response;
}

/**
 * Request support/hint when a student answers incorrectly (contract §7).
 */
export async function requestSupport(
  payload: SupportRequestPayload,
  learnerContext?: Partial<LearnerContext>
): Promise<ArithResponse> {
  const requestId = generateRequestId();
  _latestRequestId['SUPPORT_REQUESTED'] = requestId;

  const request: DomainRequest = {
    schema_version: '1.0',
    request_id: requestId,
    session_id: getSessionId(),
    event_type: 'SUPPORT_REQUESTED',
    sent_at: new Date().toISOString(),
    ...(isDemoMode() ? { demo_mode: { enabled: true, scenario_id: DEMO_SCENARIO_ID } } : {}),
    client_capabilities: DEFAULT_CAPABILITIES,
    learner_context: {
      ...DEFAULT_LEARNER_CONTEXT,
      support_level: learnerContext?.support_level ?? 1,
      ...(learnerContext ?? {}),
    },
    payload: payload as unknown as Record<string, unknown>,
  };

  const response = await callLangflow(request);

  if (isStale('SUPPORT_REQUESTED', requestId)) {
    throw new Error('STALE_RESPONSE');
  }

  return response;
}

/**
 * Request a transfer problem (contract §8).
 */
export async function requestTransfer(
  payload: TransferRequestPayload,
  learnerContext?: Partial<LearnerContext>
): Promise<ArithResponse> {
  const requestId = generateRequestId();
  _latestRequestId['TRANSFER_REQUESTED'] = requestId;

  const request: DomainRequest = {
    schema_version: '1.0',
    request_id: requestId,
    session_id: getSessionId(),
    event_type: 'TRANSFER_REQUESTED',
    sent_at: new Date().toISOString(),
    ...(isDemoMode() ? { demo_mode: { enabled: true, scenario_id: DEMO_SCENARIO_ID } } : {}),
    client_capabilities: DEFAULT_CAPABILITIES,
    learner_context: { ...DEFAULT_LEARNER_CONTEXT, ...(learnerContext ?? {}) },
    payload: payload as unknown as Record<string, unknown>,
  };

  const response = await callLangflow(request);

  if (isStale('TRANSFER_REQUESTED', requestId)) {
    throw new Error('STALE_RESPONSE');
  }

  if (response.status === 'ERROR') {
    throw new Error(`Langflow transfer error: ${response.error?.code ?? 'UNKNOWN'}`);
  }

  return response;
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
  generateRequestId,
  getSessionId,
};
