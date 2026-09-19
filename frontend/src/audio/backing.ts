import * as Tone from 'tone';
import { pitchClass } from '../engine/theory';
import type { Chord, GenrePreset } from '../engine/types';

const BAR_LENGTH = '1m';

function chordToNotes(chord: Chord, octave: number): string[] {
  return chord.intervals.map((interval) =>
    Tone.Frequency(pitchClass(chord.root + interval) + 12 * octave, 'midi').toNote(),
  );
}

/**
 * Drums, bass and a chord pad, one bar per chord. Deliberately sparse: the
 * lead has to stay audible over it. Makes no musical decisions of its own —
 * the progression comes from the genre preset.
 */
export class BackingBand {
  private readonly pad: Tone.PolySynth;
  private readonly bass: Tone.MonoSynth;
  private readonly kick: Tone.MembraneSynth;
  private readonly hat: Tone.NoiseSynth;
  private chordLoop: Tone.Loop | null = null;
  private drumLoop: Tone.Loop | null = null;
  private index = 0;

  constructor(private readonly preset: GenrePreset) {
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.6, decay: 1, sustain: 0.6, release: 2 },
    }).toDestination();
    this.pad.volume.value = -20;

    this.bass = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.4 },
    }).toDestination();
    this.bass.volume.value = -14;

    this.kick = new Tone.MembraneSynth().toDestination();
    this.kick.volume.value = -10;

    this.hat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
    }).toDestination();
    this.hat.volume.value = -26;
  }

  get chordIndex(): number {
    return this.index;
  }

  start(): void {
    Tone.getTransport().bpm.value = this.preset.bpm;

    this.chordLoop = new Tone.Loop((time) => {
      const chord = this.preset.progression[this.index % this.preset.progression.length];
      this.pad.triggerAttackRelease(chordToNotes(chord, 4), '1m', time);
      this.bass.triggerAttackRelease(
        Tone.Frequency(pitchClass(chord.root) + 24, 'midi').toNote(),
        '2n',
        time,
      );
      this.index += 1;
    }, BAR_LENGTH).start(0);

    this.drumLoop = new Tone.Loop((time) => {
      this.kick.triggerAttackRelease('C1', '8n', time);
      this.hat.triggerAttackRelease('16n', time + Tone.Time('4n').toSeconds());
    }, '2n').start(0);

    Tone.getTransport().start();
  }

  stop(): void {
    Tone.getTransport().stop();
    this.chordLoop?.stop();
    this.drumLoop?.stop();
    this.index = 0;
  }

  dispose(): void {
    this.stop();
    this.chordLoop?.dispose();
    this.drumLoop?.dispose();
    this.pad.dispose();
    this.bass.dispose();
    this.kick.dispose();
    this.hat.dispose();
  }
}
