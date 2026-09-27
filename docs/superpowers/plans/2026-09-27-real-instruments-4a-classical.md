# Real Instruments 4a: Foundation + Classical — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recorded instruments can replace synth voices, and Classical becomes a real grand piano over an orchestra.

**Architecture:** A Node script downloads CC0/CC-BY recordings listed in a manifest and trims them with ffmpeg into `frontend/public/samples/`. A pure data file (`sampleLibrary.ts`) says which instrument and which kit voice uses which files. Pure wrapper classes (`sampledVoices.ts`) play a Tone sampler or player once it has loaded and fall back to today's synth until then. `instruments.ts` and `backing.ts` construct them. Classical's preset switches to the new instruments, and the Java MIDI vocabulary learns `grandPiano`.

**Tech Stack:** Node 24 (script), ffmpeg (Gyan build via winget), Tone.js 15 (`Sampler`, `Player`), TypeScript, Vitest; Java 22 / Spring Boot 4 for the MIDI whitelist.

**Spec:** `docs/superpowers/specs/2026-09-27-real-instruments-design.md` (this plan is its §8 row 4a).

## Global Constraints

- Licences: CC0 only, except the Salamander piano (CC-BY 3.0, credited in `CREDITS.md`).
- Samples live in `frontend/public/samples/`, committed. Whole-project budget ≤ 20 MB; this plan adds about 3.5 MB.
- Every voice falls back to its current synth sound until its recordings have loaded, and forever if a file fails (one `console.warn`).
- Only the selected genre's samples load, when its instruments are built.
- **Before any download or install, show the user the list (file, source, size) and get a yes.** The ffmpeg install is part of that list.
- `engine/` stays free of Tone, DOM and randomness (`tests/engine/purity.test.ts`).
- Commits: very short messages, no prefix, **no `Co-Authored-By` trailer**. Do not push. Every git command needs `-c safe.directory=D:/projects/keytosound`.
- Windows: use Git Bash for git, node, mvnw. Keep each file's existing line endings (CRLF files stay CRLF: normalise with `sed -i 's/\r*$/\r/' <file>` after editing); new files use LF.

**Deviations from the spec, decided here:**
- The pipeline lives under `frontend/scripts/samples/` rather than `scripts/samples/`, so the Vitest integrity test and the public folder sit in the same package.
- Pitched backing voices get their own preset fields: `padInstrument`, `bassInstrument` and **`stabInstrument`** (the stab plays a chord, so it is pitched, not a kit hit). Kit hits cover the seven drum voices only.
- Only the instrument ids this plan uses are added (`grandPiano`, `strings`, `stringsPizz`, `contrabassArco`); later plans add theirs.

## File Structure

| File | Responsibility |
|---|---|
| `frontend/scripts/samples/manifest.json` (create) | Every output file: source, path, processing; every source's author and licence. |
| `frontend/scripts/samples/fetch.mjs` (create) | Download → ffmpeg → `public/samples/…` + `CREDITS.md`. |
| `frontend/public/samples/**` (generated, committed) | The MP3s and `CREDITS.md`. |
| `.gitignore` (modify) | Ignore the download cache. |
| `frontend/src/engine/types.ts` (modify) | New `InstrumentId`s; optional `padInstrument`, `bassInstrument`, `stabInstrument`. |
| `frontend/src/audio/sampleLibrary.ts` (create) | Pure data: pitched sample sets and kit hit sets. |
| `frontend/src/audio/sampledVoices.ts` (create) | Pure: `SampledLead`, `SampledChords`, `SampledHit`, and the structural interfaces they wrap. |
| `frontend/src/audio/samplers.ts` (create) | The only Tone construction of `Sampler`/`Player`. |
| `frontend/src/audio/instruments.ts` (modify) | Fallback synth for every id; sampled lead when samples exist. |
| `frontend/src/audio/backing.ts` (modify) | Pad, bass and stab as `ChordVoice`s; drum voices through `SampledHit` when the kit has samples. |
| `frontend/src/engine/presets.ts` (modify) | Classical uses the new instruments. |
| `backend/.../midi/Score.java`, `MidiWriter.java` (modify) | Accept and map `grandPiano`. |
| Tests | `tests/audio/sampleLibrary.test.ts`, `tests/audio/sampledVoices.test.ts` (create); `tests/audio/backing.test.ts`, `tests/session/vocabulary.test.ts`, `MidiVocabularyTest.java`, `MidiWriterTest.java` (modify). |

---

### Task 1: Sample pipeline and Classical recordings

**Files:**
- Create: `frontend/scripts/samples/manifest.json`, `frontend/scripts/samples/fetch.mjs`
- Modify: `.gitignore`
- Generated: `frontend/public/samples/**`

**Interfaces:**
- Produces: files under `frontend/public/samples/` exactly as listed in `manifest.json` `files[].out`, and `frontend/public/samples/CREDITS.md`.

- [ ] **Step 1: Get the user's approval** for this list, with sizes from the source listings:

| What | Source | Size |
|---|---|---|
| ffmpeg (Gyan build) | `winget install Gyan.FFmpeg` | ~100 MB install |
| 30 piano notes | github.com/Tonejs/audio `salamander/` | 2.0 MB |
| 7 violin-section sustains, 7 violin pizzicato notes | github.com/sgossner/VSCO-2-CE `Strings/Violin Section/` | ~15 MB |
| 4 contrabass sustains | VSCO-2-CE `Strings/Solo Contrabass/SusNV/` | ~6.8 MB |
| 4 timpani, 2 snare, 4 triangle, 2 crash, 1 cymbal swell | VSCO-2-CE `Percussion/` | ~15 MB |

Downloads go to a git-ignored cache; only the trimmed output (~3.5 MB) is committed. Stop here until the user says yes.

- [ ] **Step 2: Install ffmpeg** — `winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements`, then find the binary: `ls "$LOCALAPPDATA/Microsoft/WinGet/Links/ffmpeg.exe" || find "$LOCALAPPDATA/Microsoft/WinGet/Packages" -name ffmpeg.exe`. Export `FFMPEG=<that path>` for Step 5. Verify: `"$FFMPEG" -version | head -1` prints a version.

- [ ] **Step 3: Write the manifest**

`frontend/scripts/samples/manifest.json`:

