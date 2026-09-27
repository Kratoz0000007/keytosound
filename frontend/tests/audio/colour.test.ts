import { describe, expect, it, vi } from 'vitest';

class FakeEffect {
  wet = { value: 1 };
  dispose = vi.fn();
}

const destination = { chain: vi.fn() };

vi.mock('tone', () => ({
  Filter: FakeEffect,
  Vibrato: FakeEffect,
  BitCrusher: FakeEffect,
  getDestination: () => destination,
}));

const { applyColour, COLOURS } = await import('../../src/audio/colour');

describe('applyColour', () => {
  it('routes the whole output through Lo-Fi colour, and back out on dispose', () => {
    const colour = applyColour('lofi')!;
    const effects = destination.chain.mock.calls[0] as FakeEffect[];
    expect(effects).toHaveLength(3);
    expect(effects[2].wet.value).toBe(COLOURS.lofi.crush);

    colour.dispose();
    expect(destination.chain).toHaveBeenLastCalledWith();
    for (const effect of effects) expect(effect.dispose).toHaveBeenCalled();
  });

  it('leaves the output clean for a genre with no colour', () => {
    destination.chain.mockClear();
    expect(applyColour('synthwave')).toBeNull();
    expect(destination.chain).not.toHaveBeenCalled();
  });
});
