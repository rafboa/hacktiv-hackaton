import React from 'react';
import { motion } from 'framer-motion';
import { springs } from '../utils/springs';

interface BlockCubeProps {
  count: number;
  color?: string;
  onRemove?: (index: number) => void;
  animated?: boolean;
  delay?: number;
}

export default function BlockCube({ count, color = 'blue', onRemove, animated = true, delay = 0 }: BlockCubeProps) {
  const blocks = Array.from({ length: count });

  const bgColors: Record<string, string> = {
    blue: '#4A90D9',
    orange: '#F0883E',
    green: '#34C759',
    yellow: '#FFD60A',
    red: '#FF3B30',
    purple: '#AF52DE'
  };

  const bgColor = bgColors[color] ?? bgColors.blue;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(36px,48px))] max-w-[540px] gap-1.5 p-2">
      {blocks.map((_, i) => {
        const randomRot = Math.random() * 6 - 3; // random +/-3
        return (
          <motion.div
            key={i}
            className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg cursor-pointer flex items-center justify-center animate-[breathe_3s_infinite_ease-in-out]"
            style={{
              backgroundColor: bgColor,
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), 0 4px 6px rgba(0,0,0,0.1)'
            }}
            initial={animated ? { scale: 0, opacity: 0, rotate: -10 } : false}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 10,
              delay: delay + i * 0.06
            }}
            whileHover={{ y: -4, rotate: randomRot, scale: 1.05, transition: springs?.wobbly ?? { type: "spring", stiffness: 300 } }}
            whileTap={{ scale: 0.85, transition: springs?.snappy ?? { type: "spring", stiffness: 500 } }}
            onClick={() => onRemove && onRemove(i)}
          >
            <style>{`
              @keyframes breathe {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-2px); }
              }
            `}</style>
          </motion.div>
        );
      })}
    </div>
  );
}
