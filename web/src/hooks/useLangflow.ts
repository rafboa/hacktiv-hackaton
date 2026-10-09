import { useState, useCallback, useEffect } from 'react';
import {
  requestProblem,
  requestSupport,
  requestTransfer,
  checkLangflowHealth,
  type ArithResponse,
  type SupportRequestPayload,
  type TransferRequestPayload,
  type LearnerContext,
} from '../utils/langflowClient';

/**
 * useLangflow — React hook for the Arith teaching planner.
 *
 * Falls back gracefully when Langflow is unreachable or
 * VITE_LANGFLOW_FLOW_ID is not configured.
 *
 * All public methods return null on any error (caller supplies fallback).
 */
export default function useLangflow() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkLangflowHealth().then((h) => {
      setConnected(h.ok);
      if (!h.ok) {
        console.warn(`Langflow not available: ${h.error}. Using local fallback.`);
      }
    });
  }, []);

  const fetchProblem = useCallback(
    async (options?: {
      purpose?: 'INITIAL' | 'NEXT' | 'SIMPLIFIED';
      learnerContext?: Partial<LearnerContext>;
    }): Promise<ArithResponse | null> => {
      if (!connected) return null;
      setLoading(true);
      setError(null);
      try {
        return await requestProblem(options);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg !== 'STALE_RESPONSE') {
          setError(msg);
          console.error('Langflow requestProblem failed:', msg);
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [connected]
  );

  const fetchSupport = useCallback(
    async (
      payload: SupportRequestPayload,
      learnerContext?: Partial<LearnerContext>
    ): Promise<ArithResponse | null> => {
      if (!connected) return null;
      setLoading(true);
      setError(null);
      try {
        return await requestSupport(payload, learnerContext);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg !== 'STALE_RESPONSE') {
          setError(msg);
          console.error('Langflow requestSupport failed:', msg);
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [connected]
  );

  const fetchTransfer = useCallback(
    async (
      payload: TransferRequestPayload,
      learnerContext?: Partial<LearnerContext>
    ): Promise<ArithResponse | null> => {
      if (!connected) return null;
      setLoading(true);
      setError(null);
      try {
        return await requestTransfer(payload, learnerContext);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg !== 'STALE_RESPONSE') {
          setError(msg);
          console.error('Langflow requestTransfer failed:', msg);
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [connected]
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
