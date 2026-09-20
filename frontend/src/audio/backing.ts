import * as Tone from 'tone';
import { pitchClass } from '../engine/theory';
import type { Chord, GenrePreset } from '../engine/types';

const STEPS_PER_BAR = 16;

function chordToNotes(chord: Chord, octave: number): string[] {
  return chord.intervals.map((interval) =>
    Tone.Frequency(pitchClass(chord.root + interval) + 12 * octave, 'midi').toNote(),
  );
}

/**
 * Drums, bass and a chord pad, sequenced on a 16th-note grid from the genre's
 * groove. Deliberately sparse: the lead has to stay audible over it. Makes no
 * musical decisions of its own — both the progression and the rhythm come
 * from the preset, which is what lets a new genre be pure data.
 */
export class BackingBand {
  private readonly pad: Tone.PolySynth;
  private readonly bass: Tone.MonoSynth;
  private readonly kick: Tone.MembraneSynth;
  private readonly snare: Tone.NoiseSynth;
  private readonly hat: Tone.NoiseSynth;
  private sequence: Tone.Sequence<number> | null = null;
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

    // Longer, brighter decay than the hat: reads as a snare rather than a tick.
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    }).toDestination();
    this.snare.volume.value = -18;

    this.hat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
    }).toDestination();
    this.hat.volume.value = -26;
  }

  get chordIndex(): number {
    return this.index;
  }

  private currentChord(): Chord {
    return this.preset.progression[this.index % this.preset.progression.length];
  }

  start(): void {
    const transport = Tone.getTransport();
    transport.bpm.value = this.preset.bpm;

    const { groove } = this.preset;
    const sixteenth = Tone.Time('16n').toSeconds();
    const steps = Array.from({ length: STEPS_PER_BAR }, (_, i) => i);

    this.sequence = new Tone.Sequence<number>(
      (time, step) => {
        // Swing delays the odd 16ths, which is what separates a Lo-Fi drag
        // from Synthwave's rigid grid.
        const swung = step % 2 === 1 ? time + sixteenth * groove.swing : time;

        if (step === 0) {
          const chord = this.currentChord();
          this.pad.triggerAttackRelease(chordToNotes(chord, 4), '1m', time);
        }

        if (groove.kick.includes(step)) this.kick.triggerAttackRelease('C1', '8n', swung);
        if (groove.snare.includes(step)) this.snare.triggerAttackRelease('8n', swung);
        if (groove.hat.includes(step)) this.hat.triggerAttackRelease('16n', swung);

        if (groove.bass.includes(step)) {
          const root = Tone.Frequency(pitchClass(this.currentChord().root) + 24, 'midi').toNote();
          this.bass.triggerAttackRelease(root, '8n', swung);
        }

        // Advance the harmony at the end of the bar, not the start, so the
        // pad and bass agree on which chord they are playing.
        if (step === STEPS_PER_BAR - 1) this.index += 1;
      },
      steps,
      '16n',
    ).start(0);

    transport.start();
  }

  stop(): void {
    Tone.getTransport().stop();
    this.sequence?.stop();
    this.index = 0;
  }

  dispose(): void {
    this.stop();
    this.sequence?.dispose();
    this.pad.dispose();
    this.bass.dispose();
    this.kick.dispose();
    this.snare.dispose();
    this.hat.dispose();
  }
}
