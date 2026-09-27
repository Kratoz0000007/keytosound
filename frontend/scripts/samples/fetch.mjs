// Downloads the recordings listed in manifest.json, trims and converts them
// with ffmpeg, and writes them to public/samples/ along with CREDITS.md.
// Run from frontend/:  node scripts/samples/fetch.mjs
// ffmpeg must be on PATH, or FFMPEG must hold its full path. Downloads are
// cached in scripts/samples/.cache, so re-running only redoes the conversion.
import { execFileSync, spawnSync } from 'node:child_process';
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

/** Only seek when cutting: even '-ss 0' drops the single frame of a tiny FLAC. */
function inputArgs(input, start) {
  return [...(start > 0 ? ['-ss', String(start)] : []), '-i', input];
}

/** The loudest sample, in dBFS, after the filters. */
function measurePeak(input, start, filters) {
  const result = spawnSync(
    ffmpeg,
    ['-hide_banner', ...inputArgs(input, start), '-af', `${filters.join(',')},volumedetect`, '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  const match = /max_volume: (-?[\d.]+) dB/.exec(result.stderr);
  if (!match) throw new Error(`no level for ${input}: ${result.stderr}`);
  return Number(match[1]);
}

/** Every converted file peaks here, so a volume in sampleLibrary means one thing. */
const PEAK_DB = -1;

/**
 * Mono, 44.1 kHz, 96 kbps MP3. Leading silence is cut so every hit lands on
 * its beat; the tail is faded so a trimmed note never ends in a click; the
 * peak is brought to PEAK_DB, since libraries record at wildly different
 * levels (a VCSL hi-hat peaked at -38 dB, a tabla stroke at 0).
 * `start` cuts one note out of a longer recording (the harmonium's run).
 * `even` compresses first, flattening a note that swells (the sax's and the
 * strings' do, and a swell reads as the note arriving late).
 */
function convert(input, output, { start = 0, seconds, fade, even }) {
  const filters = [
    // Mono first, so the peak measured below is the peak of what is written.
    'aformat=sample_rates=44100:channel_layouts=mono',
    'silenceremove=start_periods=1:start_threshold=-60dB',
    'asetpts=PTS-STARTPTS',
    `atrim=0:${seconds}`,
    `afade=t=out:st=${Math.max(0, seconds - fade)}:d=${fade}`,
  ];
  if (even) {
    filters.push(`volume=${PEAK_DB - measurePeak(input, start, filters)}dB`);
    filters.push('acompressor=threshold=-24dB:ratio=8:attack=3:release=250:knee=4');
  }
  filters.push(`volume=${PEAK_DB - measurePeak(input, start, filters)}dB`);
  execFileSync(ffmpeg, [
    '-v', 'error', '-y', ...inputArgs(input, start),
    '-af', filters.join(','),
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
