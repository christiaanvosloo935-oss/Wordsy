# Wordsy — Design Spec

Date: 2026-10-12
Status: Approved 2026-10-12

## 1. Purpose

A personal vocabulary app for one user. Each day it teaches up to three new
words: curious, sometimes advanced or unusual words that still work in everyday
conversation and make you sound a little smarter. Each word is reinforced with
active recall (flip-card quizzes). Every word is kept in an archive grouped by
day, and any of them can be pulled back in for relearning.

Success: the user opens it a few times a day, learns about 3 words a day, and
can find any past word in the archive.

### Out of scope (for now)

- Push notifications and messaging channels (Telegram, SMS, email)
- Accounts, sync between devices, and multiple users
- Automatic spaced repetition of words from past days
- AI-generated content or answer grading at runtime
- Native iOS or Android apps

## 2. Daily flow

### Day

A day runs from local midnight to midnight on the user's device. Days are
numbered by days *used*: Day 1 is the first day the app was opened, and days
with no visits don't appear.

### Visit

A **visit** begins when the app is opened (or brought back to the foreground) and
either of these holds:

- it is the first visit of the current day, or
- the app has been closed or in the background for **at least 60 minutes**.

Coming back sooner continues the current visit and changes nothing.

Implementation: on `visibilitychange` → hidden and on `pagehide`, record
`lastHiddenAt`. On load and on `visibilitychange` → visible, compare it against
now and against the current day.

### What each visit shows

| Visit of the day | Shows |
|---|---|
| 1 | New word #1 |
| 2 | Recall quiz, then new word #2 |
| 3 | Recall quiz, then new word #3 |
| 4+ | Recall quizzes only |

A visit after the first one reveals a new word after its quiz for as long as the
day has had fewer than 3. That way a visit you left before grading doesn't cost
the day a word.

- After any quiz has been graded, a **"Another one"** button offers a further
  quiz from the same pool. There's no limit.
- On visits 2–3 the user can't skip ahead to the new word: it appears once the
  quiz has been graded.
- A day with fewer than 3 visits just has fewer words. Unseen words aren't
  carried over, and the word list pointer only advances when a word is actually
  shown.

### Quiz pool and selection

- Pool = today's new words plus any words the user marked **Relearn** today.
  Words from earlier days never appear unless relearned.
- Selection: the word quizzed fewest times today. Ties go to the word shown most
  recently, so visit 2 always quizzes word #1.
- Direction: each quiz picks word → meaning or meaning → word. For a given word
  the direction alternates, starting with word → meaning.

### Flip-card quiz

1. The front shows the prompt: the headword plus pronunciation, or the definition.
2. Tapping flips the card. The back shows the answer and one example sentence.
3. The user grades themselves with **Knew it** or **Didn't know**.

The grade is stored with the word (timestamp, direction, result). In v1 it only
affects the "Didn't know" follow-up text, not scheduling.

### Quiz a past day

Each day in the archive has a **Quiz this day** button. It opens a practice
session that uses only that day's words, with the same flip cards, the same
selection rule (fewest quizzed in this session; ties go to the word that appears
last in the day) and the same direction alternation, plus an "Another one"
button. A **Done** button returns to the archive.

Practice sessions run outside the daily flow. They never count as a visit, never
reveal a new word, and never change today's quiz pool or counts. Grades from
practice are still recorded in `grades`. Session state is held in memory only
and isn't saved.

### Share as picture

The new-word screen and the archive word pop-up have a small **share icon** (the
usual box-with-arrow glyph, no label or border) at the top right of the word card.
It draws a 1080×1350 PNG of the word card in the current theme (cream or
navy): the headword, pronunciation, part of speech, definition, the first example
with the word highlighted, and a "Wordsy" footer. It uses the same fonts as the
app, shrinks the headword to fit, and shrinks the body text if an entry is too
long. The picture is drawn in the browser (`js/card.js`), with no libraries.

Where the browser can share files (phones), the share sheet opens with the picture
attached; closing it does nothing. Otherwise the picture downloads as
`wordsy-<word>.png`. The icon dims while the picture is made. A small notice at the
bottom says "Picture saved" after a download, or "Couldn't make the picture" if
something fails.

### Relearn

In the archive, **Relearn** adds a word to *today's* quiz pool. Pressing it again
removes it. The next day the pool resets.

## 3. Screens

The approved mockup is in `docs/mockups/layouts.html`.

1. **Today**: the new word card (headword, IPA, part of speech, definition, 3
   examples), with dots for words shown today (●●○) and a note about when the
   next word unlocks. On visits 4+ the screen opens straight into a quiz.
2. **Recall (word → meaning)**: flip card plus grade buttons.
3. **Recall (meaning → word)**: flip card plus grade buttons.
4. **Archive**: collapsible days, newest first (`Day 13 · Sun 11 Oct · 3 words`),
   each word with a one-line definition and a Relearn button. Each open day
   also has a **Quiz this day** button. Search filters by
   headword or definition text. Tapping a word opens its full card.

A bottom bar switches between **Today** and **Archive**.

