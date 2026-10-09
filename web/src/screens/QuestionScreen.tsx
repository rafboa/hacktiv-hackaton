import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CornerBar from '../components/CornerBar';
import BlockCube from '../components/BlockCube';
import NumberLine from '../components/NumberLine';
import NumberPad from '../components/NumberPad';
import Mascot from '../components/Mascot';
import SpeechBubble from '../components/SpeechBubble';
import HintCard from '../components/HintCard';
import ReasoningInput from '../components/ReasoningInput';
import FeedbackOverlay from './FeedbackOverlay';
import useTTS from '../hooks/useTTS';
import useLangflow from '../hooks/useLangflow';
import { bouncy } from '../utils/springs';
import type { Question } from '../utils/sampleQuestions';
import type { MascotState } from '../components/Mascot';
import type {
  ArithResponse,
  ArithPlan,
  PlanStep,
  SupportRequestPayload,
} from '../utils/langflowClient';
import { isDemoMode } from '../utils/demoMode';

// ─── Types ────────────────────────────────────────────────────────────────

type Phase =
  | 'loading'
  | 'intro'
  | 'stepping'
  | 'answering'
  | 'askingReasoning'
  | 'loadingSupport'
  | 'feedback';

interface QuestionResult {
  questionIndex: number;
  correct: boolean;
  attempts: number;
  hintsUsed: number;
  problemKind: 'REGULAR' | 'TRANSFER';
}

interface VisibleBlock {
  groupId: string;
  count: number;
  color: string;
  role: string;
}

interface Jump {
  start: number;
  end: number;
}

/** Active problem derived from a Langflow response or sampleQuestions fallback. */
interface ActiveProblem {
  problem_id: string;
  display_text: string;
  operands: [number, number];
  operation: 'ADDITION' | 'SUBTRACTION';
  correct_answer: number;
  accepted_answers: number[];
  concept: string;
  plan: ArithPlan | null;
  /** Hints from local fallback */
  hints: string[];
  /** Current plan_id for SUPPORT_REQUESTED */
  current_plan_id: string;
}

