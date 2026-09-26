import { caretPoint } from './caret';
import { between, flip, isCharacter, Particles, type ParticleSpec } from './particles';
import type { ThemeFx } from './index';

const NOTES = ['♩', '♪', '♫', '♬']; // quarter, eighth, beamed eighths, beamed sixteenths

/**
 * Which Classical effects a keystroke sets off. Letters and digits float a
 * note up from the caret; space and Enter sweep red along the rules of the
 * terminal.
 */
export function classicalEffects(key: string): { note: boolean; sweep: boolean } {
  return {
    note: isCharacter(key),
    sweep: key === ' ' || key === 'Enter',
  };
}

/** One note in ink or red pencil, rising gently and fading over 500ms. */
function floatingNote(): ParticleSpec[] {
  const size = Math.round(between(16, 22));
  return [
    {
      shape: 'glyph',
      glyph: NOTES[Math.floor(Math.random() * NOTES.length)],
      // Bodoni has no music symbols; the symbol fonts after it do.
      font: `${size}px 'Bodoni Moda', 'Segoe UI Symbol', 'Noto Music', 'Apple Symbols', serif`,
      color: Math.random() < 0.5 ? '#A4161A' : '#1C1A17',
      size,
      lifeMs: 500,
      vx: between(-20, 20),
      vy: -between(60, 90),
      gravity: -20,
    },
  ];
}

export function createClassicalFx(): ThemeFx {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const particles = new Particles();

  return {
    onKey(key, area) {
      if (reducedMotion.matches) return;
      const effects = classicalEffects(key);
      if (effects.note) {
        const { x, y } = caretPoint(area);
        particles.emit(x, y - 8, floatingNote());
      }
      const terminal = area.closest<HTMLElement>('.terminal');
      if (effects.sweep && terminal) flip(terminal, 'fxSweep');
    },
    dispose() {
      particles.dispose();
      document.querySelectorAll<HTMLElement>('[data-fx-sweep]').forEach((el) => {
        delete el.dataset.fxSweep;
      });
    },
  };
}
