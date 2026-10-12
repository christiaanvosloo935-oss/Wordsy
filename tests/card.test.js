import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitHighlight, layoutRuns, fitSize, cardFileName } from '../js/card.js';

const plain = (lines) => lines.map((l) => l.map((r) => r.text).join(''));
const width = (text) => text.length * 10;

test('splitHighlight picks out the word and keeps surrounding text', () => {
  assert.deepEqual(
    splitHighlight('We ate lunch, soaking up the apricity of a January afternoon.', 'apricity'),
    [
      { text: 'We ate lunch, soaking up the ', hl: false },
      { text: 'apricity', hl: true },
      { text: ' of a January afternoon.', hl: false },
    ],
  );
});

test('splitHighlight matches inflections and is case-insensitive', () => {
  assert.deepEqual(splitHighlight('He was bamboozled.', 'bamboozle')[1], { text: 'bamboozled', hl: true });
  assert.deepEqual(splitHighlight('Apricity is rare.', 'apricity')[0], { text: 'Apricity', hl: true });
});

test('splitHighlight with no match returns the whole sentence unhighlighted', () => {
  assert.deepEqual(splitHighlight('Nothing here.', 'apricity'), [{ text: 'Nothing here.', hl: false }]);
});

test('layoutRuns wraps on spaces without losing or adding text', () => {
  const lines = layoutRuns([{ text: 'aaa bbb ccc ddd', hl: false }], width, 80);
  assert.deepEqual(plain(lines), ['aaa bbb', 'ccc ddd']);
});

test('layoutRuns keeps punctuation attached to a highlighted word', () => {
  const segs = splitHighlight("I'm appreciating the apricity, she said.", 'apricity');
  const lines = layoutRuns(segs, width, 1000);
  assert.deepEqual(plain(lines), ["I'm appreciating the apricity, she said."]);
  assert.deepEqual(lines[0].filter((r) => r.hl).map((r) => r.text), ['apricity']);
});

test('layoutRuns never breaks between a highlighted word and its comma', () => {
  const segs = splitHighlight('xx apricity, yy', 'apricity');
  // 'xx apricity,' is 12 chars = 120; max 125 forces yy onto the next line, not the comma.
  assert.deepEqual(plain(layoutRuns(segs, width, 125)), ['xx apricity,', 'yy']);
});

test('layoutRuns puts a word longer than the line on its own line', () => {
  assert.deepEqual(plain(layoutRuns([{ text: 'a verylongwordhere b', hl: false }], width, 60)), ['a', 'verylongwordhere', 'b']);
});

test('layoutRuns on empty text gives no lines', () => {
  assert.deepEqual(layoutRuns([{ text: '', hl: false }], width, 100), []);
});

test('fitSize returns the largest whole size that fits, within limits', () => {
  const m = (t, size) => t.length * size * 0.5; // 16 chars → 8 * size
  assert.equal(fitSize(m, 'Ultracrepidarian', 400, 160, 40), 50);
  assert.equal(fitSize(m, 'Ultracrepidarian', 4000, 160, 40), 160);
  assert.equal(fitSize(m, 'Ultracrepidarian', 100, 160, 40), 40);
});

test('cardFileName makes a safe png name', () => {
  assert.equal(cardFileName('Apricity'), 'wordsy-apricity.png');
  assert.equal(cardFileName('Ultra crepidarian!'), 'wordsy-ultra-crepidarian.png');
});
