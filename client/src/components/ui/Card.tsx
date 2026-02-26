import React from 'react';
import { motion } from 'motion/react';
import { NEU } from '../../utils/shadows';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <motion.div
      whileHover={onClick ? { y: -6, transition: { duration: 0.2 } } : undefined}
      whileTap={onClick ? { scale: 0.94 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`
        rounded-2xl bg-bg-card p-4
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      style={{
        boxShadow: NEU.raised,
      }}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
