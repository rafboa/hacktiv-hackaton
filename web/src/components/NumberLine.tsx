import React from 'react';
import { motion } from 'framer-motion';

interface Jump {
  start: number;
  end: number;
  label?: string;
}

interface NumberLineProps {
  from?: number;
  to?: number;
  jumps?: Jump[];
  activeNumber?: number | null;
  range?: number;
}

/**
 * NumberLine — SVG horizontal number line (0-20) with animated arc jumps
 * Uses viewBox for proper SVG coordinate system — no pixel/percentage confusion
 */
export default function NumberLine({ from = 0, to = 20, jumps = [], activeNumber, range = 20 }: NumberLineProps) {
  const numbers = Array.from({ length: range + 1 }, (_, i) => i);

  // SVG coordinate system: viewBox width = 1000, padding = 40 each side
  const padding = 40;
  const svgWidth = 1000;
  const usableWidth = svgWidth - padding * 2;
  const lineY = 60; // y position of the main line

  const getX = (num: number) => padding + (num / range) * usableWidth;

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <svg viewBox={`0 0 ${svgWidth} 120`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Main horizontal line */}
        <line x1={padding} y1={lineY} x2={svgWidth - padding} y2={lineY} stroke="#ccc" strokeWidth="2" />

        {/* Tick marks and labels */}
        {numbers.map((num) => {
          const x = getX(num);
          const isActive = num === activeNumber;
          const isFrom = num === from;
          const isTo = num === to;

          return (
            <g key={num}>
              {/* Tick mark */}
              <line
                x1={x} y1={lineY - 8} x2={x} y2={lineY + 8}
                stroke={isActive ? '#4A90D9' : '#999'}
                strokeWidth={isActive ? 3 : 1.5}
              />

              {/* Number label */}
              <motion.text
                x={x}
                y={lineY + 28}
                textAnchor="middle"
                fill={isActive ? '#4A90D9' : (isFrom || isTo) ? '#F0883E' : '#2C2C2C'}
                fontSize={isActive ? '18' : '13'}
                fontWeight={isActive || isFrom || isTo ? 'bold' : 'normal'}
                fontFamily="'Inter Tight', system-ui, sans-serif"
                animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.4 }}
              >
                {num}
              </motion.text>

              {/* Active indicator dot */}
              {isActive && (
                <motion.circle
                  cx={x}
                  cy={lineY}
                  r={8}
                  fill="#4A90D9"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                />
              )}
            </g>
          );
        })}

        {/* Animated jump arcs */}
        {jumps.map((jump, idx) => {
          const x1 = getX(jump.start);
          const x2 = getX(jump.end);
          const arcHeight = 35; // height of the parabola
          const midX = (x1 + x2) / 2;
          const controlY = lineY - arcHeight;

          const path = `M ${x1} ${lineY} Q ${midX} ${controlY}, ${x2} ${lineY}`;

          return (
            <g key={idx}>
              {/* Arc path */}
              <motion.path
                d={path}
                fill="transparent"
                stroke="#F0883E"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: idx * 0.3, ease: 'easeInOut' }}
              />
              {/* Jump label */}
              <motion.text
                x={midX}
                y={controlY - 6}
                textAnchor="middle"
                fill="#F0883E"
                fontSize="12"
                fontWeight="bold"
                fontFamily="'Inter Tight', system-ui, sans-serif"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.3 + 0.3 }}
              >
                {jump.label ?? `+${Math.abs(jump.end - jump.start)}`}
              </motion.text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
