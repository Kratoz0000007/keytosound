import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ApiError,
  deleteComposition,
  exportMidi,
  listCompositions,
  loadComposition,
  saveComposition,
} from '../../src/session/api';
import type { RecordedSession } from '../../src/session/types';

const session: RecordedSession = {
  genreId: 'lofi',
  seed: 42,
  keystrokes: [
    { key: 'a', timestamp: 0 },
    { key: 'b', timestamp: 150.5 },
  ],
};

function mockFetch(status: number, body: unknown) {
  const spy = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('saveComposition', () => {
  it('posts the keystroke stream in the wire shape', async () => {
    const spy = mockFetch(201, { id: 'abc' });

    await saveComposition(session, 'my tune');

    const [url, init] = spy.mock.calls[0];
    expect(url).toContain('/api/compositions');
    expect(init.method).toBe('POST');

    const sent = JSON.parse(init.body);
    expect(sent.title).toBe('my tune');
    expect(sent.genreId).toBe('lofi');
    expect(sent.seed).toBe(42);
    // The engine's KeyEvent.timestamp becomes the wire's timestampMs.
    expect(sent.keystrokes).toEqual([
      { key: 'a', timestampMs: 0 },
      { key: 'b', timestampMs: 150.5 },
    ]);
  });

  it('sends settings so the backend can store them as jsonb', async () => {
    const spy = mockFetch(201, { id: 'abc' });
    await saveComposition(session, 'my tune');
    expect(JSON.parse(spy.mock.calls[0][1].body).settings).toEqual({ genreId: 'lofi' });
  });

  it('throws an ApiError carrying the status on failure', async () => {
    mockFetch(400, { message: 'bad' });
    await expect(saveComposition(session, '')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('listCompositions', () => {
  it('returns the parsed list', async () => {
    mockFetch(200, [{ id: 'a', title: 't', genreId: 'lofi', keystrokeCount: 3, createdAt: 'x' }]);
    const list = await listCompositions();
    expect(list).toHaveLength(1);
    expect(list[0].keystrokeCount).toBe(3);
  });
});

describe('loadComposition', () => {
  it('requests the composition by id', async () => {
    const spy = mockFetch(200, { id: 'xyz', keystrokes: [] });
    await loadComposition('xyz');
    expect(spy.mock.calls[0][0]).toContain('/api/compositions/xyz');
  });

  it('throws with status 404 when it is missing', async () => {
    mockFetch(404, { message: 'nope' });
    await expect(loadComposition('gone')).rejects.toMatchObject({ status: 404 });
  });
});

describe('deleteComposition', () => {
  it('issues a DELETE', async () => {
    const spy = mockFetch(204, null);
    await deleteComposition('xyz');
    expect(spy.mock.calls[0][1].method).toBe('DELETE');
  });
});

describe('exportMidi', () => {
  const score = {
    bpm: 75,
    leadInstrument: 'electricPiano' as const,
    lead: [{ pitch: 69, start: 0.4, duration: 0.3, velocity: 0.7 }],
    pad: [],
    bass: [],
    drums: [],
  };

  function mockMidi(status: number, disposition: string | null) {
    const blob = new Blob(['MThd'], { type: 'audio/midi' });
    const spy = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => (name === 'Content-Disposition' ? disposition : null) },
      blob: async () => blob,
      json: async () => ({ message: 'nope' }),
    });
    vi.stubGlobal('fetch', spy);
    return { spy, blob };
  }

  it('posts the score to the composition export endpoint', async () => {
    const { spy } = mockMidi(200, 'attachment; filename="rain.mid"');
    await exportMidi('abc', score);
    const [url, init] = spy.mock.calls[0];
    expect(url).toMatch(/\/api\/compositions\/abc\/midi$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(score);
  });

  it('returns the file and the name the server chose', async () => {
    const { blob } = mockMidi(200, 'attachment; filename="rain-at-night.mid"');
    const result = await exportMidi('abc', score);
    expect(result.blob).toBe(blob);
    expect(result.filename).toBe('rain-at-night.mid');
  });

  it('falls back to a default name when the header is missing', async () => {
    mockMidi(200, null);
    expect((await exportMidi('abc', score)).filename).toBe('composition.mid');
  });

  it('throws an ApiError with the status on failure', async () => {
    mockMidi(404, null);
    await expect(exportMidi('abc', score)).rejects.toMatchObject({ status: 404 });
    await expect(exportMidi('abc', score)).rejects.toBeInstanceOf(ApiError);
  });
});
