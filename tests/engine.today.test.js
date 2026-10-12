import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState, onForeground, onHidden, pickQuiz, flipQuiz, gradeQuiz, advance,
  toggleRelearn, isRelearn, stock,
} from '../js/engine.js';
import { deepFreeze } from './helpers.js';
import { W, at, MIN } from './fixtures.js';

const H = 60 * MIN;
const day1 = at(2026, 10, 12, 8, 0);

// Open the app at `now` after having been away since `now - 2h`.
function visit(s, now, words = W) {
  return onForeground(onHidden(s, now - 2 * H), words, now);
}
function answer(s, knew = true, now = day1) {
  return gradeQuiz(flipQuiz(s), knew, now);
}

test('visit 1 reveals word 0 and advances nextIndex', () => {
  const s = visit(initialState(), day1);
  assert.deepEqual(s.today.screen, { type: 'word', id: 'alpha' });
  assert.deepEqual(s.today.newWordIds, ['alpha']);
  assert.equal(s.nextIndex, 1);
});

test('visit 2 quizzes word 0 word-to-meaning with pendingNewWord true', () => {
  let s = visit(initialState(), day1);
  s = visit(s, day1 + 2 * H);
  assert.deepEqual(s.today.screen, { type: 'quiz', id: 'alpha', direction: 'word-to-meaning', flipped: false, graded: null });
  assert.equal(s.today.pendingNewWord, true);
  assert.equal(s.nextIndex, 1);
});

test('grading then advance reveals word 1', () => {
  let s = visit(initialState(), day1);
  s = visit(s, day1 + 2 * H);
  s = answer(s);
  assert.equal(s.today.screen.graded, true);
  s = advance(s, W);
  assert.deepEqual(s.today.screen, { type: 'word', id: 'bravo' });
  assert.equal(s.today.pendingNewWord, false);
  assert.equal(s.nextIndex, 2);
});

test('visit 3 quizzes the least-quizzed word, ties to most recent', () => {
  let s = visit(initialState(), day1);
  s = advance(answer(visit(s, day1 + 2 * H)), W);
  s = visit(s, day1 + 4 * H);
  assert.equal(s.today.screen.id, 'bravo');
  assert.equal(s.today.screen.direction, 'word-to-meaning');
});

test('visit 4 quizzes only, never reveals', () => {
  let s = visit(initialState(), day1);
  s = advance(answer(visit(s, day1 + 2 * H)), W);
  s = advance(answer(visit(s, day1 + 4 * H)), W);
  assert.equal(s.nextIndex, 3);
  s = visit(s, day1 + 6 * H);
  assert.equal(s.today.screen.type, 'quiz');
  assert.equal(s.today.pendingNewWord, false);
  s = advance(answer(s), W);
  assert.equal(s.today.screen.type, 'quiz');
  assert.equal(s.nextIndex, 3);
});

test('direction alternates per word', () => {
  let s = visit(initialState(), day1);
  s = advance(answer(visit(s, day1 + 2 * H)), W); // alpha quizzed once
  s = advance(answer(visit(s, day1 + 4 * H)), W); // bravo quizzed once
  s = visit(s, day1 + 6 * H); // charlie has 0 quizzes
  assert.equal(s.today.screen.id, 'charlie');
  s = advance(answer(s), W); // all at 1 → tie goes to the latest, charlie, now on its 2nd quiz
  assert.equal(s.today.screen.id, 'charlie');
  assert.equal(s.today.screen.direction, 'meaning-to-word');
});

test('grade is recorded with timestamp and direction', () => {
  let s = visit(initialState(), day1);
  s = visit(s, day1 + 2 * H);
  s = gradeQuiz(flipQuiz(s), false, 12345);
  assert.deepEqual(s.grades.alpha, [{ at: 12345, direction: 'word-to-meaning', knew: false }]);
  assert.equal(s.today.quizCounts.alpha, 1);
});

test('relearn adds an archived word to the pool and toggles off', () => {
  let s = visit(initialState(), day1);
  s = visit(s, at(2026, 10, 13, 8)); // day 2, word bravo; alpha archived
  s = toggleRelearn(s, 'alpha');
  assert.equal(isRelearn(s, 'alpha'), true);
  s = visit(s, at(2026, 10, 13, 11));
  // pool = [bravo, alpha]; both 0 → latest = alpha
  assert.equal(s.today.screen.id, 'alpha');
  s = toggleRelearn(s, 'alpha');
  assert.equal(isRelearn(s, 'alpha'), false);
  assert.deepEqual(pickQuiz(s.today), { id: 'bravo', direction: 'word-to-meaning' });
});

test('relearn ignores a word already in today', () => {
  let s = visit(initialState(), day1);
  s = toggleRelearn(s, 'alpha');
  assert.deepEqual(s.today.relearnIds, []);
});

test('relearn resets on the next day', () => {
  let s = visit(initialState(), day1);
  s = visit(s, at(2026, 10, 13, 8));
  s = toggleRelearn(s, 'alpha');
  s = visit(s, at(2026, 10, 14, 8));
  assert.deepEqual(s.today.relearnIds, []);
});

test('visit 2 with no words left quizzes and shows outOfWords', () => {
  const one = W.slice(0, 1);
  let s = visit(initialState(), day1, one);
  s = visit(s, day1 + 2 * H, one);
  assert.equal(s.today.screen.type, 'quiz');
  assert.equal(s.today.pendingNewWord, false);
  assert.equal(stock(s, one).out, true);
  s = advance(answer(s), one);
  assert.equal(s.today.screen.type, 'quiz');
});

test('a new day with no words left shows empty', () => {
  const one = W.slice(0, 1);
  let s = visit(initialState(), day1, one);
  s = visit(s, at(2026, 10, 13, 8), one);
  assert.deepEqual(s.today.screen, { type: 'empty' });
  s = visit(s, at(2026, 10, 13, 11), one);
  assert.deepEqual(s.today.screen, { type: 'empty' });
});

test('stock low threshold', () => {
  const words = Array.from({ length: 100 }, (_, i) => ({ id: `w${i}` }));
  assert.deepEqual(stock({ nextIndex: 11 }, words), { left: 89, low: true, daysLeft: 30, out: false });
  assert.equal(stock({ nextIndex: 10 }, words).low, false);
  assert.deepEqual(stock({ nextIndex: 100 }, words), { left: 0, low: false, daysLeft: 0, out: true });
});

test('inputs are not mutated', () => {
  let s = deepFreeze(visit(initialState(), day1));
  s = deepFreeze(visit(s, day1 + 2 * H));
  s = deepFreeze(flipQuiz(s));
  s = deepFreeze(gradeQuiz(s, true, day1));
  s = deepFreeze(advance(s, W));
  assert.doesNotThrow(() => toggleRelearn(s, 'zzz'));
});
