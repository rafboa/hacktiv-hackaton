const RESPONSE_TYPES = new Set(['PROBLEM_PLAN', 'SUPPORT_PLAN', 'TRANSFER_PLAN', 'ERROR']);
const STATUSES = new Set(['OK', 'FALLBACK', 'ERROR']);
const SOURCES = new Set(['AI_VALIDATED', 'DETERMINISTIC', 'LOCAL_FALLBACK']);
const EVENTS = {
  PROBLEM_REQUESTED: 'PROBLEM_PLAN',
  SUPPORT_REQUESTED: 'SUPPORT_PLAN',
  TRANSFER_REQUESTED: 'TRANSFER_PLAN',
};
const ACTIONS = new Set([
  'CLEAR_STAGE', 'SHOW_TEXT', 'SPEAK', 'SHOW_OBJECTS', 'ADD_OBJECTS',
  'REMOVE_OBJECTS', 'MOVE_OBJECTS', 'GROUP_TO_TEN', 'SHOW_NUMBER_LINE',
  'PLACE_MARKER', 'MOVE_MARKER', 'SHOW_EQUATION', 'HIGHLIGHT',
  'ASK_QUESTION', 'ASK_REASONING', 'SHOW_FEEDBACK',
]);
const REQUIRED_RESPONSE_FIELDS = [
  'schema_version', 'request_id', 'session_id', 'response_type', 'status',
  'source', 'problem_id', 'problem', 'inference', 'plan',
  'learning_state_patch', 'warnings', 'error',
];

function fail(message) {
  throw new Error(`MODEL_OUTPUT_INVALID: ${message}`);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') fail(`${name} must be a non-empty string`);
}

function validateProblem(problem, responseProblemId) {
  if (!isRecord(problem)) fail('problem must be an object for a successful response');
  for (const key of ['problem_id', 'type', 'concept', 'operation', 'display_text']) {
    requireNonEmptyString(problem[key], `problem.${key}`);
  }
  if (problem.type !== 'ARITHMETIC') fail('problem.type must be ARITHMETIC');
  if (!['ADDITION', 'SUBTRACTION'].includes(problem.operation)) fail('problem.operation is invalid');
  if (problem.problem_id !== responseProblemId) fail('problem_id does not match problem.problem_id');
  if (!Array.isArray(problem.operands) || problem.operands.length !== 2 ||
      !problem.operands.every(Number.isSafeInteger)) {
    fail('problem.operands must contain two integers');
  }
  if (!Number.isSafeInteger(problem.correct_answer)) fail('problem.correct_answer must be an integer');
  const [a, b] = problem.operands;
  const expectedAnswer = problem.operation === 'ADDITION' ? a + b : a - b;
  if (problem.correct_answer !== expectedAnswer) fail('problem.correct_answer does not match its operands');
  if (!Array.isArray(problem.accepted_answers) ||
      !problem.accepted_answers.every(Number.isSafeInteger) ||
      !problem.accepted_answers.includes(problem.correct_answer)) {
    fail('problem.accepted_answers must include correct_answer');
  }
  if (!isRecord(problem.number_range) ||
      !Number.isSafeInteger(problem.number_range.min) ||
      !Number.isSafeInteger(problem.number_range.max) ||
      problem.number_range.min > problem.number_range.max) {
    fail('problem.number_range is invalid');
  }
}

function validatePlan(plan) {
  if (!isRecord(plan)) fail('plan must be an object for a successful response');
  requireNonEmptyString(plan.plan_id, 'plan.plan_id');
  if (plan.plan_version !== 1) fail('plan.plan_version must be 1');
  requireNonEmptyString(plan.purpose, 'plan.purpose');
  requireNonEmptyString(plan.strategy, 'plan.strategy');
  if (!Number.isSafeInteger(plan.support_level) || plan.support_level < 0 || plan.support_level > 3) {
    fail('plan.support_level must be an integer from 0 to 3');
  }
  if (!['NORMAL', 'SLOW', 'FAST'].includes(plan.pace)) fail('plan.pace is invalid');
  if (!Array.isArray(plan.steps) || plan.steps.length < 1 || plan.steps.length > 12) {
    fail('plan.steps must contain 1 to 12 steps');
  }
  const stepIds = new Set();
  plan.steps.forEach((step, index) => {
    if (!isRecord(step)) fail(`plan.steps[${index}] must be an object`);
    requireNonEmptyString(step.step_id, `plan.steps[${index}].step_id`);
    if (stepIds.has(step.step_id)) fail('plan.steps contains duplicate step_id values');
    stepIds.add(step.step_id);
    if (!ACTIONS.has(step.action)) fail(`plan.steps[${index}].action is unknown`);
    if (!isRecord(step.params)) fail(`plan.steps[${index}].params must be an object`);
    if (!['ANIMATION', 'NARRATION', 'ANIMATION_AND_NARRATION', 'USER_INPUT'].includes(step.completion)) {
      fail(`plan.steps[${index}].completion is invalid`);
    }
    if (step.narration !== null) {
      if (!isRecord(step.narration) || typeof step.narration.text !== 'string' ||
          typeof step.narration.auto_play !== 'boolean' || typeof step.narration.can_repeat !== 'boolean') {
        fail(`plan.steps[${index}].narration is invalid`);
      }
      if (step.narration.text.length > 140) fail(`plan.steps[${index}].narration is too long`);
    }
  });
  const terminals = plan.steps.filter((step) => step.action === 'ASK_QUESTION' || step.action === 'ASK_REASONING');
  if (terminals.length !== 1 || plan.steps[plan.steps.length - 1] !== terminals[0]) {
    fail('plan must end with exactly one terminal question');
  }
}

