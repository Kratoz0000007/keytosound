import { useEffect, useState, type CSSProperties } from 'react';
import type { StruckKey } from '../KeyLegend';
import { mascotTempo } from './motion';
import { SynthMascot } from './SynthMascot';
import './mascots.css';

/** How long after the last keystroke the mascot keeps performing. */
const HOLD_MS = 1500;

/**
 * True from a keystroke until HOLD_MS after the last one. State is set only
 * by the timer, never in the effect body, so a keystroke adds no render of
 * its own.
 */
function useTyping(seq: number): boolean {
  const [restedAt, setRestedAt] = useState(0);
  useEffect(() => {
    if (seq === 0) return;
    const timer = window.setTimeout(() => setRestedAt(seq), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [seq]);
  return seq > 0 && restedAt !== seq;
}

const parity = (n: number) => (n % 2 === 1 ? 'a' : 'b');

/**
 * The synth robot mascot, performing along with the typing. Everything moves in
 * CSS (mascots.css): data-state switches idle and typing loops, --m-tempo
 * sets their speed from the live wpm, and data-tap / data-hit flip between
 * a and b on each keystroke and each beat. Each flip swaps in an identical
 * keyframes block, which restarts the reaction without re-rendering the
 * figure, so a keystroke costs a couple of attribute writes.
 */
export function Mascot({ wpm, lastKey }: { wpm: number; lastKey: StruckKey | null }) {
  const typing = useTyping(lastKey?.seq ?? 0);

  return (
    <div
      className="mascot-stage"
      aria-hidden="true"
      data-state={typing ? 'typing' : 'idle'}
      data-tap={lastKey ? parity(lastKey.seq) : undefined}
      data-hit={lastKey && lastKey.beats > 0 ? parity(lastKey.beats) : undefined}
      style={{ '--m-tempo': `${mascotTempo(wpm)}s` } as CSSProperties}
    >
      <SynthMascot />
    </div>
  );
}
