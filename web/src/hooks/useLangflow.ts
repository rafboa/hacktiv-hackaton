import { useState, useCallback, useEffect } from 'react';
import {
  requestProblem,
  requestSupport,
  requestTransfer,
  checkLangflowHealth,
  type ProblemPlan,
  type LangflowEnvelope,
} from '../utils/langflowClient';
import type { Question } from '../utils/sampleQuestions';

/**
 * useLangflow — React hook for AI-powered question generation via Langflow.
 *
 * Falls back to local sampleQuestions when Langflow is unreachable or
 * VITE_LANGFLOW_FLOW_ID is not configured.
 */
export default function useLangflow() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkLangflowHealth().then((h) => {
      setConnected(h.ok);
      if (!h.ok) {
        console.warn(`Langflow not available: ${h.error}. Using local questions.`);
      }
    });
  }, []);

  /**
   * Convert a Langflow ProblemPlan into the Question format the UI expects.
   */
  const planToQuestion = useCallback((plan: ProblemPlan): Question => {
    return {
      type: 'math_steps',
      visual: plan.visual || 'blocks',
      question: plan.question,
      steps: plan.steps,
      answer: plan.answer,
      hints: plan.hints || ['Coba lagi!', 'Perhatikan baloknya', `Jawabannya adalah ${plan.answer}`],
    };
  }, []);

  const fetchProblem = useCallback(
    async (difficulty?: 'easy' | 'medium' | 'hard'): Promise<Question | null> => {
      if (!connected) return null;
      setLoading(true);
      setError(null);
      try {
        const plan = await requestProblem(difficulty);
        return planToQuestion(plan);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        console.error('Langflow requestProblem failed:', msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [connected, planToQuestion]
  );

  const fetchSupport = useCallback(
    async (context: {
      payload: Parameters<typeof requestSupport>[0]['payload'];
      learner_context: Parameters<typeof requestSupport>[0]['learner_context'];
      client_capabilities: Parameters<typeof requestSupport>[0]['client_capabilities'];
    }): Promise<LangflowEnvelope | null> => {
      if (!connected) return null;
      setLoading(true);
      setError(null);
      try {
        return await requestSupport(context);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [connected]
  );

  const fetchTransfer = useCallback(
    async (context: {
      original_question: string;
      original_answer: number;
      operator: string;
    }): Promise<Question | null> => {
      if (!connected) return null;
      setLoading(true);
      setError(null);
      try {
        const plan = await requestTransfer(context);
        return planToQuestion(plan);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [connected, planToQuestion]
  );

  return {
    connected,
    loading,
    error,
    fetchProblem,
    fetchSupport,
    fetchTransfer,
  };
}