```json
{
  "sources": {
    "salamander": {
      "title": "Salamander Grand Piano V2 (Tone.js mirror)",
      "author": "Alexander Holm",
      "license": "CC-BY 3.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/3.0/",
      "home": "https://github.com/Tonejs/audio/tree/master/salamander",
      "base": "https://raw.githubusercontent.com/Tonejs/audio/master/salamander/"
    },
    "vsco2": {
      "title": "VSCO 2 Community Edition",
      "author": "Versilian Studios",
      "license": "CC0 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "home": "https://github.com/sgossner/VSCO-2-CE",
      "base": "https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/"
    }
  },
  "files": [
    { "out": "grand-piano/A0.mp3", "source": "salamander", "path": "A0.mp3", "process": "copy" },
    { "out": "grand-piano/C1.mp3", "source": "salamander", "path": "C1.mp3", "process": "copy" },
    { "out": "grand-piano/Ds1.mp3", "source": "salamander", "path": "Ds1.mp3", "process": "copy" },
    { "out": "grand-piano/Fs1.mp3", "source": "salamander", "path": "Fs1.mp3", "process": "copy" },
    { "out": "grand-piano/A1.mp3", "source": "salamander", "path": "A1.mp3", "process": "copy" },
    { "out": "grand-piano/C2.mp3", "source": "salamander", "path": "C2.mp3", "process": "copy" },
    { "out": "grand-piano/Ds2.mp3", "source": "salamander", "path": "Ds2.mp3", "process": "copy" },
    { "out": "grand-piano/Fs2.mp3", "source": "salamander", "path": "Fs2.mp3", "process": "copy" },
    { "out": "grand-piano/A2.mp3", "source": "salamander", "path": "A2.mp3", "process": "copy" },
    { "out": "grand-piano/C3.mp3", "source": "salamander", "path": "C3.mp3", "process": "copy" },
    { "out": "grand-piano/Ds3.mp3", "source": "salamander", "path": "Ds3.mp3", "process": "copy" },
    { "out": "grand-piano/Fs3.mp3", "source": "salamander", "path": "Fs3.mp3", "process": "copy" },
    { "out": "grand-piano/A3.mp3", "source": "salamander", "path": "A3.mp3", "process": "copy" },
    { "out": "grand-piano/C4.mp3", "source": "salamander", "path": "C4.mp3", "process": "copy" },
    { "out": "grand-piano/Ds4.mp3", "source": "salamander", "path": "Ds4.mp3", "process": "copy" },
    { "out": "grand-piano/Fs4.mp3", "source": "salamander", "path": "Fs4.mp3", "process": "copy" },
    { "out": "grand-piano/A4.mp3", "source": "salamander", "path": "A4.mp3", "process": "copy" },
    { "out": "grand-piano/C5.mp3", "source": "salamander", "path": "C5.mp3", "process": "copy" },
    { "out": "grand-piano/Ds5.mp3", "source": "salamander", "path": "Ds5.mp3", "process": "copy" },
    { "out": "grand-piano/Fs5.mp3", "source": "salamander", "path": "Fs5.mp3", "process": "copy" },
    { "out": "grand-piano/A5.mp3", "source": "salamander", "path": "A5.mp3", "process": "copy" },
    { "out": "grand-piano/C6.mp3", "source": "salamander", "path": "C6.mp3", "process": "copy" },
    { "out": "grand-piano/Ds6.mp3", "source": "salamander", "path": "Ds6.mp3", "process": "copy" },
    { "out": "grand-piano/Fs6.mp3", "source": "salamander", "path": "Fs6.mp3", "process": "copy" },
    { "out": "grand-piano/A6.mp3", "source": "salamander", "path": "A6.mp3", "process": "copy" },
    { "out": "grand-piano/C7.mp3", "source": "salamander", "path": "C7.mp3", "process": "copy" },
    { "out": "grand-piano/Ds7.mp3", "source": "salamander", "path": "Ds7.mp3", "process": "copy" },
    { "out": "grand-piano/Fs7.mp3", "source": "salamander", "path": "Fs7.mp3", "process": "copy" },
    { "out": "grand-piano/A7.mp3", "source": "salamander", "path": "A7.mp3", "process": "copy" },
    { "out": "grand-piano/C8.mp3", "source": "salamander", "path": "C8.mp3", "process": "copy" },

    { "out": "strings/Fs3.mp3", "source": "vsco2", "path": "Strings/Violin Section/susVib/VlnEns_susVib_F#3_v1.wav", "process": { "seconds": 4, "fade": 0.8 } },
    { "out": "strings/A3.mp3", "source": "vsco2", "path": "Strings/Violin Section/susVib/VlnEns_susVib_A3_v1.wav", "process": { "seconds": 4, "fade": 0.8 } },
    { "out": "strings/C4.mp3", "source": "vsco2", "path": "Strings/Violin Section/susVib/VlnEns_susVib_C4_v1.wav", "process": { "seconds": 4, "fade": 0.8 } },
    { "out": "strings/E4.mp3", "source": "vsco2", "path": "Strings/Violin Section/susVib/VlnEns_susVib_E4_v1.wav", "process": { "seconds": 4, "fade": 0.8 } },
    { "out": "strings/G4.mp3", "source": "vsco2", "path": "Strings/Violin Section/susVib/VlnEns_susVib_G4_v1.wav", "process": { "seconds": 4, "fade": 0.8 } },
    { "out": "strings/B4.mp3", "source": "vsco2", "path": "Strings/Violin Section/susVib/VlnEns_susVib_B4_v1.wav", "process": { "seconds": 4, "fade": 0.8 } },
    { "out": "strings/D5.mp3", "source": "vsco2", "path": "Strings/Violin Section/susVib/VlnEns_susVib_D5_v1.wav", "process": { "seconds": 4, "fade": 0.8 } },

    { "out": "strings-pizz/Fs3.mp3", "source": "vsco2", "path": "Strings/Violin Section/Pizz/VlnEns_Pizz_F#3_v1_rr1.wav", "process": { "seconds": 1.5, "fade": 0.3 } },
    { "out": "strings-pizz/A3.mp3", "source": "vsco2", "path": "Strings/Violin Section/Pizz/VlnEns_Pizz_A3_v1_rr1.wav", "process": { "seconds": 1.5, "fade": 0.3 } },
    { "out": "strings-pizz/C4.mp3", "source": "vsco2", "path": "Strings/Violin Section/Pizz/VlnEns_Pizz_C4_v1_rr1.wav", "process": { "seconds": 1.5, "fade": 0.3 } },
    { "out": "strings-pizz/E4.mp3", "source": "vsco2", "path": "Strings/Violin Section/Pizz/VlnEns_Pizz_E4_v1_rr1.wav", "process": { "seconds": 1.5, "fade": 0.3 } },
    { "out": "strings-pizz/G4.mp3", "source": "vsco2", "path": "Strings/Violin Section/Pizz/VlnEns_Pizz_G4_v1_rr1.wav", "process": { "seconds": 1.5, "fade": 0.3 } },
    { "out": "strings-pizz/B4.mp3", "source": "vsco2", "path": "Strings/Violin Section/Pizz/VlnEns_Pizz_B4_v1_rr1.wav", "process": { "seconds": 1.5, "fade": 0.3 } },
    { "out": "strings-pizz/D5.mp3", "source": "vsco2", "path": "Strings/Violin Section/Pizz/VlnEns_Pizz_D5_v1_rr1.wav", "process": { "seconds": 1.5, "fade": 0.3 } },

    { "out": "contrabass-arco/C1.mp3", "source": "vsco2", "path": "Strings/Solo Contrabass/SusNV/BKCtbss_SusNV_C1_v1_rr1.wav", "process": { "seconds": 3, "fade": 0.6 } },
    { "out": "contrabass-arco/E1.mp3", "source": "vsco2", "path": "Strings/Solo Contrabass/SusNV/BKCtbss_SusNV_E1_v1_rr1.wav", "process": { "seconds": 3, "fade": 0.6 } },
    { "out": "contrabass-arco/Gs1.mp3", "source": "vsco2", "path": "Strings/Solo Contrabass/SusNV/BKCtbss_SusNV_G#1_v1_rr1.wav", "process": { "seconds": 3, "fade": 0.6 } },
    { "out": "contrabass-arco/Cs2.mp3", "source": "vsco2", "path": "Strings/Solo Contrabass/SusNV/BKCtbss_SusNV_C#2_v1_rr1.wav", "process": { "seconds": 3, "fade": 0.6 } },

    { "out": "timpani/drum1-1.mp3", "source": "vsco2", "path": "Percussion/Timpani/Timpani1_Hit_v3_rr1_Sum.wav", "process": { "seconds": 3, "fade": 1 } },
    { "out": "timpani/drum1-2.mp3", "source": "vsco2", "path": "Percussion/Timpani/Timpani1_Hit_v3_rr2_Sum.wav", "process": { "seconds": 3, "fade": 1 } },
    { "out": "timpani/drum3-1.mp3", "source": "vsco2", "path": "Percussion/Timpani/Timpani3_Hit_v3_rr1_Sum.wav", "process": { "seconds": 3, "fade": 1 } },
    { "out": "timpani/drum3-2.mp3", "source": "vsco2", "path": "Percussion/Timpani/Timpani3_Hit_v3_rr2_Sum.wav", "process": { "seconds": 3, "fade": 1 } },
    { "out": "orchestral-snare/1.mp3", "source": "vsco2", "path": "Percussion/Snare2-HitSN_v5_rr1_Sum.wav", "process": { "seconds": 1, "fade": 0.3 } },
    { "out": "orchestral-snare/2.mp3", "source": "vsco2", "path": "Percussion/Snare2-HitSN_v5_rr2_Sum.wav", "process": { "seconds": 1, "fade": 0.3 } },
    { "out": "triangle/muted-1.mp3", "source": "vsco2", "path": "Percussion/Triangle3-HitM_v1_rr1_Sum.wav", "process": { "seconds": 0.6, "fade": 0.2 } },
    { "out": "triangle/muted-2.mp3", "source": "vsco2", "path": "Percussion/Triangle3-HitM_v1_rr2_Sum.wav", "process": { "seconds": 0.6, "fade": 0.2 } },
    { "out": "triangle/open-1.mp3", "source": "vsco2", "path": "Percussion/Triangle3-Hit_v1_rr1_Sum.wav", "process": { "seconds": 3, "fade": 1 } },
    { "out": "triangle/open-2.mp3", "source": "vsco2", "path": "Percussion/Triangle3-Hit_v1_rr2_Sum.wav", "process": { "seconds": 3, "fade": 1 } },
    { "out": "cymbals/crash-1.mp3", "source": "vsco2", "path": "Percussion/cymbal-crash1_mp_rr1.wav", "process": { "seconds": 3, "fade": 1.2 } },
    { "out": "cymbals/crash-2.mp3", "source": "vsco2", "path": "Percussion/cymbal-crash1_mp_rr2.wav", "process": { "seconds": 3, "fade": 1.2 } },
    { "out": "cymbals/swell.mp3", "source": "vsco2", "path": "Percussion/susCymb1-cresc-Short_v1.wav", "process": { "seconds": 6, "fade": 0.2 } }
  ]
}
```

