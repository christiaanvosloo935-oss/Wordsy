// Loads and saves Wordsy state. Never throws: falls back to a fresh state.
import { initialState } from './engine.js';

export const STORAGE_KEY = 'wordsy:v1';

function defaultStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

function isValid(s) {
  return !!s && typeof s === 'object' && s.version === 1 && Array.isArray(s.history)
    && !!s.grades && typeof s.grades === 'object' && !Array.isArray(s.grades);
}

export function load(storage = defaultStorage()) {
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
      if (isValid(parsed)) state = parsed;
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
