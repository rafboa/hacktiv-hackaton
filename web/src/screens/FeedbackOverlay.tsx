import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import WobbleButton from '../components/WobbleButton';

interface FeedbackOverlayProps {
  isCorrect: boolean;
  equation: string;
  playerName: string;
  onNext: () => void;
  onFinish: () => void;
  nextLabel?: string;
}

const FeedbackOverlay = ({ isCorrect, equation, playerName, onNext, onFinish, nextLabel }: FeedbackOverlayProps) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FDF8F0]/90 backdrop-blur-sm p-6"
      >
        {isCorrect ? (
          <div className="flex flex-col items-center text-center relative w-full h-full justify-center">
            {/* Confetti particles */}
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-4 h-4 rounded-full"
                style={{
                  backgroundColor: ['#4A90D9', '#F0883E', '#34C759', '#FFD60A'][i % 4],
                  top: '50%',
                  left: '50%',
                }}
                initial={{ x: 0, y: 0, scale: 0 }}
                animate={{
                  x: (Math.random() - 0.5) * 600,
                  y: (Math.random() - 0.5) * 600,
                  scale: [0, 1.5, 0],
                  rotate: Math.random() * 360,
                }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            ))}

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [1.5, 1] }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="text-8xl mb-6"
            >
              🎉
            </motion.div>

            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-4xl font-bold text-[#34C759] mb-4"
            >
              Hebat, {playerName}!
            </motion.h2>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-6xl font-bold text-[#2C2C2C] bg-white px-8 py-4 rounded-3xl shadow-lg border-4 border-[#34C759]"
            >
              {equation}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="mt-12 flex flex-col sm:flex-row gap-4"
            >
              <WobbleButton onClick={onNext} variant="primary">
                {nextLabel ?? 'Lanjut soal berikutnya'} &rarr;
              </WobbleButton>
              <WobbleButton onClick={onFinish} variant="secondary">
                Selesai belajar
              </WobbleButton>
            </motion.div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center justify-center h-full">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-8xl mb-6"
            >
              🤗
            </motion.div>

            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-4xl font-bold text-[#F0883E] mb-4"
            >
              Tidak apa-apa!
            </motion.h2>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl text-[#888] mb-8 font-medium"
            >
              Jawaban yang benar adalah:
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-6xl font-bold text-[#2C2C2C] bg-white px-8 py-4 rounded-3xl shadow-lg border-4 border-[#F0883E]"
            >
              {equation}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-12 flex flex-col sm:flex-row gap-4"
            >
              <WobbleButton onClick={onNext} variant="primary">
                Lanjut soal berikutnya &rarr;
              </WobbleButton>
              <WobbleButton onClick={onFinish} variant="secondary">
                Selesai belajar
              </WobbleButton>
            </motion.div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default FeedbackOverlay;