- [ ] **Step 4: Write the script**

`frontend/scripts/samples/fetch.mjs`:

```js
// Downloads the recordings listed in manifest.json, trims and converts them
// with ffmpeg, and writes them to public/samples/ along with CREDITS.md.
// Run from frontend/:  node scripts/samples/fetch.mjs
// ffmpeg must be on PATH, or FFMPEG must hold its full path. Downloads are
// cached in scripts/samples/.cache, so re-running only redoes the conversion.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, '.cache');
const out = join(here, '..', '..', 'public', 'samples');
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
const manifest = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));

/** Paths contain spaces and '#', so each segment is encoded on its own. */
function sourceUrl(source, path) {
  return source.base + path.split('/').map(encodeURIComponent).join('/');
}

async function download(url, to) {
  if (existsSync(to)) return;
  mkdirSync(dirname(to), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  writeFileSync(to, Buffer.from(await response.arrayBuffer()));
}

/**
 * Mono, 44.1 kHz, 96 kbps MP3. Leading silence is cut so every hit lands on
 * its beat; the tail is faded so a trimmed note never ends in a click.
 */
function convert(input, output, { seconds, fade }) {
  const filters = [
    'silenceremove=start_periods=1:start_threshold=-60dB',
    'asetpts=PTS-STARTPTS',
    `atrim=0:${seconds}`,
    `afade=t=out:st=${Math.max(0, seconds - fade)}:d=${fade}`,
  ].join(',');
  execFileSync(ffmpeg, [
    '-v', 'error', '-y', '-i', input,
    '-af', filters,
    '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '96k',
    output,
  ]);
}

function credits() {
  const lines = [
    '# Sample credits',
    '',
    'Recordings used by the app. Generated from scripts/samples/manifest.json by',
    'scripts/samples/fetch.mjs; do not edit by hand.',
  ];
  for (const [id, source] of Object.entries(manifest.sources)) {
    const files = manifest.files.filter((f) => f.source === id).map((f) => f.out);
    lines.push(
      '',
      `## ${source.title}`,
      '',
      `- Author: ${source.author}`,
      `- Licence: [${source.license}](${source.licenseUrl})`,
      `- Source: ${source.home}`,
      `- Files: ${files.join(', ')}`,
    );
  }
  return lines.join('\n') + '\n';
}

for (const file of manifest.files) {
  const source = manifest.sources[file.source];
  const cached = join(cache, file.source, ...file.path.split('/'));
  await download(sourceUrl(source, file.path), cached);
  const target = join(out, ...file.out.split('/'));
  mkdirSync(dirname(target), { recursive: true });
  if (file.process === 'copy') copyFileSync(cached, target);
  else convert(cached, target, file.process);
  console.log(file.out);
}
writeFileSync(join(out, 'CREDITS.md'), credits());
console.log(`${manifest.files.length} files and CREDITS.md written to ${out}`);
```

- [ ] **Step 5: Ignore the cache and run it**

Append to the root `.gitignore`:

```
# Raw downloads for frontend/scripts/samples/fetch.mjs; only its output is committed.
frontend/scripts/samples/.cache/
```

Run (Git Bash, from `frontend/`): `FFMPEG="$FFMPEG" node scripts/samples/fetch.mjs`
Expected: 61 output paths printed, then `61 files and CREDITS.md written to …`. Then `du -sh public/samples` — expected ≈ 3–4 MB — and `git -c safe.directory=D:/projects/keytosound status --short` shows `public/samples/` and the script files, and nothing under `.cache`.

- [ ] **Step 6: Commit**

```bash
git -c safe.directory=D:/projects/keytosound add .gitignore frontend/scripts/samples/manifest.json frontend/scripts/samples/fetch.mjs frontend/public/samples
git -c safe.directory=D:/projects/keytosound commit -m "add classical recordings"
```

---

### Task 2: Instrument ids, sample library, integrity tests

**Files:**
- Modify: `frontend/src/engine/types.ts` (CRLF), `frontend/src/audio/instruments.ts` (LF; fallback cases only)
- Create: `frontend/src/audio/sampleLibrary.ts`
- Test: `frontend/tests/audio/sampleLibrary.test.ts`

**Interfaces:**
- Consumes: the files and manifest from Task 1.
- Produces: `InstrumentId` now also `'grandPiano' | 'strings' | 'stringsPizz' | 'contrabassArco'`; `GenrePreset` optional `padInstrument?`, `bassInstrument?`, `stabInstrument?: InstrumentId`; `PitchedSamples { dir; notes: Record<string,string>; volume: number; release: number }`, `HitSamples { dir; files: string[]; volume: number }`, `PITCHED: Partial<Record<InstrumentId, PitchedSamples>>`, `KIT_SAMPLES: Record<string, Partial<Record<DrumVoice, HitSamples>>>`, `type DrumVoice = Exclude<Voice, 'bass' | 'stab'>`, `sampleUrl(dir: string, file = ''): string`.

- [ ] **Step 1: Write the failing test**

`frontend/tests/audio/sampleLibrary.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run (from `frontend/`): `npx vitest run tests/audio/sampleLibrary.test.ts`
Expected: FAIL — cannot resolve `../../src/audio/sampleLibrary`.

