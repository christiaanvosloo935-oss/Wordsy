# Wordsy

A personal vocabulary app. Each day it teaches up to three curious, slightly
unusual words: the kind you can drop into conversation to sound a little
smarter. It uses flip-card quizzes for active recall and keeps every word in a
day-by-day archive.

## How it works

- **First open of the day:** a new word, with pronunciation, a definition and
  three examples.
- **Each time you come back after an hour or more away:** a quick flip-card
  quiz on today's words, then the next new word (up to 3 a day).
- **After the third word:** opening the app gives quizzes only. Quizzes go both
  ways: word → meaning and meaning → word.
- **Archive:** every word, grouped by day. Search it, tap a word to see its
  full card, press **Relearn** to add a past word to today's quizzes, or press
  **Quiz this day** to practise a whole past day.
- **Share as picture:** on a new word or any archived word, makes a picture of
  the word card and opens your phone's share sheet. On a computer it downloads
  the picture instead.
- The theme follows your phone's light/dark setting.

Progress is saved on the device in the browser's local storage, and nothing
leaves your phone.

## Install on your phone

1. Open the site in Safari (iPhone) or Chrome (Android).
2. iPhone: **Share → Add to Home Screen**. Android: **⋮ → Add to Home screen**
   (or **Install app**).
3. Open Wordsy from the home-screen icon from then on.

Opening it from the home screen matters on iPhone. Safari may delete stored
data for websites you haven't visited in a while, but home-screen apps keep
theirs. Use one device: progress doesn't sync between phone and laptop.

## Run locally

```sh
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # engine, storage and word-list tests (Node 20+)
```

For manual testing, `?now=2026-10-12T10:30:00` shifts the app's clock, so you
can simulate later visits and new days.

## Deploy (GitHub Pages)

Repository **Settings → Pages → Build and deployment → Deploy from a branch**,
choose `main` and `/ (root)`. The app is then at
`https://<your-username>.github.io/<repo-name>/`.

## Adding words

The app warns you when about 30 days of words are left. To restock:

1. Append new rows to the end of `RAW` in `data/words.js`. Never reorder,
   rename or remove existing rows, because the app tracks your place by
   position.
2. Run `npm test`. It checks for duplicates, missing fields and examples that
   don't use the word.
3. Change `CACHE` in `sw.js` (for example `wordsy-v1` → `wordsy-v2`) so phones
   download the new list.

Asking Claude "add 150 more Wordsy words" in this repo works well.

## Layout

```
index.html            App shell
css/styles.css        Day (cream) and night (navy) themes
js/engine.js          All the rules: days, visits, quizzes, archive, practice (pure, tested)
js/store.js           Saving and loading state
js/app.js             Rendering and browser events
js/fit.js             Shrinks long headwords to fit
js/card.js            Draws the share picture (layout helpers are tested)
data/words.js         The word list
sw.js                 Offline cache
docs/                 Design spec, plan and mockups
```
