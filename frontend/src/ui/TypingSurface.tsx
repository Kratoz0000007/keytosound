import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/audioEngine';
import { MusicEngine } from '../engine/engine';
import { GENRES, DEFAULT_GENRE_ID } from '../engine/presets';
import { noteName } from '../engine/theory';
import { TypingAnalyzer } from '../typing/analyzer';
import { attachCapture } from '../typing/capture';
import type { KeyEvent } from '../typing/types';

const SEED = 20260919;

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

  const [genreId, setGenreId] = useState(DEFAULT_GENRE_ID);
  const [running, setRunning] = useState(false);
  const [readout, setReadout] = useState<Readout>(EMPTY_READOUT);

  const preset = GENRES[genreId];

  const handleKey = useCallback((key: KeyEvent) => {
    const features = analyzerRef.current.process(key);
    const event = musicRef.current.step(features);
    const state = musicRef.current.getState();
    if (!event) {
      setReadout((r) => ({ ...r, wpm: features.speed, chordIndex: state.chordIndex }));
      return;
    }
    audioRef.current.play(event);
    setReadout((r) => ({
      current: event.pitch,
      previous: r.current,
      wpm: features.speed,
      chordIndex: state.chordIndex,
    }));
  }, []);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    return attachCapture(el, handleKey);
  }, [handleKey]);

  const start = async () => {
    await audioRef.current.start();
    setRunning(true);
    areaRef.current?.focus();
  };

  const changeGenre = (id: string) => {
    setGenreId(id);
    musicRef.current = new MusicEngine(GENRES[id], SEED);
    analyzerRef.current.reset();
    audioRef.current.setGenre(GENRES[id]);
    setReadout(EMPTY_READOUT);
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
        <Stat label="Current note" value={readout.current === null ? '—' : noteName(readout.current)} />
        <Stat
          label="Previous note"
          value={readout.previous === null ? '—' : noteName(readout.previous)}
        />
        <Stat label="Key / scale" value={`${noteName(preset.keyRoot + 60).slice(0, -1)} ${preset.scale === 'minorPentatonic' ? 'min pent' : 'maj pent'}`} />
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
        className="h-64 w-full resize-none rounded border border-neutral-300 p-4 font-mono text-lg outline-none focus:border-neutral-900 disabled:bg-neutral-50"
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