- [ ] **Step 3: Extend the types**

In `frontend/src/engine/types.ts`, replace the `InstrumentId` union with:

```ts
export type InstrumentId =
  | 'piano'
  | 'synthLead'
  | 'electricPiano'
  | 'bass'
  | 'eightBit'
  // Recorded instruments; each also has a synth fallback in audio/instruments.ts.
  | 'grandPiano'
  | 'strings'
  | 'stringsPizz'
  | 'contrabassArco';
```

and add to `GenrePreset`, directly after `glideSeconds`:

```ts
  /** The chord pad's instrument. Absent: the soft synth pad. */
  padInstrument?: InstrumentId;
  /** The bass voice's instrument. Absent: the synth bass. */
  bassInstrument?: InstrumentId;
  /** The stab voice's instrument. Absent: the kit's synth stab. */
  stabInstrument?: InstrumentId;
```

Then `sed -i 's/\r*$/\r/' src/engine/types.ts`.

- [ ] **Step 4: Give every new id a fallback synth**

In `frontend/src/audio/instruments.ts`, add these cases to `voiceFor`'s switch, before `case 'bass':`:

```ts
    // The recorded instruments' stand-ins until their samples load.
    case 'grandPiano':
      return new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.4, sustain: 0.25, release: 1.2 },
      });

    case 'strings':
      return new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.6, decay: 1, sustain: 0.6, release: 2 },
      });

    case 'stringsPizz':
      return new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.1 },
      });

    case 'contrabassArco':
```

so that `contrabassArco` falls through to the existing `bass` MonoSynth.

- [ ] **Step 5: Write the library**

`frontend/src/audio/sampleLibrary.ts`:

```ts
import type { Voice } from '../engine/beat';
import type { InstrumentId } from '../engine/types';

/** The seven voices that are hits rather than notes. */
export type DrumVoice = Exclude<Voice, 'bass' | 'stab'>;

/** A pitched instrument recorded at some notes; the sampler repitches between them. */
export interface PitchedSamples {
  /** Folder under public/samples/. */
  dir: string;
  /** Note name to file. '#' is spelled 's' in file names: it is not URL-safe. */
  notes: Record<string, string>;
  /** dB, set by ear against the rest of the band. */
  volume: number;
  /** Seconds a note takes to die away after release. */
  release: number;
}

/** One-shot hits, played in turn so repeats don't sound identical. */
export interface HitSamples {
  dir: string;
  files: string[];
  volume: number;
}

/** Where public/ is served: '/' in dev, the deploy path in production. */
export function sampleUrl(dir: string, file = ''): string {
  return `${import.meta.env.BASE_URL}samples/${dir}/${file}`;
}

const SALAMANDER_NOTES = Object.fromEntries(
  ['A0', 'C1', 'D#1', 'F#1', 'A1', 'C2', 'D#2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4',
    'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D#6', 'F#6', 'A6', 'C7', 'D#7', 'F#7', 'A7', 'C8']
    .map((note) => [note, `${note.replace('#', 's')}.mp3`]),
);

/** The seven notes the string samples were taken at (Task 1 manifest). */
const STRING_NOTES = {
  'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  E4: 'E4.mp3',
  G4: 'G4.mp3',
  B4: 'B4.mp3',
  D5: 'D5.mp3',
};

export const PITCHED: Partial<Record<InstrumentId, PitchedSamples>> = {
  grandPiano: { dir: 'grand-piano', notes: SALAMANDER_NOTES, volume: -4, release: 1.2 },
  strings: { dir: 'strings', notes: STRING_NOTES, volume: -16, release: 1 },
  stringsPizz: { dir: 'strings-pizz', notes: STRING_NOTES, volume: -10, release: 0.3 },
  contrabassArco: {
    dir: 'contrabass-arco',
    notes: { C1: 'C1.mp3', E1: 'E1.mp3', 'G#1': 'Gs1.mp3', 'C#2': 'Cs2.mp3' },
    volume: -10,
    release: 0.6,
  },
};

/** Recorded hits per genre id. A voice left out keeps its synth sound. */
export const KIT_SAMPLES: Record<string, Partial<Record<DrumVoice, HitSamples>>> = {
  classical: {
    kick: { dir: 'timpani', files: ['drum3-1.mp3', 'drum3-2.mp3'], volume: -4 },
    perc: { dir: 'timpani', files: ['drum1-1.mp3', 'drum1-2.mp3'], volume: -6 },
    snare: { dir: 'orchestral-snare', files: ['1.mp3', '2.mp3'], volume: -12 },
    hat: { dir: 'triangle', files: ['muted-1.mp3', 'muted-2.mp3'], volume: -14 },
    openHat: { dir: 'triangle', files: ['open-1.mp3', 'open-2.mp3'], volume: -14 },
    clap: { dir: 'cymbals', files: ['crash-1.mp3', 'crash-2.mp3'], volume: -16 },
    fx: { dir: 'cymbals', files: ['swell.mp3'], volume: -14 },
  },
};
```

- [ ] **Step 6: Run the tests and the type check**

Run: `npx vitest run tests/audio/sampleLibrary.test.ts` — expected 6 PASS.
Run: `npx tsc -b 2>&1 | grep -c "error TS"` — expected **16** (the pre-existing TS1294 errors only); `npx tsc -b 2>&1 | grep -E "sampleLibrary|instruments|engine/types"` — expected no output.

- [ ] **Step 7: Commit**

```bash
git -c safe.directory=D:/projects/keytosound add frontend/src/engine/types.ts frontend/src/audio/instruments.ts frontend/src/audio/sampleLibrary.ts frontend/tests/audio/sampleLibrary.test.ts
git -c safe.directory=D:/projects/keytosound commit -m "add sample library"
```

---

### Task 3: Sampled voices (pure)

**Files:**
- Create: `frontend/src/audio/sampledVoices.ts`
- Test: `frontend/tests/audio/sampledVoices.test.ts`

**Interfaces:**
- Consumes: `LeadVoice` from `audio/lead.ts`.
- Produces: `interface SamplerLike { readonly loaded: boolean; triggerAttack(notes: string | string[], time?: number, velocity?: number): unknown; triggerRelease(notes: string | string[], time?: number): unknown; triggerAttackRelease(notes: string | string[], duration: number | string, time?: number, velocity?: number): unknown; releaseAll(time?: number): unknown; dispose(): unknown }`; `interface PlayerLike { readonly loaded: boolean; start(time?: number): unknown; dispose(): unknown }`; `interface ChordVoice { play(notes: string[], duration: number | string, time: number): void; release(): void; dispose(): void }`; `class SampledLead implements LeadVoice` (constructor `(sampler: SamplerLike, fallback: LeadVoice)`); `class SampledChords implements ChordVoice` (constructor `(sampler: SamplerLike, fallback: ChordVoice)`); `class SampledHit` (constructor `(players: PlayerLike[], fallback: (time: number) => void)`, methods `trigger(time: number): void`, `dispose(): void`).