function validateInference(inference) {
  if (inference === null) return;
  if (!isRecord(inference)) fail('inference must be an object or null');
  requireNonEmptyString(inference.hypothesis_code, 'inference.hypothesis_code');
  requireNonEmptyString(inference.strategy_code, 'inference.strategy_code');
  if (!['LOW', 'MEDIUM', 'HIGH'].includes(inference.confidence)) fail('inference.confidence is invalid');
  if (typeof inference.evidence_summary !== 'string' || inference.evidence_summary.length > 500) {
    fail('inference.evidence_summary is invalid');
  }
}

function validateLearningStatePatch(patch) {
  if (!isRecord(patch)) fail('learning_state_patch must be an object for a successful response');
  if (!Number.isSafeInteger(patch.support_level) || patch.support_level < 0 || patch.support_level > 3) {
    fail('learning_state_patch.support_level is invalid');
  }
  if (!Array.isArray(patch.observations_to_append) || !Array.isArray(patch.effective_visuals_to_add)) {
    fail('learning_state_patch arrays are missing');
  }
}

export function validateArithResponse(raw, context) {
  if (!isRecord(raw)) fail('response must be a JSON object');
  for (const key of REQUIRED_RESPONSE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) fail(`response is missing '${key}'`);
  }
  if (raw.schema_version !== '1.0') throw new Error(`UNSUPPORTED_SCHEMA: schema_version=${raw.schema_version}`);
  requireNonEmptyString(raw.request_id, 'request_id');
  requireNonEmptyString(raw.session_id, 'session_id');
  if (raw.request_id !== context.requestId || raw.session_id !== context.sessionId) {
    throw new Error('STALE_RESPONSE');
  }
  if (!RESPONSE_TYPES.has(raw.response_type)) fail('response_type is invalid');
  if (!STATUSES.has(raw.status)) fail('status is invalid');
  if (!SOURCES.has(raw.source)) fail('source is invalid');
  if (typeof raw.problem_id !== 'string') fail('problem_id must be a string');
  if (!Array.isArray(raw.warnings) || !raw.warnings.every((item) => typeof item === 'string')) {
    fail('warnings must be an array of strings');
  }

  if (raw.status === 'ERROR') {
    if (raw.response_type !== 'ERROR') fail('error response_type must be ERROR');
    if (raw.problem !== null || raw.inference !== null || raw.plan !== null ||
        raw.learning_state_patch !== null) {
      fail('error response plan fields must be null');
    }
    if (!isRecord(raw.error) || typeof raw.error.code !== 'string' ||
        typeof raw.error.recoverable !== 'boolean' || typeof raw.error.user_message !== 'string') {
      fail('error object is invalid');
    }
    return raw;
  }

  if (raw.response_type !== EVENTS[context.eventType]) {
    fail(`response_type does not match ${context.eventType}`);
  }
  if (raw.error !== null) fail('successful response error must be null');
  validateProblem(raw.problem, raw.problem_id);
  validateInference(raw.inference);
  validatePlan(raw.plan);
  validateLearningStatePatch(raw.learning_state_patch);

  if (context.expectedProblemId && raw.problem_id !== context.expectedProblemId) {
    throw new Error('STALE_RESPONSE');
  }
  if (context.sourceProblemId && raw.problem_id === context.sourceProblemId) {
    fail('transfer response reused the source problem_id');
  }
  return raw;
}
