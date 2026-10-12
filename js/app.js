// Wires the browser to the engine: lifecycle events in, rendered DOM out.
import { onForeground, onHidden, flipQuiz, gradeQuiz, advance, stock, WORDS_PER_DAY } from './engine.js';
import { load, save } from './store.js';
import { fitText } from './fit.js';
import { WORDS } from '../data/words.js';

const byId = new Map(WORDS.map((w) => [w.id, w]));

// `?now=<ISO date>` shifts the clock for manual testing only.
const nowParam = new URLSearchParams(location.search).get('now');
const clockOffset = nowParam && !Number.isNaN(Date.parse(nowParam)) ? Date.parse(nowParam) - Date.now() : 0;
const now = () => Date.now() + clockOffset;

let { state, persistent } = load();

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Wraps the word (or its inflection) inside an example sentence in <em>.
function highlight(example, word) {
  const stem = word.toLowerCase().slice(0, Math.max(4, word.length - 2)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${stem}[\\p{L}-]*)`, 'iu');
  return esc(example).replace(re, '<em>$1</em>');
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function shortDate(ms) {
  const d = new Date(ms);
  const wd = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const dm = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${wd} ${dm}`;
}

function commit(next) {
  state = next;
  save(state);
  render();
}

// ---------- Today ----------

function wordCard(w, kicker, note) {
  return `
    <div class="card plain">
      <p class="kicker">${esc(kicker)}</p>
      <h1 class="word">${esc(cap(w.word))}</h1>
      <p class="pron">${esc(w.ipa)}</p>
    </div>
    <div class="card">
      <span class="pos">${esc(w.pos)}</span>
      <p class="def">${esc(w.definition)}</p>
    </div>
    <div class="card">
      <p class="kicker">In use</p>
      <ul class="ex">${w.examples.map((e) => `<li>${highlight(e, w.word)}</li>`).join('')}</ul>
    </div>
    ${note ? `<p class="note">${esc(note)}</p>` : ''}`;
}

// A flip card for either quiz direction. `ns` prefixes the data-action names
// so the Today quiz and archive practice can share this markup.
export function quizCard(card, ns) {
  const w = byId.get(card.id);
  const front = card.direction === 'word-to-meaning'
    ? `<p class="kicker">What does it mean?</p>
       <p class="word">${esc(cap(w.word))}</p>
       <p class="pron">${esc(w.ipa)}</p>`
    : `<p class="kicker">Which word means…</p>
       <p class="clue">${esc(w.definition)}</p>`;
  const back = card.direction === 'word-to-meaning'
    ? `<p class="kicker">${esc(w.word)} · <span class="pos">${esc(w.pos)}</span></p>
       <p class="def">${esc(w.definition)}</p>`
    : `<p class="kicker">The word is</p>
       <p class="word">${esc(cap(w.word))}</p>
       <p class="pron">${esc(w.ipa)}</p>`;
  return `
    <button type="button" class="flip${card.flipped ? ' flipped' : ''}" data-action="${ns}-flip"
      aria-label="${card.flipped ? 'Answer shown' : 'Tap to reveal the answer'}">
      <div class="flip-inner">
        <div class="face front">${front}<p class="tap">Tap to reveal</p></div>
        <div class="face back">${back}<ul class="ex"><li>${highlight(w.examples[0], w.word)}</li></ul></div>
      </div>
    </button>`;
}

function gradeRow(card, ns, nextLabel) {
  if (!card.flipped) return '';
  if (card.graded === null) {
    return `<div class="actions">
      <button type="button" data-action="${ns}-grade" data-knew="0">Didn't know</button>
      <button type="button" class="primary" data-action="${ns}-grade" data-knew="1">Knew it</button>
    </div>`;
  }
  const said = card.graded ? 'Nice, marked as known.' : "No problem. It'll come up again.";
  return `<p class="note">${said}</p>
    <div class="actions"><button type="button" class="primary" data-action="${ns}-next">${esc(nextLabel)}</button></div>`;
}

function renderToday() {
  const t = state.today;
  const sc = t.screen;
  const st = stock(state, WORDS);
  let html;

  if (sc.type === 'word') {
    const n = t.newWordIds.indexOf(sc.id) + 1;
    let note;
    if (n < WORDS_PER_DAY && !st.out) note = `Word ${n + 1} unlocks the next time you open Wordsy, after an hour or more away.`;
    else if (n < WORDS_PER_DAY) note = "You've seen every word. Open Wordsy later to review today's.";
    else note = "That's today's three. Open Wordsy later to review them.";
    html = wordCard(byId.get(sc.id), `Word ${n} of ${WORDS_PER_DAY} today`, note);
  } else if (sc.type === 'quiz') {
    html = quizCard(sc, 'today') + gradeRow(sc, 'today', t.pendingNewWord ? 'Show my new word' : 'Another one');
  } else {
    const msg = st.out ? "You've seen every word." : 'Open Wordsy again later for a new word.';
    html = `<div class="card message"><p class="def">${esc(msg)}</p></div>`;
  }
  $('view-today').innerHTML = html;
}

function renderChrome() {
  const t = state.today;
  $('dateline').textContent = `${shortDate(now())} · Day ${t.dayNumber}`;
  const shown = t.newWordIds.length;
  $('dots').innerHTML = Array.from({ length: WORDS_PER_DAY }, (_, i) => `<i class="${i < shown ? 'on' : ''}"></i>`).join('');
  $('dots').setAttribute('aria-label', `${shown} of ${WORDS_PER_DAY} words today`);

  const st = stock(state, WORDS);
  const banners = [];
  if (st.low) banners.push(`About ${st.daysLeft} days of words left.`);
  if (!persistent) banners.push("Progress can't be saved on this device.");
  $('banners').innerHTML = banners.map((b) => `<p class="banner">${esc(b)}</p>`).join('');
}

function fitAll() {
  document.querySelectorAll('.word').forEach((el) => fitText(el));
}

function render() {
  renderChrome();
  renderToday();
  fitAll();
}

// ---------- Events ----------

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  switch (el.dataset.action) {
    case 'today-flip': if (!state.today.screen.flipped) commit(flipQuiz(state)); break;
    case 'today-grade': commit(gradeQuiz(state, el.dataset.knew === '1', now())); break;
    case 'today-next': commit(advance(state, WORDS)); break;
    default: break;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') commit(onForeground(state, WORDS, now()));
  else { state = onHidden(state, now()); save(state); }
});
window.addEventListener('pagehide', () => { state = onHidden(state, now()); save(state); });

// Heartbeat: if the app is killed without a pagehide, the last-seen time is still recent.
setInterval(() => {
  if (document.visibilityState === 'visible') { state = onHidden(state, now()); save(state); }
}, 60 * 1000);

window.addEventListener('resize', fitAll);
if (document.fonts?.ready) document.fonts.ready.then(fitAll);

commit(onForeground(state, WORDS, now()));
