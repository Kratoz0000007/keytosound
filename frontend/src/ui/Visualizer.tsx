import { useEffect, useRef } from 'react';
import {
  BAR_HEIGHT,
  layoutNotes,
  matrixLevels,
  scopeWave,
  type VisualNote,
} from './visualizerLayout';

const WIDTH = 760;
const HEIGHT = 200;
const WINDOW_MS = 6000;
const MIN_PITCH = 48;
const MAX_PITCH = 88;

/** The dot matrix: 38 x 10 cells of 20px, each holding a 14px dot. */
const MATRIX_COLUMNS = 38;
const MATRIX_ROWS = 10;
const MATRIX_CELL = 20;
const MATRIX_DOT = 14;
const MATRIX_DECAY_MS = 600;

/** The oscilloscope: sampled every 4px, ringing for 1.2s a note. */
const SCOPE_SAMPLES = 191;
const SCOPE_DECAY_MS = 1200;
const SCOPE_SWING = HEIGHT * 0.36;
const STAVE_GAP = 14;

/**
 * How a theme draws the notes: a scrolling roll, a dot-matrix equalizer, or
 * an oscilloscope trace. The scope can carry decoration: rising smoke that
 * thickens as notes play, or a stave behind the trace.
 */
type VizStyle = 'roll' | 'matrix' | 'scope';
type VizDecor = 'none' | 'smoke' | 'staves';

interface Palette {
  style: VizStyle;
  decor: VizDecor;
  bg: string;
  /** Octave guides in the roll; unlit dots in the matrix; the centre line of the scope. */
  grid: string;
  note: string;
  /** The playhead in the roll; the peak dot of each column in the matrix. */
  playhead: string;
  /** Smoke or stave colour for the scope's decoration. */
  accent: string;
  /** Blur radius of the glow around notes and the playhead; 0 for none. */
  glow: number;
}

/** Used for anything a theme leaves out. */
const DEFAULT_PALETTE: Palette = {
  style: 'roll',
  decor: 'none',
  bg: '#000000',
  grid: '#333333',
  note: '#FFFFFF',
  playhead: '#FFFFFF',
  accent: 'rgba(255, 255, 255, 0.15)',
  glow: 0,
};

interface Puff {
  x: number;
  y: number;
  r: number;
  vy: number;
  sway: number;
  born: number;
  life: number;
}

/** Reads the canvas style and colours from the active theme's --viz-* variables. */
function readPalette(el: HTMLElement): Palette {
  const style = getComputedStyle(el);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  const glow = Number.parseFloat(read('--viz-glow', ''));
  const vizStyle = read('--viz-style', DEFAULT_PALETTE.style);
  const decor = read('--viz-decor', DEFAULT_PALETTE.decor);
  return {
    style: vizStyle === 'matrix' || vizStyle === 'scope' ? vizStyle : 'roll',
    decor: decor === 'smoke' || decor === 'staves' ? decor : 'none',
    bg: read('--viz-bg', DEFAULT_PALETTE.bg),
    grid: read('--viz-grid', DEFAULT_PALETTE.grid),
    note: read('--viz-note', DEFAULT_PALETTE.note),
    playhead: read('--viz-playhead', DEFAULT_PALETTE.playhead),
    accent: read('--viz-accent', DEFAULT_PALETTE.accent),
    glow: Number.isFinite(glow) ? glow : DEFAULT_PALETTE.glow,
  };
}

/** Centre line of a bar at this pitch, matching layoutNotes' mapping. */
function pitchY(pitch: number): number {
  const normalised = (pitch - MIN_PITCH) / (MAX_PITCH - MIN_PITCH);
  return Math.round((1 - normalised) * (HEIGHT - BAR_HEIGHT) + BAR_HEIGHT / 2);
}

function drawRoll(ctx: CanvasRenderingContext2D, notes: VisualNote[], palette: Palette, now: number) {
  // One guide per C, so a note's height reads against its octave.
  ctx.fillStyle = palette.grid;
  for (let pitch = MIN_PITCH; pitch <= MAX_PITCH; pitch += 12) {
    ctx.fillRect(0, pitchY(pitch), WIDTH, 1);
  }

  const bars = layoutNotes(notes, {
    width: WIDTH,
    height: HEIGHT,
    windowMs: WINDOW_MS,
    now,
    minPitch: MIN_PITCH,
    maxPitch: MAX_PITCH,
  });

  ctx.fillStyle = palette.note;
  ctx.shadowColor = palette.note;
  ctx.shadowBlur = palette.glow;
  for (const bar of bars) {
    ctx.globalAlpha = bar.alpha;
    ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  }
  ctx.globalAlpha = 1;

  // The present is the right edge; notes are born there.
  ctx.fillStyle = palette.playhead;
  ctx.shadowColor = palette.playhead;
  ctx.fillRect(WIDTH - 2, 0, 2, HEIGHT);
  ctx.shadowBlur = 0;
}

