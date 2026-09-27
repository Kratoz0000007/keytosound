import * as Tone from 'tone';
import { VOICES, type Voice } from '../engine/beat';
import type { BarHarmony } from '../engine/harmony';
import { pitchClass } from '../engine/theory';
import type { Chord, GenrePreset, InstrumentId } from '../engine/types';
import { DEFAULT_KIT, KITS } from './kits';
import { AMBIENCE, KIT_SAMPLES, PITCHED, type DrumVoice } from './sampleLibrary';
import { SampledChords, SampledHit, type ChordVoice } from './sampledVoices';
import { Ambience, createPlayers, createSampler } from './samplers';

const STEPS_PER_BAR = 16;

/**
 * What the band needs from the engine. The band makes no musical decisions:
 * the chord comes from the engine's Harmony and the hits from its BeatPattern,
 * so the lead and the band can never disagree about either.
 */
export interface BandSource {
  harmonyAt(bar: number): BarHarmony;
  beatHas(voice: Voice, step: number): boolean;
  readonly swing: number;
  readonly barMs: number;
}

/** Where the pad, stab and bass sit when a preset does not say. */
const DEFAULT_PAD_OCTAVE = 4;
const DEFAULT_BASS_OCTAVE = 2;

/** The drone sits this much quieter than the pad it shares an instrument with. */
const DRONE_DB = -6;

function midiNote(pitch: number): string {
  return Tone.Frequency(pitch, 'midi').toNote();
}

function chordToNotes(chord: Chord, octave: number): string[] {
  return chord.intervals.map((interval) =>
    midiNote(pitchClass(chord.root + interval) + 12 * octave),
  );
}

const DRUM_VOICES: DrumVoice[] = ['kick', 'snare', 'hat', 'openHat', 'clap', 'perc', 'fx'];

function polyVoice(synth: Tone.PolySynth): ChordVoice {
  return {
    play: (notes, duration, time) => synth.triggerAttackRelease(notes, duration, time),
    release: () => synth.releaseAll(),
    dispose: () => synth.dispose(),
  };
}

/**
 * Plays only hits that land after the previous one. Tone's synths start a
 * source per hit on a single timeline and throw on an earlier time, which
 * happens when a digit's immediate hit lands just after the sequencer queued
 * the same voice a few ms ahead. That queued hit is as good as this one.
 */
function inOrder(play: (time: number) => void): (time: number) => void {
  let last = -Infinity;
  return (time) => {
    if (time < last) return;
    last = time;
    play(time);
  };
}

function monoVoice(synth: Tone.MonoSynth): ChordVoice {
  // One oscillator on one timeline, like the drum synths: see inOrder.
  let last = -Infinity;
  return {
    play: (notes, duration, time) => {
      if (time < last) return;
      last = time;
      synth.triggerAttackRelease(notes[0], duration, time);
    },
    release: () => synth.triggerRelease(),
    dispose: () => synth.dispose(),
  };
}

/**
 * The pad's synth: its own patch for a synth-only instrument, else the soft
 * sine pad, which is also what a recorded pad plays until it loads.
 */
function padSynth(id: InstrumentId | undefined): Tone.PolySynth {
  const pad =
    id === 'synthPad'
      ? new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'fatsawtooth', count: 3, spread: 40 },
          envelope: { attack: 0.9, decay: 0.5, sustain: 0.8, release: 2.5 },
        })
      : new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 0.6, decay: 1, sustain: 0.6, release: 2 },
        });
  pad.volume.value = id === 'synthPad' ? -28 : -20;
  return pad.toDestination();
}

/** The bass's synth, chosen the same way as padSynth. */
function bassSynth(id: InstrumentId | undefined): Tone.MonoSynth {
  const bass =
    id === 'synthBass'
      ? new Tone.MonoSynth({
          oscillator: { type: 'sawtooth' },
          filter: { Q: 3, type: 'lowpass' },
          envelope: { attack: 0.005, decay: 0.2, sustain: 0.5, release: 0.15 },
          filterEnvelope: { attack: 0.005, decay: 0.15, sustain: 0.2, baseFrequency: 90, octaves: 3.5 },
        })
      : new Tone.MonoSynth({
          oscillator: { type: 'square' },
          envelope: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.4 },
        });
  bass.volume.value = -14;
  return bass.toDestination();
}

/** The recorded instrument when there is one, else the band's synth voice. */
function recorded(id: InstrumentId | undefined, fallback: ChordVoice, gainDb = 0): ChordVoice {
  const samples = id ? PITCHED[id] : undefined;
  if (!samples) return fallback;
  const sampler = createSampler({ ...samples, volume: samples.volume + gainDb });
  return new SampledChords(sampler.toDestination(), fallback);
}

