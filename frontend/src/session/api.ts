import type { Score } from './score';
import type { CompositionDetail, CompositionSummary, RecordedSession } from './types';

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const body = await response.json();
      if (body && typeof body.message === 'string') message = body.message;
    } catch {
      // A non-JSON error body is fine; the status is the useful part.
    }
    throw new ApiError(message, response.status);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export function saveComposition(
  session: RecordedSession,
  title: string,
): Promise<CompositionDetail> {
  return request<CompositionDetail>('/api/compositions', {
    method: 'POST',
    body: JSON.stringify({
      title,
      genreId: session.genreId,
      seed: session.seed,
      settings: { genreId: session.genreId },
      keystrokes: session.keystrokes.map((k) => ({ key: k.key, timestampMs: k.timestamp })),
    }),
  });
}

export function listCompositions(): Promise<CompositionSummary[]> {
  return request<CompositionSummary[]>('/api/compositions');
}

export function loadComposition(id: string): Promise<CompositionDetail> {
  return request<CompositionDetail>(`/api/compositions/${id}`);
}

export function deleteComposition(id: string): Promise<void> {
  return request<void>(`/api/compositions/${id}`, { method: 'DELETE' });
}

/**
 * Posts a rendered score and returns the MIDI file the server wrote. Not via
 * request(): the response is binary, and the file name comes from a header.
 */
export async function exportMidi(
  id: string,
  score: Score,
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${BASE}/api/compositions/${id}/midi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(score),
  });
  if (!response.ok) throw new ApiError(`Export failed with ${response.status}`, response.status);
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  return { blob: await response.blob(), filename: match?.[1] ?? 'composition.mid' };
}