function drawMatrix(ctx: CanvasRenderingContext2D, notes: VisualNote[], palette: Palette, now: number) {
  const levels = matrixLevels(notes, {
    columns: MATRIX_COLUMNS,
    rows: MATRIX_ROWS,
    now,
    minPitch: MIN_PITCH,
    maxPitch: MAX_PITCH,
    decayMs: MATRIX_DECAY_MS,
  });

  // Integer coordinates throughout, so every dot lands on whole pixels.
  const inset = (MATRIX_CELL - MATRIX_DOT) / 2;
  for (let col = 0; col < MATRIX_COLUMNS; col++) {
    const level = levels[col];
    for (let row = 0; row < MATRIX_ROWS; row++) {
      ctx.fillStyle =
        row === level - 1 ? palette.playhead : row < level ? palette.note : palette.grid;
      ctx.fillRect(
        col * MATRIX_CELL + inset,
        HEIGHT - (row + 1) * MATRIX_CELL + inset,
        MATRIX_DOT,
        MATRIX_DOT,
      );
    }
  }
}

/**
 * Smoke drifting up the scope: more puffs, faster, the harder the trace is
 * swinging, so the room seems to breathe with the music.
 */
function drawSmoke(
  ctx: CanvasRenderingContext2D,
  puffs: Puff[],
  energy: number,
  palette: Palette,
  now: number,
  dt: number,
) {
  if (Math.random() < 0.04 + energy * 0.6) {
    puffs.push({
      x: Math.random() * WIDTH,
      y: HEIGHT + 10,
      r: 6 + Math.random() * 6,
      vy: 18 + Math.random() * 22 + energy * 40,
      sway: Math.random() * Math.PI * 2,
      born: now,
      life: 3000 + Math.random() * 2000,
    });
  }

  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    const t = (now - p.born) / p.life;
    if (t >= 1) {
      puffs.splice(i, 1);
      continue;
    }
    p.y -= p.vy * dt;
    const x = p.x + Math.sin(p.sway + t * 5) * 10;
    const r = p.r * (1 + t * 2.5);
    const gradient = ctx.createRadialGradient(x, p.y, 0, x, p.y, r);
    gradient.addColorStop(0, palette.accent);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = Math.sin(Math.PI * t);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawScope(
  ctx: CanvasRenderingContext2D,
  notes: VisualNote[],
  palette: Palette,
  now: number,
  dt: number,
  puffs: Puff[],
) {
  const mid = HEIGHT / 2;
  const wave = scopeWave(notes, {
    samples: SCOPE_SAMPLES,
    now,
    minPitch: MIN_PITCH,
    maxPitch: MAX_PITCH,
    decayMs: SCOPE_DECAY_MS,
  });
  const energy = wave.reduce((sum, v) => sum + Math.abs(v), 0) / wave.length;

  if (palette.decor === 'smoke') {
    drawSmoke(ctx, puffs, energy, palette, now, dt);
  } else if (palette.decor === 'staves') {
    // A stave behind the trace, so the scope reads as a line of music.
    ctx.fillStyle = palette.accent;
    for (let line = -2; line <= 2; line++) {
      ctx.fillRect(0, Math.round(mid + line * STAVE_GAP), WIDTH, 1);
    }
  } else {
    ctx.fillStyle = palette.grid;
    ctx.fillRect(0, mid, WIDTH, 1);
  }

  // A slow idle ripple under the notes, so the trace never lies dead flat.
  const step = WIDTH / (SCOPE_SAMPLES - 1);
  ctx.beginPath();
  for (let i = 0; i < SCOPE_SAMPLES; i++) {
    const x = i * step;
    const idle = 0.035 * Math.sin((i / SCOPE_SAMPLES) * Math.PI * 4 + now / 650);
    const y = mid - (wave[i] + idle) * SCOPE_SWING;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = palette.note;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.shadowColor = palette.note;
  ctx.shadowBlur = palette.glow;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/**
 * Draws the notes as they play, in the style the theme asks for. It renders
 * whatever notes it is given, on an animation frame, so audio and picture
 * are driven by the same events; the only state it keeps is the smoke.
 */
export function Visualizer({ notes, theme }: { notes: VisualNote[]; theme: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const paletteRef = useRef(DEFAULT_PALETTE);

  // Re-read on a theme change rather than every frame: getComputedStyle is
  // not free, and the colours only change when the theme does.
  useEffect(() => {
    if (canvasRef.current) paletteRef.current = readPalette(canvasRef.current);
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const puffs: Puff[] = [];
    let last = performance.now();
    let frame = 0;
    const draw = () => {
      const palette = paletteRef.current;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      if (palette.style === 'matrix') drawMatrix(ctx, notesRef.current, palette, now);
      else if (palette.style === 'scope') drawScope(ctx, notesRef.current, palette, now, dt, puffs);
      else drawRoll(ctx, notesRef.current, palette, now);

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      aria-label="Notes as they play"
      role="img"
      className="visualizer"
    />
  );
}
