import { describe, expect, it, vi } from 'vitest';
import type { LeadVoice } from '../../src/audio/lead';
import {
  SampledChords,
  SampledHit,
  SampledLead,
  type ChordVoice,
  type PlayerLike,
  type SamplerLike,
} from '../../src/audio/sampledVoices';

function fakeSampler(loaded: boolean) {
  return {
    loaded,
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    triggerAttackRelease: vi.fn(),
    releaseAll: vi.fn(),
    dispose: vi.fn(),
  } satisfies SamplerLike & { loaded: boolean };
}

function fakeLead(): LeadVoice & Record<'triggerAttack' | 'setNote' | 'triggerRelease' | 'dispose', ReturnType<typeof vi.fn>> {
  return {
    portamento: 0,
    triggerAttack: vi.fn(),
    setNote: vi.fn(),
    triggerRelease: vi.fn(),
    dispose: vi.fn(),
  };
}

function fakeChords() {
  return { play: vi.fn(), release: vi.fn(), dispose: vi.fn() } satisfies ChordVoice;
}

function fakePlayer(loaded = true) {
  return { loaded, start: vi.fn(), dispose: vi.fn() } satisfies PlayerLike;
}

describe('SampledLead', () => {
  it('plays the fallback until the samples have loaded', () => {
    const sampler = fakeSampler(false);
    const fallback = fakeLead();
    const lead = new SampledLead(sampler, fallback);

    lead.triggerAttack('C4', 1, 0.8);

    expect(fallback.triggerAttack).toHaveBeenCalledWith('C4', 1, 0.8);
    expect(sampler.triggerAttack).not.toHaveBeenCalled();
  });

  it('plays the sampler once loaded', () => {
    const sampler = fakeSampler(true);
    const fallback = fakeLead();
    new SampledLead(sampler, fallback).triggerAttack('C4', 1, 0.8);

    expect(sampler.triggerAttack).toHaveBeenCalledWith('C4', 1, 0.8);
    expect(fallback.triggerAttack).not.toHaveBeenCalled();
  });

  it('is monophonic: a new note releases the one sounding', () => {
    const sampler = fakeSampler(true);
    const lead = new SampledLead(sampler, fakeLead());

    lead.triggerAttack('C4', 1, 0.8);
    lead.triggerAttack('E4', 2, 0.8);

    expect(sampler.triggerRelease).toHaveBeenCalledWith('C4', 2);
    expect(sampler.triggerAttack).toHaveBeenLastCalledWith('E4', 2, 0.8);
  });

  it('re-strikes on a glide, since a recording cannot slide', () => {
    const sampler = fakeSampler(true);
    const lead = new SampledLead(sampler, fakeLead());

    lead.triggerAttack('C4', 1, 0.6);
    lead.setNote('D4', 2);

    expect(sampler.triggerRelease).toHaveBeenCalledWith('C4', 2);
    expect(sampler.triggerAttack).toHaveBeenLastCalledWith('D4', 2, 0.6);
  });

  it('glides on the fallback while it is the one playing', () => {
    const fallback = fakeLead();
    const lead = new SampledLead(fakeSampler(false), fallback);

    lead.triggerAttack('C4', 1, 0.6);
    lead.setNote('D4', 2);

    expect(fallback.setNote).toHaveBeenCalledWith('D4', 2);
  });

  it('hands over cleanly when the samples finish loading mid-line', () => {
    const sampler = fakeSampler(false);
    const fallback = fakeLead();
    const lead = new SampledLead(sampler, fallback);

    lead.triggerAttack('C4', 1, 0.8);
    sampler.loaded = true;
    lead.triggerAttack('E4', 2, 0.8);

    expect(fallback.triggerRelease).toHaveBeenCalledWith(2);
    expect(sampler.triggerAttack).toHaveBeenCalledWith('E4', 2, 0.8);
  });

  it('release silences whichever voice is sounding', () => {
    const sampler = fakeSampler(true);
    const lead = new SampledLead(sampler, fakeLead());

    lead.triggerAttack('C4', 1, 0.8);
    lead.triggerRelease(3);
    lead.triggerRelease(4);

    expect(sampler.triggerRelease).toHaveBeenCalledTimes(1);
    expect(sampler.triggerRelease).toHaveBeenCalledWith('C4', 3);
  });

  it('passes portamento to the fallback, the only voice that can use it', () => {
    const fallback = fakeLead();
    const lead = new SampledLead(fakeSampler(true), fallback);

    lead.portamento = 0.1;

    expect(fallback.portamento).toBe(0.1);
    expect(lead.portamento).toBe(0.1);
  });

  it('disposes both voices', () => {
    const sampler = fakeSampler(true);
    const fallback = fakeLead();
    new SampledLead(sampler, fallback).dispose();

    expect(sampler.dispose).toHaveBeenCalled();
    expect(fallback.dispose).toHaveBeenCalled();
  });
});

describe('SampledChords', () => {
  it('plays the fallback until loaded, then the sampler', () => {
    const sampler = fakeSampler(false);
    const fallback = fakeChords();
    const chords = new SampledChords(sampler, fallback);

    chords.play(['C4', 'E4', 'G4'], '1m', 0);
    sampler.loaded = true;
    chords.play(['F4', 'A4', 'C5'], '1m', 2);

    expect(fallback.play).toHaveBeenCalledWith(['C4', 'E4', 'G4'], '1m', 0);
    expect(sampler.triggerAttackRelease).toHaveBeenCalledWith(['F4', 'A4', 'C5'], '1m', 2);
    expect(fallback.play).toHaveBeenCalledTimes(1);
  });

  it('release and dispose reach both voices', () => {
    const sampler = fakeSampler(true);
    const fallback = fakeChords();
    const chords = new SampledChords(sampler, fallback);

    chords.release();
    chords.dispose();

    expect(sampler.releaseAll).toHaveBeenCalled();
    expect(fallback.release).toHaveBeenCalled();
    expect(sampler.dispose).toHaveBeenCalled();
    expect(fallback.dispose).toHaveBeenCalled();
  });
});

describe('SampledHit', () => {
  it('plays the synth hit until every recording has loaded', () => {
    const fallback = vi.fn();
    const players = [fakePlayer(true), fakePlayer(false)];
    new SampledHit(players, fallback).trigger(1);

    expect(fallback).toHaveBeenCalledWith(1);
    expect(players[0].start).not.toHaveBeenCalled();
  });

  it('cycles through the recordings in turn', () => {
    const players = [fakePlayer(), fakePlayer(), fakePlayer()];
    const hit = new SampledHit(players, vi.fn());

    for (const t of [1, 2, 3, 4]) hit.trigger(t);

    expect(players[0].start.mock.calls).toEqual([[1], [4]]);
    expect(players[1].start.mock.calls).toEqual([[2]]);
    expect(players[2].start.mock.calls).toEqual([[3]]);
  });

  it('falls back when it has no recordings at all', () => {
    const fallback = vi.fn();
    new SampledHit([], fallback).trigger(1);
    expect(fallback).toHaveBeenCalledWith(1);
  });

  it('disposes every player', () => {
    const players = [fakePlayer(), fakePlayer()];
    new SampledHit(players, vi.fn()).dispose();
    for (const p of players) expect(p.dispose).toHaveBeenCalled();
  });
});
