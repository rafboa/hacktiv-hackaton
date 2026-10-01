import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { springs } from '../utils/springs';

export default function HintCard({ level = 1, text, onDismiss }) {
  const [isVisible, setIsVisible] = useState(true);

  const levels = {
    1: { icon: '💡', bg: 'bg-[#FFF9DB]', border: 'border-l-4 border-[#FFD60A]' },
    2: { icon: '🧩', bg: 'bg-[#FFF9DB]', border: '' },
    3: { icon: '🎯', bg: 'bg-[#FFF9DB]', border: '' }
  };

  const config = levels[level] || levels[1];

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss?.(), 300);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={springs?.wobbly || { type: 'spring', stiffness: 200, damping: 12 }}
          className={`flex items-start gap-4 p-4 rounded-xl shadow-md ${config.bg} ${config.border} max-w-sm relative`}
        >
          <motion.div
            initial={{ rotate: -15 }}
            animate={{ rotate: 15 }}
            transition={{
              type: 'spring',
              repeat: Infinity,
              repeatType: 'mirror',
              duration: 1
            }}
            className="text-3xl"
          >
            {config.icon}
          </motion.div>
          <div className="flex-1">
            <p className="text-[#2C2C2C] font-medium leading-relaxed">{text}</p>
            {level === 3 && (
              <span className="text-xs text-[#888] mt-2 block font-semibold animate-pulse">
                ▶ Auto-playing...
              </span>
            )}
          </div>
          <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-700 font-bold ml-2">
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