**Low-stock banner:** when fewer than 90 unseen words remain (about 30 days), the
Today screen shows a small notice: "About N days of words left." When none are
left, visits 1–3 skip the new word and show a "You've seen every word" message,
and quizzes keep working.

### Visual style

- **Typefaces (both themes):** Newsreader (serif) for headwords, definitions and
  day titles. IBM Plex Sans for labels, buttons and examples. IBM Plex Mono for
  pronunciation. The font files are self-hosted so the app works offline.
- **Day theme ("Lexicon"):** warm cream page `#f5eedf`, lighter cream cards
  `#fcf8ef` with hairline borders `#e4d9c5`, near-black ink text `#1d1b18`,
  ink-blue accent `#2443a8`.
- **Night theme:** deep navy page `#151826`, cards `#1e2131`, cream text
  `#f1e8d6`, soft lilac accent `#c9b8ff`.
- The theme follows the phone's light/dark setting (`prefers-color-scheme`).
  There's no in-app toggle.
- **Long headwords:** the font size shrinks until the word fits its card
  (minimum 14px), so a word like *Ultracrepidarian* never overflows.

## 4. Architecture

A static web app: plain HTML, CSS and JavaScript (ES modules), with no framework
and no build step. It's hosted on GitHub Pages from this repo.

```
index.html              App shell (Today + Archive views)
manifest.webmanifest    Home-screen install (name, icons, standalone display)
sw.js                   Service worker: caches the app shell, words and fonts for offline use
css/styles.css          Tokens for both themes, plus the layout
fonts/                  Self-hosted woff2 files
js/app.js               UI: rendering, events, view switching, fit-text
js/engine.js            Pure logic: day/visit detection, what a visit shows,
                        quiz selection, direction, relearn, stock count
js/store.js             Loading and saving state in localStorage, with a schema version
data/words.js           The word list (exported array)
tests/                  Unit tests for engine.js and the word data
```

### Unit boundaries

- **engine.js** is pure: functions take `(state, words, now)` and return new
  state or a description of what to render. It has no DOM and no storage access.
  Everything that matters is tested here.
- **store.js** only does `load()` and `save(state)` against one localStorage key
  (`wordsy:v1`). It wraps calls in try/catch and falls back to a fresh state.
- **app.js** connects browser events to the engine and the store, and renders
  the result.

### Data model

Word entry (in `data/words.js`):

```js
{
  id: "apricity",              // stable, unique; never reused or renamed
  word: "apricity",
  ipa: "/əˈprɪs.ɪ.ti/",
  pos: "noun",
  definition: "The warmth of the sun on a cold winter's day.",
  examples: [ "…", "…", "…" ]  // exactly 3, each containing the word or an inflection of it
}
```

New words are appended to the end of the list. Existing entries are never
reordered or removed, so `nextIndex` stays valid.

State (in localStorage):

```js
{
  version: 1,
  nextIndex: 0,                 // next unseen word in the list
  lastHiddenAt: null,           // ms timestamp
  today: {
    date: "2026-10-12",         // local date
    dayNumber: 14,
    visits: 2,
    newWordIds: ["…", "…"],
    relearnIds: [],
    quizCounts: { "<id>": 1 },
    currentQuiz: null           // { id, direction, flipped } while a quiz is open
  },
  history: [                    // archive, newest last
    { date: "2026-10-11", dayNumber: 13, wordIds: ["…"] }
  ],
  grades: { "<id>": [ { at, direction, knew } ] }
}
```

At the first visit of a new day, the old `today` is moved into `history` (if it
has any words) and a fresh `today` is created.

### Word content

- The initial list has **300 words** (about 100 days), written for this project.
  The theme is curious, slightly unusual, conversation-ready vocabulary.
- A test checks every entry: unique `id`, all fields present, exactly 3
  examples, and each example containing the headword (case-insensitive, stem
  match).
- Restocking: in a later session, Claude appends more entries to
  `data/words.js` and the tests verify them.

## 5. Edge cases and error handling

- **Storage unavailable or corrupt:** start fresh in memory and show a small
  notice that progress can't be saved. The app never crashes.
- **Device clock changes or time zone travel:** the day is always the device's
  current local date. Going back in time never creates a duplicate day entry; if
  `today.date` is later than the current date, the existing day is kept.
- **App open across midnight:** the next foreground event after midnight counts
  as visit 1 of the new day.
- **iOS storage eviction:** Safari may clear site data for websites that aren't
  used. Installing to the home screen avoids this. Export/import is a possible
  later addition, not part of v1.

## 6. Testing

- `node --test` (built into Node, no dependencies) runs the tests for
  `engine.js` and `data/words.js`.
- Engine cases: first visit of the day; a return under 60 minutes
  versus 60 or more; visits 1–4+ outputs; midnight rollover moves the day into
  history; quiz selection and tie-breaking; direction alternation; relearn
  add/remove and reset the next day; low-stock threshold; running out of words;
  a clock that goes backwards; past-day practice selection and the fact that it
  never touches `today`.
- Manual check in Chromium at phone width, in both themes, before publishing.
