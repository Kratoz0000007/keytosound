import { describe, it, expect } from 'vitest';
import { renderRecorded, sessionFromDetail } from '../../src/session/render';
import type { CompositionDetail, RecordedSession } from '../../src/session/types';

function sessionOf(text: string, genreId = 'lofi', seed = 20260920): RecordedSession {
  let t = 0;
  return {
    genreId,
    seed,
    keystrokes: [...text].map((key, i) => {
      t += 90 + ((i * 53) % 180);
      return { key, timestamp: t };
    }),
  };
}

const PROSE = 'the quick brown fox jumps over the lazy dog. music from typing!';

describe('renderRecorded', () => {
  it('produces notes from a recorded session', () => {
    const events = renderRecorded(sessionOf(PROSE));
    expect(events.length).toBeGreaterThan(20);
    expect(events[0].pitch).toBeGreaterThan(0);
  });

  it('is deterministic across repeated renders', () => {
    const session = sessionOf(PROSE);
    expect(renderRecorded(session)).toEqual(renderRecorded(session));
  });

  it('produces different music for a different seed', () => {
    const a = renderRecorded(sessionOf(PROSE, 'lofi', 1));
    const b = renderRecorded(sessionOf(PROSE, 'lofi', 2));
    expect(b).not.toEqual(a);
  });

  it('produces different music for a different genre', () => {
    const a = renderRecorded(sessionOf(PROSE, 'lofi'));
    const b = renderRecorded(sessionOf(PROSE, 'classical'));
    expect(b).not.toEqual(a);
  });

  it('falls back to the default genre if the stored one is gone', () => {
    // A composition saved under a genre that a later version removed must
    // still load rather than crashing the page.
    expect(() => renderRecorded(sessionOf(PROSE, 'genre-that-no-longer-exists'))).not.toThrow();
  });
});

describe('save and reload round trip', () => {
  it('renders identically after a JSON round trip', () => {
    // Exactly what save-then-load does to the data: serialise, store, parse.
    const session = sessionOf(PROSE);
    const overTheWire: RecordedSession = JSON.parse(JSON.stringify(session));

    expect(renderRecorded(overTheWire)).toEqual(renderRecorded(session));
  });

  it('renders identically after the API shape round trip', () => {
    const session = sessionOf(PROSE);
    const detail: CompositionDetail = {
      id: '00000000-0000-0000-0000-000000000000',
      title: 'round trip',
      genreId: session.genreId,
      seed: session.seed,
      settings: { genreId: session.genreId },
      keystrokes: session.keystrokes.map((k) => ({ key: k.key, timestampMs: k.timestamp })),
      createdAt: '2026-09-20T00:00:00Z',
    };

    expect(renderRecorded(sessionFromDetail(detail))).toEqual(renderRecorded(session));
  });

  it('survives fractional millisecond timings', () => {
    // performance.now() returns fractions; if the wire format rounded them the
    // analyzer would compute different intervals and the music would drift.
    const session: RecordedSession = {
      genreId: 'lofi',
      seed: 5,
      keystrokes: [
        { key: 'a', timestamp: 0 },
        { key: 'b', timestamp: 123.456 },
        { key: 'c', timestamp: 291.789 },
      ],
    };
    const revived: RecordedSession = JSON.parse(JSON.stringify(session));

    expect(revived.keystrokes[1].timestamp).toBe(123.456);
    expect(renderRecorded(revived)).toEqual(renderRecorded(session));
  });
});
