# Real Instrument Sounds (Plan 4) — Design

**Status:** approved in brainstorming, 2026-09-27
**Why:** every genre except 8-Bit imitates real instruments with bare synth tones (Classical's "piano" is one triangle wave, `frontend/src/audio/instruments.ts`), so none of them sound like their genre. 8-Bit sounds right because chiptune *is* bare synth tones. The fix is recorded instruments, plus one new genre, **Sufi**, in the spirit of "Kun Faya Kun" (the style, never the song's melody or recording).

## 1. Goal

Each genre sounds like the real thing: Classical is a piano with an orchestra, Jazz has a tenor saxophone and a walking bass, Lo-Fi is a dusty upright piano over vinyl, Synthwave gets proper 80s synth patches, and Sufi is harmonium, tabla and handclaps over a drone. 8-Bit is unchanged.

## 2. Decisions

| Question | Decision | Why |
|---|---|---|
| Sound source | **Recorded samples** for acoustic instruments; better synth patches for Synthwave; 8-Bit untouched | Samples are the only way acoustic instruments sound real. Synthwave and 8-Bit are synth genres by nature. |
| Licences | **CC0 only**, except the piano (CC-BY 3.0, one credit line) | No restrictions to track. The only free Rhodes found is non-commercial, so Lo-Fi uses a CC0 upright piano instead. |
| Where files live | `frontend/public/samples/`, committed | Works offline; no dependency on anyone else's server. Budget **≤ 20 MB** total. |
| Getting them there | A script downloads from the original sources and converts with **ffmpeg** | Provenance is recorded and reproducible; the committed MP3s are its output. |
| While loading / on failure | Each voice **falls back to its current synth sound** | Nothing breaks offline, on a slow link, or if a file is missing. |
| When loading | Only the **selected genre's** samples, when it is built | First load stays fast. |
| Sufi scale | **Bhairav-like**: 0 1 4 5 7 8 11 | Flat 2nd and 6th: the devotional, "Sufi ache" colour. |
| Sufi harmony | **Drone + gentle chords** | A Sa–Pa drone throughout, with soft chord shifts, like Rahman's fusion arrangements. |
| Delivery | **One spec, five plans**, in order (§8) | Each part is playable on its own; the user listens and gives feedback before the next. |

## 3. Sources

All checked on 2026-09-27. Sizes are the downloads; the committed, trimmed MP3s are much smaller.

