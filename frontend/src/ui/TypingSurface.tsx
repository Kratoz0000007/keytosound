import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { createThemeFx, type ThemeFx } from '../themes/fx';
import { themeFor } from '../themes/themes';
import { CompositionList } from './CompositionList';
import { saveBlob } from './download';
import { KeyLegend, type StruckKey } from './KeyLegend';
import { Mascot } from './mascots/Mascot';
import { isBeatKey } from './mascots/motion';
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
  /** Counts played notes, so a repeated pitch still flashes the readout. */
  seq: number;
}

const EMPTY_READOUT: Readout = {
  keyRoot: null,
  current: null,
  previous: null,
  wpm: 0,
  chordIndex: 0,
  seq: 0,
};

export function TypingSurface() {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fxRef = useRef<ThemeFx | null>(null);
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
  const [lastKey, setLastKey] = useState<StruckKey | null>(null);

  const preset = GENRES[genreId];
  const theme = themeFor(genreId);

  // On <html>, not a wrapper, so the page background and scrollbar follow the
  // theme too. A layout effect, so it lands before paint and before the
  // Visualizer's own effect reads the theme's colours.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // A theme's keystroke effects, if it has any, live as long as the theme.
  useEffect(() => {
    const fx = createThemeFx(theme);
    fxRef.current = fx;
    return () => {
      fx?.dispose();
      fxRef.current = null;
    };
  }, [theme]);

  /** Runs for both live typing and replay — replay is not a special case. */
  const consumeKey = useCallback((key: KeyEvent) => {
    setLastKey((k) => ({
      key: key.key,
      seq: (k?.seq ?? 0) + 1,
      beats: (k?.beats ?? 0) + (isBeatKey(key.key) ? 1 : 0),
    }));
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
      seq: r.seq + 1,
    }));
  }, []);

  const handleKey = useCallback(
    (key: KeyEvent) => {
      // Restamp on the transport's clock, the same timeline the band's bars
      // are counted on. It skips paused time, which the browser clock would not.
      const stamped = { key: key.key, timestamp: audioRef.current.sessionMs() };
      recorderRef.current.record(stamped);
      consumeKey(stamped);
      if (areaRef.current) fxRef.current?.onKey(key.key, areaRef.current);
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

  const terminalMessage = !running
    ? 'Press Start audio first'
    : paused
      ? 'Paused. Press Resume beat'
      : 'Start typing...';

  return (
    <>
      <div className="fx-grain" aria-hidden="true" />
      <div className="fx-vignette" aria-hidden="true" />
      <div className="fx-scanlines" aria-hidden="true" />

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8 sm:py-12">
        <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="flex flex-col gap-4">
            <h1 className="app-title">keytosound</h1>
            <p className="tagline max-w-prose">
              Type. Words become phrases; punctuation moves the harmony.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 pb-1">
            {!running && (
              <button onClick={start} className="btn btn-start">
                <span>Start audio</span>
              </button>
            )}
            {running && (
              <button
                onClick={togglePause}
                className={paused ? 'btn btn-start' : 'btn btn-secondary'}
              >
                <span>{paused ? 'Resume beat' : 'Pause beat'}</span>
              </button>
            )}
            <label className="genre-select">
              <span className="sr-only">Genre</span>
              <select value={genreId} onChange={(e) => changeGenre(e.target.value)}>
                {Object.values(GENRES).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <div className="chassis hud">
          <div className="chassis-frame">
            <dl
              data-live={running && !paused}
              className="chassis-body hud-panel grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
            >
              <Stat
                label="Current note"
                value={readout.current === null ? '—' : noteName(readout.current)}
                flashKey={readout.seq}
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
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <div className="chassis terminal">
              <div className="chassis-frame">
                <div className="chassis-body terminal-body">
                  <span className="terminal-prompt" aria-hidden="true">
                    &gt;
                  </span>
                  <textarea
                    ref={areaRef}
                    disabled={!running || paused}
                    placeholder={terminalMessage}
                    aria-label="Typing area"
                    spellCheck={false}
                    className="terminal-input"
                  />
                  <p className="terminal-ghost" aria-hidden="true">
                    {terminalMessage}
                    <span className="terminal-cursor" />
                  </p>
                </div>
              </div>
            </div>

            <Visualizer notes={notes} theme={theme} />
            <Mascot theme={theme} wpm={readout.wpm} lastKey={lastKey} />
          </div>

          <KeyLegend lastKey={lastKey} />
        </div>

        <section aria-labelledby="saved-heading" className="flex flex-col gap-4">
          <h2 id="saved-heading" className="panel-heading">
            Saved compositions
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Composition title"
              aria-label="Composition title"
              className="field min-w-48 flex-1"
            />
            <button onClick={() => void save()} className="btn btn-primary">
              <span>Save</span>
            </button>
          </div>
          <p role="status" className="status-line">
            {status}
          </p>
          <CompositionList
            refreshKey={refreshKey}
            onPlay={(id) => void replay(id)}
            onExport={(id) => void exportComposition(id)}
          />
        </section>
      </main>
    </>
  );
}

function Stat({ label, value, flashKey }: { label: string; value: string; flashKey?: number }) {
  // A flashKey marks the live readout: changing it remounts the value, which
  // replays the flash so each new note registers even at the same pitch.
  return (
    <div className="hud-cell">
      <dt className="hud-label">{label}</dt>
      <dd
        key={flashKey}
        className={flashKey === undefined ? 'hud-value' : 'hud-value hud-value-live'}
      >
        {value}
      </dd>
    </div>
  );
}
