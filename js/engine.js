// Pure rules for Wordsy. Every function returns new state and never mutates its input.

export const VISIT_GAP_MS = 60 * 60 * 1000;
export const WORDS_PER_DAY = 3;
export const LOW_STOCK_WORDS = 90;

const pad = (n) => String(n).padStart(2, '0');

export function localDate(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function initialState() {
  return { version: 1, nextIndex: 0, lastHiddenAt: null, today: null, history: [], grades: {} };
}
