import React from 'react';
import { motion } from 'framer-motion';
import { springs } from '../utils/springs';

type ButtonVariant = 'primary' | 'success' | 'secondary' | 'ghost';

interface WobbleButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  icon?: React.ReactNode;
}

/**
 * WobbleButton — Pill-shaped button with spring wobble animation
 * Variants: primary (blue), success (green), secondary (dark), ghost (outline)
 */
export default function WobbleButton({ children, onClick, variant = 'primary', disabled = false, icon }: WobbleButtonProps) {
  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-[#4A90D9] text-white shadow-md shadow-blue-200/50',
    success: 'bg-[#34C759] text-white shadow-md shadow-green-200/50',
    secondary: 'bg-[#2C2C2C] text-white shadow-md',
    ghost: 'bg-transparent text-[#4A90D9] border-2 border-[#4A90D9]',
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.06, transition: springs.snappy } : {}}
      whileTap={!disabled ? { scale: 0.88, rotate: -3, transition: springs.snappy } : {}}
      className={`flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold text-lg tracking-wide ${variantStyles[variant] ?? variantStyles.primary} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {icon && <span>{icon}</span>}
      {children}
    </motion.button>
  );
}
