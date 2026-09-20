import { useEffect, useRef } from 'react';
import { layoutNotes, type VisualNote } from './visualizerLayout';

const WIDTH = 760;
const HEIGHT = 200;
const WINDOW_MS = 6000;
const MIN_PITCH = 48;
const MAX_PITCH = 88;

/**
 * Draws the note stream scrolling right to left. Holds no state of its own:
 * it renders whatever notes it is given, on an animation frame, so audio and
 * picture are driven by the same events.
 */
export function Visualizer({ notes }: { notes: VisualNote[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#0b0b0f';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const bars = layoutNotes(notesRef.current, {
        width: WIDTH,
        height: HEIGHT,
        windowMs: WINDOW_MS,
        now: performance.now(),
        minPitch: MIN_PITCH,
        maxPitch: MAX_PITCH,
      });

      for (const bar of bars) {
        ctx.globalAlpha = bar.alpha;
        ctx.fillStyle = '#7dd3fc';
        ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      }
      ctx.globalAlpha = 1;

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
      className="w-full rounded border border-neutral-200"
    />
  );
}