- [ ] **Step 1: Write the failing tests**

`frontend/tests/audio/sampledVoices.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { LeadVoice } from '../../src/audio/lead';
import {
  SampledChords,
  SampledHit,
  SampledLead,
  type ChordVoice,
  type PlayerLike,
  type SamplerLike,
} from '../../src/audio/sampledVoices';

function fakeSampler(loaded: boolean) {
  return {
    loaded,
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    triggerAttackRelease: vi.fn(),
    releaseAll: vi.fn(),
    dispose: vi.fn(),
  } satisfies SamplerLike & { loaded: boolean };
}

function fakeLead(): LeadVoice & Record<'triggerAttack' | 'setNote' | 'triggerRelease' | 'dispose', ReturnType<typeof vi.fn>> {
  return {
    portamento: 0,
    triggerAttack: vi.fn(),
    setNote: vi.fn(),
    triggerRelease: vi.fn(),
    dispose: vi.fn(),
  };
}

function fakeChords() {
  return { play: vi.fn(), release: vi.fn(), dispose: vi.fn() } satisfies ChordVoice;
}

function fakePlayer(loaded = true) {
  return { loaded, start: vi.fn(), dispose: vi.fn() } satisfies PlayerLike;
}

describe('SampledLead', () => {
  it('plays the fallback until the samples have loaded', () => {
    const sampler = fakeSampler(false);
    const fallback = fakeLead();
    const lead = new SampledLead(sampler, fallback);

    lead.triggerAttack('C4', 1, 0.8);

    expect(fallback.triggerAttack).toHaveBeenCalledWith('C4', 1, 0.8);
    expect(sampler.triggerAttack).not.toHaveBeenCalled();
  });

  it('plays the sampler once loaded', () => {
    const sampler = fakeSampler(true);
    const fallback = fakeLead();
    new SampledLead(sampler, fallback).triggerAttack('C4', 1, 0.8);

    expect(sampler.triggerAttack).toHaveBeenCalledWith('C4', 1, 0.8);
    expect(fallback.triggerAttack).not.toHaveBeenCalled();
  });

  it('is monophonic: a new note releases the one sounding', () => {
    const sampler = fakeSampler(true);
    const lead = new SampledLead(sampler, fakeLead());

    lead.triggerAttack('C4', 1, 0.8);
    lead.triggerAttack('E4', 2, 0.8);

    expect(sampler.triggerRelease).toHaveBeenCalledWith('C4', 2);
    expect(sampler.triggerAttack).toHaveBeenLastCalledWith('E4', 2, 0.8);
  });

  it('re-strikes on a glide, since a recording cannot slide', () => {
    const sampler = fakeSampler(true);
    const lead = new SampledLead(sampler, fakeLead());

    lead.triggerAttack('C4', 1, 0.6);
    lead.setNote('D4', 2);

    expect(sampler.triggerRelease).toHaveBeenCalledWith('C4', 2);
    expect(sampler.triggerAttack).toHaveBeenLastCalledWith('D4', 2, 0.6);
  });

  it('glides on the fallback while it is the one playing', () => {
    const fallback = fakeLead();
    const lead = new SampledLead(fakeSampler(false), fallback);

    lead.triggerAttack('C4', 1, 0.6);
    lead.setNote('D4', 2);

    expect(fallback.setNote).toHaveBeenCalledWith('D4', 2);
  });

  it('hands over cleanly when the samples finish loading mid-line', () => {
    const sampler = fakeSampler(false);
    const fallback = fakeLead();
    const lead = new SampledLead(sampler, fallback);

    lead.triggerAttack('C4', 1, 0.8);
    sampler.loaded = true;
    lead.triggerAttack('E4', 2, 0.8);

    expect(fallback.triggerRelease).toHaveBeenCalledWith(2);
    expect(sampler.triggerAttack).toHaveBeenCalledWith('E4', 2, 0.8);
  });

  it('release silences whichever voice is sounding', () => {
    const sampler = fakeSampler(true);
    const lead = new SampledLead(sampler, fakeLead());

    lead.triggerAttack('C4', 1, 0.8);
    lead.triggerRelease(3);
    lead.triggerRelease(4);

    expect(sampler.triggerRelease).toHaveBeenCalledTimes(1);
    expect(sampler.triggerRelease).toHaveBeenCalledWith('C4', 3);
  });

  it('passes portamento to the fallback, the only voice that can use it', () => {
    const fallback = fakeLead();
    const lead = new SampledLead(fakeSampler(true), fallback);

    lead.portamento = 0.1;

    expect(fallback.portamento).toBe(0.1);
    expect(lead.portamento).toBe(0.1);
  });

  it('disposes both voices', () => {
    const sampler = fakeSampler(true);
    const fallback = fakeLead();
    new SampledLead(sampler, fallback).dispose();

    expect(sampler.dispose).toHaveBeenCalled();
    expect(fallback.dispose).toHaveBeenCalled();
  });
});

describe('SampledChords', () => {
  it('plays the fallback until loaded, then the sampler', () => {
    const sampler = fakeSampler(false);
    const fallback = fakeChords();
    const chords = new SampledChords(sampler, fallback);

    chords.play(['C4', 'E4', 'G4'], '1m', 0);
    sampler.loaded = true;
    chords.play(['F4', 'A4', 'C5'], '1m', 2);

    expect(fallback.play).toHaveBeenCalledWith(['C4', 'E4', 'G4'], '1m', 0);
    expect(sampler.triggerAttackRelease).toHaveBeenCalledWith(['F4', 'A4', 'C5'], '1m', 2);
    expect(fallback.play).toHaveBeenCalledTimes(1);
  });

  it('release and dispose reach both voices', () => {
    const sampler = fakeSampler(true);
    const fallback = fakeChords();
    const chords = new SampledChords(sampler, fallback);

    chords.release();
    chords.dispose();

    expect(sampler.releaseAll).toHaveBeenCalled();
    expect(fallback.release).toHaveBeenCalled();
    expect(sampler.dispose).toHaveBeenCalled();
    expect(fallback.dispose).toHaveBeenCalled();
  });
});

describe('SampledHit', () => {
  it('plays the synth hit until every recording has loaded', () => {
    const fallback = vi.fn();
    const players = [fakePlayer(true), fakePlayer(false)];
    new SampledHit(players, fallback).trigger(1);

    expect(fallback).toHaveBeenCalledWith(1);
    expect(players[0].start).not.toHaveBeenCalled();
  });

  it('cycles through the recordings in turn', () => {
    const players = [fakePlayer(), fakePlayer(), fakePlayer()];
    const hit = new SampledHit(players, vi.fn());

    for (const t of [1, 2, 3, 4]) hit.trigger(t);

    expect(players[0].start.mock.calls).toEqual([[1], [4]]);
    expect(players[1].start.mock.calls).toEqual([[2]]);
    expect(players[2].start.mock.calls).toEqual([[3]]);
  });

  it('falls back when it has no recordings at all', () => {
    const fallback = vi.fn();
    new SampledHit([], fallback).trigger(1);
    expect(fallback).toHaveBeenCalledWith(1);
  });

  it('disposes every player', () => {
    const players = [fakePlayer(), fakePlayer()];
    new SampledHit(players, vi.fn()).dispose();
    for (const p of players) expect(p.dispose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/audio/sampledVoices.test.ts`
