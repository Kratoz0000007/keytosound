import { describe, expect, it } from 'vitest';
import { VOICES } from '../../src/engine/beat';
import { GENRES } from '../../src/engine/presets';

/**
 * Pins the frontend's instrument and drum-voice vocabularies against the
 * literal patterns backend/.../midi/Score.java and DrumHit.java accept.
 * Nothing derives one side from the other on purpose: adding a sixth
 * instrument or a tenth voice in TypeScript should turn this red here,
 * rather than as a 400 at export time.
 */
describe('MIDI export vocabulary', () => {
  it('every genre lead instrument is one the backend Score pattern accepts', () => {
    const acceptedByBackend = ['piano', 'electricPiano', 'synthLead', 'eightBit', 'bass'];
    for (const genre of Object.values(GENRES)) {
      expect(acceptedByBackend).toContain(genre.leadInstrument);
    }
  });

  it('the drum voices are exactly what the backend DrumHit pattern accepts', () => {
    const acceptedByBackend = ['kick', 'snare', 'hat', 'openHat', 'clap', 'perc', 'fx'];
    const drumVoices = VOICES.filter((voice) => voice !== 'bass' && voice !== 'stab');
    expect(drumVoices).toHaveLength(7);
    expect([...drumVoices].sort()).toEqual([...acceptedByBackend].sort());
  });
});
