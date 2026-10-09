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
import FeedbackOverlay from './FeedbackOverlay';
import useTTS from '../hooks/useTTS';
import useSTT from '../hooks/useSTT';
import { bouncy } from '../utils/springs';
import type { Question } from '../utils/sampleQuestions';
import type { MascotState } from '../components/Mascot';

type Phase = 'intro' | 'stepping' | 'answering' | 'feedback';

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

  // Step engine state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [visibleBlocks, setVisibleBlocks] = useState<VisibleBlock[]>([]);
  const [removedCount, setRemovedCount] = useState(0);
  const [numberLineActive, setNumberLineActive] = useState<number | null>(null);
  const [numberLineJumps, setNumberLineJumps] = useState<Jump[]>([]);
  const [speechText, setSpeechText] = useState('');

  const { speak } = useTTS();
  const { startListening, stopListening, transcript, isListening, resetTranscript } = useSTT();
  const currentQ = questions[currentIndex];
  const resultsRef = useRef(results);
  resultsRef.current = results;

  // Parse STT transcript into a number and submit it
  useEffect(() => {
    if (!transcript || phase !== 'answering') return;

    const wordToNum: Record<string, number> = {
      satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
      enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
      sebelas: 11, 'dua belas': 12, 'tiga belas': 13, 'empat belas': 14, 'lima belas': 15,
      'enam belas': 16, 'tujuh belas': 17, 'delapan belas': 18, 'sembilan belas': 19, 'dua puluh': 20,
    };

    const raw = transcript.trim().toLowerCase();
    const parsed = wordToNum[raw] ?? parseInt(raw, 10);
    if (parsed && parsed >= 1 && parsed <= 20) {
      handleAnswerSelect(parsed);
      resetTranscript();
    }
  }, [transcript]);

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
        // Show hint and allow retry
        setHintLevel(newAttempts);
        setShowHint(true);

        setTimeout(() => {
          setPhase('answering');
          setMascotState('thinking');
          setSelectedAnswer(null);
        }, 1500);
      }
    }
  }, [phase, currentQ, currentIndex, attempts, hintLevel, questions.length, onFinish]);

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
                    onMicPress={() => isListening ? stopListening() : startListening()}
                    selectedNumber={selectedAnswer}
                    disabled={phase !== 'answering'}
                    max={20}
                    isListening={isListening}
                  />
                </motion.div>
              )}
            </AnimatePresence>
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
              text={currentQ.hints?.[hintLevel - 1] ?? 'Coba lagi!'}
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
