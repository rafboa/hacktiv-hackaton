import React from 'react';
import { motion } from 'framer-motion';

export default function ProgressDots({ total, current, correct = [] }) {
  const dots = Array.from({ length: total }, (_, i) => i);

  return (
    <div className="flex items-center justify-center gap-3 py-4">
      {dots.map((dotIndex) => {
        const isCurrent = dotIndex === current;
        const isCompleted = dotIndex < current;
        const isCorrect = correct.includes(dotIndex);
        
        let bgColor = 'bg-transparent';
        let borderColor = 'border-gray-300';
        let scale = 1;

        if (isCurrent) {
          bgColor = 'bg-[#4A90D9]';
          borderColor = 'border-[#4A90D9]';
          scale = 1.2;
        } else if (isCompleted) {
          bgColor = isCorrect ? 'bg-[#34C759]' : 'bg-[#F0883E]'; // Orange if completed but not fully correct
          borderColor = isCorrect ? 'border-[#34C759]' : 'border-[#F0883E]';
        }

        return (
          <motion.div
            key={dotIndex}
            initial={false}
            animate={{ scale }}
            className={`w-4 h-4 rounded-full border-2 transition-colors duration-300 flex items-center justify-center ${bgColor} ${borderColor}`}
          >
            {isCompleted && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.6 }}
                className="w-full h-full rounded-full bg-inherit"
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