interface QuestionScreenProps {
  playerName: string;
  questions: Question[];          // local fallback list
  onFinish: (results: QuestionResult[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Convert a local Question to ActiveProblem (fallback path). */
function localQuestionToActiveProblem(q: Question, index: number): ActiveProblem {
  const match = q.question.match(/(-?\d+)\s*([+-])\s*(-?\d+)/);
  const a = match ? Number(match[1]) : 0;
  const b = match ? Number(match[3]) : 0;
  const op: 'ADDITION' | 'SUBTRACTION' = match?.[2] === '-' ? 'SUBTRACTION' : 'ADDITION';
  return {
    problem_id: `local_${index}`,
    display_text: q.question,
    operands: [a, b],
    operation: op,
    correct_answer: q.answer,
    accepted_answers: [q.answer],
    concept: op === 'ADDITION' ? 'ADDITION_CROSSING_TEN' : 'SUBTRACTION_WITHIN_20',
    plan: null,
    hints: q.hints ?? [],
    current_plan_id: `plan_local_${index}`,
  };
}

function localDemoProblem(kind: ProblemKind): ActiveProblem {
  const [a, b] = kind === 'TRANSFER' ? [9, 4] : [8, 5];
  return {
    problem_id: `demo_local_${a}_plus_${b}`,
    display_text: `${a} + ${b} = ?`,
    operands: [a, b],
    operation: 'ADDITION',
    correct_answer: a + b,
    accepted_answers: [a + b],
    concept: 'ADDITION_CROSSING_TEN',
    plan: null,
    hints: ['Mulai dari 8, lalu maju lima lompatan pada garis bilangan.'],
    current_plan_id: `demo_local_plan_${a}_plus_${b}`,
  };
}

/** Convert a Langflow response to ActiveProblem. */
function responseToActiveProblem(resp: ArithResponse): ActiveProblem | null {
  if (!resp.problem || !resp.plan) return null;
  const { problem, plan } = resp;
  return {
    problem_id: problem.problem_id,
    display_text: problem.display_text,
    operands: problem.operands,
    operation: problem.operation,
    correct_answer: problem.correct_answer,
    accepted_answers: problem.accepted_answers,
    concept: problem.concept,
    plan,
    hints: [],
    current_plan_id: plan.plan_id,
  };
}

/** Extract the first ASK_QUESTION prompt from a support plan. */
function extractSupportNarration(response: ArithResponse | null): string | null {
  if (!response || response.status === 'ERROR' || !response.plan) return null;
  const steps = response.plan.steps ?? [];
  const texts: string[] = [];
  for (const step of steps) {
    const t = step.narration?.text ?? (step.params?.prompt as string | undefined);
    if (t) texts.push(t);
  }
  return texts.length ? texts.join(' ') : null;
}

// ─── Plan-step executor state machine ─────────────────────────────────────

interface StageState {
  numberLineStart: number | null;
  numberLineJumps: Jump[];
  visibleBlocks: VisibleBlock[];
  removedCount: number;
  equation: string | null;
  text: string | null;
  emphasis: string[];
  feedback: string | null;
  highlightTarget: string | null;
}

type ProblemKind = 'REGULAR' | 'TRANSFER';

interface SupportObservation {
  hypothesis_code: string;
  strategy_used: string;
  support_level_used: number;
}

function emptyStage(): StageState {
  return {
    numberLineStart: null,
    numberLineJumps: [],
    visibleBlocks: [],
    removedCount: 0,
    equation: null,
    text: null,
    emphasis: [],
    feedback: null,
    highlightTarget: null,
  };
}

function colorForRole(role: unknown): string {
  switch (role) {
    case 'ADDED': return 'orange';
    case 'REMOVED': return 'red';
    case 'HIGHLIGHT': return 'yellow';
    default: return 'blue';
  }
}

function renderEmphasized(text: string, terms: string[]): React.ReactNode {
  if (!terms.length) return text;
  return text.split(/(\d+)/).map((part, index) => (
    terms.includes(part)
      ? <mark key={`${part}-${index}`} className="rounded bg-[#FFF1A8] px-1 text-inherit">{part}</mark>
      : part
  ));
}

function applyStep(state: StageState, step: PlanStep): StageState {
  const next = { ...state };
  const p = step.params;

  switch (step.action) {
    case 'CLEAR_STAGE': {
      const targets = Array.isArray(p.targets) ? p.targets as string[] : ['ALL'];
      if (targets.includes('ALL')) return emptyStage();
      return {
        ...next,
        numberLineStart: targets.includes('NUMBER_LINE') ? null : next.numberLineStart,
        numberLineJumps: targets.includes('NUMBER_LINE') ? [] : next.numberLineJumps,
        visibleBlocks: next.visibleBlocks.filter((block) => !targets.includes(block.groupId)),
        equation: targets.includes('EQUATION') ? null : next.equation,
        text: targets.includes('TEXT') ? null : next.text,
        feedback: targets.includes('FEEDBACK') ? null : next.feedback,
      };
    }

    case 'SHOW_TEXT':
      return {
        ...next,
        text: String(p.text ?? ''),
        emphasis: Array.isArray(p.emphasis) ? p.emphasis.map(String) : [],
      };

    case 'SPEAK':
      return { ...next, text: String(p.text ?? next.text ?? '') };

    case 'SHOW_NUMBER_LINE':
      return { ...next, numberLineStart: (p.min as number) ?? 0, numberLineJumps: [] };

    case 'PLACE_MARKER':
      return { ...next, numberLineStart: p.value as number };

    case 'MOVE_MARKER': {
      const current = next.numberLineStart ?? 0;
      const steps = p.steps as number ?? 1;
      const stepSize = p.step_size as number ?? 1;
      const direction = p.direction as string ?? 'FORWARD';
      const end = direction === 'FORWARD'
        ? current + steps * stepSize
        : current - steps * stepSize;
      next.numberLineJumps = [...next.numberLineJumps, { start: current, end }];
      next.numberLineStart = end;
      return next;
    }

    case 'SHOW_OBJECTS':
    case 'ADD_OBJECTS': {
      const groupId = String(p.group_id ?? `group_${next.visibleBlocks.length + 1}`);
      const count = Number(p.count ?? 0);
      const role = String((p.appearance as { role?: string } | undefined)?.role ?? 'PRIMARY');
      const color = colorForRole(role);
      const existingIndex = next.visibleBlocks.findIndex((block) => block.groupId === groupId);
      if (existingIndex >= 0 && step.action === 'ADD_OBJECTS') {
        next.visibleBlocks = next.visibleBlocks.map((block, index) =>
          index === existingIndex ? { ...block, count: Math.min(20, block.count + count) } : block
        );
      } else {
        next.visibleBlocks = [
          ...next.visibleBlocks.filter((block) => block.groupId !== groupId),
          { groupId, count: Math.max(0, Math.min(20, count)), color, role },
        ];
      }
      return next;
    }

    case 'REMOVE_OBJECTS': {
      const groupId = String(p.group_id ?? '');
      const count = Math.max(0, Number(p.count ?? 0));
      next.visibleBlocks = next.visibleBlocks.map((block) =>
        block.groupId === groupId ? { ...block, count: Math.max(0, block.count - count) } : block
      );
      next.removedCount = count;
      return next;
    }

    case 'MOVE_OBJECTS': {
      const fromGroup = String(p.from_group ?? '');
      const toGroup = String(p.to_group ?? '');
      const count = Math.max(0, Number(p.count ?? 0));
      const source = next.visibleBlocks.find((block) => block.groupId === fromGroup);
      if (!source) return next;
      const sourceAfterMove = Math.max(0, source.count - count);
      const target = next.visibleBlocks.find((block) => block.groupId === toGroup);
      next.visibleBlocks = next.visibleBlocks
        .filter((block) => block.groupId !== toGroup)
        .map((block) => block.groupId === fromGroup ? { ...block, count: sourceAfterMove } : block);
      next.visibleBlocks.push(target
        ? { ...target, count: Math.min(20, target.count + count) }
        : { groupId: toGroup, count, color: 'orange', role: 'ADDED' });
      return next;
    }

    case 'GROUP_TO_TEN': {
      const sourceGroup = String(p.source_group ?? '');
      const targetGroup = String(p.target_group ?? '');
      const count = Math.max(0, Number(p.count ?? 0));
      const source = next.visibleBlocks.find((block) => block.groupId === sourceGroup);
      const target = next.visibleBlocks.find((block) => block.groupId === targetGroup);
      if (source) {
        next.visibleBlocks = next.visibleBlocks.map((block) =>
          block.groupId === sourceGroup ? { ...block, count: Math.max(0, block.count - count) } : block
        );
      }
      if (target) {
        next.visibleBlocks = next.visibleBlocks.map((block) =>
          block.groupId === targetGroup ? { ...block, count: 10 } : block
        );
      } else {
        next.visibleBlocks.push({ groupId: targetGroup, count: 10, color: 'blue', role: 'PRIMARY' });
      }
      next.text = `Kita bentuk kelompok 10 dengan ${count} benda.`;
      return next;
    }

    case 'SHOW_EQUATION':
      return {
        ...next,
        equation: String(p.expression ?? ''),
        emphasis: Array.isArray(p.emphasis) ? p.emphasis.map(String) : [],
      };

    case 'HIGHLIGHT':
      return {
        ...next,
        highlightTarget: String(p.target_id ?? ''),
        emphasis: [...new Set([...next.emphasis, String(p.target_id ?? '')].filter(Boolean))],
      };

    case 'SHOW_FEEDBACK':
      return { ...next, feedback: String(p.text ?? '') };

    default:
      return next;
  }
}

// ─── Component ────────────────────────────────────────────────────────────

const QuestionScreen = ({ playerName, questions, onFinish }: QuestionScreenProps) => {
  const { speak } = useTTS();
  const { fetchProblem, fetchSupport, fetchTransfer, connected } = useLangflow();
  const demoMode = isDemoMode();

  // ─── Session state ───
  const [localIndex, setLocalIndex] = useState(0);        // index into fallback `questions`
  const [sessionIndex, setSessionIndex] = useState(0);    // session-wide question counter
  const [activeProblem, setActiveProblem] = useState<ActiveProblem | null>(null);
  const [problemKind, setProblemKind] = useState<ProblemKind>('REGULAR');
  // True when the currently shown problem came from the local fallback (not Langflow)
  const [isLocalFallback, setIsLocalFallback] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const [showNumberPad, setShowNumberPad] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(false);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [wrongAnswers, setWrongAnswers] = useState<number[]>([]);
  const [reasoningText, setReasoningText] = useState('');
  const [supportHintText, setSupportHintText] = useState<string | null>(null);
  const [supportObservation, setSupportObservation] = useState<SupportObservation | null>(null);
  const [guidedAcceptedAnswers, setGuidedAcceptedAnswers] = useState<number[] | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);

  // ─── Stage (visual area) state ───
  const [stage, setStage] = useState<StageState>(emptyStage());
  const [speechText, setSpeechText] = useState('');

  // ─── Plan execution ───
  const [planStepIndex, setPlanStepIndex] = useState(0);

  const resultsRef = useRef(results);
  resultsRef.current = results;
  const activeProblemRef = useRef(activeProblem);
  activeProblemRef.current = activeProblem;
  const problemKindRef = useRef(problemKind);
  problemKindRef.current = problemKind;
  const generationRef = useRef(0);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoWrongSentRef = useRef(false);
  const demoReasoningSentRef = useRef(false);
  const demoGuidedAnswerSentRef = useRef(false);
  const demoFinalAnswerPendingRef = useRef(false);
  const demoTransferAnswerSentRef = useRef(false);
  const demoTransferRequestedRef = useRef(false);
  const demoFinishedRef = useRef(false);

  const finishSession = useCallback((finalResults = resultsRef.current) => {
    generationRef.current += 1;
    if (introTimerRef.current) clearTimeout(introTimerRef.current);
    onFinish(finalResults);
  }, [onFinish]);

  // ─── Load problem ────────────────────────────────────────────────────

  const presentProblem = useCallback(
    (problem: ActiveProblem, kind: ProblemKind, questionNumber?: number) => {
      if (introTimerRef.current) clearTimeout(introTimerRef.current);
      const generation = ++generationRef.current;
      activeProblemRef.current = problem;
      problemKindRef.current = kind;
      setActiveProblem(problem);
      setProblemKind(kind);
      if (questionNumber !== undefined) setSessionIndex(questionNumber);
      setAttempts(0);
      setHintLevel(0);
      setShowHint(false);
      setShowNumberPad(false);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setIsCorrectAnswer(false);
      setWrongAnswers([]);
      setReasoningText('');
      setSupportHintText(null);
      setSupportObservation(null);
      setGuidedAcceptedAnswers(null);
      setStage(emptyStage());
      setPlanStepIndex(0);

      setSpeechText(problem.display_text);
      setMascotState('speaking');
      speak(problem.display_text);
      setPhase('intro');
      introTimerRef.current = setTimeout(() => {
        if (generationRef.current !== generation) return;
        setPhase(problem.plan ? 'stepping' : 'answering');
        setMascotState('idle');
        if (!problem.plan) setShowNumberPad(true);
      }, 1400);
    },
    [speak]
  );

  const loadProblem = useCallback(
    async (
      sessIdx: number,
      localIdx: number,
      connectedNow?: boolean,
      purpose: 'INITIAL' | 'NEXT' = 'NEXT'
    ) => {
      if (introTimerRef.current) clearTimeout(introTimerRef.current);
      const generation = ++generationRef.current;
      setPhase('loading');
      setMascotState('thinking');

      let problem: ActiveProblem | null = null;
      const useRemote = connectedNow ?? connected;

      if (useRemote) {
        try {
          const resp = await fetchProblem({ purpose });
          if (resp) problem = responseToActiveProblem(resp);
        } catch {
          // Fall through to local
        }
      }

      if (generationRef.current !== generation) return;

      const usedLocal = !problem;
      if (!problem && demoMode && sessIdx === 0 && localIdx === 0) {
        problem = localDemoProblem('REGULAR');
      } else if (!problem && questions.length > 0) {
        const fallbackIndex = localIdx % questions.length;
        problem = localQuestionToActiveProblem(questions[fallbackIndex], localIdx);
      }

      if (!problem) {
        setPhase('feedback');
        finishSession(resultsRef.current);
        return;
      }

      setIsLocalFallback(usedLocal);
      setLocalIndex(localIdx);
      presentProblem(problem, 'REGULAR', sessIdx);
    },
    [connected, demoMode, fetchProblem, questions, finishSession, presentProblem]
  );

  // Load first problem on mount (connected may still be false at this point)
  useEffect(() => {
    void loadProblem(0, 0, false, 'INITIAL');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When Langflow becomes available and we're still showing the first local fallback,
  // silently upgrade to a Langflow problem (contract §6 retry path).
  const prevConnectedRef = useRef(false);
  useEffect(() => {
    if (connected && !prevConnectedRef.current && isLocalFallback && sessionIndex === 0 && problemKind === 'REGULAR') {
      void loadProblem(0, 0, true, 'INITIAL');
    }
    prevConnectedRef.current = connected;
  }, [connected, isLocalFallback, sessionIndex, problemKind, loadProblem]);

  useEffect(() => () => {
    generationRef.current += 1;
    if (introTimerRef.current) clearTimeout(introTimerRef.current);
  }, []);

  // ─── Plan step engine ─────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'stepping' || !activeProblem?.plan) return;
    const { steps } = activeProblem.plan;
    if (planStepIndex >= steps.length) return;

    const step = steps[planStepIndex];
    const delay = planStepIndex === 0 ? 500 : 1800;

    const timer = setTimeout(() => {
      // Terminal step — hand off to answering phase
      if (step.action === 'ASK_QUESTION') {
        const prompt = String(step.params.prompt ?? 'Pilih jawabanmu.');
        setSpeechText(prompt);
        speak(prompt);
        setShowNumberPad(true);
        setPhase('answering');
        setMascotState('thinking');
        return;
      }
      if (step.action === 'ASK_REASONING') {
        const prompt = String(step.params.prompt ?? 'Bagaimana kamu menghitungnya?');
        setSpeechText(prompt);
        setReasoningText('');
        setShowNumberPad(false);
        speak(prompt);
        setPhase('askingReasoning');
        setMascotState('thinking');
        return;
      }

      // Narration
      const narration = step.narration?.text ?? (step.params?.text as string | undefined);
      if (narration) {
        setSpeechText(narration);
        if (step.narration?.auto_play !== false) speak(narration);
      }

      // Visual update
      setStage((prev) => applyStep(prev, step));
      setPlanStepIndex((i) => i + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [phase, planStepIndex, activeProblem, speak]);

  // ─── Answer handler ────────────────────────────────────────────────────

  const handleAnswerSelect = useCallback(
    (num: number) => {
      if (phase !== 'answering' || !activeProblem) return;
      setSelectedAnswer(num);

      const expectedAnswers = guidedAcceptedAnswers ?? activeProblem.accepted_answers;
      const correct = expectedAnswers.includes(num);
      setIsCorrectAnswer(correct);

      if (correct) {
        const isIntermediateGuidedCheck = guidedAcceptedAnswers !== null &&
          !guidedAcceptedAnswers.includes(activeProblem.correct_answer);
        if (isIntermediateGuidedCheck) {
          if (demoMode) demoFinalAnswerPendingRef.current = true;
          setGuidedAcceptedAnswers(null);
          setSelectedAnswer(null);
          const finalPrompt = `Bagus. Sekarang, ${activeProblem.display_text.replace(' = ?', '')} berapa hasilnya?`;
          setSpeechText(finalPrompt);
          speak(finalPrompt);
          setShowNumberPad(true);
          setPhase('answering');
          setMascotState('thinking');
          return;
        }
        setMascotState('happy');
        const newResults: QuestionResult[] = [
          ...resultsRef.current,
          {
            questionIndex: sessionIndex,
            correct: true,
            attempts: attempts + 1,
            hintsUsed: hintLevel,
            problemKind,
          },
        ];
        resultsRef.current = newResults;
        setResults(newResults);
        setShowFeedback(true);
        setPhase('feedback');
      } else {
        const newAttempts = attempts + 1;
        setWrongAnswers((prev) => [...prev, num]);
        setAttempts(newAttempts);
        setMascotState('encourage');

        if (newAttempts >= 3) {
          const newResults: QuestionResult[] = [
            ...resultsRef.current,
            {
              questionIndex: sessionIndex,
              correct: false,
              attempts: newAttempts,
              hintsUsed: 3,
              problemKind,
            },
          ];
          resultsRef.current = newResults;
          setResults(newResults);
          setShowNumberPad(false);
          setShowHint(false);
          setShowFeedback(true);
          setPhase('feedback');
        } else {
          setHintLevel(newAttempts);
          setShowHint(false);
          setShowNumberPad(false);
          setReasoningText('');
          setSpeechText('Bagaimana kamu menghitungnya?');
          speak('Bagaimana kamu menghitungnya?');
          setPhase('askingReasoning');
        }
      }
    },
    [
      phase, activeProblem, sessionIndex, attempts, hintLevel, problemKind, demoMode,
      guidedAcceptedAnswers, speak,
    ]
  );

  // ─── Reasoning / support handler ──────────────────────────────────────

  const submitReasoning = useCallback(
    async (skipped = false, submittedText?: string) => {
      const explanation = (submittedText ?? reasoningText).trim();
      if (!skipped && !explanation) return;
      if (!activeProblem) return;

      const submittedProblemId = activeProblem.problem_id;
      const submittedGeneration = generationRef.current;
      const attemptNumber = Math.max(attempts, 1);
      setPhase('loadingSupport');
      setMascotState('thinking');

      const supportPayload: SupportRequestPayload = {
        problem: {
          problem_id: activeProblem.problem_id,
          type: 'ARITHMETIC',
          concept: activeProblem.concept,
          operation: activeProblem.operation,
          operands: activeProblem.operands,
          correct_answer: activeProblem.correct_answer,
          display_text: activeProblem.display_text,
          number_range: { min: 0, max: 20 },
        },
        attempt: {
          attempt_id: `attempt_${sessionIndex + 1}_${attemptNumber}`,
          attempt_number: attemptNumber,
          submitted_answer: wrongAnswers[wrongAnswers.length - 1] ?? 0,
          input_mode: 'BUTTONS',
          confirmed: true,
          reasoning: {
            mode: skipped ? 'SKIPPED' : 'TEXT',
            text: skipped ? null : explanation.slice(0, 500),
            transcript: null,
            option_code: null,
            skipped,
          },
        },
        current_plan: {
          plan_id: activeProblem.current_plan_id,
          plan_version: 1,
        },
      };

      const response = await fetchSupport(supportPayload, {
        support_level: Math.min(attemptNumber, 3),
      });
      if (generationRef.current !== submittedGeneration ||
          activeProblemRef.current?.problem_id !== submittedProblemId) return;

      // Extract narration from support plan
      const localHint =
        activeProblem.hints[Math.max(0, Math.min(attemptNumber - 1, activeProblem.hints.length - 1))]
        ?? 'Kita coba cara lain bersama-sama.';
      const helpText = extractSupportNarration(response) ?? localHint;

      setSupportHintText(helpText);
      setSpeechText(helpText);
      speak(helpText);
      setShowHint(true);
      setSelectedAnswer(null);

      const terminalStep = response?.plan?.steps.find(
        (step) => step.action === 'ASK_QUESTION' || step.action === 'ASK_REASONING'
      );
      const guidedPrompt = terminalStep?.params.prompt;
      const terminalAnswers = terminalStep?.params.accepted_answers;
      setGuidedAcceptedAnswers(
        terminalStep?.action === 'ASK_QUESTION' && Array.isArray(terminalAnswers) &&
          terminalAnswers.every(Number.isSafeInteger)
          ? terminalAnswers as number[]
          : null
      );
      if (typeof guidedPrompt === 'string' && guidedPrompt.trim()) {
        setSpeechText(guidedPrompt);
        speak(guidedPrompt);
      }
      setSupportObservation({
        hypothesis_code: response?.inference?.hypothesis_code ?? 'UNKNOWN',
        strategy_used: response?.inference?.strategy_code ?? response?.plan?.strategy ?? 'LOCAL_FALLBACK',
        support_level_used: Math.min(attemptNumber, 3),
      });

      // Apply support plan visual steps (all non-terminal)
      if (response?.plan) {
        const supportSteps = response.plan.steps.filter(
          (s: PlanStep) => s.action !== 'ASK_QUESTION' && s.action !== 'ASK_REASONING'
        );
        let s = emptyStage();
        for (const step of supportSteps) {
          s = applyStep(s, step);
        }
        setStage(s);
        // Update activeProblem with support plan for next cycle
        setActiveProblem((prev) =>
          prev
            ? {
                ...prev,
                plan: response.plan ?? prev.plan,
                current_plan_id: response.plan?.plan_id ?? prev.current_plan_id,
              }
            : prev
        );
        setPlanStepIndex(response.plan.steps.length); // plan already applied
      } else if (demoMode && submittedProblemId === 'demo_local_8_plus_5') {
        setStage({
          ...emptyStage(),
          numberLineStart: 13,
          numberLineJumps: [
            { start: 8, end: 9 }, { start: 9, end: 10 }, { start: 10, end: 11 },
            { start: 11, end: 12 }, { start: 12, end: 13 },
          ],
          equation: '8 + 5 = 13',
          text: 'Mulai dari 8, lalu maju lima lompatan.',
        });
      }

      if (terminalStep?.action === 'ASK_REASONING') {
        setReasoningText('');
        setShowNumberPad(false);
        setPhase('askingReasoning');
      } else {
        setShowNumberPad(true);
        setPhase('answering');
      }
    },
    [reasoningText, activeProblem, attempts, wrongAnswers, sessionIndex, fetchSupport, speak, demoMode]
  );

  const handleContinue = useCallback(async () => {
    if (!showFeedback || !activeProblem) return;
    setShowFeedback(false);

    const currentProblem = activeProblem;
    const currentKind = problemKind;
    const currentGeneration = generationRef.current;

    if (isCorrectAnswer && currentKind === 'REGULAR' && hintLevel > 0 && (connected || demoMode)) {
      setPhase('loading');
      let transferProblem: ActiveProblem | null = null;
      let usedLocalTransfer = false;
      if (connected) {
        const observation = supportObservation ?? {
          hypothesis_code: 'UNKNOWN',
          strategy_used: 'LOCAL_FALLBACK',
          support_level_used: hintLevel,
        };
        const transferResp = await fetchTransfer(
          {
            purpose: 'TRANSFER',
            concept: currentProblem.concept,
            operation: currentProblem.operation,
            source_problem_id: currentProblem.problem_id,
            avoid_same_operands: true,
            target_difficulty: 'SAME_CONCEPT',
            number_range: { min: 0, max: 20 },
            previous_observation: { ...observation, guided_step_correct: true },
          },
          { support_level: hintLevel }
        );
        if (transferResp) transferProblem = responseToActiveProblem(transferResp);
      }
      if (transferProblem &&
          (transferProblem.problem_id === currentProblem.problem_id ||
           ((transferProblem.operands[0] === currentProblem.operands[0] &&
             transferProblem.operands[1] === currentProblem.operands[1]) ||
            (transferProblem.operands[0] === currentProblem.operands[1] &&
             transferProblem.operands[1] === currentProblem.operands[0])))) {
        transferProblem = null;
      }
      if (!transferProblem && demoMode) {
        transferProblem = localDemoProblem('TRANSFER');
        usedLocalTransfer = true;
      }
      if (generationRef.current !== currentGeneration ||
          activeProblemRef.current?.problem_id !== currentProblem.problem_id) return;
      if (transferProblem) {
        setIsLocalFallback(usedLocalTransfer);
        presentProblem(transferProblem, 'TRANSFER', sessionIndex + 1);
        return;
      }
    }

    if (demoMode && isCorrectAnswer && currentKind === 'TRANSFER') {
      generationRef.current += 1;
      finishSession(resultsRef.current);
      return;
    }

    const nextLocal = localIndex + 1;
    const nextSession = sessionIndex + 1;
    setLocalIndex(nextLocal);
    await loadProblem(nextSession, nextLocal, undefined, 'NEXT');
  }, [
    showFeedback, activeProblem, problemKind, hintLevel, connected, demoMode, isCorrectAnswer,
    supportObservation, fetchTransfer, presentProblem, sessionIndex, localIndex,
    finishSession, loadProblem,
  ]);

  useEffect(() => {
    if (!demoMode || !activeProblem || (connected && isLocalFallback && phase === 'loading')) return;

    if (problemKind === 'REGULAR' && sessionIndex === 0 && phase === 'answering' &&
        hintLevel === 0 && !demoWrongSentRef.current) {
      demoWrongSentRef.current = true;
      const timer = setTimeout(() => handleAnswerSelect(12), 450);
      return () => clearTimeout(timer);
    }

    if (problemKind === 'REGULAR' && phase === 'askingReasoning' && hintLevel > 0 &&
        !demoReasoningSentRef.current) {
      demoReasoningSentRef.current = true;
      const timer = setTimeout(() => {
        void submitReasoning(false, 'Aku menghitung angka 8 sebagai lompatan pertama.');
      }, 450);
      return () => clearTimeout(timer);
    }

    if (problemKind === 'REGULAR' && phase === 'answering' && hintLevel > 0 &&
        supportHintText && !demoGuidedAnswerSentRef.current) {
      demoGuidedAnswerSentRef.current = true;
      const guidedAnswer = guidedAcceptedAnswers?.[0] ?? activeProblem.correct_answer;
      const timer = setTimeout(() => handleAnswerSelect(guidedAnswer), 450);
      return () => clearTimeout(timer);
    }

    if (problemKind === 'REGULAR' && phase === 'answering' && hintLevel > 0 &&
        demoFinalAnswerPendingRef.current) {
      demoFinalAnswerPendingRef.current = false;
      const timer = setTimeout(() => handleAnswerSelect(activeProblem.correct_answer), 450);
      return () => clearTimeout(timer);
    }

    if (problemKind === 'TRANSFER' && phase === 'answering' && !demoTransferAnswerSentRef.current) {
      demoTransferAnswerSentRef.current = true;
      const timer = setTimeout(() => handleAnswerSelect(13), 450);
      return () => clearTimeout(timer);
    }
  }, [
    demoMode, activeProblem, problemKind, sessionIndex, phase, hintLevel,
    supportHintText, guidedAcceptedAnswers, handleAnswerSelect, submitReasoning,
    connected, isLocalFallback,
  ]);

  useEffect(() => {
    if (!demoMode || !showFeedback || !isCorrectAnswer) return;
    if (problemKind === 'REGULAR' && hintLevel > 0 && !demoTransferRequestedRef.current) {
      demoTransferRequestedRef.current = true;
    } else if (problemKind === 'TRANSFER' && !demoFinishedRef.current) {
      demoFinishedRef.current = true;
    } else {
      return;
    }
    const timer = setTimeout(() => void handleContinue(), 1400);
    return () => clearTimeout(timer);
  }, [demoMode, showFeedback, isCorrectAnswer, problemKind, hintLevel, handleContinue]);

  // ─── Derived ──────────────────────────────────────────────────────────

  const equation = activeProblem
    ? activeProblem.display_text.replace(' = ?', ` = ${activeProblem.correct_answer}`)
    : '';

  if (!activeProblem && phase !== 'loading') return null;

  return (
    <div className="min-h-screen bg-[#FDF8F0] flex flex-col relative overflow-hidden">
      {/* Corner bar */}
      <CornerBar
        playerName={playerName}
        currentQuestion={sessionIndex + 1}
        totalQuestions={0}
        onMenuAction={(action) => {
          if (action === 'finish') {
            setConfirmExit(true);
          } else if (action === 'menu') {
            setConfirmExit(true);
          } else if (action === 'restart') {
            generationRef.current += 1;
            setSessionIndex(0);
            setLocalIndex(0);
            setProblemKind('REGULAR');
            problemKindRef.current = 'REGULAR';
            setResults([]);
            resultsRef.current = [];
            demoWrongSentRef.current = false;
            demoReasoningSentRef.current = false;
            demoGuidedAnswerSentRef.current = false;
            demoFinalAnswerPendingRef.current = false;
            demoTransferAnswerSentRef.current = false;
            demoTransferRequestedRef.current = false;
            demoFinishedRef.current = false;
            setConfirmExit(false);
            void loadProblem(0, 0, undefined, 'INITIAL');
          }
        }}
      />

      {demoMode && (
        <div className="fixed top-5 left-4 z-40 rounded-full bg-[#FFF1C2] px-4 py-2 text-sm font-extrabold tracking-wide text-[#725400] shadow-sm">
          SIMULASI DEMO
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-start pt-24 pb-28 px-4 z-10 w-full max-w-3xl mx-auto">
        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4">
            <div className="text-[#888] text-lg font-medium animate-pulse">
              Menyiapkan soal…
            </div>
          </div>
        )}

        {phase !== 'loading' && activeProblem && (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeProblem.problem_id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={bouncy}
              className="w-full flex flex-col items-center gap-6"
            >
              {/* Speech bubble */}
              <SpeechBubble
                text={speechText || activeProblem.display_text}
                isActive={phase === 'intro' || phase === 'stepping'}
                onReplay={() => speak(speechText || activeProblem.display_text)}
              />

              {/* Visual area */}
              <div className="min-h-[200px] flex flex-col items-center justify-center gap-4 w-full">
                {(stage.equation || stage.text || stage.feedback || stage.emphasis.length > 0) && (
                  <div className={`rounded-2xl bg-white px-5 py-3 text-center shadow-sm ${stage.emphasis.length ? 'ring-2 ring-[#F5C542]' : ''}`}>
                    {stage.equation && <div className="text-3xl font-black text-[#2C2C2C]">{renderEmphasized(stage.equation, stage.emphasis)}</div>}
                    {stage.text && <div className="mt-1 text-lg font-semibold text-[#555]">{renderEmphasized(stage.text, stage.emphasis)}</div>}
                    {stage.feedback && <div className="mt-1 text-lg font-bold text-[#4A90D9]">{stage.feedback}</div>}
                  </div>
                )}
                {stage.numberLineStart !== null ? (
                  <NumberLine
                    from={0}
                    to={20}
                    activeNumber={stage.numberLineStart}
                    jumps={stage.numberLineJumps}
                    range={20}
                  />
                ) : (
                  <div className="flex flex-col gap-2 items-center">
                    {stage.visibleBlocks.map((block, idx) => (
                      <motion.div
                        key={idx}
                        className={stage.highlightTarget === block.groupId ? 'rounded-xl ring-4 ring-[#F5C542] p-2' : 'p-2'}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...bouncy, delay: idx * 0.2 }}
                      >
                        <BlockCube
                          count={block.count}
                          color={block.color}
                          animated={true}
                          delay={idx * 0.3}
                        />
                        <span className="block text-center text-sm font-semibold text-[#777]">{block.groupId}</span>
                      </motion.div>
                    ))}
                    {stage.visibleBlocks.length === 0 && phase === 'intro' && (
                      <div className="text-[#888] text-lg font-medium animate-pulse">
                        Bersiap-siap… 🎯
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Number pad */}
              <AnimatePresence>
                {showNumberPad && (
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    transition={bouncy}
                    className="w-full"
                  >
                    <NumberPad
                      onSelect={handleAnswerSelect}
                      selectedNumber={selectedAnswer}
                      disabled={phase !== 'answering'}
                      max={20}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {phase === 'askingReasoning' && (
                  <ReasoningInput
                    value={reasoningText}
                    loading={false}
                    onChange={setReasoningText}
                    onSubmit={() => void submitReasoning(false)}
                    onSkip={() => void submitReasoning(true)}
                  />
                )}
              </AnimatePresence>

              {phase === 'loadingSupport' && (
                <div
                  role="status"
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-[#555] shadow-sm"
                >
                  Menyiapkan bantuan…
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Mascot — fixed bottom-left */}
      <div className="fixed bottom-4 left-4 z-20 pointer-events-none">
        <Mascot state={mascotState} />
      </div>

      {/* Hint card */}
      <AnimatePresence>
        {showHint && hintLevel > 0 && activeProblem && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed top-20 left-4 right-4 z-30 max-w-lg mx-auto"
          >
            <HintCard
              level={hintLevel}
              text={
                supportHintText ??
                activeProblem.hints[hintLevel - 1] ??
                'Coba lagi!'
              }
              onDismiss={() => setShowHint(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback overlay */}
      <AnimatePresence>
      {showFeedback && (
          <FeedbackOverlay
            isCorrect={isCorrectAnswer}
            equation={equation}
            playerName={playerName}
            nextLabel={problemKind === 'REGULAR' && hintLevel > 0 ? 'Cek dengan soal transfer' : undefined}
            onNext={() => void handleContinue()}
            onFinish={() => finishSession(resultsRef.current)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmExit && (
          <motion.div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="exit-session-title"
              className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl"
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
            >
              <h2 id="exit-session-title" className="text-2xl font-extrabold text-[#2C2C2C]">
                Akhiri sesi belajar?
              </h2>
              <p className="mt-3 text-[#666]">
                Soal yang belum selesai tidak dihitung. Kamu tetap bisa melihat ringkasan soal yang sudah selesai.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  className="rounded-xl bg-gray-100 px-5 py-3 font-bold text-gray-700"
                  onClick={() => setConfirmExit(false)}
                >
                  Lanjut belajar
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-[#F0883E] px-5 py-3 font-bold text-white"
                  onClick={() => {
                    generationRef.current += 1;
                    finishSession(resultsRef.current);
                  }}
                >
                  Akhiri dan lihat ringkasan
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuestionScreen;
