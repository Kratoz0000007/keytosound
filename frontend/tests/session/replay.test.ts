import { describe, it, expect, vi } from 'vitest';
import { ReplayPlayer, type ReplayClock } from '../../src/session/replay';
import type { KeyEvent } from '../../src/typing/types';
import type { RecordedSession } from '../../src/session/types';

/** A clock the test drives by hand, so replay is tested without real waiting. */
class FakeClock implements ReplayClock {
  private pending: { at: number; fn: () => void; handle: number }[] = [];
  private nextHandle = 1;
  now = 0;

  setTimeout(fn: () => void, ms: number): number {
    const handle = this.nextHandle++;
    this.pending.push({ at: this.now + ms, fn, handle });
    return handle;
  }

  clearTimeout(handle: number): void {
    this.pending = this.pending.filter((p) => p.handle !== handle);
  }

  advanceTo(time: number): void {
    const due = this.pending.filter((p) => p.at <= time).sort((a, b) => a.at - b.at);
    this.pending = this.pending.filter((p) => p.at > time);
    // Move the clock to each callback's own scheduled moment before firing it.
    // Jumping straight to `time` first would make every callback observe the
    // same instant, which is not what real time does.
    for (const item of due) {
      this.now = item.at;
      item.fn();
    }
    this.now = time;
  }
}

const session: RecordedSession = {
  genreId: 'lofi',
  seed: 1,
  keystrokes: [
    { key: 'a', timestamp: 0 },
    { key: 'b', timestamp: 100 },
    { key: 'c', timestamp: 350 },
  ],
};

describe('ReplayPlayer', () => {
  it('emits each keystroke at its recorded offset', () => {
    const clock = new FakeClock();
    const player = new ReplayPlayer(clock);
    const seen: { key: string; at: number }[] = [];

    player.play(
      session,
      (e: KeyEvent) => seen.push({ key: e.key, at: clock.now }),
      () => {},
    );

    clock.advanceTo(0);
    expect(seen.map((s) => s.key)).toEqual(['a']);
    clock.advanceTo(100);
    expect(seen.map((s) => s.key)).toEqual(['a', 'b']);
    clock.advanceTo(350);
    expect(seen.map((s) => s.key)).toEqual(['a', 'b', 'c']);
  });

  it('preserves the original gaps rather than firing everything at once', () => {
    const clock = new FakeClock();
    const player = new ReplayPlayer(clock);
    const times: number[] = [];

    player.play(
      session,
      () => times.push(clock.now),
      () => {},
    );
    clock.advanceTo(400);

    expect(times).toEqual([0, 100, 350]);
  });

  it('signals completion after the last keystroke', () => {
    const clock = new FakeClock();
    const player = new ReplayPlayer(clock);
    const done = vi.fn();

    player.play(session, () => {}, done);
    clock.advanceTo(349);
    expect(done).not.toHaveBeenCalled();
    clock.advanceTo(350);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('reports whether it is playing', () => {
    const clock = new FakeClock();
    const player = new ReplayPlayer(clock);

    expect(player.isPlaying).toBe(false);
    player.play(
      session,
      () => {},
      () => {},
    );
    expect(player.isPlaying).toBe(true);
    clock.advanceTo(350);
    expect(player.isPlaying).toBe(false);
  });

  it('stops emitting when stopped part way', () => {
    const clock = new FakeClock();
    const player = new ReplayPlayer(clock);
    const seen: string[] = [];

    player.play(
      session,
      (e) => seen.push(e.key),
      () => {},
    );
    clock.advanceTo(100);
    player.stop();
    clock.advanceTo(1000);

    expect(seen).toEqual(['a', 'b']);
    expect(player.isPlaying).toBe(false);
  });

  it('cancels a previous replay when a new one starts', () => {
    const clock = new FakeClock();
    const player = new ReplayPlayer(clock);
    const seen: string[] = [];

    player.play(
      session,
      (e) => seen.push(e.key),
      () => {},
    );
    clock.advanceTo(0);
    player.play(
      { genreId: 'lofi', seed: 1, keystrokes: [{ key: 'z', timestamp: 0 }] },
      (e) => seen.push(e.key),
      () => {},
    );
    clock.advanceTo(1000);

    expect(seen).toEqual(['a', 'z']);
  });

  it('completes immediately for an empty session', () => {
    const clock = new FakeClock();
    const player = new ReplayPlayer(clock);
    const done = vi.fn();

    player.play({ genreId: 'lofi', seed: 1, keystrokes: [] }, () => {}, done);

    expect(done).toHaveBeenCalledTimes(1);
    expect(player.isPlaying).toBe(false);
  });
});
