import { caretPoint } from './caret';
import { between, Particles, type ParticleSpec } from './particles';
import type { ThemeFx } from './index';

/** How long the system glitch holds the panels displaced. */
const GLITCH_MS = 50;
/**
 * WCAG 2.3.1 allows no more than three flashes a second; typing spaces
 * would easily beat that, and fast flashing can trigger seizures.
 */
const MIN_GLITCH_GAP_MS = 334;

/** The hex a fragment can read: a prefix, a byte, or a nibble pair. */
const HEX = '0123456789ABCDEF';

/**
 * Which Cyber-Terminal effects a keystroke sets off. A letter throws hex
 * fragments off the caret; space and Enter glitch the whole interface.
 * Digits are drum keys, left to the beat.
 */
export function eightbitEffects(key: string): { fragments: boolean; glitch: boolean } {
  return {
    fragments: /^\p{L}$/u.test(key),
    glitch: key === ' ' || key === 'Enter',
  };
}

/** A scrap of hex: 0x, or a byte like FF or A1. */
export function hexFragment(rand: () => number = Math.random): string {
  if (rand() < 0.25) return '0x';
  return HEX[Math.floor(rand() * 16)] + HEX[Math.floor(rand() * 16)];
}

/**
 * Three fragments of glowing green hex scattering out from the caret,
 * gone in 200ms over three hard steps.
 */
function fragments(): ParticleSpec[] {
  return Array.from({ length: 3 }, (_, i) => {
    const angle = between(0, Math.PI * 2);
    const speed = between(120, 240);
    return {
      shape: 'glyph',
      glyph: hexFragment(),
      font: "18px 'VT323', monospace",
      color: i === 0 ? '#FFFFFF' : '#00FF41',
      size: 18,
      glow: 8,
      lifeMs: 200,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0,
      fadeSteps: 3,
    };
  });
}

export function createEightbitFx(): ThemeFx {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const particles = new Particles();
  let glitched: HTMLElement | null = null;
  let timer = 0;
  let lastGlitch = -Infinity;

  const glitch = (main: HTMLElement) => {
    const now = performance.now();
    if (now - lastGlitch < MIN_GLITCH_GAP_MS) return;
    lastGlitch = now;
    // A data attribute, not a class: React owns className and could reset it.
    main.dataset.fxGlitch = '';
    glitched = main;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      delete main.dataset.fxGlitch;
      glitched = null;
    }, GLITCH_MS);
  };

  return {
    onKey(key, area) {
      if (reducedMotion.matches) return;
      const effects = eightbitEffects(key);
      if (effects.fragments) {
        const { x, y } = caretPoint(area);
        particles.emit(x, y, fragments());
      }
      const main = area.closest<HTMLElement>('main');
      if (effects.glitch && main) glitch(main);
    },
    dispose() {
      particles.dispose();
      window.clearTimeout(timer);
      if (glitched) delete glitched.dataset.fxGlitch;
    },
  };
}
