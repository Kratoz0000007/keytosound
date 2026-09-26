# Session Analytics (Plan 3c) — Design

**Status:** approved in brainstorming, 2026-09-26
**Parent spec:** `2026-09-19-typing-to-music-design.md` §6 item 3 ("Typing rhythm histograms, WPM distributions, and pause analysis computed server-side over stored keystroke streams") and its API line `GET /api/compositions/{id}/analytics`.
**Plan 3 split:** 3a MIDI export (done) → 3b accounts (done) → 3c analytics (this).

## 1. Goal

Each saved composition gets a stats view computed by the Java backend from its stored keystrokes: rhythm, speed per sentence, pauses and key usage. The UI is a deliberate placeholder: plain rows and grey bars, to be replaced in a later redesign.

## 2. Decisions

| Question | Decision | Why |
|---|---|---|
| Scope | **One composition at a time.** No cross-song summary. | Matches the parent spec's endpoint; smallest useful build. |
| Stats | Rhythm, speed per sentence, pauses, key usage | All four chosen. |
| When computed | **On every request, in memory.** Nothing stored. | No migration; results always follow the current rules; a composition is capped at 20,000 keystrokes, so it is instant. |
| Speed slices | **Per sentence** | Lines up with the music, where `.` and `?` move the harmony. |
| Pause threshold | **400 ms**, same as the live analyzer | Live readout and stats agree. |
| Held keys | **Dropped** (see §3) | Auto-repeat fakes speed bursts and skews rhythm. |
| Pause view | Typed text with pause markers inline | Readable without a chart. |
| UI | Temporary. Separate panel below the library, plain rows, div bars, no chart library. | User will redesign later. |

## 3. Cleaning the keystroke stream

Rules shared with the live analyzer (`frontend/src/typing/analyzer.ts`): a pause is a gap **> 400 ms**; a word is **5** keys; WPM is capped at **300**; sentences end at `.` `!` `?` `Enter`.

1. **Held keys.** Walk every stored keystroke in ordinal order. A keystroke is a repeat when its key equals the previous keystroke's key (the previous one seen, kept or not, so a whole repeat chain drops) and it arrives **< 50 ms** after it. Repeats are dropped and counted as `heldKeysIgnored`. Known gap: the OS waits ~500 ms before the first repeat, so a held key still counts as two presses with a pause between them.
2. **Digits** (`0`–`9`) are drum keys. They are removed from rhythm, speed, pauses and text, exactly as the live analyzer skips them, and counted as `drums`.
3. What remains are the **text keys**: every non-digit keystroke, including `Backspace`, `Enter` and other named keys (the live analyzer times these too). Gaps are measured between consecutive text keys, so a drum hit in between does not split a gap.

## 4. The analysis

A new package `com.keytosound.backend.analytics`. The analyzer is a plain Java class (no Spring, no JPA types in its signature): it takes the ordered `List<KeystrokeDto>` from `CompositionDetail` and returns an immutable result. All of the logic below lives there.

**Summary**
- `keyCount` — text keys.
- `durationMs` — last text key minus first. 0 with fewer than 2.
- `averageWpm` — `(keyCount / 5) / (durationMs / 60000)`, capped at 300. 0 with fewer than 2 keys or zero duration.
- `peakWpm` — highest sentence WPM; `null` if no sentence has one.
- `heldKeysIgnored`.

**Rhythm** — over gaps **≤ 400 ms** between consecutive text keys (longer gaps are pauses).
- `bands`: counts in `[0,50)`, `[50,100)`, `[100,150)`, `[150,200)`, `[200,300)`, `[300,400]` ms.
- `medianGapMs`: median gap (mean of the middle two for an even count); `null` with no gaps.
- `steadiness`: share of gaps within ±25% of the median, 0..1; `null` with no gaps.

**Sentences** — split the text keys after each `.` `!` `?` `Enter` (the terminator belongs to its sentence); a trailing unterminated run is a sentence too.
- Each: `label` (its rendered text, trimmed, first 40 characters), `keyCount`, `wpm`.
- `wpm` is `(keyCount / 5) / (last − first minutes)`, capped at 300, and `null` when the sentence has fewer than 2 keys or zero duration. Pauses inside a sentence count toward its time.

**Pauses** — every gap **> 400 ms** between consecutive text keys.
- Kind comes from the key **before** the gap: space → `word`; `,` → `comma`; `.` `!` `?` `Enter` → `sentence`; anything else → `hesitation` (mid-word stops and stops after a Backspace).
- `count`, `totalMs`, `longestMs` (0 with none), `byKind` (all four kinds always present).
- `segments`: the rendered text split at each pause, as `[{text, pauseAfterMs}]`. The last segment's `pauseAfterMs` is `null`. No pauses means one segment.

