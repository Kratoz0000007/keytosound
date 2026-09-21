import type { KeyEvent } from './types';

const IGNORED_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'Tab',
  'Escape',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

/**
 * The only file in typing/ permitted to touch the DOM. Returns a detach
 * function so React can clean up on unmount.
 */
export function attachCapture(
  element: HTMLElement,
  onKey: (event: KeyEvent) => void,
): () => void {
  const handler = (e: KeyboardEvent) => {
    if (IGNORED_KEYS.has(e.key)) return;
    // Digits are drum keys: they play the beat and stay out of the text.
    if (/^[0-9]$/.test(e.key)) e.preventDefault();
    onKey({ key: e.key, timestamp: performance.now() });
  };
  element.addEventListener('keydown', handler);
  return () => element.removeEventListener('keydown', handler);
}