Expected: FAIL — cannot resolve `../../src/audio/sampledVoices`.

- [ ] **Step 3: Write the voices**

`frontend/src/audio/sampledVoices.ts`:

```ts
import type { LeadVoice } from './lead';

/**
 * The parts of Tone.Sampler used here. Structural, so the logic below can be
 * tested without Tone; audio/samplers.ts builds the real ones.
 */
export interface SamplerLike {
  readonly loaded: boolean;
  triggerAttack(notes: string | string[], time?: number, velocity?: number): unknown;
  triggerRelease(notes: string | string[], time?: number): unknown;
  triggerAttackRelease(
    notes: string | string[],
    duration: number | string,
    time?: number,
    velocity?: number,
  ): unknown;
  releaseAll(time?: number): unknown;
  dispose(): unknown;
}

/** The parts of Tone.Player used here. */
export interface PlayerLike {
  readonly loaded: boolean;
  start(time?: number): unknown;
  dispose(): unknown;
}

/** What the band needs from its pad, bass and stab, recorded or synth. */
export interface ChordVoice {
  play(notes: string[], duration: number | string, time: number): void;
  release(): void;
  dispose(): void;
}

/**
 * A recorded lead that plays its synth fallback until the samples load.
 * Monophonic like every lead: a new note releases the one sounding. A
 * recording cannot slide, so a glide re-strikes; sampled presets set
 * glideSeconds to 0 anyway, and LegatoLead then never asks for one.
 */
export class SampledLead implements LeadVoice {
  private note: string | null = null;
  private velocity = 0.8;
  private fallbackSounding = false;

  constructor(
    private readonly sampler: SamplerLike,
    private readonly fallback: LeadVoice,
  ) {}

  get portamento(): number {
    return this.fallback.portamento;
  }

  set portamento(seconds: number) {
    this.fallback.portamento = seconds;
  }

  triggerAttack(note: string, time: number, velocity: number): void {
    this.velocity = velocity;
    if (!this.sampler.loaded) {
      this.fallback.triggerAttack(note, time, velocity);
      this.fallbackSounding = true;
      return;
    }
    if (this.fallbackSounding) {
      this.fallback.triggerRelease(time);
      this.fallbackSounding = false;
    }
    if (this.note !== null) this.sampler.triggerRelease(this.note, time);
    this.sampler.triggerAttack(note, time, velocity);
    this.note = note;
  }

  setNote(note: string, time: number): void {
    if (!this.sampler.loaded) {
      this.fallback.setNote(note, time);
      return;
    }
    this.triggerAttack(note, time, this.velocity);
  }

  triggerRelease(time?: number): void {
    if (this.fallbackSounding) {
      this.fallback.triggerRelease(time);
      this.fallbackSounding = false;
    }
    if (this.note !== null) {
      this.sampler.triggerRelease(this.note, time);
      this.note = null;
    }
  }

  dispose(): void {
    this.sampler.dispose();
    this.fallback.dispose();
  }
}

/** A recorded pad, bass or stab that plays its synth until the samples load. */
export class SampledChords implements ChordVoice {
  constructor(
    private readonly sampler: SamplerLike,
    private readonly fallback: ChordVoice,
  ) {}

  play(notes: string[], duration: number | string, time: number): void {
    if (this.sampler.loaded) this.sampler.triggerAttackRelease(notes, duration, time);
    else this.fallback.play(notes, duration, time);
  }

  release(): void {
    this.sampler.releaseAll();
    this.fallback.release();
  }

  dispose(): void {
    this.sampler.dispose();
    this.fallback.dispose();
  }
}

/**
 * A drum voice that plays its recordings in turn, so repeated hits vary.
 * Until every one has loaded it plays the synth hit; a file that never loads
 * leaves the voice on its synth for good, which is the intended failure mode.
 */
export class SampledHit {
  private next = 0;

  constructor(
    private readonly players: PlayerLike[],
    private readonly fallback: (time: number) => void,
  ) {}

  trigger(time: number): void {
    if (this.players.length === 0 || !this.players.every((p) => p.loaded)) {
      this.fallback(time);
      return;
    }
    this.players[this.next].start(time);
    this.next = (this.next + 1) % this.players.length;
  }

  dispose(): void {
    for (const player of this.players) player.dispose();
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/audio/sampledVoices.test.ts`
Expected: 15 PASS.

- [ ] **Step 5: Commit**

```bash
git -c safe.directory=D:/projects/keytosound add frontend/src/audio/sampledVoices.ts frontend/tests/audio/sampledVoices.test.ts
git -c safe.directory=D:/projects/keytosound commit -m "add sampled voices"
```

---

### Task 4: Wire samples into the lead and the band

**Files:**
- Create: `frontend/src/audio/samplers.ts`
- Modify: `frontend/src/audio/instruments.ts` (LF), `frontend/src/audio/backing.ts` (CRLF)
- Test: `frontend/tests/audio/backing.test.ts` (LF)

**Interfaces:**
- Consumes: `PITCHED`, `KIT_SAMPLES`, `DrumVoice`, `sampleUrl` (Task 2); `SampledLead`, `SampledChords`, `SampledHit`, `ChordVoice` (Task 3); `GenrePreset.padInstrument/bassInstrument/stabInstrument` (Task 2).
- Produces: `createSampler(samples: PitchedSamples): Tone.Sampler`, `createPlayers(samples: HitSamples): Tone.Player[]`; `createLead(id)` returns a sampled lead when `PITCHED[id]` exists; `BackingBand` plays recorded pad/bass/stab/hits when the preset and kit provide them. Public API of `BackingBand` unchanged.

- [ ] **Step 1: Write the failing test**

In `frontend/tests/audio/backing.test.ts`, add two fakes after `FakeNode`:

```ts
const samplers: FakeSampler[] = [];
class FakeSampler extends FakeNode {
  loaded = false;
  releaseAll = vi.fn();
  constructor() {
    super();
    samplers.push(this);
  }
}

const players: FakePlayer[] = [];
class FakePlayer extends FakeNode {
  loaded = false;
  start = vi.fn();
  constructor() {
    super();
    players.push(this);
  }
}
```

add `Sampler: FakeSampler,` and `Player: FakePlayer,` to the `vi.mock('tone', …)` object, and append inside `describe('BackingBand', …)`:

```ts
  it('builds recorded voices for a sampled genre and disposes them', () => {
    const engine = new MusicEngine(GENRES.classical, 1);
    const band = new BackingBand(GENRES.classical, () => engine);
    // Pad, bass and stab samplers; two or one players per sampled drum voice.
    expect(samplers).toHaveLength(3);
    expect(players.length).toBeGreaterThanOrEqual(7);

    band.start();
    band.dispose();

    for (const node of [...samplers, ...players]) expect(node.dispose).toHaveBeenCalled();
  });

  it('plays the synth hit while a recording is still loading', () => {
    const engine = new MusicEngine(GENRES.classical, 1);
    const band = new BackingBand(GENRES.classical, () => engine);
    band.trigger('kick', 1);
    // Fake players never report loaded, so every hit must go to the synth.
    expect(players.every((p) => p.start.mock.calls.length === 0)).toBe(true);
    band.dispose();
  });

  it('builds no recorded voices for a synth genre', () => {
    const start = samplers.length;
    const engine = new MusicEngine(GENRES.synthwave, 1);
    new BackingBand(GENRES.synthwave, () => engine).dispose();
    expect(samplers).toHaveLength(start);
  });
```

