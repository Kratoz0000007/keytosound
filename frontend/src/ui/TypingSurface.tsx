import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/audioEngine';
import { MusicEngine } from '../engine/engine';
import { GENRES, DEFAULT_GENRE_ID } from '../engine/presets';
import { noteName } from '../engine/theory';
import type { ScaleName } from '../engine/types';
import { TypingAnalyzer } from '../typing/analyzer';
import { attachCapture } from '../typing/capture';
import type { KeyEvent } from '../typing/types';
import { ApiError, exportMidi, loadComposition, saveComposition } from '../session/api';
import { SessionRecorder } from '../session/recorder';
import { sessionFromDetail } from '../session/render';
import { ReplayPlayer } from '../session/replay';
import { renderScore } from '../session/score';
import { CompositionList } from './CompositionList';
import { saveBlob } from './download';
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
  keyRoot: number | null;
  current: number | null;
  previous: number | null;
  wpm: number;
  chordIndex: number;
}

const EMPTY_READOUT: Readout = {
  keyRoot: null,
  current: null,
  previous: null,
  wpm: 0,
  chordIndex: 0,
};

export function TypingSurface() {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const analyzerRef = useRef(new TypingAnalyzer());
  const musicRef = useRef(new MusicEngine(GENRES[DEFAULT_GENRE_ID], SEED));
  // The band reads harmony and the beat from whichever engine is current.
  const audioRef = useRef(new AudioEngine(GENRES[DEFAULT_GENRE_ID], () => musicRef.current));
  const recorderRef = useRef(new SessionRecorder());
  const playerRef = useRef(new ReplayPlayer());

  const [genreId, setGenreId] = useState(DEFAULT_GENRE_ID);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
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

    // A digit edits the loop. If the step it landed on has already gone by
    // this bar, play the hit now so the press is heard immediately; otherwise
    // the band plays it when it arrives.
    const edit = musicRef.current.lastBeatEdit;
    if (edit?.voice && edit.added && edit.stepTimeMs < features.timestamp) {
      audioRef.current.hit(edit.voice);
    }

    if (!event) {
      setReadout((r) => ({
        ...r,
        keyRoot: state.keyRoot,
        wpm: features.speed,
        chordIndex: state.chordIndex,
      }));
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
      keyRoot: state.keyRoot,
      current: event.pitch,
      previous: r.current,
      wpm: features.speed,
      chordIndex: state.chordIndex,
    }));
  }, []);

  const handleKey = useCallback(
    (key: KeyEvent) => {
      // Restamp on the transport's clock, the same timeline the band's bars
      // are counted on. It skips paused time, which the browser clock would not.
      const stamped = { key: key.key, timestamp: audioRef.current.sessionMs() };
      recorderRef.current.record(stamped);
      consumeKey(stamped);
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

  const togglePause = () => {
    if (paused) {
      audioRef.current.resume();
      setPaused(false);
      areaRef.current?.focus();
      return;
    }
    // A replay would keep feeding keystrokes into a silent engine.
    playerRef.current.stop();
    audioRef.current.pause();
    setPaused(true);
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
    audioRef.current.resume();
    setPaused(false);
    setNotes([]);
    setReadout(EMPTY_READOUT);
    setStatus('Replaying...');

    playerRef.current.play(session, consumeKey, () => setStatus('Replay finished.'));
  };

  const exportComposition = async (id: string) => {
    setStatus('Exporting MIDI...');
    try {
      const session = sessionFromDetail(await loadComposition(id));
      const { blob, filename } = await exportMidi(id, renderScore(session));
      saveBlob(blob, filename);
      setStatus(`Exported ${filename}.`);
    } catch (err) {
      // ApiError carries the server's status, e.g. a 400 over-cap score or a
      // 404 for a composition deleted in another tab; anything else is the
      // network failure the old message described.
      setStatus(
        err instanceof ApiError
          ? `Export failed (${err.status}).`
          : 'Export failed — is the backend running on :8080?',
      );
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">keytosound</h1>
        <p className="text-sm text-neutral-500">
          Type. Words become phrases; punctuation moves the harmony.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          <kbd>,</kbd> pause on the dominant · <kbd>.</kbd> resolve home · <kbd>?</kbd> hang
          unresolved · <kbd>Enter</kbd> change key · digits edit the beat: 1 kick · 2 snare · 3
          hat · 4 open hat · 5 clap · 6 perc · 7 bass · 8 stab · 9 fx · 0 reset
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
        {running && (
          <button
            onClick={togglePause}
            className="rounded border border-neutral-900 px-4 py-2 hover:bg-neutral-100"
          >
            {paused ? 'Resume beat' : 'Pause beat'}
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
          value={`${noteName((readout.keyRoot ?? preset.keyRoot) + 60).slice(0, -1)} ${SCALE_LABELS[preset.scale]}`}
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
        disabled={!running || paused}
        placeholder={
          !running ? 'Press Start audio first' : paused ? 'Paused. Press Resume beat' : 'Start typing...'
        }
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

      <CompositionList
        refreshKey={refreshKey}
        onPlay={(id) => void replay(id)}
        onExport={(id) => void exportComposition(id)}
      />
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
