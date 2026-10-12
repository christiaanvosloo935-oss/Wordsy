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

function freshToday(date, dayNumber) {
  return {
    date, dayNumber, visits: 0,
    newWordIds: [], relearnIds: [], quizCounts: {},
    pendingNewWord: false,
    screen: { type: 'empty' },
  };
}

export function onHidden(state, now) {
  return { ...state, lastHiddenAt: now };
}

// Called when the app is opened or comes back to the foreground.
export function onForeground(state, words, now) {
  const date = localDate(now);
  let next = state;
  let newVisit;

  if (!state.today || date > state.today.date) {
    const old = state.today;
    const history = old && old.newWordIds.length > 0
      ? [...state.history, { date: old.date, dayNumber: old.dayNumber, wordIds: old.newWordIds }]
      : state.history;
    next = { ...state, history, today: freshToday(date, (old?.dayNumber ?? 0) + 1) };
    newVisit = true;
  } else {
    // Same day, or the clock went backwards: only a long enough absence counts.
    newVisit = state.lastHiddenAt !== null && now - state.lastHiddenAt >= VISIT_GAP_MS;
  }

  if (newVisit) {
    next = { ...next, today: { ...next.today, visits: next.today.visits + 1 } };
    next = beginVisit(next, words, now);
  }
  return { ...next, lastHiddenAt: now };
}

function beginVisit(state, words, now) {
  return state;
}
