const HARMONY_KEYS = [
  { key: ',', action: 'Pause on the dominant' },
  { key: '.', action: 'Resolve home' },
  { key: '?', action: 'Hang unresolved' },
  { key: 'Enter', action: 'Change key' },
];

const BEAT_KEYS = [
  { key: '1', action: 'Kick' },
  { key: '2', action: 'Snare' },
  { key: '3', action: 'Hat' },
  { key: '4', action: 'Open hat' },
  { key: '5', action: 'Clap' },
  { key: '6', action: 'Perc' },
  { key: '7', action: 'Bass' },
  { key: '8', action: 'Stab' },
  { key: '9', action: 'FX' },
  { key: '0', action: 'Reset' },
];

/** The most recent keystroke. seq changes on every stroke, even a repeat. */
export interface StruckKey {
  key: string;
  seq: number;
  /** How many strokes so far landed on the beat (space or 1-8). */
  beats: number;
}

/** The keys that do more than type a letter, laid out like a cabinet's move list. */
export function KeyLegend({ lastKey }: { lastKey: StruckKey | null }) {
  return (
    <aside aria-label="Keys" className="panel flex flex-col gap-5">
      <KeyGroup
        title="Harmony"
        keys={HARMONY_KEYS}
        lastKey={lastKey}
        className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1"
      />
      <KeyGroup
        title="Beat"
        keys={BEAT_KEYS}
        lastKey={lastKey}
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 lg:grid-cols-2"
      />
    </aside>
  );
}

function KeyGroup({
  title,
  keys,
  lastKey,
  className,
}: {
  title: string;
  keys: { key: string; action: string }[];
  lastKey: StruckKey | null;
  className: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="panel-heading legend-heading">{title}</h2>
      <dl className={className}>
        {keys.map(({ key, action }) => {
          const struck = lastKey?.key === key;
          return (
            // Keyed by stroke, so striking the same key again remounts the
            // card and a theme's [data-pressed] animation plays again.
            <div
              key={struck ? `${key}:${lastKey.seq}` : key}
              className="key-card"
              data-pressed={struck || undefined}
            >
              <dt>
                <kbd className="keycap">{key}</kbd>
              </dt>
              <dd className="key-action">{action}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
