// PLACEHOLDER UI. Deliberately plain until the stats view gets a real design.
// Replace this file wholesale then: the data (getAnalytics) and the formatting
// helpers (analyticsView.ts) do not need to change.
import { useEffect, useState, type ReactNode } from 'react';
import { getAnalytics } from '../session/api';
import type { CompositionAnalytics, PauseKind } from '../session/types';
import { asPercent, barPercent, formatMs, keyLabel } from './analyticsView';
import { isUnauthorized } from './authView';

interface Props {
  id: string;
  title: string;
  onClose: () => void;
  /** Must be stable: the fetch depends on it. */
  onUnauthorized: () => void;
}

const PAUSE_LABELS: [PauseKind, string][] = [
  ['word', 'Between words'],
  ['comma', 'After a comma'],
  ['sentence', 'After a sentence'],
  ['hesitation', 'Hesitation'],
];

/** Mount with key={id}: a new composition remounts it, which resets the state. */
export function AnalyticsPanel({ id, title, onClose, onUnauthorized }: Props) {
  const [data, setData] = useState<CompositionAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getAnalytics(id).then(
      (result) => {
        if (live) setData(result);
      },
      (err: unknown) => {
        if (!live) return;
        if (isUnauthorized(err)) onUnauthorized();
        else setError('Could not load stats.');
      },
    );
    return () => {
      live = false;
    };
  }, [id, onUnauthorized]);

  return (
    <section className="flex flex-col gap-4 rounded border border-neutral-200 bg-white p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate font-semibold">Stats · {title}</h2>
        <button onClick={onClose} className="rounded border px-2 py-1">
          Close
        </button>
      </div>
      {error && <p className="text-neutral-500">{error}</p>}
      {!data && !error && <p className="text-neutral-500">Loading…</p>}
      {data && <Stats data={data} />}
    </section>
  );
}

function Stats({ data }: { data: CompositionAnalytics }) {
  const { summary, rhythm, sentences, pauses, keys } = data;
  const maxBand = Math.max(0, ...rhythm.bands.map((b) => b.count));
  const maxWpm = Math.max(0, ...sentences.map((s) => s.wpm ?? 0));

  return (
    <>
      <Section title="Summary">
        <Row label="Keys" value={String(summary.keyCount)} />
        <Row label="Length" value={formatMs(summary.durationMs)} />
        <Row label="Average speed" value={`${Math.round(summary.averageWpm)} wpm`} />
        <Row
          label="Fastest sentence"
          value={summary.peakWpm === null ? '—' : `${Math.round(summary.peakWpm)} wpm`}
        />
        <Row label="Held keys ignored" value={String(summary.heldKeysIgnored)} />
      </Section>

      <Section title="Rhythm">
        <Row
          label="Usual gap"
          value={rhythm.medianGapMs === null ? '—' : formatMs(rhythm.medianGapMs)}
        />
        <Row
          label="Steady keypresses"
          value={rhythm.steadiness === null ? '—' : asPercent(rhythm.steadiness)}
        />
        {rhythm.bands.map((b) => (
          <Bar
            key={b.fromMs}
            label={`${b.fromMs}–${b.toMs}ms`}
            value={String(b.count)}
            percent={barPercent(b.count, maxBand)}
          />
        ))}
      </Section>

      <Section title="Speed per sentence">
        {sentences.length === 0 && <p className="text-neutral-500">No sentences.</p>}
        {sentences.map((s, i) => (
          <Bar
            key={i}
            label={s.label || '(blank)'}
            value={s.wpm === null ? '—' : `${Math.round(s.wpm)} wpm`}
            percent={barPercent(s.wpm ?? 0, maxWpm)}
          />
        ))}
      </Section>

      <Section title="Pauses">
        <Row label="Pauses" value={String(pauses.count)} />
        <Row label="Time paused" value={formatMs(pauses.totalMs)} />
        <Row label="Longest" value={formatMs(pauses.longestMs)} />
        {PAUSE_LABELS.map(([kind, label]) => (
          <Row key={kind} label={label} value={String(pauses.byKind[kind])} />
        ))}
        {pauses.segments.length > 0 && (
          <p className="whitespace-pre-wrap break-words rounded bg-neutral-50 p-2 font-mono">
            {pauses.segments.map((seg, i) => (
              <span key={i}>
                {seg.text}
                {seg.pauseAfterMs !== null && (
                  <span className="text-neutral-400">[{formatMs(seg.pauseAfterMs)}]</span>
                )}
              </span>
            ))}
          </p>
        )}
      </Section>

      <Section title="Keys">
        <Row
          label="Backspaces"
          value={`${keys.backspaces} (${asPercent(keys.correctionRate)})`}
        />
        <Row label="Enter" value={String(keys.enters)} />
        <Row label="Drum hits" value={String(keys.drums)} />
        <Row
          label="Punctuation"
          value={Object.entries(keys.punctuation)
            .map(([mark, n]) => `${mark} ${n}`)
            .join('   ')}
        />
        {keys.top.length > 0 && (
          <table className="mt-1 font-mono">
            <tbody>
              {keys.top.map((k) => (
                <tr key={k.key}>
                  <td className="pr-6 text-neutral-500">{keyLabel(k.key)}</td>
                  <td>{k.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-medium">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-0.5">
      <span className="text-neutral-500">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Bar({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div className="grid grid-cols-[10rem_1fr_5rem] items-center gap-2">
      <span className="truncate text-neutral-500">{label}</span>
      <div className="h-2 bg-neutral-100">
        <div className="h-2 bg-neutral-400" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-right font-mono">{value}</span>
    </div>
  );
}
