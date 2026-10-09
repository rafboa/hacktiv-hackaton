import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateArithResponse } from '../src/utils/arithResponseValidation.mjs';

const context = {
  requestId: 'req-1',
  sessionId: 'ses-1',
  eventType: 'PROBLEM_REQUESTED',
};

function validResponse(overrides = {}) {
  return {
    schema_version: '1.0',
    request_id: 'req-1',
    session_id: 'ses-1',
    response_type: 'PROBLEM_PLAN',
    status: 'OK',
    source: 'DETERMINISTIC',
    problem_id: 'p1',
    problem: {
      problem_id: 'p1', type: 'ARITHMETIC', concept: 'ADDITION_CROSSING_TEN',
      operation: 'ADDITION', operands: [8, 5], correct_answer: 13,
      accepted_answers: [13], display_text: '8 + 5 = ?', number_range: { min: 0, max: 20 },
    },
    inference: null,
    plan: {
      plan_id: 'plan-1', plan_version: 1, purpose: 'PRESENT_PROBLEM',
      strategy: 'NUMBER_LINE_COUNT_ON', support_level: 0, pace: 'NORMAL',
      steps: [{
        step_id: 'step-1', action: 'ASK_QUESTION', params: { prompt: 'Berapa?' },
        narration: null, completion: 'USER_INPUT',
      }],
    },
    learning_state_patch: { support_level: 0, observations_to_append: [], effective_visuals_to_add: [] },
    warnings: [],
    error: null,
    ...overrides,
  };
}

test('accepts a complete response whose request/session echoes match', () => {
  assert.equal(validateArithResponse(validResponse(), context).problem_id, 'p1');
});

test('rejects a response with a mismatched request or session echo as stale', () => {
  assert.throws(() => validateArithResponse(validResponse({ request_id: 'old' }), context), /STALE_RESPONSE/);
  assert.throws(() => validateArithResponse(validResponse({ session_id: 'other' }), context), /STALE_RESPONSE/);
});

test('rejects missing contract fields and an incomplete success plan', () => {
  const missing = validResponse();
  delete missing.learning_state_patch;
  assert.throws(() => validateArithResponse(missing, context), /learning_state_patch/);
  assert.throws(() => validateArithResponse(validResponse({ plan: {} }), context), /plan_id/);
});

test('rejects a support response for a different active problem', () => {
  const supportContext = { ...context, eventType: 'SUPPORT_REQUESTED', expectedProblemId: 'active-problem' };
  assert.throws(
    () => validateArithResponse(validResponse({ response_type: 'SUPPORT_PLAN' }), supportContext),
    /STALE_RESPONSE/,
  );
});

test('accepts a well-formed structured error response', () => {
  const response = {
    schema_version: '1.0', request_id: 'req-1', session_id: 'ses-1',
    response_type: 'ERROR', status: 'ERROR', source: 'DETERMINISTIC',
    problem_id: '', problem: null, inference: null, plan: null,
    learning_state_patch: null, warnings: [],
    error: { code: 'NO_VALID_PLAN', recoverable: true, user_message: 'Coba lagi.' },
  };
  assert.equal(validateArithResponse(response, context).status, 'ERROR');
});

test('flow explicitly selects deterministic and AI guard modes and disables fixed demo seeds', () => {
  const flowPath = new URL('../../langflow/flow/arith-teaching-planner.json', import.meta.url);
  const flow = JSON.parse(readFileSync(flowPath, 'utf8'));
  const nodes = new Map(flow.data.nodes.map((node) => [node.id, node]));
  assert.equal(nodes.get('plan_guard_problem').template.validation_mode.value, 'PROBLEM');
  assert.equal(nodes.get('plan_guard_transfer').template.validation_mode.value, 'PROBLEM');
  assert.equal(nodes.get('plan_guard_pass1').template.validation_mode.value, 'AI_PLAN');
  assert.equal(nodes.get('plan_guard_pass2').template.validation_mode.value, 'AI_PLAN');
  assert.equal(nodes.get('lesson_engine_initial').template.demo_seed.value, 'OFF');
  assert.equal(nodes.get('lesson_engine_transfer').template.demo_seed.value, 'OFF');
});
