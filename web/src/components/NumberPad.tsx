import React from 'react';
import { motion } from 'framer-motion';

interface NumberPadProps {
  onSelect: (num: number) => void;
  selectedNumber?: number | null;
  disabled?: boolean;
  max?: number;
}

export default function NumberPad({ onSelect, selectedNumber, disabled = false, max = 20 }: NumberPadProps) {
  const numbers = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-4 p-4 max-w-sm mx-auto">
      {numbers.map((num, idx) => {
        const isSelected = selectedNumber === num;

        return (
          <motion.button
            key={num}
            disabled={disabled}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.02, type: 'spring' }}
            whileHover={!disabled ? { scale: 1.1, backgroundColor: isSelected ? '#4A90D9' : '#E8F1FB' } : {}}
            whileTap={!disabled ? { scale: 0.85 } : {}}
            onClick={() => onSelect(num)}
            className={`w-11 h-11 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-lg font-bold border transition-colors ${
              isSelected
                ? 'bg-[#4A90D9] text-white border-[#4A90D9] scale-105'
                : 'bg-white text-[#2C2C2C] border-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {num}
          </motion.button>
        );
      })}

      {/* Microphone button */}
      <motion.button
        disabled={disabled}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: max * 0.02, type: 'spring' }}
        whileHover={!disabled ? { scale: 1.1, backgroundColor: '#E8F1FB' } : {}}
        whileTap={!disabled ? { scale: 0.85 } : {}}
        className={`w-11 h-11 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-xl bg-white border border-gray-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        🎙
      </motion.button>
    </div>
  );
}
