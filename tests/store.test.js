import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, save, STORAGE_KEY } from '../js/store.js';
import { initialState } from '../js/engine.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}
const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };

test('round-trips state', () => {
  const st = memoryStorage();
  const s = { ...initialState(), nextIndex: 7, grades: { a: [{ at: 1, direction: 'word-to-meaning', knew: true }] } };
  assert.equal(save(s, st), true);
  assert.deepEqual(load(st), { state: s, persistent: true });
});

test('load returns fresh state on corrupt JSON', () => {
  const st = memoryStorage();
  st.setItem(STORAGE_KEY, '{not json');
  assert.deepEqual(load(st), { state: initialState(), persistent: true });
});

test('load returns fresh state on wrong version', () => {
  const st = memoryStorage();
  st.setItem(STORAGE_KEY, JSON.stringify({ ...initialState(), version: 2 }));
  assert.deepEqual(load(st).state, initialState());
});

test('load returns fresh state on wrong shape', () => {
  const st = memoryStorage();
  st.setItem(STORAGE_KEY, JSON.stringify({ version: 1, history: 'x', grades: {} }));
  assert.deepEqual(load(st).state, initialState());
});

test('throwing storage gives persistent false and save returns false', () => {
  assert.deepEqual(load(throwing), { state: initialState(), persistent: false });
  assert.equal(save(initialState(), throwing), false);
});

test('missing storage gives persistent false', () => {
  assert.deepEqual(load(undefined), { state: initialState(), persistent: false });
});

for (const [name, bad] of [
  ['missing nextIndex', { version: 1, lastHiddenAt: null, today: null, history: [], grades: {} }],
  ['today missing fields', { ...initialState(), today: { date: '2026-10-13' } }],
  ['today screen missing', { ...initialState(), today: { date: '2026-10-13', dayNumber: 1, visits: 1, newWordIds: [], relearnIds: [], quizCounts: {}, pendingNewWord: false } }],
  ['lastHiddenAt not a number', { ...initialState(), lastHiddenAt: 'yesterday' }],
]) {
  test(`load returns fresh state on bad v1 shape: ${name}`, () => {
    const st = memoryStorage();
    st.setItem(STORAGE_KEY, JSON.stringify(bad));
    assert.deepEqual(load(st).state, initialState());
  });
}

test('load drops ids that are not in the word list', () => {
  const st = memoryStorage();
  const today = { date: '2026-10-13', dayNumber: 1, visits: 1, newWordIds: ['gone'], relearnIds: [], quizCounts: {}, pendingNewWord: false, screen: { type: 'word', id: 'gone' } };
  st.setItem(STORAGE_KEY, JSON.stringify({ ...initialState(), nextIndex: 1, today }));
  assert.deepEqual(load(st, new Set(['alpha'])).state, initialState());
});
