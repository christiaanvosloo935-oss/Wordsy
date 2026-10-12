import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDate, initialState, VISIT_GAP_MS, WORDS_PER_DAY, LOW_STOCK_WORDS } from '../js/engine.js';

test('localDate formats local Y-M-D with zero padding', () => {
  assert.equal(localDate(new Date(2026, 0, 5, 23, 59).getTime()), '2026-01-05');
});

test('initialState shape', () => {
  assert.deepEqual(initialState(), { version: 1, nextIndex: 0, lastHiddenAt: null, today: null, history: [], grades: {} });
});

test('constants', () => {
  assert.equal(VISIT_GAP_MS, 3600000);
  assert.equal(WORDS_PER_DAY, 3);
  assert.equal(LOW_STOCK_WORDS, 90);
});
