import { useEffect, useState, type ComponentType, type CSSProperties } from 'react';
import type { StruckKey } from '../KeyLegend';
import { AudiophileRedMascot } from './AudiophileRedMascot';
import { InvaderDaemon } from './InvaderDaemon';
import { SpeakeasyMascot } from './SpeakeasyMascot';
import { PikachuSquirtleMascot } from './PikachuSquirtleMascot';
import { mascotTempo } from './motion';
import { CyberDragonSkaterMascot } from './CyberDragonSkaterMascot';
import './mascots.css';

const FIGURES: Record<string, ComponentType> = {
  synthwave: CyberDragonSkaterMascot,
  lofi: PikachuSquirtleMascot,
  eightbit: InvaderDaemon,
  jazz: SpeakeasyMascot,
  classical: AudiophileRedMascot,
};

/** How long after the last keystroke the mascot keeps performing. */
const HOLD_MS = 1500;

/** Past this typing speed a mascot may go into overdrive (data-overdrive). */
const OVERDRIVE_WPM = 80;

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
 * The genre's mascot, performing along with the typing. Everything moves in
 * CSS (mascots.css): data-state switches idle and typing loops, --m-tempo
 * sets their speed from the live wpm, data-overdrive marks typing past 80
 * wpm, and data-tap / data-hit flip between a and b on each keystroke and
 * each beat. Each flip swaps in an identical
 * keyframes block, which restarts the reaction without re-rendering the
 * figure, so a keystroke costs a couple of attribute writes.
 */
export function Mascot({
  theme,
  wpm,
  lastKey,
}: {
  theme: string;
  wpm: number;
  lastKey: StruckKey | null;
}) {
  const typing = useTyping(lastKey?.seq ?? 0);
  const Figure = FIGURES[theme];
  if (!Figure) return null;

  return (
    <div
      className="mascot-stage"
      aria-hidden="true"
      data-state={typing ? 'typing' : 'idle'}
      data-overdrive={(typing && wpm > OVERDRIVE_WPM) || undefined}
      data-tap={lastKey ? parity(lastKey.seq) : undefined}
      data-hit={lastKey && lastKey.beats > 0 ? parity(lastKey.beats) : undefined}
      style={{ '--m-tempo': `${mascotTempo(wpm)}s` } as CSSProperties}
    >
      <Figure />
    </div>
  );
}
