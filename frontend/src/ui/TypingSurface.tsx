import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/audioEngine';
import { MusicEngine } from '../engine/engine';
import { GENRES, DEFAULT_GENRE_ID } from '../engine/presets';
import { noteName } from '../engine/theory';
import type { ScaleName } from '../engine/types';
import { TypingAnalyzer } from '../typing/analyzer';
import { attachCapture } from '../typing/capture';
import type { KeyEvent } from '../typing/types';
import { loadComposition, saveComposition } from '../session/api';
import { SessionRecorder } from '../session/recorder';
import { sessionFromDetail } from '../session/render';
import { ReplayPlayer } from '../session/replay';
import { CompositionList } from './CompositionList';
import { Visualizer } from './Visualizer';
import type { VisualNote } from './visualizerLayout';

const SEED = 20260919;
/** How many notes the visualizer keeps; older ones have scrolled away anyway. */
const NOTE_HISTORY = 200;

const SCALE_LABELS: Record<ScaleName, string> = {
  minorPentatonic: 'min pent',
  majorPentatonic: 'maj pent',
  dorian: 'dorian',
  major: 'major',
};

interface Readout {
  current: number | null;
  previous: number | null;
  wpm: number;
  chordIndex: number;
}

const EMPTY_READOUT: Readout = { current: null, previous: null, wpm: 0, chordIndex: 0 };

export function TypingSurface() {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const analyzerRef = useRef(new TypingAnalyzer());
  const musicRef = useRef(new MusicEngine(GENRES[DEFAULT_GENRE_ID], SEED));
  const audioRef = useRef(new AudioEngine(GENRES[DEFAULT_GENRE_ID]));
  const recorderRef = useRef(new SessionRecorder());
  const playerRef = useRef(new ReplayPlayer());

  const [genreId, setGenreId] = useState(DEFAULT_GENRE_ID);
  const [running, setRunning] = useState(false);
  const [readout, setReadout] = useState<Readout>(EMPTY_READOUT);
  const [notes, setNotes] = useState<VisualNote[]>([]);
  const [title, setTitle] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const preset = GENRES[genreId];

  /** Runs for both live typing and replay — replay is not a special case. */
  const consumeKey = useCallback((key: KeyEvent) => {
    const features = analyzerRef.current.process(key);
    const event = musicRef.current.step(features);
    const state = musicRef.current.getState();
    if (!event) {
      setReadout((r) => ({ ...r, wpm: features.speed, chordIndex: state.chordIndex }));
      return;
    }
    audioRef.current.play(event);
    setNotes((current) => [
      ...current.slice(-NOTE_HISTORY),
      {
        pitch: event.pitch,
        at: performance.now(),
        durationBeats: event.durationBeats,
        velocity: event.velocity,
      },
    ]);
    setReadout((r) => ({
      current: event.pitch,
      previous: r.current,
      wpm: features.speed,
      chordIndex: state.chordIndex,
    }));
  }, []);

  const handleKey = useCallback(
    (key: KeyEvent) => {
      recorderRef.current.record(key);
      consumeKey(key);
    },
    [consumeKey],
  );

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    return attachCapture(el, handleKey);
  }, [handleKey]);

  const start = async () => {
    await audioRef.current.start();
    recorderRef.current.start(genreId, SEED);
    setRunning(true);
    areaRef.current?.focus();
  };

  const changeGenre = (id: string) => {
    playerRef.current.stop();
    setGenreId(id);
    musicRef.current = new MusicEngine(GENRES[id], SEED);
    analyzerRef.current.reset();
    audioRef.current.setGenre(GENRES[id]);
    recorderRef.current.start(id, SEED);
    setReadout(EMPTY_READOUT);
    setNotes([]);
  };

  const save = async () => {
    const session = recorderRef.current.snapshot();
    if (session.keystrokes.length === 0) {
      setStatus('Type something first.');
      return;
    }
    try {
      await saveComposition(session, title.trim() || 'Untitled');
      setStatus(`Saved ${session.keystrokes.length} keystrokes.`);
      setTitle('');
      setRefreshKey((k) => k + 1);
    } catch {
      setStatus('Save failed — is the backend running on :8080?');
    }
  };

  const replay = async (id: string) => {
    let session;
    try {
      session = sessionFromDetail(await loadComposition(id));
    } catch {
      setStatus('Could not load that composition.');
      return;
    }

    // Restore the saved genre and seed before a single note plays, or replay
    // produces different music from what was recorded.
    const preset = GENRES[session.genreId] ?? GENRES[DEFAULT_GENRE_ID];
    setGenreId(preset.id);
    musicRef.current = new MusicEngine(preset, session.seed);
    analyzerRef.current.reset();
    audioRef.current.setGenre(preset);
    setNotes([]);
    setReadout(EMPTY_READOUT);
    setStatus('Replaying...');

    playerRef.current.play(session, consumeKey, () => setStatus('Replay finished.'));
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">keytosound</h1>
        <p className="text-sm text-neutral-500">
          Type. The transition engine composes a melody over the band.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        {!running && (
          <button
            onClick={start}
            className="rounded bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700"
          >
            Start audio
          </button>
        )}
        <select
          value={genreId}
          onChange={(e) => changeGenre(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        >
          {Object.values(GENRES).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Stat
          label="Current note"
          value={readout.current === null ? '—' : noteName(readout.current)}
        />
        <Stat
          label="Previous note"
          value={readout.previous === null ? '—' : noteName(readout.previous)}
        />
        <Stat
          label="Key / scale"
          value={`${noteName(preset.keyRoot + 60).slice(0, -1)} ${SCALE_LABELS[preset.scale]}`}
        />
        <Stat label="BPM" value={String(preset.bpm)} />
        <Stat label="Typing speed" value={`${Math.round(readout.wpm)} wpm`} />
        <Stat
          label="Chord"
          value={`${(readout.chordIndex % preset.progression.length) + 1} / ${preset.progression.length}`}
        />
      </dl>

      <textarea
        ref={areaRef}
        disabled={!running}
        placeholder={running ? 'Start typing...' : 'Press Start audio first'}
        className="h-48 w-full resize-none rounded border border-neutral-300 p-4 font-mono text-lg outline-none focus:border-neutral-900 disabled:bg-neutral-50"
      />

      <Visualizer notes={notes} />

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Composition title"
          className="flex-1 rounded border border-neutral-300 px-3 py-2"
        />
        <button
          onClick={() => void save()}
          className="rounded bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700"
        >
          Save
        </button>
      </div>

      {status && <p className="text-sm text-neutral-500">{status}</p>}

      <CompositionList refreshKey={refreshKey} onPlay={(id) => void replay(id)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-200 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="font-mono text-base">{value}</dd>
    </div>
  );
}