| Library | Licence | What we take |
|---|---|---|
| [Salamander Grand Piano, Tone.js mirror](https://github.com/Tonejs/audio/tree/master/salamander) (Alexander Holm) | CC-BY 3.0 | 30 piano MP3s, 2.0 MB. Used as-is. |
| [VSCO-2-CE](https://github.com/sgossner/VSCO-2-CE) (Versilian Studios) | CC0 | Violin/Viola/Cello sections, solo contrabass (arco and **pizzicato**), harp, upright piano, timpani, orchestral snare and cymbals, triangle, trumpet. |
| [VCSL](https://github.com/sgossner/VCSL) (Versilian Studios) | CC0 | **Tenor saxophone**, handclaps, frame drum (daf), finger cymbals, drum kit (bass drum, snare, hi-hat). |
| [Sonic Pi samples](https://github.com/sonic-pi-net/sonic-pi/blob/dev/etc/samples/README.md) | CC0 | All 26 **tabla** strokes (0.86 MB), `vinyl_hiss`. |
| [Freesound 330410](https://freesound.org/people/donyaquick/sounds/330410/) (Donya Quick, recorded at Yale) | CC0 | A real **Indian harmonium**, every key and drone in one 7½-minute recording. The WAV needs a login; the public HQ preview (11.5 MB MP3) does not, and CC0 covers it. |

Every download is shown to the user (file, source, size) and approved before it happens, once per plan.

## 4. Asset pipeline

- `scripts/samples/manifest.json` lists every output file: its source URL, licence, author, and processing (trim window, fade-out, mono, peak-normalise, MP3 bitrate).
- `scripts/samples/fetch.mjs` (Node, no dependencies) downloads each source into a git-ignored cache, runs **ffmpeg** on it, writes `frontend/public/samples/<instrument>/<name>.mp3`, and regenerates `frontend/public/samples/CREDITS.md` from the manifest. Re-running it is idempotent.
- ffmpeg is installed with `winget install Gyan.FFmpeg` (asked for once, before the first plan).
- Pitched instruments keep about one note every 3 semitones over their playable range (Tone's sampler repitches in between), one velocity layer, trimmed to what a bar needs (≤ 4 s) with a short fade-out. Hits keep their round-robin variants (2–5 each) so repeated hits don't sound machine-gunned.
- The harmonium is one long recording: the script cuts it at silences (ffmpeg `silencedetect`), and each slice's pitch is checked by analysis before it is named.

## 5. Runtime

**Instruments.** `InstrumentId` gains `grandPiano`, `uprightPiano`, `tenorSax`, `harmonium`, `strings`, `harp`, `contrabassPizz`, `contrabassArco`. Each id has a **synth fallback** (today's voices, or a close one) and an optional **sample set**: base URL plus note → file. The existing ids keep working unchanged.

**Lead.** A `SampledLead` implements the existing `LeadVoice` interface around `Tone.Sampler`, monophonically: a new attack releases the previous note. Samplers cannot glide, so sampled leads use `glideSeconds: 0` and connect by legato, as the piano already does (`LegatoLead` handles this). Until the sampler reports loaded, calls go to the fallback synth.

**Backing.** The chord pad and the bass become instruments too. `GenrePreset` gains optional `padInstrument` and `bassInstrument`; when absent, today's synth pad and bass are used, so Synthwave and 8-Bit need no change. A `drone` flag holds the key's root and fifth under every bar (Sufi only).

**Kit.** `Kit` gains optional sampled hits per voice: `samples?: Partial<Record<Voice, HitSet>>`, where a `HitSet` is a list of files played round-robin. A voice without samples, or whose samples haven't loaded, plays today's synth hit. Digits keep their meaning in every genre (1 kick … 9 fx); only the timbre changes.

**Ambience.** Optional per-genre looping bed (Lo-Fi's vinyl hiss) under everything, quiet, starting and pausing with the transport.

**Loading and failure.** Samples load when a genre's instruments are built, which is on Start and on a genre switch. The browser caches them, so switching back is instant. A file that fails to load logs one `console.warn` and that voice stays on its synth.

**MIDI export.** `Score.leadInstrument` is validated by a whitelist in `backend/.../midi/Score.java`, and `MidiWriter` maps it to a General MIDI program. Each new lead id is added to both: `grandPiano` 0 (Acoustic Grand), `uprightPiano` 0, `tenorSax` 66, `harmonium` 20 (Reed Organ), plus Java tests. Pad, bass and drums in the exported file stay General MIDI as today (§9).

## 6. Genres

Instrument-to-voice choices below are the plan; exact files and volumes are settled by ear during each build.

**Classical** — lead `grandPiano`; pad `strings` (violin/viola/cello section sustain); bass `contrabassArco`; kit: 1 timpani, 2 orchestral snare, 3 triangle, 4 suspended cymbal, 5 crash cymbal, 6 low timpani, 8 string pizzicato chord, 9 cymbal swell. Scale, progression and tempo unchanged.

**Sufi** (new, id `sufi`) — scale `bhairav` = [0, 1, 4, 5, 7, 8, 11], key C (Sa = C); lead `harmonium`; drone: harmonium C + G throughout; pad: harmonium chords C → D♭ → Fm → C (all three chords use only Bhairav tones); bass: harmonium, low octave, on the chord root. Kit: 1 tabla ghe (deep), 2 tabla na, 3 tabla te/ke, 4 tabla tun, 5 handclaps, 6 daf, 7 bass, 8 harmonium chord, 9 finger cymbals. Default groove: an 8-beat qawwali (Keherwa-style) pattern on the 16-step bar, claps on the main beats. About 84 BPM, straight. Weights like Jazz and Classical (heavier chord-tone pull, since a 7-note scale has semitone clashes). Punctuation as everywhere: `.` resolves to Sa, `,` rests on Pa, `?` hangs.

**Jazz** — lead `tenorSax`; pad `grandPiano` comping; bass `contrabassPizz` (walking bass); kit: soft bass drum, brush-like snare taps, closed and open hi-hat, cymbal as ride; swing as today.

**Lo-Fi** — lead and pad `uprightPiano` through a low-pass filter and light bit-crush; ambience `vinyl_hiss`; kit: real kit samples through the same low-pass and crush; swing as today.

**Synthwave** — no samples. Lead: three detuned saws (Tone `FatOscillator`) with chorus; pad: wide saw pad with a slow attack; snare: noise into a large reverb cut short (gated-reverb feel); bass: pulsing saw. Tuned by ear.

**8-Bit** — unchanged.

## 7. Testing

- **Catalogue integrity (Vitest, reads the filesystem):** every sample file referenced by any instrument, kit or ambience exists under `public/samples`; every `InstrumentId` used by a preset has a fallback; every manifest entry has a licence and author; `CREDITS.md` lists every source used.
- **Pure logic:** round-robin order; note-name mapping for sample sets; `SampledLead` routes to the fallback until loaded and to the sampler after, releases the previous note on a new attack, and ignores glide; the `bhairav` scale and the Sufi preset's invariants (chords use scale tones, drone is root + fifth).
- **Existing engine invariants** run against the new preset like every other genre (pitches in scale, register bounds, resolution on `.`).
- **Java:** `Score` accepts the new lead ids; `MidiWriter` writes the mapped program for each.
- **By ear, in the browser, after every plan:** the user listens and gives feedback; volumes and file choices are adjusted before moving on.

## 8. Delivery

| Plan | Contents |
|---|---|
| 4a | Foundation (pipeline, ffmpeg, instrument/fallback layer, sampled kit hits, credits, integrity tests, MIDI whitelist) **+ Classical** |
| 4b | Sufi: `bhairav` scale, preset, drone, harmonium slicing, tabla/clap/daf/cymbal kit |
| 4c | Jazz |
| 4d | Lo-Fi (ambience bed, low-pass and crush chain) |
| 4e | Synthwave patches |

Each plan ends with a listening check by the user before the next begins.

## 9. Out of scope, and known gaps

- Recorded vocals or chorus. Qawwali is sung; synthesising singing is out of scope.
- Harmonium and saxophone cannot slide between notes (a real harmonium can't either); expressive bends are not modelled.
- MIDI export keeps General MIDI pad, bass and drums for every genre, so a Sufi export plays its tabla parts on a standard drum kit.
- Only one velocity layer per pitched instrument, so loudness changes volume but not tone colour.
- No strings for Jazz or Lo-Fi, no brass section for Classical beyond what §6 lists.
