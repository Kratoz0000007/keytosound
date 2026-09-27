import { caretPoint } from './caret';
import { between, isCharacter, Particles, type ParticleSpec } from './particles';
import type { ThemeFx } from './index';

const FLASH_MS = 50;
/**
 * WCAG 2.3.1 allows no more than three flashes a second; typing spaces and
 * beats would easily beat that, and fast flashing can trigger seizures.
 */
const MIN_FLASH_GAP_MS = 334;

/**
 * Which 8-bit effects a keystroke sets off. Letters and digits throw pixels
 * from the caret; space, digits (the beat keys) and punctuation flash the
 * screen. Named keys like Enter or Backspace do neither.
 */
export function eightbitEffects(key: string): { burst: boolean; flash: boolean } {
  return {
    burst: isCharacter(key),
    flash: key === ' ' || /^[0-9]$/.test(key) || /^[^\p{L}\p{N}\s]$/u.test(key),
  };
}

/** 4 to 6 blocky pixels, lime and yellow, thrown up under arcade gravity. */
function pixelBurst(): ParticleSpec[] {
  const count = 4 + Math.floor(Math.random() * 3);
  return Array.from({ length: count }, (_, i) => ({
    shape: 'square',
    color: i % 2 ? '#FFE600' : '#39FF14',
    size: 4,
    lifeMs: 300,
    vx: between(-220, 220),
    vy: -between(140, 360),
    gravity: 1400,
    stepped: true,
  }));
}

export function createEightbitFx(): ThemeFx {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const particles = new Particles();
  const flashing = new Map<HTMLElement, number>();
  let lastFlash = -Infinity;

  const flash = (screen: HTMLElement) => {
    const now = performance.now();
    if (now - lastFlash < MIN_FLASH_GAP_MS) return;
    lastFlash = now;
    // A data attribute, not a class: React owns className and could reset it.
    screen.dataset.fxFlash = '';
    const timer = window.setTimeout(() => {
      delete screen.dataset.fxFlash;
      flashing.delete(screen);
    }, FLASH_MS);
    flashing.set(screen, timer);
  };

  return {
    onKey(key, area) {
      if (reducedMotion.matches) return;
      const effects = eightbitEffects(key);
      if (effects.burst) {
        const { x, y } = caretPoint(area);
        particles.emit(x, y, pixelBurst());
      }
      const screen = area.closest<HTMLElement>('.terminal');
      if (effects.flash && screen) flash(screen);
    },
    dispose() {
      particles.dispose();
      for (const [screen, timer] of flashing) {
        window.clearTimeout(timer);
        delete screen.dataset.fxFlash;
      }
      flashing.clear();
    },
  };
}
