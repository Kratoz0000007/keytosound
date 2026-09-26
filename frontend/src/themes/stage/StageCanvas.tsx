import { useEffect, useRef, type RefObject } from 'react';
import { caretPoint } from '../fx/caret';

/** What the page tells a theme's stage: the live typing speed and the last keystroke. */
export interface StageProps {
  wpm: number;
  /**
   * The most recent keystroke; seq changes on every stroke, even a repeat,
   * and beats counts the strokes so far that landed on the beat.
   */
  lastKey: { key: string; seq: number; beats: number } | null;
  /** The typing area, for stages that play off the caret. */
  area: RefObject<HTMLTextAreaElement | null>;
}

/** One keystroke, as a stage sees it. x and y are the caret in viewport px, or NaN. */
export interface StageEvent {
  key: string;
  at: number;
  x: number;
  y: number;
  /** Whether the stroke landed on the beat (space or a drum key). */
  beat: boolean;
}

export interface StageInput {
  wpm: number;
  lastKeyAt: number;
  /** Keystrokes since the previous frame, oldest first. */
  events: readonly StageEvent[];
}

/**
 * A theme's picture. The canvas and its loop belong to StageCanvas; a scene
 * only says what to draw. Its coordinates are CSS pixels of the viewport,
 * whatever resolution the buffer really has.
 */
export interface Scene {
  resize(width: number, height: number): void;
  /** Draws one frame. At rest (reduced motion) it is called once, with dt 0 and no events. */
  draw(ctx: CanvasRenderingContext2D, now: number, dt: number, input: StageInput): void;
}

/**
 * A full-window canvas behind the page, running a scene on
 * requestAnimationFrame.
 *
 * The props only land in a ref. The loop reads that ref on its own
 * schedule, so a keystroke never waits on a frame and a frame never waits
 * on React. Keystrokes queue up as events, each stamped with where the
 * caret was, and the next frame takes the whole queue.
 *
 * Stage art is soft light, so the buffer runs below screen resolution
 * (`scale`) and the browser scales it up: at 0.5 there is a quarter of the
 * pixels to fill every frame. With reduced motion the scene is drawn once,
 * still, and redrawn only on resize.
 */
export function StageCanvas({
  createScene,
  scale = 0.5,
  caret = false,
  className,
  wpm,
  lastKey,
  area,
}: StageProps & {
  /** Called once when the canvas mounts. Pass a module-level function. */
  createScene: () => Scene;
  scale?: number;
  /** Whether events need the caret's position. Finding it costs a layout read. */
  caret?: boolean;
  className: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({
    wpm,
    lastKeyAt: Number.NEGATIVE_INFINITY,
    events: [] as StageEvent[],
    running: false,
  });

  useEffect(() => {
    live.current.wpm = wpm;
  }, [wpm]);

  const seq = lastKey?.seq ?? 0;
  const key = lastKey?.key ?? '';
  const beats = lastKey?.beats ?? 0;
  // The beat count at the previous keystroke: a stroke is a beat if it moved it.
  const beatsSeen = useRef(beats);
  useEffect(() => {
    if (seq === 0) return;
    const state = live.current;
    const beat = beats > beatsSeen.current;
    beatsSeen.current = beats;
    state.lastKeyAt = performance.now();
    // Nothing would ever drain the queue while the scene stands still.
    if (!state.running) return;
    const point = caret && area.current ? caretPoint(area.current) : { x: Number.NaN, y: Number.NaN };
    state.events.push({ key, at: state.lastKeyAt, x: point.x, y: point.y, beat });
  }, [seq, key, beats, caret, area]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const scene = createScene();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const state = live.current;
    const still: StageInput = { wpm: 0, lastKeyAt: Number.NEGATIVE_INFINITY, events: [] };

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      // Capped, so a tab coming back from the background doesn't fling everything.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      scene.draw(ctx, now, dt, state);
      state.events.length = 0;
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      state.events.length = 0;
      state.running = !reducedMotion.matches;
      if (!state.running) {
        scene.draw(ctx, 0, 0, still);
        return;
      }
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const resize = () => {
      // clientWidth, not innerWidth: the canvas must not run under the scrollbar.
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      scene.resize(width, height);
      if (!state.running) scene.draw(ctx, 0, 0, still);
    };

    resize();
    start();
    window.addEventListener('resize', resize);
    reducedMotion.addEventListener('change', start);
    return () => {
      cancelAnimationFrame(frame);
      state.running = false;
      window.removeEventListener('resize', resize);
      reducedMotion.removeEventListener('change', start);
    };
  }, [createScene, scale]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
