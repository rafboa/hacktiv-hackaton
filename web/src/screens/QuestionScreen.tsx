import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CornerBar from '../components/CornerBar';
import BlockCube from '../components/BlockCube';
import NumberLine from '../components/NumberLine';
import NumberPad from '../components/NumberPad';
import ProgressDots from '../components/ProgressDots';
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
import type { LangflowEnvelope } from '../utils/langflowClient';

type Phase = 'intro' | 'stepping' | 'answering' | 'askingReasoning' | 'loadingSupport' | 'feedback';

interface QuestionResult {
  questionIndex: number;
  correct: boolean;
  attempts: number;
  hintsUsed: number;
}

interface VisibleBlock {
  count: number;
  color: string;
}

interface Jump {
  start: number;
  end: number;
}

interface QuestionScreenProps {
  playerName: string;
  questions: Question[];
  onFinish: (results: QuestionResult[]) => void;
  onHome?: () => void;
}

function readSupportNarration(response: LangflowEnvelope | null): string | null {
  if (!response || response.status === 'ERROR') return null;

  const payload = response.payload as {
    plan?: {
      steps?: Array<{
        narration?: { text?: string } | null;
        params?: Record<string, unknown>;
      }>;
    };
  };
  const narration = (payload.plan?.steps ?? [])
    .map((step) => {
      const spokenText = step.narration?.text;
      if (typeof spokenText === 'string' && spokenText.trim()) return spokenText.trim();
      const prompt = step.params?.prompt;
      if (typeof prompt === 'string' && prompt.trim()) return prompt.trim();
      const text = step.params?.text;
      if (typeof text === 'string' && text.trim()) return text.trim();
      return null;
    })
    .filter((text): text is string => text !== null);

  return narration.length ? narration.join(' ') : null;
}

function parseQuestion(question: string): { operands: [number, number]; operation: 'ADDITION' | 'SUBTRACTION' } {
  const match = question.match(/(-?\d+)\s*([+-])\s*(-?\d+)/);
  if (!match) return { operands: [0, 0], operation: 'ADDITION' };
  return {
    operands: [Number(match[1]), Number(match[3])],
    operation: match[2] === '-' ? 'SUBTRACTION' : 'ADDITION',
  };
}

/**
 * QuestionScreen — Core learning screen with step-by-step animation engine
 *
 * Phases: intro → stepping → answering → feedback → next
 *
 * The step engine iterates through question.steps one at a time:
 * - 'show'/'add' → renders blocks/numberline with stagger, TTS reads step.say
 * - 'remove' → animates blocks disappearing, TTS reads step.say
 * - 'prompt' → shows NumberPad, awaits answer
 */
