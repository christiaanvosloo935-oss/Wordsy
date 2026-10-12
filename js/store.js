// Loads and saves Wordsy state. Never throws: falls back to a fresh state.
import { initialState } from './engine.js';

export const STORAGE_KEY = 'wordsy:v1';

function defaultStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isIdList = (x, known) => Array.isArray(x) && x.every((id) => typeof id === 'string' && (!known || known.has(id)));

function isValidToday(t, known) {
  if (t === null) return true;
  return isObj(t) && typeof t.date === 'string' && isNum(t.dayNumber) && isNum(t.visits)
    && isIdList(t.newWordIds, known) && isIdList(t.relearnIds, known)
    && isObj(t.quizCounts) && typeof t.pendingNewWord === 'boolean'
    && isObj(t.screen) && typeof t.screen.type === 'string'
    && (t.screen.type === 'empty' || (typeof t.screen.id === 'string' && (!known || known.has(t.screen.id))));
}

// `known` (optional) is the set of word ids in the list; ids outside it make the record invalid.
function isValid(s, known) {
  return isObj(s) && s.version === 1
    && Number.isInteger(s.nextIndex) && s.nextIndex >= 0
    && (s.lastHiddenAt === null || isNum(s.lastHiddenAt))
    && isValidToday(s.today, known)
    && Array.isArray(s.history) && s.history.every((d) => isObj(d) && typeof d.date === 'string' && isNum(d.dayNumber) && isIdList(d.wordIds, known))
    && isObj(s.grades);
}

export function load(storage = defaultStorage(), known = null) {
  let persistent = false;
  let raw = null;
  try {
    if (storage) {
      storage.setItem(`${STORAGE_KEY}:probe`, '1');
      storage.removeItem(`${STORAGE_KEY}:probe`);
      persistent = true;
      raw = storage.getItem(STORAGE_KEY);
    }
  } catch {
    persistent = false;
  }
  let state = initialState();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isValid(parsed, known)) state = parsed;
    } catch { /* corrupt: start fresh */ }
  }
  return { state, persistent };
}

export function save(state, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
