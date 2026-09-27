import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { KIT_SAMPLES, PITCHED, sampleUrl } from '../../src/audio/sampleLibrary';

const publicSamples = fileURLToPath(new URL('../../public/samples/', import.meta.url));
const manifest = JSON.parse(
  readFileSync(new URL('../../scripts/samples/manifest.json', import.meta.url), 'utf8'),
) as {
  sources: Record<string, { author: string; license: string; licenseUrl: string; home: string }>;
  files: { out: string; source: string }[];
};
const credits = readFileSync(`${publicSamples}CREDITS.md`, 'utf8');

/** Every file the app can request, as a path under public/samples. */
function referenced(): string[] {
  const out: string[] = [];
  for (const set of Object.values(PITCHED)) {
    for (const file of Object.values(set!.notes)) out.push(`${set!.dir}/${file}`);
  }
  for (const kit of Object.values(KIT_SAMPLES)) {
    for (const set of Object.values(kit)) {
      for (const file of set!.files) out.push(`${set!.dir}/${file}`);
    }
  }
  return out;
}

describe('sample library', () => {
  it('every referenced file exists under public/samples', () => {
    const missing = referenced().filter((path) => !existsSync(`${publicSamples}${path}`));
    expect(missing).toEqual([]);
  });

  it('every referenced file was produced by the manifest, so its source is recorded', () => {
    const produced = new Set(manifest.files.map((f) => f.out));
    expect(referenced().filter((path) => !produced.has(path))).toEqual([]);
  });

  it('every manifest source names its author, licence and home', () => {
    for (const source of Object.values(manifest.sources)) {
      expect(source.author).toBeTruthy();
      expect(source.license).toBeTruthy();
      expect(source.licenseUrl).toMatch(/^https:\/\//);
      expect(source.home).toMatch(/^https:\/\//);
    }
  });

  it('CREDITS.md credits every source', () => {
    for (const source of Object.values(manifest.sources)) {
      expect(credits).toContain(source.author);
      expect(credits).toContain(source.license);
    }
  });

  it('builds URLs under the app base', () => {
    expect(sampleUrl('grand-piano', 'C4.mp3')).toBe('/samples/grand-piano/C4.mp3');
    expect(sampleUrl('grand-piano')).toBe('/samples/grand-piano/');
  });

  it('gives every sampled voice a usable volume', () => {
    for (const set of Object.values(PITCHED)) expect(set!.volume).toBeLessThanOrEqual(0);
    for (const kit of Object.values(KIT_SAMPLES)) {
      for (const set of Object.values(kit)) {
        expect(set!.files.length).toBeGreaterThan(0);
        expect(set!.volume).toBeLessThanOrEqual(0);
      }
    }
  });
});
