import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import CornerBar from '../components/CornerBar';
import JiggleCard from '../components/JiggleCard';
import WobbleButton from '../components/WobbleButton';
import Mascot from '../components/Mascot';
import SpeechBubble from '../components/SpeechBubble';
import { fadeUp, containerVariants } from '../utils/springs';
import { isDemoMode } from '../utils/demoMode';

interface QuestionResult {
  correct: boolean;
  hintsUsed?: number;
  problemKind?: 'REGULAR' | 'TRANSFER';
}

interface SummaryScreenProps {
  playerName: string;
  results?: QuestionResult[];
  totalQuestions: number;
  onRestart: () => void;
  onHome: () => void;
}

const SummaryScreen = ({ playerName, results = [], totalQuestions, onRestart, onHome }: SummaryScreenProps) => {
  const [countedCorrect, setCountedCorrect] = useState(0);

  const correctCount = results.filter(r => r.correct).length;
  const helpedCount = results.filter(r => (r.hintsUsed ?? 0) > 0).length;
  const transferCorrectCount = results.filter(r => r.problemKind === 'TRANSFER' && r.correct).length;
  const percentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

  let stars = '🌟';
  if (percentage > 80) stars = '🌟🌟🌟';
  else if (percentage > 50) stars = '🌟🌟';

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      if (current < correctCount) {
        current += 1;
        setCountedCorrect(current);
      } else {
        clearInterval(interval);
      }
    }, 150);
    return () => clearInterval(interval);
  }, [correctCount]);

  return (
    <div className="min-h-screen bg-[#FDF8F0] flex flex-col relative overflow-hidden p-4 md:p-8">
      <CornerBar playerName="Selesai!" currentQuestion={totalQuestions} totalQuestions={totalQuestions} onMenuAction={onHome} />

      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto z-10 pt-10">
        {isDemoMode() && (
          <div className="mb-5 rounded-full bg-[#FFF1C2] px-4 py-2 text-sm font-extrabold tracking-wide text-[#725400]">
            HASIL SIMULASI DEMO
          </div>
        )}
        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="text-4xl md:text-5xl font-bold text-[#2C2C2C] mb-10 text-center"
        >
          Ringkasan Hari Ini
        </motion.h1>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="w-full"
        >
          <JiggleCard className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-xl border-4 border-gray-100 flex flex-col items-center">
            <div className="text-7xl mb-8 tracking-widest">{stars}</div>

            <div className="w-full flex flex-col gap-8 mb-8">
              <div className="flex justify-between items-center text-xl md:text-2xl">
                <span className="text-[#888] font-bold">Soal dikerjakan:</span>
                <span className="text-3xl font-black text-[#2C2C2C]">{totalQuestions}</span>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center text-xl md:text-2xl">
                  <span className="text-[#888] font-bold">Jawaban benar:</span>
                  <span className="text-3xl font-black text-[#34C759]">{countedCorrect}</span>
                </div>
                <div className="flex justify-between items-center text-lg md:text-xl">
                  <span className="text-[#888] font-bold">Soal dengan bantuan:</span>
                  <span className="text-2xl font-black text-[#4A90D9]">{helpedCount}</span>
                </div>
                <div className="flex justify-between items-center text-lg md:text-xl">
                  <span className="text-[#888] font-bold">Soal transfer benar:</span>
                  <span className="text-2xl font-black text-[#4A90D9]">{transferCorrectCount}</span>
                </div>
                {/* Progress bar */}
                <div className="h-6 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                  <motion.div
                    className="h-full bg-[#34C759] rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                  />
                </div>
              </div>
            </div>
          </JiggleCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
          className="mt-12 flex flex-col sm:flex-row gap-6 w-full sm:w-auto"
        >
          <WobbleButton onClick={onRestart} variant="primary">
            Latihan Lagi
          </WobbleButton>
          <WobbleButton onClick={onHome} variant="secondary">
            Selesai ✓
          </WobbleButton>
        </motion.div>
      </main>

      <div className="fixed bottom-6 left-6 z-20 flex items-end gap-4 pointer-events-none">
        <Mascot state="happy" />
        <motion.div
          initial={{ opacity: 0, scale: 0.8, x: -20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ delay: 0.5, type: 'spring' }}
          className="mb-16"
        >
          <SpeechBubble text={`Hebat ${playerName}!`} isActive={true} />
        </motion.div>
      </div>
    </div>
  );
};

export default SummaryScreen;
