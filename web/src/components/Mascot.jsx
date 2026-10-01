import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Mascot({ state = 'idle' }) {
  const states = {
    idle: { emoji: '🤖', animation: { y: [0, -4, 0], transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } } },
    thinking: { emoji: '🤔', animation: { y: [0, -8, 0], transition: { duration: 0.8, repeat: Infinity } } },
    happy: { emoji: '🥳', animation: { scale: [1, 1.3, 1], rotate: [0, -10, 10, -10, 0], transition: { duration: 0.6 } } },
    encourage: { emoji: '💪', animation: { rotateX: [0, 20, 0], transition: { duration: 0.5, repeat: 2 } } },
    speaking: { emoji: '🗣️', animation: { scale: [1, 1.05, 1], transition: { duration: 0.3, repeat: Infinity } } }
  };

  const current = states[state] || states.idle;

  return (
    <div className="w-20 h-20 flex flex-col items-center justify-center z-50">
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1, ...current.animation }}
          exit={{ opacity: 0, scale: 0.5 }}
          className="text-6xl drop-shadow-lg relative"
        >
          {current.emoji}
          {state === 'thinking' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute -top-4 right-0 bg-white px-2 rounded-full shadow-sm text-xs font-bold text-black"
            >
              ...
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
      {state === 'happy' && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Simple CSS Confetti placeholder */}
          <div className="absolute top-0 left-1/2 w-2 h-2 bg-[#FFD60A] rounded-full animate-ping" />
          <div className="absolute top-2 left-1/4 w-2 h-2 bg-[#F0883E] rounded-full animate-ping delay-75" />
          <div className="absolute top-1 left-3/4 w-2 h-2 bg-[#4A90D9] rounded-full animate-ping delay-150" />
        </div>
      )}
    </div>
  );
}
