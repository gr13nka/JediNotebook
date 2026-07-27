import React, { useCallback, useEffect, useRef } from 'react';

interface TaskTextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'rows' | 'value'> {
  value: string;
  onValueChange: (value: string) => void;
  onCommit?: () => void;
  onCancel?: () => void;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  focusOnMount?: boolean;
  stopPropagation?: boolean;
}

export function TaskTextArea({
  value,
  onValueChange,
  onCommit,
  onCancel,
  textareaRef: forwardedRef,
  focusOnMount = false,
  stopPropagation = true,
  className = '',
  onKeyDown,
  onClick,
  onPointerDown,
  ...props
}: TaskTextAreaProps) {
  const localRef = useRef<HTMLTextAreaElement>(null);

  const setTextareaRef = useCallback((node: HTMLTextAreaElement | null) => {
    localRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
    }
  }, [forwardedRef]);

  const resize = useCallback(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [resize, value]);

  useEffect(() => {
    if (!focusOnMount) return;
    const el = localRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [focusOnMount]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || e.nativeEvent.isComposing) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit?.();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    }
  };

  return (
    <textarea
      {...props}
      ref={setTextareaRef}
      value={value}
      rows={1}
      onChange={(e) => {
        onValueChange(e.target.value);
        resize();
      }}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        onClick?.(e);
      }}
      onPointerDown={(e) => {
        if (stopPropagation) e.stopPropagation();
        onPointerDown?.(e);
      }}
      className={`block w-full min-w-0 resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent outline-none [overflow-wrap:anywhere] ${className}`}
    />
  );
}
