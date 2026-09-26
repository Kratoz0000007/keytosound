import { useCallback, useEffect, useState } from 'react';
import { deleteComposition, listCompositions } from '../session/api';
import type { CompositionSummary } from '../session/types';

interface Props {
  refreshKey: number;
  onPlay: (id: string) => void;
  onExport: (id: string) => void;
}

export function CompositionList({ refreshKey, onPlay, onExport }: Props) {
  const [items, setItems] = useState<CompositionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listCompositions());
      setError(null);
    } catch {
      // The backend not running is the common case in development, and it
      // must not break the part of the app that makes music.
      setError('Saving needs the backend on :8080. Typing and audio work without it.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const remove = async (id: string) => {
    await deleteComposition(id);
    void refresh();
  };

  if (error) return <p className="notice-warn">{error}</p>;
  if (items.length === 0) {
    return (
      <p className="library-empty">
        Nothing saved yet. Type a take, give it a title and press Save.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="track-row">
          <span className="min-w-0 truncate">
            <span className="track-title">{item.title}</span>{' '}
            <span className="track-meta">
              {item.genreId} · {item.keystrokeCount} keys
            </span>
          </span>
          <span className="flex shrink-0 gap-4">
            <button onClick={() => onPlay(item.id)} className="btn btn-secondary btn-sm">
              <span>Replay</span>
            </button>
            <button onClick={() => onExport(item.id)} className="btn btn-secondary btn-sm">
              <span>Export MIDI</span>
            </button>
            <button onClick={() => void remove(item.id)} className="btn btn-danger btn-sm">
              <span>Delete</span>
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