**Rendered text** (used by labels and segments): a single-character key renders as itself, `Backspace` as `⌫`, `Enter` as `↵`, and any other named key (`Delete`, `Home`, `F5`…) renders as nothing. It is the text *as typed*, so corrections stay visible.

**Key usage** (counted over text keys)
- `top`: up to 10 single-character keys by count, case-folded to lower case, ties broken by first appearance. Space is the key `" "`; the UI labels it.
- `backspaces`, `correctionRate` (`backspaces / keyCount`, 0 when `keyCount` is 0).
- `punctuation`: counts for `.` `,` `!` `?`, all four always present.
- `enters`, `drums`.

## 5. API

`GET /api/compositions/{id}/analytics` in a new `AnalyticsController`, following `MidiExportController`: `@AuthenticationPrincipal UUID userId`, loads through the existing owner-scoped `CompositionService.get(userId, id)` path, so another user's composition is a **404** and no session is a **401** (both already handled by the security chain and `ApiExceptionHandler`).

```json
{
  "summary":   { "keyCount": 12, "durationMs": 2400.0, "averageWpm": 60.0, "peakWpm": 64.3, "heldKeysIgnored": 0 },
  "rhythm":    { "bands": [ { "fromMs": 0, "toMs": 50, "count": 0 } ], "medianGapMs": 180.0, "steadiness": 0.72 },
  "sentences": [ { "label": "hello world.", "keyCount": 12, "wpm": 64.3 } ],
  "pauses":    { "count": 1, "totalMs": 1200.0, "longestMs": 1200.0,
                 "byKind": { "word": 0, "comma": 0, "sentence": 1, "hesitation": 0 },
                 "segments": [ { "text": "hello world.", "pauseAfterMs": 1200.0 }, { "text": " keep", "pauseAfterMs": null } ] },
  "keys":      { "top": [ { "key": "l", "count": 3 } ], "backspaces": 0, "correctionRate": 0.0,
                 "punctuation": { ".": 1, ",": 0, "!": 0, "?": 0 }, "enters": 0, "drums": 0 }
}
```

(Shape only: values are illustrative, and `bands` always has all six entries, shortened above.) A composition whose keystrokes are all digits returns zeros, `null`s and empty lists as defined in §4, with status 200. Numbers are not rounded server-side; the UI rounds for display.

## 6. Frontend (temporary UI)

- `session/types.ts`: `CompositionAnalytics` and its parts, mirroring §5.
- `session/api.ts`: `getAnalytics(id)` via the existing `request` (sends the session cookie).
- `ui/analyticsView.ts`: pure helpers — `formatMs` (`1200` → `"1.2s"`, under a second → `"340ms"`), `barPercent(value, max)` (0 when max is 0), `asPercent(0.72)` → `"72%"`, `keyLabel(" ")` → `"space"`.
- `ui/AnalyticsPanel.tsx`: one file, headed by a comment marking it as a placeholder for the redesign. Shows the title and a Close button, then four plain sections: summary rows; rhythm bands and per-sentence WPM as thin grey div bars; the pause text in monospace with `[1.2s]` markers and the per-kind counts; key usage as a small table. White background, neutral greys, no chart library, no new dependency.
- `CompositionList`: a **Stats** button per row, via a new `onStats(id, title)` prop.
- `TypingSurface`: holds which composition's stats are open; renders `AnalyticsPanel` below the library, only while signed in. A 401 goes through the existing `expireSession`; any other failure shows an inline "Could not load stats." in the panel.

## 7. Testing

- **Analyzer unit tests (Java, no Spring):** empty-after-cleaning (all digits); a single key; held-key chains dropped and counted, while a real double letter at ≥ 50 ms is kept; digits excluded from gaps and text but counted; band edges (49/50, 399/400/401); median for odd and even counts; steadiness; sentence split including a trailing unterminated sentence and `Enter`; sentence WPM cap and `null` cases; each pause kind; segments with and without pauses; rendered text for `⌫`, `↵` and ignored named keys; top keys case-folded with tie order; correction rate; punctuation map always complete.
- **Controller tests (MockMvc, real DB):** 200 with the expected shape for the owner; 404 for another user's composition; 401 with no session.
- **Frontend (Vitest):** `getAnalytics` hits the right URL with credentials; `analyticsView` helpers.
- **Browser check:** type a known sentence with a deliberate pause, save, open Stats, confirm the numbers and the pause marker; close; log out hides the panel.

## 8. Out of scope

Cross-composition summary; storing computed results; live stats while typing; chart libraries; the final visual design of the panel.
