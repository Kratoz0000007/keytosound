import { beforeEach, describe, expect, it } from 'vitest';
import { LegatoLead, LEGATO_HOLD, PHRASE_VELOCITY, type LeadVoice, type LeadClock } from '../../src/audio/lead';

/** Records what the lead asked the voice to do, and what portamento was at the time. */
function fakeVoice(portamento: number) {
  const calls: { op: string; note?: string; velocity?: number; portamento: number }[] = [];
  const voice: LeadVoice = {
    portamento,
    triggerAttack(note, _time, velocity) {
      calls.push({ op: 'attack', note, velocity, portamento: voice.portamento });
    },
    setNote(note) {
      calls.push({ op: 'glide', note, portamento: voice.portamento });
    },
    triggerRelease() {
      calls.push({ op: 'release', portamento: voice.portamento });
    },
    dispose() {},
  };
  return { voice, calls };
}

/** A transport clock whose scheduled callbacks run only when the test says so. */
function fakeClock() {
  let next = 1;
  const pending = new Map<number, { at: number; fn: (time: number) => void }>();
  const clock: LeadClock = {
    scheduleOnce(fn, at) {
      const id = next++;
      pending.set(id, { at, fn });
      return id;
    },
    clear(id) {
      pending.delete(id);
    },
  };
  const runUntil = (t: number) => {
    for (const [id, item] of [...pending].sort((a, b) => a[1].at - b[1].at)) {
      if (item.at > t) break;
      pending.delete(id);
      item.fn(item.at);
    }
  };
  return { clock, pending, runUntil };
}

describe('LegatoLead', () => {
  let v: ReturnType<typeof fakeVoice>;
  let c: ReturnType<typeof fakeClock>;
  let lead: LegatoLead;

  beforeEach(() => {
    v = fakeVoice(0.1);
    c = fakeClock();
    lead = new LegatoLead(v.voice, c.clock, 0.1);
  });

  it('attacks the first note even when it is a slur', () => {
    lead.play({ note: 'A4', time: 0, at: 0, duration: 0.5, velocity: 0.8, articulation: 'slur' });
    expect(v.calls[0]).toMatchObject({ op: 'attack', note: 'A4' });
  });

  it('glides into a slurred note instead of re-attacking', () => {
    lead.play({ note: 'A4', time: 0, at: 0, duration: 0.5, velocity: 0.8, articulation: 'phrase' });
    lead.play({ note: 'C5', time: 0.25, at: 0.25, duration: 0.5, velocity: 0.8, articulation: 'slur' });
    expect(v.calls.map((call) => call.op)).toEqual(['attack', 'glide']);
    expect(v.calls[1]).toMatchObject({ note: 'C5', portamento: 0.1 });
  });

  it('holds a note until the next one instead of leaving a gap', () => {
    lead.play({ note: 'A4', time: 0, at: 0, duration: 0.5, velocity: 0.8, articulation: 'phrase' });
    lead.play({ note: 'C5', time: 0.6, at: 0.6, duration: 0.5, velocity: 0.8, articulation: 'slur' });
    // 0.6s is past A4's written length but inside its legato hold, so the
    // release was cancelled and C5 glided in from a note still sounding.
    expect(0.6).toBeLessThan(0.5 * LEGATO_HOLD);
    c.runUntil(0.6);
    expect(v.calls.map((call) => call.op)).toEqual(['attack', 'glide']);
  });

  it('releases when nothing follows', () => {
    lead.play({ note: 'A4', time: 0, at: 0, duration: 0.5, velocity: 0.8, articulation: 'phrase' });
    c.runUntil(10);
    expect(v.calls.map((call) => call.op)).toEqual(['attack', 'release']);
  });

  it('re-attacks after a release rather than gliding from silence', () => {
    lead.play({ note: 'A4', time: 0, at: 0, duration: 0.5, velocity: 0.8, articulation: 'phrase' });
    c.runUntil(10);
    lead.play({ note: 'C5', time: 10, at: 10, duration: 0.5, velocity: 0.8, articulation: 'slur' });
    expect(v.calls.map((call) => call.op)).toEqual(['attack', 'release', 'attack']);
  });

  it('starts a word with a softer attack that still glides in', () => {
    lead.play({ note: 'A4', time: 0, at: 0, duration: 0.5, velocity: 0.8, articulation: 'slur' });
    lead.play({ note: 'E5', time: 0.3, at: 0.3, duration: 0.5, velocity: 0.8, articulation: 'phrase' });
    expect(v.calls[1]).toMatchObject({ op: 'attack', note: 'E5', portamento: 0.1 });
    expect(v.calls[1].velocity).toBeCloseTo(0.8 * PHRASE_VELOCITY);
  });

  it('strikes punctuation with no glide, then restores the glide', () => {
    lead.play({ note: 'A4', time: 0, at: 0, duration: 0.5, velocity: 0.8, articulation: 'slur' });
    lead.play({ note: 'A3', time: 0.3, at: 0.3, duration: 0.5, velocity: 0.8, articulation: 'strike' });
    expect(v.calls[1]).toMatchObject({ op: 'attack', note: 'A3', portamento: 0 });
    expect(v.voice.portamento).toBe(0.1);
  });

  it('never glides a voice that cannot, like a piano: it re-strikes instead', () => {
    const piano = fakeVoice(0);
    const pianoLead = new LegatoLead(piano.voice, c.clock, 0);
    pianoLead.play({ note: 'C4', time: 0, at: 0, duration: 0.5, velocity: 0.8, articulation: 'phrase' });
    pianoLead.play({ note: 'D4', time: 0.2, at: 0.2, duration: 0.5, velocity: 0.8, articulation: 'slur' });
    expect(piano.calls.map((call) => call.op)).toEqual(['attack', 'attack']);
  });

  it('silences immediately on release()', () => {
    lead.play({ note: 'A4', time: 0, at: 0, duration: 0.5, velocity: 0.8, articulation: 'phrase' });
    lead.release();
    expect(v.calls.at(-1)?.op).toBe('release');
    expect(c.pending.size).toBe(0);
  });
});
