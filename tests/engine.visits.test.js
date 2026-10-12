import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, onForeground, onHidden } from '../js/engine.js';
import { deepFreeze } from './helpers.js';
import { W, at, MIN } from './fixtures.js';

const t0 = at(2026, 10, 12, 9, 0);

test('first ever foreground creates Day 1 visit 1', () => {
  const s = onForeground(initialState(), W, t0);
  assert.equal(s.today.date, '2026-10-12');
  assert.equal(s.today.dayNumber, 1);
  assert.equal(s.today.visits, 1);
  assert.equal(s.lastHiddenAt, t0);
});

test('reopen after 59 min is the same visit', () => {
  let s = onForeground(initialState(), W, t0);
  s = onHidden(s, t0 + MIN);
  s = onForeground(s, W, t0 + 60 * MIN);
  assert.equal(s.today.visits, 1);
});

test('reopen after exactly 60 min is a new visit', () => {
  let s = onForeground(initialState(), W, t0);
  s = onHidden(s, t0);
  s = onForeground(s, W, t0 + 60 * MIN);
  assert.equal(s.today.visits, 2);
});

test('heartbeat keeps a reopen within 60 min in the same visit', () => {
  let s = onForeground(initialState(), W, t0);
  s = onHidden(s, t0 + 50 * MIN);
  s = onForeground(s, W, t0 + 100 * MIN);
  assert.equal(s.today.visits, 1);
});

test('midnight rollover counts as a new visit even inside the gap', () => {
  let s = onForeground(initialState(), W, at(2026, 10, 12, 23, 50));
  s = { ...s, today: { ...s.today, newWordIds: ['alpha'] } };
  s = onHidden(s, at(2026, 10, 12, 23, 51));
  s = onForeground(s, W, at(2026, 10, 13, 0, 10));
  assert.equal(s.today.date, '2026-10-13');
  assert.equal(s.today.dayNumber, 2);
  assert.equal(s.today.visits, 1);
  assert.deepEqual(s.history, [{ date: '2026-10-12', dayNumber: 1, wordIds: ['alpha'] }]);
});

test('a day with no words is not archived', () => {
  let s = onForeground(initialState(), W, t0);
  s = { ...s, today: { ...s.today, newWordIds: [] } };
  s = onForeground(s, W, at(2026, 10, 13));
  assert.deepEqual(s.history, []);
  assert.equal(s.today.dayNumber, 2);
});

test('clock going backwards keeps today and does not add a visit', () => {
  let s = onForeground(initialState(), W, t0);
  const before = s.today;
  s = onHidden(s, t0 + 5 * 60 * MIN); // lastHiddenAt ends up "in the future" relative to the next call
  s = onForeground(s, W, at(2026, 10, 11, 9, 0));
  assert.equal(s.today.date, '2026-10-12');
  assert.equal(s.today.visits, before.visits);
  assert.deepEqual(s.history, []);
});

test('inputs are not mutated', () => {
  const s0 = deepFreeze(onForeground(initialState(), W, t0));
  const s1 = deepFreeze(onHidden(s0, t0 + MIN));
  assert.doesNotThrow(() => onForeground(s1, W, t0 + 2 * 60 * MIN));
  assert.doesNotThrow(() => onForeground(s1, W, at(2026, 10, 13)));
});
