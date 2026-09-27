import { describe, expect, it, vi } from 'vitest';

class FakeEffect {
  wet = { value: 1 };
  dispose = vi.fn();
  constructor(readonly kind: string) {}
}

const destination = { chain: vi.fn() };

vi.mock('tone', () => ({
  Filter: class extends FakeEffect {
    constructor() {
      super('filter');
    }
  },
  Vibrato: class extends FakeEffect {
    constructor() {
      super('vibrato');
    }
  },
  Distortion: class extends FakeEffect {
    constructor() {
      super('distortion');
    }
  },
  Limiter: class extends FakeEffect {
    constructor() {
      super('limiter');
    }
  },
  getDestination: () => destination,
}));

const { applyColour } = await import('../../src/audio/colour');

describe('applyColour', () => {
  it('routes Lo-Fi through worn tape, then the limiter, and back out on dispose', () => {
    destination.chain.mockClear();
    const colour = applyColour('lofi');
    const effects = destination.chain.mock.calls[0] as FakeEffect[];
    expect(effects.map((e) => e.kind)).toEqual(['filter', 'vibrato', 'distortion', 'limiter']);

    colour.dispose();
    expect(destination.chain).toHaveBeenLastCalledWith();
    for (const effect of effects) expect(effect.dispose).toHaveBeenCalled();
  });

  it('gives a genre with no colour just the limiter, so a loud band never clips', () => {
    destination.chain.mockClear();
    const colour = applyColour('synthwave');
    const effects = destination.chain.mock.calls[0] as FakeEffect[];
    expect(effects.map((e) => e.kind)).toEqual(['limiter']);
    colour.dispose();
    expect(destination.chain).toHaveBeenLastCalledWith();
  });
});
