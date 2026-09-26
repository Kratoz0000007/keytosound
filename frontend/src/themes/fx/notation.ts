import { caretPoint } from './caret';
import { between, flip, Particles, type ParticleSpec } from './particles';
import type { ThemeFx } from './index';

/** Quarter, eighth, beamed eighths, beamed sixteenths. */
export const NOTE_GLYPHS = ['♩', '♪', '♫', '♬'];

/** The fonts that actually carry the music symbols, after the theme's own. */
const SYMBOL_FONTS = "'Segoe UI Symbol', 'Noto Music', 'Apple Symbols', serif";

/** Downward pull on a note in flight, px/s^2: it arcs up off the caret, then drops in. */
const FLIGHT_GRAVITY = 900;
/** How many recent keystrokes the typing speed is judged over. */
const RATE_WINDOW = 8;

/**
 * Which notation effects a keystroke sets off. A letter sends a note off
 * the caret; space and Enter sweep light along the card borders. Digits
 * are drum keys, so they stay quiet here.
 */
export function notationEffects(key: string): { note: boolean; sweep: boolean } {
  return {
    note: /^\p{L}$/u.test(key),
    sweep: key === ' ' || key === 'Enter',
  };
}

/** Typing speed from keystroke times in ms, oldest first: five characters a word. */
export function typingWpm(times: readonly number[]): number {
  if (times.length < 2) return 0;
  const spanS = (times[times.length - 1] - times[0]) / 1000;
  return spanS > 0 ? ((times.length - 1) / spanS) * 12 : 0;
}

/** How long a note takes to fly into the target: 900ms at a crawl, down to 320ms from about 115 wpm. */
export function flightMs(wpm: number): number {
  return Math.round(Math.min(900, Math.max(320, 900 - wpm * 5)));
}

/**
 * The starting velocity, px/s, that carries a particle from `from` to `to`
 * in exactly lifeMs under the given downward gravity.
 */
export function launch(
  from: { x: number; y: number },
  to: { x: number; y: number },
  lifeMs: number,
  gravity: number,
): { vx: number; vy: number } {
  const t = lifeMs / 1000;
  return {
    vx: (to.x - from.x) / t,
    vy: (to.y - from.y) / t - (gravity * t) / 2,
  };
}

export interface NotationInk {
  /** Each note is drawn in one of these, at random. */
  colors: string[];
  /** Glow blur radius. */
  glow: number;
  /** The theme's display face, tried before the symbol fonts. */
  font: string;
  /**
   * Where the notes fly to, in viewport px, looked up on every keystroke;
   * null, or a point off screen, and they just float up from the caret.
   */
  target?: () => { x: number; y: number } | null;
}

function noteSpec(ink: NotationInk): ParticleSpec {
  const size = Math.round(between(16, 22));
  return {
    shape: 'glyph',
    glyph: NOTE_GLYPHS[Math.floor(Math.random() * NOTE_GLYPHS.length)],
    font: `${size}px ${ink.font}, ${SYMBOL_FONTS}`,
    color: ink.colors[Math.floor(Math.random() * ink.colors.length)],
    size,
    glow: ink.glow,
    lifeMs: 500,
    vx: 0,
    vy: 0,
    gravity: 0,
  };
}

/** A note rising gently off the caret and dissolving over 500ms. */
function floatingNote(ink: NotationInk): ParticleSpec {
  return { ...noteSpec(ink), vx: between(-20, 20), vy: -between(60, 90), gravity: -20 };
}

/** A note arcing from the caret into the target, shrinking and fading as it arrives. */
function homingNote(
  ink: NotationInk,
  from: { x: number; y: number },
  to: { x: number; y: number },
  lifeMs: number,
): ParticleSpec {
  return {
    ...noteSpec(ink),
    lifeMs,
    ...launch(from, to, lifeMs, FLIGHT_GRAVITY),
    gravity: FLIGHT_GRAVITY,
    fadeFrom: 0.8,
    scaleTo: 0.35,
  };
}

function onScreen(p: { x: number; y: number }): boolean {
  return p.x >= 0 && p.y >= 0 && p.x <= window.innerWidth && p.y <= window.innerHeight;
}

/**
 * Notes off the caret, and the border sweep. The sweep flips data-fx-sweep
 * on <main>, so the theme's CSS can light every card's border at once.
 */
export function createNotationFx(ink: NotationInk): ThemeFx {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const particles = new Particles();
  const times: number[] = [];

  return {
    onKey(key, area) {
      if (reducedMotion.matches) return;
      const effects = notationEffects(key);
      if (effects.note) {
        times.push(performance.now());
        if (times.length > RATE_WINDOW) times.shift();
        const caret = caretPoint(area);
        const from = { x: caret.x, y: caret.y - 8 };
        const to = ink.target?.();
        const note =
          to && onScreen(to) ? homingNote(ink, from, to, flightMs(typingWpm(times))) : floatingNote(ink);
        particles.emit(from.x, from.y, [note]);
      }
      const main = area.closest<HTMLElement>('main');
      if (effects.sweep && main) flip(main, 'fxSweep');
    },
    dispose() {
      particles.dispose();
      document.querySelectorAll<HTMLElement>('[data-fx-sweep]').forEach((el) => {
        delete el.dataset.fxSweep;
      });
    },
  };
}
