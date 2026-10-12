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
    next = beginVisit(next, words);
  }
  return { ...next, lastHiddenAt: now };
}

// Picks the least-quizzed id; ties go to the latest in `ids`.
// Direction alternates per word, starting with word → meaning.
export function selectNext(ids, counts) {
  let best = null;
  for (const id of ids) {
    if (best === null || (counts[id] ?? 0) <= (counts[best] ?? 0)) best = id;
  }
  if (best === null) return null;
  return { id: best, direction: (counts[best] ?? 0) % 2 === 0 ? 'word-to-meaning' : 'meaning-to-word' };
}

export function pickQuiz(today) {
  return selectNext([...today.newWordIds, ...today.relearnIds], today.quizCounts);
}

const withToday = (state, patch) => ({ ...state, today: { ...state.today, ...patch } });

function revealWord(state, words) {
  if (state.nextIndex >= words.length) return withToday(state, { pendingNewWord: false, screen: { type: 'empty' } });
  const id = words[state.nextIndex].id;
  return {
    ...withToday(state, {
      newWordIds: [...state.today.newWordIds, id],
      pendingNewWord: false,
      screen: { type: 'word', id },
    }),
    nextIndex: state.nextIndex + 1,
  };
}

function startQuiz(state) {
  const q = pickQuiz(state.today);
  return withToday(state, { screen: q ? { type: 'quiz', ...q, flipped: false, graded: null } : { type: 'empty' } });
}

function beginVisit(state, words) {
  const { visits } = state.today;
  if (visits === 1) return revealWord(state, words);
  if (visits <= WORDS_PER_DAY) {
    const pending = state.nextIndex < words.length;
    const quizzed = startQuiz(withToday(state, { pendingNewWord: pending }));
    if (quizzed.today.screen.type === 'empty' && pending) return revealWord(quizzed, words);
    return quizzed;
  }
  return startQuiz(withToday(state, { pendingNewWord: false }));
}

export function flipQuiz(state) {
  const sc = state.today.screen;
  if (sc.type !== 'quiz') return state;
  return withToday(state, { screen: { ...sc, flipped: true } });
}

export function gradeQuiz(state, knew, now) {
  const sc = state.today.screen;
  if (sc.type !== 'quiz' || sc.graded !== null) return state;
  const counts = state.today.quizCounts;
  return {
    ...withToday(state, {
      screen: { ...sc, graded: knew },
      quizCounts: { ...counts, [sc.id]: (counts[sc.id] ?? 0) + 1 },
    }),
    grades: { ...state.grades, [sc.id]: [...(state.grades[sc.id] ?? []), { at: now, direction: sc.direction, knew }] },
  };
}

// The button shown after grading: reveal the waiting new word, or another quiz.
export function advance(state, words) {
  return state.today.pendingNewWord ? revealWord(state, words) : startQuiz(state);
}

export function isRelearn(state, id) {
  return state.today?.relearnIds.includes(id) ?? false;
}

export function toggleRelearn(state, id) {
  const t = state.today;
  if (!t || t.newWordIds.includes(id)) return state;
  const relearnIds = t.relearnIds.includes(id) ? t.relearnIds.filter((x) => x !== id) : [...t.relearnIds, id];
  return withToday(state, { relearnIds });
}

export function stock(state, words) {
  const left = Math.max(0, words.length - state.nextIndex);
  return { left, low: left > 0 && left < LOW_STOCK_WORDS, daysLeft: Math.ceil(left / WORDS_PER_DAY), out: left === 0 };
}

// ---------- Archive ----------

export function archiveDays(state) {
  const days = [...state.history];
  const t = state.today;
  if (t && t.newWordIds.length > 0) days.push({ date: t.date, dayNumber: t.dayNumber, wordIds: t.newWordIds });
  return days.reverse();
}

export function searchArchive(days, words, query) {
  const q = query.trim().toLowerCase();
  if (!q) return days;
  const byId = new Map(words.map((w) => [w.id, w]));
  const matches = (id) => {
    const w = byId.get(id);
    return !!w && (w.word.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q));
  };
  return days
    .map((d) => ({ ...d, wordIds: d.wordIds.filter(matches) }))
    .filter((d) => d.wordIds.length > 0);
}

// ---------- Past-day practice (in memory only; never touches today) ----------

function practiceCard(ids, counts) {
  const q = selectNext(ids, counts);
  return q && { ...q, flipped: false, graded: null };
}

export function startPractice(wordIds) {
  return { ids: wordIds, counts: {}, current: practiceCard(wordIds, {}) };
}

export function practiceFlip(session) {
  return session.current ? { ...session, current: { ...session.current, flipped: true } } : session;
}

export function practiceGrade(session, state, knew, now) {
  const c = session.current;
  if (!c || c.graded !== null) return { session, state };
  return {
    session: { ...session, counts: { ...session.counts, [c.id]: (session.counts[c.id] ?? 0) + 1 }, current: { ...c, graded: knew } },
    state: { ...state, grades: { ...state.grades, [c.id]: [...(state.grades[c.id] ?? []), { at: now, direction: c.direction, knew }] } },
  };
}

export function practiceNext(session) {
  return { ...session, current: practiceCard(session.ids, session.counts) };
}
