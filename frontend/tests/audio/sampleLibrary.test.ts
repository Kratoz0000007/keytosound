import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AMBIENCE, KIT_SAMPLES, PITCHED, sampleUrl } from '../../src/audio/sampleLibrary';

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
  for (const bed of Object.values(AMBIENCE)) out.push(`${bed.dir}/${bed.file}`);
  return out;
}

describe('sample library', () => {
  it('every referenced file exists under public/samples', () => {
    const missing = referenced().filter((path) => !existsSync(`${publicSamples}${path}`));
    expect(missing).toEqual([]);
  });

  it('every referenced file holds real audio, not an empty MP3 shell', () => {
    // A 43 ms tabla stroke once converted to a 357-byte file no browser could
    // decode; the smallest real hit is several KB.
    const empty = referenced().filter((path) => statSync(`${publicSamples}${path}`).size < 1000);
    expect(empty).toEqual([]);
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

  it('maps every note to the file named after it', () => {
    // Files are named by the pitch they were measured at. A note mapped to a
    // differently named file is how the octave-low library names slipped in.
    for (const set of Object.values(PITCHED)) {
      for (const [note, file] of Object.entries(set!.notes)) {
        expect(file).toBe(`${note.replace('#', 's')}.mp3`);
      }
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
    for (const bed of Object.values(AMBIENCE)) expect(bed.volume).toBeLessThan(-12);
  });
});
