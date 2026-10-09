import type { ArithResponse } from './langflowClient';

export interface ArithResponseValidationContext {
  requestId: string;
  sessionId: string;
  eventType: 'PROBLEM_REQUESTED' | 'SUPPORT_REQUESTED' | 'TRANSFER_REQUESTED';
  expectedProblemId?: string;
  sourceProblemId?: string;
}

export function validateArithResponse(
  raw: unknown,
  context: ArithResponseValidationContext,
): ArithResponse;