Note: this test needs Task 5's Classical preset change to see three samplers. Run it now to see it fail, then again after Task 5.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/audio/backing.test.ts`
Expected: the first new test FAILS (`expected [] to have a length of 3`).

- [ ] **Step 3: Write the Tone factories**

`frontend/src/audio/samplers.ts`:

```ts
import * as Tone from 'tone';
import { sampleUrl, type HitSamples, type PitchedSamples } from './sampleLibrary';

/** One warning per failed folder, then the voice quietly stays on its synth. */
function warn(dir: string, error: unknown): void {
  console.warn(`Samples in public/samples/${dir} failed to load; using the synth sound.`, error);
}

/** Loads in the background; `loaded` turns true when every note is ready. */
export function createSampler(samples: PitchedSamples): Tone.Sampler {
  const sampler = new Tone.Sampler({
    urls: samples.notes,
    baseUrl: sampleUrl(samples.dir),
    release: samples.release,
    onerror: (error) => warn(samples.dir, error),
  });
  sampler.volume.value = samples.volume;
  return sampler;
}

export function createPlayers(samples: HitSamples): Tone.Player[] {
  return samples.files.map((file) => {
    const player = new Tone.Player({
      url: sampleUrl(samples.dir, file),
      onerror: (error) => warn(samples.dir, error),
    }).toDestination();
    player.volume.value = samples.volume;
    return player;
  });
}
```

- [ ] **Step 4: Sampled leads**

In `frontend/src/audio/instruments.ts`:

1. Add imports:

```ts
import { PITCHED } from './sampleLibrary';
import { SampledLead } from './sampledVoices';
import { createSampler } from './samplers';
```

2. Replace `createLead` with:

```ts
/**
 * Each instrument is a Tone.js voice plus its characteristic envelope, sent
 * through a short echo and a small room so consecutive notes blur into each
 * other. A recorded instrument plays its synth stand-in until its samples
 * load. Adding one is authoring a case above; nothing in engine/ changes.
 */
export function createLead(id: InstrumentId): LeadChain {
  const synth = voiceFor(id);
  const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.22, wet: 0.14 });
  const reverb = new Tone.Reverb({ decay: 2.4, wet: 0.24 });
  delay.chain(reverb, Tone.getDestination());
  synth.connect(delay);

  const samples = PITCHED[id];
  const sampler = samples ? createSampler(samples) : null;
  sampler?.connect(delay);
  const voice = sampler ? new SampledLead(sampler, synth) : synth;

  return {
    voice,
    dispose() {
      voice.dispose();
      delay.dispose();
      reverb.dispose();
    },
  };
}
```

(`SampledLead.dispose` disposes both the sampler and the synth; a plain synth disposes itself.)

- [ ] **Step 5: Sampled band**

In `frontend/src/audio/backing.ts`:

1. Add imports:

```ts
import type { InstrumentId } from '../engine/types';
import { KIT_SAMPLES, PITCHED, type DrumVoice } from './sampleLibrary';
import { SampledChords, SampledHit, type ChordVoice } from './sampledVoices';
import { createPlayers, createSampler } from './samplers';
```

2. Add these helpers above the class:

```ts
const DRUM_VOICES: DrumVoice[] = ['kick', 'snare', 'hat', 'openHat', 'clap', 'perc', 'fx'];

function polyVoice(synth: Tone.PolySynth): ChordVoice {
  return {
    play: (notes, duration, time) => synth.triggerAttackRelease(notes, duration, time),
    release: () => synth.releaseAll(),
    dispose: () => synth.dispose(),
  };
}

function monoVoice(synth: Tone.MonoSynth): ChordVoice {
  return {
    play: (notes, duration, time) => synth.triggerAttackRelease(notes[0], duration, time),
    release: () => synth.triggerRelease(),
    dispose: () => synth.dispose(),
  };
}

/** The recorded instrument when there is one, else the band's synth voice. */
function recorded(id: InstrumentId | undefined, fallback: ChordVoice): ChordVoice {
  const samples = id ? PITCHED[id] : undefined;
  if (!samples) return fallback;
  return new SampledChords(createSampler(samples).toDestination(), fallback);
}
```

3. Change the field declarations: `pad`, `bass` and `stab` become `private readonly pad: ChordVoice;`, `private readonly bass: ChordVoice;`, `private readonly stab: ChordVoice;`, and add:

```ts
  private readonly hit: Record<DrumVoice, (time: number) => void>;
  private readonly sampledHits: SampledHit[] = [];
```

4. In the constructor, build the pad, bass and stab synths into locals and wrap them. Replace the `this.pad = …` block with:

```ts
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.6, decay: 1, sustain: 0.6, release: 2 },
    }).toDestination();
    pad.volume.value = -20;
    this.pad = recorded(preset.padInstrument, polyVoice(pad));
```

the `this.bass = …` block with:

```ts
    const bass = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.4 },
    }).toDestination();
    bass.volume.value = -14;
    this.bass = recorded(preset.bassInstrument, monoVoice(bass));
```

and the `this.stab = …` block with:

```ts
    const stab = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: kit.stabOscillator },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.1 },
    }).toDestination();
    stab.volume.value = -20;
    this.stab = recorded(preset.stabInstrument, polyVoice(stab));
```

5. At the end of the constructor, build the drum voices:

```ts
    const synthHit: Record<DrumVoice, (time: number) => void> = {
      kick: (time) => this.kick.triggerAttackRelease(kit.kick.note, '8n', time),
      snare: (time) => this.snare.triggerAttackRelease('8n', time),
      hat: (time) => this.hat.triggerAttackRelease('16n', time),
      openHat: (time) => this.openHat.triggerAttackRelease('8n', time),
      clap: (time) => this.clap.triggerAttackRelease('16n', time),
      perc: (time) => this.perc.triggerAttackRelease(kit.perc.note, '8n', time),
      fx: (time) => this.fx.triggerAttackRelease('4n', time),
    };
    const samples = KIT_SAMPLES[preset.id] ?? {};
    this.hit = { ...synthHit };
    for (const voice of DRUM_VOICES) {
      const set = samples[voice];
      if (!set) continue;
      const sampled = new SampledHit(createPlayers(set), synthHit[voice]);
      this.sampledHits.push(sampled);
      this.hit[voice] = (time) => sampled.trigger(time);
    }
```

6. In `start()`, the pad line becomes `this.pad.play(chordToNotes(this.chord, 4), '1m', time);`.

7. Replace `trigger` with:

```ts
  /** Plays one voice at `time`. Also used for immediate feedback on a digit press. */
  trigger(voice: Voice, time: number = Tone.now()): void {
    if (voice === 'bass') {
      const root = Tone.Frequency(pitchClass(this.chord.root) + 24, 'midi').toNote();
      this.bass.play([root], '8n', time);
    } else if (voice === 'stab') {
      this.stab.play(chordToNotes(this.chord, 4), '16n', time);
    } else {
      this.hit[voice](time);
    }
  }
```

8. `release()` becomes:

