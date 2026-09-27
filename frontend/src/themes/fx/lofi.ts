import { caretPoint } from './caret';
import { between, flip, isCharacter, Particles, type ParticleSpec } from './particles';
import type { ThemeFx } from './index';

/**
 * Which Lo-Fi effects a keystroke sets off. Letters and digits send up a few
 * micro-glows from the caret; space and the beat keys wash the studio
 * backlight out from behind the terminal.
 */
export function lofiEffects(key: string): { glow: boolean; backlight: boolean } {
  return {
    glow: isCharacter(key),
    backlight: key === ' ' || /^[1-8]$/.test(key),
  };
}

/** Three tiny glows, mostly neon pink, one in four cyan, gone in 200ms. */
function microGlows(): ParticleSpec[] {
  return Array.from({ length: 3 }, () => ({
    shape: 'dot',
    color: Math.random() < 0.25 ? '#67E8F9' : '#FF7AC6',
    size: between(1.2, 2.2),
    lifeMs: 200,
    vx: between(-30, 30),
    vy: -between(70, 130),
    gravity: -60,
    glow: 6,
  }));
}

export function createLofiFx(): ThemeFx {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const particles = new Particles();

  return {
    onKey(key, area) {
      if (reducedMotion.matches) return;
      const effects = lofiEffects(key);
      if (effects.glow) {
        const { x, y } = caretPoint(area);
        particles.emit(x, y, microGlows());
      }
      const terminal = area.closest<HTMLElement>('.terminal');
      if (effects.backlight && terminal) flip(terminal, 'fxBacklight');
    },
    dispose() {
      particles.dispose();
      document.querySelectorAll<HTMLElement>('[data-fx-backlight]').forEach((el) => {
        delete el.dataset.fxBacklight;
      });
    },
  };
}
