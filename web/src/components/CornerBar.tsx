import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CornerBarProps {
  playerName?: string;
  currentQuestion?: number;
  totalQuestions?: number;
  onMenuAction?: (action: string) => void;
}

export default function CornerBar({ playerName = 'Pelajar', currentQuestion = 1, totalQuestions = 0, onMenuAction }: CornerBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col items-end">
      <div className="flex items-center gap-3">
        <span className="text-lg font-medium text-[#2C2C2C] bg-white/80 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm hidden sm:block border border-gray-100">
          👋 {playerName}
        </span>
        {totalQuestions > 0 && (
          <span className="text-lg font-bold text-[#4A90D9] bg-white/80 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm border border-blue-100">
            Soal {currentQuestion} / {totalQuestions}
          </span>
        )}
        {totalQuestions <= 0 && currentQuestion > 0 && (
          <span className="text-lg font-bold text-[#4A90D9] bg-white/80 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm border border-blue-100">
            Soal {currentQuestion}
          </span>
        )}
        <motion.button
          whileHover={{ scale: 1.08, rotate: -2 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(!isOpen)}
          className="bg-[#2C2C2C] text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg relative cursor-pointer"
        >
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            className="flex flex-col gap-1 items-center justify-center"
          >
            {isOpen ? (
              <span className="text-2xl leading-none font-light">✕</span>
            ) : (
              <>
                <span className="w-5 h-[2px] bg-white block"></span>
                <span className="w-5 h-[2px] bg-white block"></span>
                <span className="w-5 h-[2px] bg-white block"></span>
              </>
            )}
          </motion.div>
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-3 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[200px]"
          >
            <div className="flex flex-col">
              <button onClick={() => { onMenuAction?.('menu'); setIsOpen(false); }} className="px-5 py-3 text-left hover:bg-gray-50 font-medium text-gray-700 cursor-pointer transition-colors">
                Kembali ke Menu
              </button>
              <div className="h-[1px] bg-gray-100 w-full" />
              <button onClick={() => { onMenuAction?.('restart'); setIsOpen(false); }} className="px-5 py-3 text-left hover:bg-gray-50 font-medium text-gray-700 cursor-pointer transition-colors">
                Mulai Ulang
              </button>
              <div className="h-[1px] bg-gray-100 w-full" />
              <button onClick={() => { onMenuAction?.('finish'); setIsOpen(false); }} className="px-5 py-3 text-left hover:bg-red-50 text-red-500 font-bold cursor-pointer transition-colors">
                Selesai
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