/**
 * Nine voices plus a chord pad on a 16th-note grid. Reads its source through
 * a getter, because the engine is replaced on every genre switch and replay.
 */
export class BackingBand {
  private readonly pad: ChordVoice;
  private readonly drone: ChordVoice | null = null;
  private readonly ambience: Ambience | null = null;
  private readonly padOctave: number;
  private readonly bassOctave: number;
  private readonly bass: ChordVoice;
  private readonly kick: Tone.MembraneSynth;
  private readonly perc: Tone.MembraneSynth;
  private readonly snare: Tone.NoiseSynth;
  private readonly snareEffects: Tone.ToneAudioNode[] = [];
  private readonly hat: Tone.NoiseSynth;
  private readonly openHat: Tone.NoiseSynth;
  private readonly clap: Tone.NoiseSynth;
  private readonly clapFilter: Tone.Filter;
  private readonly stab: ChordVoice;
  private readonly fx: Tone.NoiseSynth;
  private readonly hit: Record<DrumVoice, (time: number) => void>;
  private readonly sampledHits: SampledHit[] = [];
  private sequence: Tone.Sequence<number> | null = null;
  private chord: Chord;
  private keyRoot: number;

  constructor(
    private readonly preset: GenrePreset,
    private readonly source: () => BandSource,
  ) {
    const kit = KITS[preset.id] ?? DEFAULT_KIT;
    this.chord = preset.progression[0];
    this.keyRoot = preset.keyRoot;
    this.padOctave = preset.padOctave ?? DEFAULT_PAD_OCTAVE;
    this.bassOctave = preset.bassOctave ?? DEFAULT_BASS_OCTAVE;

    this.pad = recorded(preset.padInstrument, polyVoice(padSynth(preset.padInstrument)));

    if (preset.drone) {
      // Its own voice, so a new pad chord never cuts the drone off.
      const drone = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.8, decay: 0.2, sustain: 0.9, release: 2 },
      }).toDestination();
      drone.volume.value = -22;
      this.drone = recorded(preset.padInstrument, polyVoice(drone), DRONE_DB);
    }

    const bed = AMBIENCE[preset.id];
    if (bed) this.ambience = new Ambience(bed);

    this.bass = recorded(preset.bassInstrument, monoVoice(bassSynth(preset.bassInstrument)));

    this.kick = new Tone.MembraneSynth({
      pitchDecay: kit.kick.pitchDecay,
      octaves: kit.kick.octaves,
      oscillator: { type: kit.kick.oscillator },
      envelope: { attack: 0.001, decay: kit.kick.decay, sustain: 0 },
    }).toDestination();
    this.kick.volume.value = -10;

    this.perc = new Tone.MembraneSynth({
      pitchDecay: kit.perc.pitchDecay,
      octaves: kit.perc.octaves,
      envelope: { attack: 0.001, decay: 0.25, sustain: 0 },
    }).toDestination();
    this.perc.volume.value = -16;

    // Longer, brighter decay than the hat: reads as a snare rather than a tick.
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    });
    this.snare.volume.value = -18;
    if (kit.gatedSnare) {
      // The gate shuts once the reverb tail falls below its threshold.
      const reverb = new Tone.Reverb({ decay: 1.8, wet: 0.6 });
      const gate = new Tone.Gate(-38, 0.04);
      this.snare.chain(reverb, gate, Tone.getDestination());
      this.snareEffects.push(reverb, gate);
      this.snare.volume.value = -14;
    } else {
      this.snare.toDestination();
    }

    this.hat = new Tone.NoiseSynth({
      noise: { type: kit.hatNoise },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
    }).toDestination();
    this.hat.volume.value = -26;

    this.openHat = new Tone.NoiseSynth({
      noise: { type: kit.hatNoise },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0 },
    }).toDestination();
    this.openHat.volume.value = -28;

    this.clapFilter = new Tone.Filter(kit.clapHz, 'bandpass').toDestination();
    this.clap = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.003, decay: 0.14, sustain: 0 },
    }).connect(this.clapFilter);
    this.clap.volume.value = -8;

    const stab = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: kit.stabOscillator },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.1 },
    }).toDestination();
    stab.volume.value = -20;
    this.stab = recorded(preset.stabInstrument, polyVoice(stab));

    // A swell into the beat it lands on, not a hit on it.
    this.fx = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.7, decay: 0.05, sustain: 0 },
    }).toDestination();
    this.fx.volume.value = -24;

    const synthHit: Record<DrumVoice, (time: number) => void> = {
      kick: inOrder((time) => this.kick.triggerAttackRelease(kit.kick.note, '8n', time)),
      snare: inOrder((time) => this.snare.triggerAttackRelease('8n', time)),
      hat: inOrder((time) => this.hat.triggerAttackRelease('16n', time)),
      openHat: inOrder((time) => this.openHat.triggerAttackRelease('8n', time)),
      clap: inOrder((time) => this.clap.triggerAttackRelease('16n', time)),
      perc: inOrder((time) => this.perc.triggerAttackRelease(kit.perc.note, '8n', time)),
      fx: inOrder((time) => this.fx.triggerAttackRelease('4n', time)),
    };
    // A kit's recordings replace its synth hits voice by voice; the synth hit
    // plays until they load, and for any voice the kit does not record.
    const samples = KIT_SAMPLES[preset.id] ?? {};
    this.hit = { ...synthHit };
    for (const voice of DRUM_VOICES) {
      const set = samples[voice];
      if (!set) continue;
      const sampled = new SampledHit(createPlayers(set), synthHit[voice]);
      this.sampledHits.push(sampled);
      this.hit[voice] = (time) => sampled.trigger(time);
    }
  }

  /**
   * Queues the loop on the transport. Does not start the transport itself:
   * AudioEngine owns it, so pausing and genre switches are decided in one place.
   */
  start(): void {
    const transport = Tone.getTransport();
    transport.bpm.value = this.preset.bpm;
    const sixteenth = Tone.Time('16n').toSeconds();
    const steps = Array.from({ length: STEPS_PER_BAR }, (_, i) => i);

    this.sequence = new Tone.Sequence<number>(
      (time, step) => {
        const source = this.source();
        // Swing delays the odd 16ths, which is what separates a Lo-Fi drag
        // from Synthwave's rigid grid.
        const swung = step % 2 === 1 ? time + sixteenth * source.swing : time;

        if (step === 0) {
          const seconds = transport.getSecondsAtTime(time);
          const bar = Math.max(0, Math.round((seconds * 1000) / source.barMs));
          const harmony = source.harmonyAt(bar);
          this.chord = harmony.chord;
          this.keyRoot = harmony.keyRoot;
          this.pad.play(chordToNotes(this.chord, this.padOctave), '1m', time);
          // Sa and Pa of whatever key the music is in, restated every bar.
          const sa = pitchClass(this.keyRoot) + 12 * this.padOctave;
          this.drone?.play([midiNote(sa), midiNote(sa + 7)], '1m', time);
        }

        for (const voice of VOICES) {
          if (source.beatHas(voice, step)) this.trigger(voice, swung);
        }
      },
      steps,
      '16n',
    ).start(0);
  }

  /** Plays one voice at `time`. Also used for immediate feedback on a digit press. */
  trigger(voice: Voice, time: number = Tone.now()): void {
    if (voice === 'bass') {
      const root = midiNote(pitchClass(this.chord.root) + 12 * this.bassOctave);
      this.bass.play([root], '8n', time);
    } else if (voice === 'stab') {
      this.stab.play(chordToNotes(this.chord, this.padOctave), '16n', time);
    } else {
      this.hit[voice](time);
    }
  }

  /** Starts the genre's ambience bed, if it has one; again after every pause. */
  startAmbience(): void {
    this.ambience?.start();
  }

  /** Cuts any held notes; the pad's '1m' chords otherwise ring on after a pause. */
  release(): void {
    this.ambience?.stop();
    this.drone?.release();
    this.pad.release();
    this.stab.release();
    this.bass.release();
  }

  dispose(): void {
    // Dispose without stop(): dispose already cancels the sequence, while
    // stop() schedules a stop at the transport's current position, which just
    // after a restart can be -4e-13s. Tone throws on that, and a genre switch
    // made moments after Start would abort half-way with no lead instrument.
    this.sequence?.dispose();
    this.pad.dispose();
    this.drone?.dispose();
    this.ambience?.dispose();
    this.bass.dispose();
    this.stab.dispose();
    for (const hit of this.sampledHits) hit.dispose();
    for (const effect of this.snareEffects) effect.dispose();
    for (const node of [
      this.kick,
      this.perc,
      this.snare,
      this.hat,
      this.openHat,
      this.clap,
      this.clapFilter,
      this.fx,
    ]) {
      node.dispose();
    }
  }
}