const QuestionScreen = ({ playerName, questions, onFinish, onHome }: QuestionScreenProps) => {
  // ─── State ───
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const [showNumberPad, setShowNumberPad] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(false);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [wrongAnswers, setWrongAnswers] = useState<number[]>([]);
  const [reasoningText, setReasoningText] = useState('');
  const [supportHintText, setSupportHintText] = useState<string | null>(null);

  // Step engine state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [visibleBlocks, setVisibleBlocks] = useState<VisibleBlock[]>([]);
  const [removedCount, setRemovedCount] = useState(0);
  const [numberLineActive, setNumberLineActive] = useState<number | null>(null);
  const [numberLineJumps, setNumberLineJumps] = useState<Jump[]>([]);
  const [speechText, setSpeechText] = useState('');

  const { speak } = useTTS();
  const { fetchSupport } = useLangflow();
  const currentQ = questions[currentIndex];
  const resultsRef = useRef(results);
  resultsRef.current = results;

  // ─── Reset for new question ───
  useEffect(() => {
    setPhase('intro');
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
    setMascotState('speaking');
    setCurrentStepIndex(0);
    setVisibleBlocks([]);
    setRemovedCount(0);
    setNumberLineActive(null);
    setNumberLineJumps([]);

    if (currentQ) {
      setSpeechText(currentQ.question);
      speak(currentQ.question);

      // Move to stepping phase after intro delay
      const timer = setTimeout(() => {
        setPhase('stepping');
        setMascotState('idle');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentIndex]);

  // ─── Step Engine ───
  useEffect(() => {
    if (phase !== 'stepping' || !currentQ) return;

    const steps = currentQ.steps;
    if (currentStepIndex >= steps.length) return;

    const step = steps[currentStepIndex];

    const timer = setTimeout(() => {
      // Execute current step
      if (step.action === 'show') {
        if (currentQ.visual === 'numberline') {
          setNumberLineActive(step.count ?? null);
        } else {
          setVisibleBlocks(prev => [...prev, { count: step.count ?? 0, color: step.color ?? 'blue' }]);
        }
        setSpeechText(step.say);
        speak(step.say);
      }
      else if (step.action === 'add') {
        if (currentQ.visual === 'numberline') {
          const prevNum = numberLineActive ?? 0;
          setNumberLineJumps(prev => [...prev, { start: prevNum, end: prevNum + (step.count ?? 0) }]);
          setNumberLineActive(prevNum + (step.count ?? 0));
        } else {
          setVisibleBlocks(prev => [...prev, { count: step.count ?? 0, color: step.color ?? 'orange' }]);
        }
        setSpeechText(step.say);
        speak(step.say);
      }
      else if (step.action === 'remove') {
        if (currentQ.visual === 'numberline') {
          const prevNum = numberLineActive ?? 0;
          setNumberLineJumps(prev => [...prev, { start: prevNum, end: prevNum - (step.count ?? 0) }]);
          setNumberLineActive(prevNum - (step.count ?? 0));
        } else {
          setRemovedCount(step.count ?? 0);
        }
        setSpeechText(step.say);
        speak(step.say);
      }
      else if (step.action === 'prompt') {
        setSpeechText(step.say);
        speak(step.say);
        setShowNumberPad(true);
        setPhase('answering');
        setMascotState('thinking');
        return; // Don't advance step index
      }

      // Advance to next step
      setCurrentStepIndex(prev => prev + 1);
    }, currentStepIndex === 0 ? 500 : 1800); // First step faster, rest with TTS delay

    return () => clearTimeout(timer);
  }, [phase, currentStepIndex, currentQ]);

  // ─── Answer Handler ───
  const handleAnswerSelect = useCallback((num: number) => {
    if (phase !== 'answering') return;
    setSelectedAnswer(num);

    const correct = num === currentQ.answer;
    setIsCorrectAnswer(correct);

    if (correct) {
      setMascotState('happy');
      const newResults: QuestionResult[] = [...resultsRef.current, {
        questionIndex: currentIndex,
        correct: true,
        attempts: attempts + 1,
        hintsUsed: hintLevel
      }];
      setResults(newResults);
      setShowFeedback(true);
      setPhase('feedback');

      // Auto-advance after feedback
      setTimeout(() => {
        setShowFeedback(false);
        if (currentIndex < questions.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          onFinish(newResults);
        }
      }, 2500);
    } else {
      const newAttempts = attempts + 1;
      setWrongAnswers((previous) => [...previous, num]);
      setAttempts(newAttempts);
      setMascotState('encourage');

      if (newAttempts >= 3) {
        // Show answer after 3 wrong attempts
        const newResults: QuestionResult[] = [...resultsRef.current, {
          questionIndex: currentIndex,
          correct: false,
          attempts: newAttempts,
          hintsUsed: 3
        }];
        setResults(newResults);
        setShowNumberPad(false);
        setShowHint(false);
        setShowFeedback(true);
        setPhase('feedback');

        setTimeout(() => {
          setShowFeedback(false);
          if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
          } else {
            onFinish(newResults);
          }
        }, 3000);
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
  }, [phase, currentQ, currentIndex, attempts, hintLevel, questions.length, onFinish, speak]);

  const submitReasoning = useCallback(async (skipped = false) => {
    const explanation = reasoningText.trim();
    if (!skipped && !explanation) return;

    const { operands, operation } = parseQuestion(currentQ.question);
    const attemptNumber = Math.max(attempts, 1);
    setPhase('loadingSupport');
    setMascotState('thinking');

    const response = await fetchSupport({
      payload: {
        problem: {
          problem_id: `problem_${operands[0]}_${operation === 'ADDITION' ? 'plus' : 'minus'}_${operands[1]}`,
          type: 'ARITHMETIC',
          concept: operation === 'ADDITION' ? 'ADDITION_CROSSING_TEN' : 'SUBTRACTION_WITHIN_20',
          operation,
          operands,
          correct_answer: currentQ.answer,
          display_text: currentQ.question,
          number_range: { min: 0, max: 20 },
        },
        attempt: {
          attempt_id: `attempt_${currentIndex + 1}_${attemptNumber}`,
          attempt_number: attemptNumber,
          submitted_answer: wrongAnswers.at(-1) ?? 0,
          input_mode: 'BUTTONS',
          confirmed: true,
          reasoning: {
            mode: skipped ? 'SKIPPED' : 'TEXT',
            text: skipped ? null : explanation,
            transcript: null,
            option_code: null,
            skipped,
          },
        },
        current_plan: { plan_id: `plan_${currentIndex + 1}`, plan_version: 1 },
      },
      learner_context: {
        support_level: Math.min(attemptNumber, 3),
        effective_visuals: [],
        recent_observations: [],
        preferences: { tts_enabled: true, input_mode: 'BUTTONS_AND_TEXT', pace: 'NORMAL' },
      },
      client_capabilities: {
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
      },
    });

    const localHint = currentQ.hints?.[Math.max(0, Math.min(attemptNumber - 1, currentQ.hints.length - 1))]
      ?? 'Kita coba cara lain bersama-sama.';
    const helpText = readSupportNarration(response) ?? localHint;
    setSupportHintText(helpText);
    setSpeechText(helpText);
    speak(helpText);
    setShowHint(true);
    setSelectedAnswer(null);
    setShowNumberPad(true);
    setPhase('answering');
  }, [reasoningText, currentQ, attempts, wrongAnswers, currentIndex, fetchSupport, speak]);

  // ─── Derived values ───
  const equation = currentQ ? currentQ.question.replace(' = ?', ` = ${currentQ.answer}`) : '';

  if (!currentQ) return null;

  return (
    <div className="min-h-screen bg-[#FDF8F0] flex flex-col relative overflow-hidden">
      {/* Progress bar */}
      <motion.div
        className="fixed top-0 left-0 h-[4px] bg-[#C8FF00] z-50"
        initial={{ width: 0 }}
        animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />

      {/* Corner bar */}
      <CornerBar
        playerName={playerName}
        currentQuestion={currentIndex + 1}
        totalQuestions={questions.length}
        onMenuAction={(action) => {
          if (action === 'finish') {
            onFinish(resultsRef.current);
          } else if (action === 'menu') {
            onHome?.();
          } else if (action === 'restart') {
            setCurrentIndex(0);
            setResults([]);
          }
        }}
      />

      {/* Progress dots */}
      <div className="fixed top-16 left-0 right-0 z-40">
        <ProgressDots
          total={questions.length}
          current={currentIndex}
          correct={results.filter(r => r.correct).map(r => r.questionIndex)}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-start pt-20 pb-28 px-4 z-10 w-full max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={bouncy}
            className="w-full flex flex-col items-center gap-6"
          >
            {/* Speech bubble */}
            <SpeechBubble
              text={speechText || currentQ.question}
              isActive={phase === 'intro' || phase === 'stepping'}
              onReplay={() => speak(speechText || currentQ.question)}
            />

            {/* Visual area */}
            <div className="min-h-[160px] flex items-center justify-center w-full">
              {currentQ.visual === 'numberline' ? (
                <NumberLine
                  from={0}
                  to={20}
                  activeNumber={numberLineActive}
                  jumps={numberLineJumps}
                  range={20}
                />
              ) : (
                <div className="flex flex-col gap-2 items-center">
                  {visibleBlocks.map((block, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...bouncy, delay: idx * 0.2 }}
                    >
                      <BlockCube
                        count={idx === visibleBlocks.length - 1 && removedCount > 0
                          ? Math.max(0, block.count - removedCount)
                          : block.count
                        }
                        color={block.color}
                        animated={true}
                        delay={idx * 0.3}
                      />
                    </motion.div>
                  ))}
                  {visibleBlocks.length === 0 && phase === 'intro' && (
                    <div className="text-[#888] text-lg font-medium animate-pulse">
                      Bersiap-siap... 🎯
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
              <div role="status" className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-[#555] shadow-sm">
                Menyiapkan bantuan…
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mascot — fixed bottom-left */}
      <div className="fixed bottom-4 left-4 z-20 pointer-events-none">
        <Mascot state={mascotState} />
      </div>

      {/* Hint card */}
      <AnimatePresence>
        {showHint && hintLevel > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed top-20 left-4 right-4 z-30 max-w-lg mx-auto"
          >
            <HintCard
              level={hintLevel}
              text={supportHintText ?? currentQ.hints?.[hintLevel - 1] ?? 'Coba lagi!'}
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
            onNext={() => {
              setShowFeedback(false);
              if (currentIndex < questions.length - 1) {
                setCurrentIndex(prev => prev + 1);
              } else {
                onFinish(resultsRef.current);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuestionScreen;
