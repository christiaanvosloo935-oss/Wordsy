import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../data/words.js';

const stem = (w) => w.toLowerCase().slice(0, Math.max(4, w.length - 2));

test('has at least 300 words', () => {
  assert.ok(WORDS.length >= 300, `only ${WORDS.length} words`);
});

test('ids are unique and equal the lowercase word', () => {
  const ids = new Set();
  for (const w of WORDS) {
    assert.equal(w.id, w.word.toLowerCase(), w.word);
    assert.ok(!ids.has(w.id), `duplicate ${w.id}`);
    ids.add(w.id);
  }
});

test('every entry has word, ipa in slashes, pos and a short definition', () => {
  for (const w of WORDS) {
    assert.ok(w.word.trim(), JSON.stringify(w));
    assert.match(w.ipa, /^\/.+\/$/, w.word);
    assert.ok(w.pos.trim(), w.word);
    assert.ok(w.definition.trim(), w.word);
    assert.ok(w.definition.length <= 120, `${w.word} definition is ${w.definition.length} chars`);
  }
});

test('every entry has exactly 3 examples, each containing the stem', () => {
  for (const w of WORDS) {
    assert.equal(w.examples.length, 3, w.word);
    for (const ex of w.examples) {
      assert.ok(ex.toLowerCase().includes(stem(w.word)), `${w.word}: "${ex}"`);
    }
  }
});
