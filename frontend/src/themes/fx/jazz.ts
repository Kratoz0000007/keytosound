import { caretPoint } from './caret';
import { between, flip, isCharacter, Particles, type ParticleSpec } from './particles';
import type { ThemeFx } from './index';

/**
 * Which Jazz effects a keystroke sets off. Letters and digits throw brass
 * sparks and a curl of smoke from the caret; space and Enter drag a needle
 * scratch across the terminal and give it a small shake.
 */
export function jazzEffects(key: string): { sparks: boolean; scratch: boolean } {
  return {
    sparks: isCharacter(key),
    scratch: key === ' ' || key === 'Enter',
  };
}

/** Brass sparks that arc and fall, and dark-crimson smoke that rises and spreads. */
function sparksAndSmoke(): ParticleSpec[] {
  const sparks: ParticleSpec[] = Array.from({ length: 3 }, () => ({
    shape: 'dot',
    color: '#FFB703',
    size: between(1.2, 2),
    lifeMs: 400,
    vx: between(-70, 70),
    vy: -between(60, 150),
    gravity: 260,
    glow: 6,
  }));
  const smoke: ParticleSpec[] = Array.from({ length: 2 }, () => ({
    shape: 'puff',
    color: 'rgba(120, 24, 38, 0.55)',
    size: between(3, 5),
    grow: 3.5,
    lifeMs: 400,
    vx: between(-15, 15),
    vy: -between(40, 80),
    gravity: -30,
  }));
  return [...smoke, ...sparks];
}

export function createJazzFx(): ThemeFx {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const particles = new Particles();

  return {
    onKey(key, area) {
      if (reducedMotion.matches) return;
      const effects = jazzEffects(key);
      if (effects.sparks) {
        const { x, y } = caretPoint(area);
        particles.emit(x, y, sparksAndSmoke());
      }
      const terminal = area.closest<HTMLElement>('.terminal');
      if (effects.scratch && terminal) flip(terminal, 'fxScratch');
    },
    dispose() {
      particles.dispose();
      document.querySelectorAll<HTMLElement>('[data-fx-scratch]').forEach((el) => {
        delete el.dataset.fxScratch;
      });
    },
  };
}
