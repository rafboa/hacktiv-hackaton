import React from 'react';
import { motion } from 'framer-motion';
import { springs } from '../utils/springs';

export default function SpeechBubble({ text, onReplay, isActive = false }) {
  // Highlight numbers in blue
  const formatText = (content) => {
    if (!content) return null;
    return content.split(/(\d+)/).map((part, i) => {
      if (/\d+/.test(part)) {
        return <span key={i} className="text-[#4A90D9] font-bold">{part}</span>;
      }
      return part;
    });
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={springs?.wobbly || { type: 'spring', stiffness: 200, damping: 10 }}
      className={`relative bg-white rounded-2xl shadow-lg p-6 max-w-md ${isActive ? 'border-2 border-[#4A90D9]' : ''}`}
    >
      {onReplay && (
        <div className="absolute top-4 right-4 cursor-pointer hover:scale-110 transition-transform" onClick={onReplay}>
          🔄
        </div>
      )}
      <p className="text-xl md:text-2xl text-[#2C2C2C] pr-8 leading-relaxed font-medium">
        {formatText(text)}
      </p>
      
      {/* Down-left CSS triangle */}
      <div className="absolute -bottom-4 left-6 w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[16px] border-t-white drop-shadow-md" style={{ borderLeftWidth: '0' }} />
    </motion.div>
  );
}
