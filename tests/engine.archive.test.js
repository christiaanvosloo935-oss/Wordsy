import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archiveDays, searchArchive, startPractice, practiceFlip, practiceGrade, practiceNext } from '../js/engine.js';
import { deepFreeze } from './helpers.js';
import { W } from './fixtures.js';

const today = { date: '2026-10-13', dayNumber: 2, visits: 1, newWordIds: ['charlie'], relearnIds: [], quizCounts: {}, pendingNewWord: false, screen: { type: 'word', id: 'charlie' } };
const state = deepFreeze({
  version: 1, nextIndex: 3, lastHiddenAt: null, today,
  history: [{ date: '2026-10-12', dayNumber: 1, wordIds: ['alpha', 'bravo'] }],
  grades: {},
});

test('archiveDays lists newest first and includes today', () => {
  assert.deepEqual(archiveDays(state), [
    { date: '2026-10-13', dayNumber: 2, wordIds: ['charlie'] },
    { date: '2026-10-12', dayNumber: 1, wordIds: ['alpha', 'bravo'] },
  ]);
});

test('archiveDays leaves out a today with no words', () => {
  const s = { ...state, today: { ...today, newWordIds: [] } };
  assert.equal(archiveDays(s).length, 1);
});

test('searchArchive matches definition text and drops empty days', () => {
  const days = archiveDays(state);
  assert.deepEqual(searchArchive(days, W, 'MEANING OF BRA'), [{ date: '2026-10-12', dayNumber: 1, wordIds: ['bravo'] }]);
  assert.equal(searchArchive(days, W, '   '), days);
});

test('practice starts on the last word of the day', () => {
  const s = startPractice(['alpha', 'bravo']);
  assert.deepEqual(s.current, { id: 'bravo', direction: 'word-to-meaning', flipped: false, graded: null });
});

test('practice never touches today', () => {
  let session = practiceFlip(startPractice(['alpha', 'bravo']));
  const out = practiceGrade(session, state, true, 999);
  assert.equal(out.state.today, state.today);
  assert.deepEqual(out.state.grades, { bravo: [{ at: 999, direction: 'word-to-meaning', knew: true }] });
  assert.equal(out.session.current.graded, true);
});

test('practiceNext cycles through all words before repeating', () => {
  let session = startPractice(['alpha', 'bravo', 'charlie']);
  const seen = [];
  let s = state;
  for (let i = 0; i < 3; i++) {
    seen.push(session.current.id);
    ({ session, state: s } = practiceGrade(practiceFlip(session), s, true, i));
    session = practiceNext(session);
  }
  assert.deepEqual([...seen].sort(), ['alpha', 'bravo', 'charlie']);
});
