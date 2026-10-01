import React, { useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface JiggleCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export default function JiggleCard({ children, className = '', onClick, disabled = false }: JiggleCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Mouse coordinates (normalized between -1 and 1)
  const x = useSpring(0, { stiffness: 60, damping: 20 });
  const y = useSpring(0, { stiffness: 60, damping: 20 });

  const rotateX = useTransform(y, [-1, 1], [12, -12]);
  const rotateY = useTransform(x, [-1, 1], [-12, 12]);
  const rotateZ = useTransform(x, [-1, 1], [-3, 3]);

  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !ref.current) return;

    const rect = ref.current.getBoundingClientRect();

    // Calculate mouse position relative to the element
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Normalize to -1 to 1
    const xPct = (mouseX / rect.width) * 2 - 1;
    const yPct = (mouseY / rect.height) * 2 - 1;

    x.set(xPct);
    y.set(yPct);

    // Update glow position (in percentage)
    setGlowPos({
      x: (mouseX / rect.width) * 100,
      y: (mouseY / rect.height) * 100
    });
  };

  const handleMouseLeave = () => {
    if (disabled) return;
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={!disabled ? onClick : undefined}
      style={{
        rotateX,
        rotateY,
        rotateZ,
        transformPerspective: 800
      }}
      className={`relative bg-white rounded-2xl border border-gray-100 transition-shadow duration-300 overflow-hidden ${
        isHovered ? 'shadow-2xl' : 'shadow-md'
      } ${disabled ? 'opacity-70' : 'cursor-pointer'} ${className}`}
    >
      {/* Mouse Glow */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, rgba(74, 144, 217, 0.06) 0%, transparent 60%)`
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}
