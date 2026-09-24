import { describe, expect, it } from 'vitest';
import { PHRASE_VELOCITY } from '../../src/audio/lead';
import { renderSession } from '../../src/engine/engine';
import { GENRES } from '../../src/engine/presets';
import { renderScore } from '../../src/session/score';
import type { RecordedSession } from '../../src/session/types';
import { TypingAnalyzer } from '../../src/typing/analyzer';

/** Types text on a steady, human-ish rhythm, as the recorder would store it. */
function session(text: string, genreId = 'lofi', startMs = 100): RecordedSession {
  let t = startMs;
  const keystrokes = [...text].map((ch, i) => {
    t += ' .,!?'.includes(ch) ? 220 : 120 + ((i * 37) % 160);
    return { key: ch === '\n' ? 'Enter' : ch, timestamp: t };
  });
  return { genreId, seed: 20260919, keystrokes };
}

const PROSE = 'rain falls softly on the harbour, the night is long.';

describe('renderScore', () => {
  it('is deterministic', () => {
    expect(renderScore(session(PROSE))).toEqual(renderScore(session(PROSE)));
  });

  it('carries the genre tempo and lead instrument', () => {
    const score = renderScore(session(PROSE, 'synthwave'));
    expect(score.bpm).toBe(GENRES.synthwave.bpm);
    expect(score.leadInstrument).toBe(GENRES.synthwave.leadInstrument);
  });

  it('places every lead note on the 16th-note grid', () => {
    const score = renderScore(session(PROSE));
    const sixteenth = 60 / GENRES.lofi.bpm / 4;
    expect(score.lead.length).toBeGreaterThan(20);
    for (const note of score.lead) {
      const steps = note.start / sixteenth;
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
    }
  });

  it('plays the lead legato: notes never overlap and never outlast their hold', () => {
    const { lead } = renderScore(session(PROSE));
    for (let i = 0; i < lead.length - 1; i++) {
      expect(lead[i].duration).toBeGreaterThan(0);
      expect(lead[i].start + lead[i].duration).toBeLessThanOrEqual(lead[i + 1].start + 1e-9);
    }
  });

  it('holds one pad chord per bar, through the bar after the last keystroke', () => {
    const s = session(PROSE);
    const score = renderScore(s);
    const barSec = (4 * 60) / GENRES.lofi.bpm;
    const chordStarts = new Set(
      score.pad.filter((n) => Math.abs(n.duration - barSec) < 1e-9).map((n) => n.start),
    );
    const lastKeySec = s.keystrokes[s.keystrokes.length - 1].timestamp / 1000;
    expect(chordStarts.size).toBe(Math.floor(lastKeySec / barSec) + 2);
  });

  it('resolves the pad to the home chord after a full stop', () => {
    const score = renderScore(session('the night is long.'));
    const barSec = (4 * 60) / GENRES.lofi.bpm;
    const lastBar = [...score.pad]
      .filter((n) => Math.abs(n.duration - barSec) < 1e-9)
      .reduce((max, n) => Math.max(max, n.start), 0);
    const finalChord = score.pad.filter((n) => n.start === lastBar && n.duration > 1);
    const home = GENRES.lofi.progression[0];
    const expected = home.intervals.map((i) => ((home.root + i) % 12) + 48).sort();
    expect(finalChord.map((n) => n.pitch).sort()).toEqual(expected);
  });

  it('applies a digit edit only from the moment it was pressed', () => {
    // Lo-Fi starts with no clap; '5' adds one mid-session.
    const s = session('rain falls softly on the harbour');
    const pressAt = s.keystrokes[10].timestamp + 1;
    s.keystrokes.splice(11, 0, { key: '5', timestamp: pressAt });
    const claps = renderScore(s).drums.filter((d) => d.voice === 'clap');
    expect(claps.length).toBeGreaterThan(0);
    for (const clap of claps) expect(clap.start).toBeGreaterThanOrEqual(pressAt / 1000);
  });

  it('delays odd 16ths by the genre swing', () => {
    // Jazz hats fire on step 3; swing is 0.5 of a 16th.
    const score = renderScore(session(PROSE, 'jazz'));
    const sixteenth = 60 / GENRES.jazz.bpm / 4;
    const expected = 3 * sixteenth + GENRES.jazz.groove.swing * sixteenth;
    expect(score.drums.some((d) => d.voice === 'hat' && Math.abs(d.start - expected) < 1e-9)).toBe(
      true,
    );
  });

  it('puts bass hits on the chord root, two octaves down', () => {
    const score = renderScore(session(PROSE));
    expect(score.bass.length).toBeGreaterThan(0);
    const firstRoot = GENRES.lofi.progression[0].root;
    expect(score.bass[0].pitch).toBe(firstRoot + 24);
  });

  it('softens a word-start note by PHRASE_VELOCITY, as LegatoLead does live', () => {
    const s = session(PROSE);
    const analyzer = new TypingAnalyzer();
    const rawEvents = renderSession(
      s.keystrokes.map((key) => analyzer.process(key)),
      GENRES[s.genreId],
      s.seed,
    );
    const phraseIndex = rawEvents.findIndex((e) => e.articulation === 'phrase');
    expect(phraseIndex).toBeGreaterThanOrEqual(0);

    const score = renderScore(s);
    // Same note, same raw velocity from the engine; the only difference is
    // the exported multiplier a word start gets and a mid-word note does not.
    expect(score.lead[phraseIndex].velocity).toBeCloseTo(
      rawEvents[phraseIndex].velocity * PHRASE_VELOCITY,
    );
  });

  it('renders an empty session as two bars of band and no lead', () => {
    const score = renderScore({ genreId: 'lofi', seed: 1, keystrokes: [] });
    expect(score.lead).toEqual([]);
    expect(score.drums.length).toBeGreaterThan(0);
  });
});
