import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Enforces the spec's Global Constraints mechanically rather than by
 * discipline. The determinism contract is what Plans 2 and 3 rest on:
 * a single Math.random or Date.now in engine/ silently breaks saved
 * composition replay, and nothing else would catch it.
 */
const FORBIDDEN = [
  'Math.random',
  'Date.now',
  'new Date',
  'performance.now',
  'window.',
  'document.',
  "from 'react'",
  "from 'tone'",
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('engine purity', () => {
  const dirs = ['src/engine', 'src/typing'];

  for (const dir of dirs) {
    for (const file of sourceFiles(dir)) {
      // capture.ts is the declared DOM adapter and is exempt.
      if (file.endsWith('capture.ts')) continue;

      it(`${file} contains no impure references`, () => {
        const contents = readFileSync(file, 'utf8');
        for (const needle of FORBIDDEN) {
          expect(contents).not.toContain(needle);
        }
      });
    }
  }
});
