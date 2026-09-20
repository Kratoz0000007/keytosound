import { describe, it, expect } from 'vitest';
import { SessionRecorder } from '../../src/session/recorder';

describe('SessionRecorder', () => {
  it('records nothing before start is called', () => {
    const recorder = new SessionRecorder();
    recorder.record({ key: 'a', timestamp: 1000 });
    expect(recorder.count).toBe(0);
    expect(recorder.isRecording).toBe(false);
  });

  it('records keystrokes once started', () => {
    const recorder = new SessionRecorder();
    recorder.start('lofi', 42);
    recorder.record({ key: 'a', timestamp: 1000 });
    recorder.record({ key: 'b', timestamp: 1150 });
    expect(recorder.count).toBe(2);
  });

  it('rebases timestamps so the first keystroke is at zero', () => {
    // The browser clock starts wherever it likes; a saved session must not
    // depend on when in the page's life it happened to be recorded.
    const recorder = new SessionRecorder();
    recorder.start('lofi', 42);
    recorder.record({ key: 'a', timestamp: 91234.5 });
    recorder.record({ key: 'b', timestamp: 91384.5 });

    const session = recorder.snapshot();

    expect(session.keystrokes[0].timestamp).toBe(0);
    expect(session.keystrokes[1].timestamp).toBe(150);
  });

  it('preserves the exact gaps between keystrokes', () => {
    const recorder = new SessionRecorder();
    recorder.start('jazz', 7);
    const gaps = [0, 120, 260, 1500, 90];
    let t = 5000;
    for (const gap of gaps) {
      t += gap;
      recorder.record({ key: 'x', timestamp: t });
    }

    const stamps = recorder.snapshot().keystrokes.map((k) => k.timestamp);

    let expected = 0;
    for (let i = 0; i < gaps.length; i++) {
      expected += i === 0 ? 0 : gaps[i];
      expect(stamps[i]).toBeCloseTo(expected, 6);
    }
  });

  it('carries the genre and seed', () => {
    const recorder = new SessionRecorder();
    recorder.start('eightbit', 20260920);
    recorder.record({ key: 'a', timestamp: 0 });

    const session = recorder.snapshot();

    expect(session.genreId).toBe('eightbit');
    expect(session.seed).toBe(20260920);
  });

  it('returns a copy, so later typing cannot mutate an earlier snapshot', () => {
    const recorder = new SessionRecorder();
    recorder.start('lofi', 1);
    recorder.record({ key: 'a', timestamp: 0 });

    const first = recorder.snapshot();
    recorder.record({ key: 'b', timestamp: 100 });

    expect(first.keystrokes).toHaveLength(1);
    expect(recorder.snapshot().keystrokes).toHaveLength(2);
  });

  it('starts over when restarted', () => {
    const recorder = new SessionRecorder();
    recorder.start('lofi', 1);
    recorder.record({ key: 'a', timestamp: 0 });
    recorder.start('jazz', 2);

    expect(recorder.count).toBe(0);
    expect(recorder.snapshot().genreId).toBe('jazz');
  });

  it('clears back to not recording', () => {
    const recorder = new SessionRecorder();
    recorder.start('lofi', 1);
    recorder.record({ key: 'a', timestamp: 0 });
    recorder.clear();

    expect(recorder.count).toBe(0);
    expect(recorder.isRecording).toBe(false);
  });
});