```ts
  release(): void {
    this.pad.release();
    this.stab.release();
    this.bass.release();
  }
```

9. In `dispose()`, dispose `this.pad`, `this.bass`, `this.stab` and every sampled hit alongside the synths: replace the `for` loop's array with the remaining Tone nodes (`this.kick, this.perc, this.snare, this.hat, this.openHat, this.clap, this.clapFilter, this.fx`) and add before it:

```ts
    this.pad.dispose();
    this.bass.dispose();
    this.stab.dispose();
    for (const hit of this.sampledHits) hit.dispose();
```

Then `sed -i 's/\r*$/\r/' src/audio/backing.ts`.

- [ ] **Step 6: Type-check and run the audio tests**

Run: `npx tsc -b 2>&1 | grep -c "error TS"` — expected 16; `npx tsc -b 2>&1 | grep -E "samplers|instruments|backing|sampledVoices"` — expected no output.
Run: `npx vitest run tests/audio` — expected all pass except `builds recorded voices for a sampled genre` (Classical is not switched until Task 5).

- [ ] **Step 7: Commit**

```bash
git -c safe.directory=D:/projects/keytosound add frontend/src/audio/samplers.ts frontend/src/audio/instruments.ts frontend/src/audio/backing.ts frontend/tests/audio/backing.test.ts
git -c safe.directory=D:/projects/keytosound commit -m "play samples in lead and band"
```

---

### Task 5: Classical goes orchestral; MIDI learns grandPiano

**Files:**
- Modify: `frontend/src/engine/presets.ts` (CRLF), `frontend/tests/session/vocabulary.test.ts` (LF)
- Modify: `backend/src/main/java/com/keytosound/backend/midi/Score.java`, `MidiWriter.java` (LF)
- Test: `backend/src/test/java/com/keytosound/backend/midi/MidiVocabularyTest.java`, `MidiWriterTest.java` (LF)

**Interfaces:**
- Consumes: instrument ids and preset fields from Task 2.
- Produces: `GENRES.classical` with `leadInstrument: 'grandPiano'`, `padInstrument: 'strings'`, `bassInstrument: 'contrabassArco'`, `stabInstrument: 'stringsPizz'`; the backend accepts `leadInstrument: "grandPiano"` and writes GM program 0 for it.

- [ ] **Step 1: Write the failing tests**

In `frontend/tests/session/vocabulary.test.ts`, change the list to:

```ts
    const acceptedByBackend = ['piano', 'electricPiano', 'synthLead', 'eightBit', 'bass', 'grandPiano'];
```

In `MidiVocabularyTest.java`, change `INSTRUMENTS` to:

```java
    private static final List<String> INSTRUMENTS =
            List.of("piano", "electricPiano", "synthLead", "eightBit", "bass", "grandPiano");
```

In `MidiWriterTest.java`, add after `setsTheLeadProgramFromTheInstrument`:

```java
    @Test
    void writesTheGrandPianoAsAnAcousticGrand() throws Exception {
        Score grand = new Score(120, "grandPiano", score().lead(), score().pad(), score().bass(), score().drums());
        Track lead = read(writer.write("rain", grand)).getTracks()[1];
        int program = -1;
        for (int i = 0; i < lead.size(); i++) {
            if (lead.get(i).getMessage() instanceof ShortMessage m
                    && m.getCommand() == ShortMessage.PROGRAM_CHANGE) {
                program = m.getData1();
            }
        }
        assertThat(program).isZero(); // GM "Acoustic Grand Piano"
    }
```

- [ ] **Step 2: Switch Classical**

In `frontend/src/engine/presets.ts`, in `classical`, replace

```ts
    leadInstrument: 'piano',
    glideSeconds: 0, // a piano cannot glide; legato only
```

with

```ts
    leadInstrument: 'grandPiano',
    glideSeconds: 0, // a piano cannot glide; legato only
    padInstrument: 'strings',
    bassInstrument: 'contrabassArco',
    stabInstrument: 'stringsPizz',
```

then `sed -i 's/\r*$/\r/' src/engine/presets.ts`.

- [ ] **Step 3: Run to verify the frontend and Java tests fail**

Run (from `frontend/`): `npx vitest run tests/session/vocabulary.test.ts` — expected PASS now (list and preset agree); `npx vitest run tests/audio/backing.test.ts` — expected PASS (Classical now builds three samplers).
Run (from `backend/`): `./mvnw -B -q test -Dtest='MidiVocabularyTest,MidiWriterTest'` — expected FAIL: `grandPiano` violates the `leadInstrument` pattern, and `MidiWriter` throws on a null program.

- [ ] **Step 4: Teach the backend**

In `Score.java`, change the pattern to:

```java
        @NotNull @Pattern(regexp = "piano|electricPiano|synthLead|eightBit|bass|grandPiano") String leadInstrument,
```

In `MidiWriter.java`, change `LEAD_PROGRAMS` to:

```java
    private static final Map<String, Integer> LEAD_PROGRAMS = Map.of(
            "piano", 0, // Acoustic Grand Piano
            "grandPiano", 0, // Acoustic Grand Piano
            "electricPiano", 4, // Electric Piano 1
            "synthLead", 81, // Lead 2 (sawtooth)
            "eightBit", 80, // Lead 1 (square)
            "bass", 38); // Synth Bass 1
```

- [ ] **Step 5: Run both suites**

Run (from `backend/`): `./mvnw -B -q test`, then sum the surefire reports — expected 118 tests (117 + 1), 0 failures.
Run (from `frontend/`): `npx vitest run` — expected all pass (339 + 6 + 15 + 3 = 363). `npx tsc -b 2>&1 | grep -c "error TS"` — 16. `npx eslint src/audio src/engine` — clean.

- [ ] **Step 6: Commit**

```bash
git -c safe.directory=D:/projects/keytosound add frontend/src/engine/presets.ts frontend/tests/session/vocabulary.test.ts backend/src/main/java/com/keytosound/backend/midi/Score.java backend/src/main/java/com/keytosound/backend/midi/MidiWriter.java backend/src/test/java/com/keytosound/backend/midi/MidiVocabularyTest.java backend/src/test/java/com/keytosound/backend/midi/MidiWriterTest.java
git -c safe.directory=D:/projects/keytosound commit -m "make classical orchestral"
```

---

### Task 6: Listening check

- [ ] **Step 1:** Start `backend` and `frontend` previews. Open `http://localhost:5173`, pick **Classical**, Start audio.
- [ ] **Step 2:** Network: every `/samples/...` request for Classical is 200, and no other genre's samples were requested. Console: no `failed to load` warnings.
- [ ] **Step 3:** Type a sentence with real key presses. Confirm the melody is the piano (not the old triangle tone) once loaded; press `1`–`9` and confirm timpani, snare, triangle, cymbals, bass and pizzicato sound. Switch to Lo-Fi and back: Lo-Fi unchanged, Classical returns.
- [ ] **Step 4:** Export MIDI from a Classical composition: 200, file downloads (intercept the click as in earlier checks).
- [ ] **Step 5:** Hand over to the user to listen. Adjust `volume`/`release` in `sampleLibrary.ts`, or swap files in the manifest (re-run the script), per their feedback; commit each adjustment with a short message.
- [ ] **Step 6:** Stop the previews and stop the embedded Postgres cleanly (`pg_ctl stop -D .pgdata -m fast` from `backend/`).
