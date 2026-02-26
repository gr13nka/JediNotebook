import React from 'react';
import { NEU } from '../../utils/shadows';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <label className="block">
      {label && (
        <span className="block text-sm text-text-secondary mb-1 transition-colors duration-200">{label}</span>
      )}
      <input
        className={`w-full rounded-xl bg-bg-card px-3 py-2 text-text-primary placeholder:text-text-muted transition-colors duration-200 focus:outline-none ${className}`}
        style={{
          border: 'none',
          boxShadow: NEU.pressed,
        }}
        {...props}
      />
    </label>
  );
}
