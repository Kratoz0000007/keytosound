import { describe, expect, it } from 'vitest';
import { Harmony, CADENCE_MARGIN_MS } from '../../src/engine/harmony';
import { GENRES } from '../../src/engine/presets';

const lofi = GENRES.lofi; // A minor, Am7 - Dm7 - G - C, 75 bpm
const BAR = (4 * 60000) / lofi.bpm; // 3200ms

describe('Harmony', () => {
  it('walks the progression one chord per bar', () => {
    const h = new Harmony(lofi);
    expect(h.at(0).chord).toEqual(lofi.progression[0]);
    expect(h.at(1).chord).toEqual(lofi.progression[1]);
    expect(h.at(4).chord).toEqual(lofi.progression[0]);
    expect(h.barMs).toBe(BAR);
  });

  it('maps session time to a bar', () => {
    const h = new Harmony(lofi);
    expect(h.barAt(0)).toBe(0);
    expect(h.barAt(BAR - 1)).toBe(0);
    expect(h.barAt(BAR)).toBe(1);
  });

  it('resolves a full stop to the tonic on the next bar, then restarts the progression', () => {
    const h = new Harmony(lofi);
    h.at(1); // bars 0-1 already heard
    h.request('full', BAR * 1.2); // mid bar 1
    expect(h.at(2).chord).toEqual(lofi.progression[0]);
    expect(h.at(3).chord).toEqual(lofi.progression[1]);
  });

  it('never changes chord mid-bar: a request lands on a later bar boundary', () => {
    const h = new Harmony(lofi);
    h.request('half', 10);
    expect(h.at(0).chord).toEqual(lofi.progression[0]);
    expect(h.at(1).cadence).toBe('half');
  });

  it('defers a request made just before a bar line to the bar after', () => {
    const h = new Harmony(lofi);
    h.request('half', BAR - CADENCE_MARGIN_MS / 2);
    expect(h.at(1).cadence).toBeNull();
    expect(h.at(2).cadence).toBe('half');
  });

  it('plays the dominant (Em in A minor) on a comma', () => {
    const h = new Harmony(lofi);
    h.request('half', 0);
    const bar = h.at(1);
    expect(bar.chord.root).toBe(4); // E
    expect(bar.chord.intervals).toEqual([0, 3, 7]);
  });

  it('holds the dominant for two bars on a question', () => {
    const h = new Harmony(lofi);
    h.request('open', 0);
    expect(h.at(1).chord.root).toBe(4);
    expect(h.at(2).chord.root).toBe(4);
    expect(h.at(3).chord.root).not.toBe(4);
  });

  it('modulates on Enter, transposing the whole progression', () => {
    const h = new Harmony(lofi);
    h.modulate(0);
    const bar = h.at(1);
    expect(bar.keyRoot).toBe((9 + 7) % 12); // up a fifth: E
    expect(bar.chord.root).toBe((lofi.progression[0].root + 7) % 12);
    expect(bar.tonic.root).toBe(bar.chord.root);
  });

  it('comes home after a full cycle of modulations', () => {
    const h = new Harmony(lofi);
    for (let i = 0; i < 4; i++) h.modulate(i * BAR);
    expect(h.at(4).keyRoot).toBe(9);
  });

  it('never rewrites a bar that has already been read', () => {
    const h = new Harmony(lofi);
    const before = h.at(3).chord;
    h.request('full', BAR); // effective bar would be 2, already simulated
    expect(h.at(3).chord).toEqual(before);
    expect(h.at(4).cadence).toBe('full');
  });

  it('is deterministic for the same requests', () => {
    const run = () => {
      const h = new Harmony(lofi);
      h.request('half', 500);
      h.modulate(BAR * 2.5);
      h.request('full', BAR * 4.1);
      return Array.from({ length: 8 }, (_, i) => h.at(i));
    };
    expect(run()).toEqual(run());
  });
});
