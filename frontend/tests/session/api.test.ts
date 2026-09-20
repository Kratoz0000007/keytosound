import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ApiError,
  deleteComposition,
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
