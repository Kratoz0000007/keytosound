import { createNotationFx, notationEffects } from './notation';
import type { ThemeFx } from './index';

/**
 * Classical's keystroke effects: a letter sends a glowing gold note arcing
 * from the caret into the mascot's giant ear (or floating up, if the ear is
 * off screen), faster as the typing speeds up; space or Enter runs a gold
 * hairline around every card for 120ms.
 */
export const classicalEffects = notationEffects;

/** The middle of the mascot's ear canal on screen, if it is drawn. */
function earCanal(): { x: number; y: number } | null {
  const canal = document.querySelector('.m-red-canal');
  if (!canal) return null;
  const box = canal.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

export function createClassicalFx(): ThemeFx {
  return createNotationFx({
    colors: ['#E5C158', '#D4AF37', '#F7F1E5'],
    glow: 8,
    font: "'Bodoni Moda'",
    target: earCanal,
  });
}
