import { useEffect } from 'react';

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    // Buttons and checkboxes rendered as <input> do not consume Backspace.
    const type = (target as HTMLInputElement).type;
    return !['button', 'submit', 'reset', 'checkbox', 'radio'].includes(type);
  }
  return false;
}

/**
 * Suppresses the webview's Backspace-navigates-back behavior.
 *
 * In a Tauri webview, Backspace pressed outside a text field walks the history
 * stack, which reads to the user as the app randomly switching tabs. Text
 * fields keep their normal behavior.
 *
 * Mount once, at the app root.
 */
export function useBackspaceGuard(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace') return;
      if (isEditable(e.target)) return;
      e.preventDefault();
    };
    // Capture phase: run before any component handler can let it through.
    document.addEventListener('keydown', handler, { capture: true });
    return () => document.removeEventListener('keydown', handler, { capture: true });
  }, []);
}
