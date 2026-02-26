import React from 'react';
import { NEU } from '../../utils/shadows';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base = 'rounded-xl font-medium transition-colors duration-200 ease-[var(--ease-spring)] focus:outline-none disabled:opacity-50 neu-btn';
  const variants = {
    primary: 'bg-accent text-accent-fg',
    secondary: 'bg-bg-card text-text-primary',
    ghost: 'bg-transparent text-text-secondary hover:text-text-primary',
    danger: 'bg-red text-white',
  };
  const shadows: Record<string, React.CSSProperties> = {
    primary: { boxShadow: NEU.raisedSm },
    secondary: { boxShadow: NEU.raisedSm },
    ghost: {},
    danger: { boxShadow: NEU.raisedSm },
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      style={shadows[variant]}
      {...props}
    >
      {children}
    </button>
  );
}
