import { useCallback, useEffect, useState } from 'react';
import { deleteComposition, listCompositions } from '../session/api';
import type { CompositionSummary } from '../session/types';

interface Props {
  refreshKey: number;
  onPlay: (id: string) => void;
}

export function CompositionList({ refreshKey, onPlay }: Props) {
  const [items, setItems] = useState<CompositionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listCompositions());
      setError(null);
    } catch {
      // The backend not running is the common case in development, and it
      // must not break the part of the app that makes music.
      setError('Backend unavailable — typing and audio still work.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const remove = async (id: string) => {
    await deleteComposition(id);
    void refresh();
  };

  if (error) return <p className="text-sm text-neutral-500">{error}</p>;
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">No saved compositions yet.</p>;
  }

  return (
    <ul className="divide-y divide-neutral-200 rounded border border-neutral-200">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="truncate">
            <span className="font-medium">{item.title}</span>{' '}
            <span className="text-xs text-neutral-500">
              {item.genreId} · {item.keystrokeCount} keys
            </span>
          </span>
          <span className="flex shrink-0 gap-2">
            <button onClick={() => onPlay(item.id)} className="rounded border px-2 py-1 text-sm">
              Replay
            </button>
            <button
              onClick={() => void remove(item.id)}
              className="rounded border px-2 py-1 text-sm"
            >
              Delete
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
