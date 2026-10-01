// Framer Motion Spring Configurations
export const bouncy = { type: 'spring', stiffness: 300, damping: 15 };
export const wobbly = { type: 'spring', stiffness: 180, damping: 12 };
export const gentle = { type: 'spring', stiffness: 120, damping: 20 };
export const snappy = { type: 'spring', stiffness: 500, damping: 25 };

// Grouped object for convenience: import { springs } from './springs'
export const springs = { bouncy, wobbly, gentle, snappy };

// Framer Motion Variants
export const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } }
};

export const blockReveal = {
  hidden: { scale: 0, opacity: 0, rotate: -10 },
  show: { scale: 1, opacity: 1, rotate: 0 }
};

export const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 }
};

export const slideUp = {
  hidden: { opacity: 0, y: 50 },
  show: { opacity: 1, y: 0 }
};
