// Wires the browser to the engine: lifecycle events in, rendered DOM out.
import {
  initialState, onForeground, onHidden, flipQuiz, gradeQuiz, advance, stock, notices, WORDS_PER_DAY,
  archiveDays, searchArchive, toggleRelearn, isRelearn,
  startPractice, practiceFlip, practiceGrade, practiceNext,
} from './engine.js';
import { load, save } from './store.js';
import { fitText } from './fit.js';
import { splitHighlight, renderCardBlob, cardFileName } from './card.js';
import { WORDS } from '../data/words.js';

const byId = new Map(WORDS.map((w) => [w.id, w]));

// `?now=<ISO date>` shifts the clock for manual testing only.
const nowParam = new URLSearchParams(location.search).get('now');
const clockOffset = nowParam && !Number.isNaN(Date.parse(nowParam)) ? Date.parse(nowParam) - Date.now() : 0;
const now = () => Date.now() + clockOffset;

let { state, persistent } = load(undefined, new Set(WORDS.map((w) => w.id)));

// UI-only state; none of this is saved.
let view = 'today';
try { if (sessionStorage.getItem('wordsy:view') === 'archive') view = 'archive'; } catch { /* ignore */ }
let practice = null;          // { session, dayNumber } while quizzing a past day
let openDays = null;          // Set of dates whose <details> is open; null = default (newest open)
let sheetWordId = null;       // word shown in the overlay

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Wraps the word (or its inflection) inside an example sentence in <em>.
function highlight(example, word) {
  return splitHighlight(example, word)
    .map((r) => (r.hl ? `<em>${esc(r.text)}</em>` : esc(r.text)))
    .join('');
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
    <div class="actions">
      <button type="button" data-action="share" data-id="${esc(w.id)}">Share as picture</button>
    </div>
    ${note ? `<p class="note">${esc(note)}</p>` : ''}`;
}

// Shares a picture of the word card: the share sheet where files can be shared,
// otherwise the picture is downloaded.
async function shareWord(id, button) {
  const w = byId.get(id);
  if (!w || button.disabled) return;
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Preparing…';
  try {
    const blob = await renderCardBlob(w);
    const name = cardFileName(w.word);
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: cap(w.word) });
      } catch (err) {
        if (err.name !== 'AbortError') throw err;   // the user closing the sheet is not an error
      }
      button.textContent = label;
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      button.textContent = 'Picture saved';
      setTimeout(() => { button.textContent = label; }, 2500);
    }
  } catch (err) {
    console.error('Wordsy: could not share picture', err);
    button.textContent = "Couldn't make the picture";
    setTimeout(() => { button.textContent = label; }, 2500);
  } finally {
    button.disabled = false;
  }
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

function dateFromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

function renderArchive() {
  const body = $('archive-body');
  if (practice) {
    const { session, dayNumber } = practice;
    body.innerHTML = `
      <div class="practice-head">
        <p class="kicker">Quizzing Day ${dayNumber}</p>
        <button type="button" class="link" data-action="practice-done">Done</button>
      </div>
      ${quizCard(session.current, 'practice')}
      ${gradeRow(session.current, 'practice', 'Another one')}`;
    $('search').hidden = true;
    return;
  }
  $('search').hidden = false;
  const all = archiveDays(state);
  const days = searchArchive(all, WORDS, $('search').value);
  if (all.length === 0) {
    body.innerHTML = '<p class="empty-note">Your words will appear here, grouped by day.</p>';
    return;
  }
  if (days.length === 0) {
    body.innerHTML = '<p class="empty-note">No words match your search.</p>';
    return;
  }
  const searching = $('search').value.trim() !== '';
  const todayKey = state.today?.date;
  body.innerHTML = days.map((d, i) => {
    const open = searching || (openDays ? openDays.has(d.date) : i === 0);
    const count = d.wordIds.length;
    const rows = d.wordIds.map((id) => {
      const w = byId.get(id);
      if (!w) return '';
      const relearn = d.date === todayKey
        ? '<span class="tag">Today</span>'
        : `<button type="button" class="relearn" data-action="relearn" data-id="${esc(id)}" aria-pressed="${isRelearn(state, id)}">${isRelearn(state, id) ? 'Added' : 'Relearn'}</button>`;
      return `<li>
        <button type="button" class="row" data-action="open-word" data-id="${esc(id)}">
          <strong>${esc(cap(w.word))}</strong><small>${esc(w.definition)}</small>
        </button>${relearn}</li>`;
    }).join('');
    return `<details class="day" data-date="${esc(d.date)}"${open ? ' open' : ''}>
      <summary><b>Day ${d.dayNumber}</b><span>${esc(shortDate(dateFromKey(d.date)))} · ${count} word${count === 1 ? '' : 's'}</span></summary>
      <ul>${rows}</ul>
      <div class="day-actions"><button type="button" data-action="practice" data-date="${esc(d.date)}">Quiz this day</button></div>
    </details>`;
  }).join('');
}

function renderSheet() {
  const w = sheetWordId && byId.get(sheetWordId);
  $('overlay').hidden = !w;
  if (w) $('sheet-body').innerHTML = wordCard(w, 'From your archive', '');
}

function renderChrome() {
  const t = state.today;
  $('view-today').hidden = view !== 'today';
  $('view-archive').hidden = view !== 'archive';
  for (const v of ['today', 'archive']) {
    if (v === view) $(`tab-${v}`).setAttribute('aria-current', 'page');
    else $(`tab-${v}`).removeAttribute('aria-current');
  }

  if (view === 'archive') {
    const total = archiveDays(state).reduce((n, d) => n + d.wordIds.length, 0);
    $('dateline').textContent = `Archive · ${total} word${total === 1 ? '' : 's'}`;
    $('dots').hidden = true;
  } else {
    $('dateline').textContent = `${shortDate(now())} · Day ${t.dayNumber}`;
    $('dots').hidden = false;
  }
  const shown = t.newWordIds.length;
  $('dots').innerHTML = Array.from({ length: WORDS_PER_DAY }, (_, i) => `<i class="${i < shown ? 'on' : ''}"></i>`).join('');
  $('dots').setAttribute('aria-label', `${shown} of ${WORDS_PER_DAY} words today`);

  const banners = notices(state, WORDS);
  if (!persistent) banners.push("Progress can't be saved on this device.");
  $('banners').innerHTML = banners.map((b) => `<p class="banner">${esc(b)}</p>`).join('');
}

function fitAll() {
  document.querySelectorAll('.word').forEach((el) => fitText(el));
}

function render() {
  renderChrome();
  renderToday();
  renderArchive();
  renderSheet();
  fitAll();
}

function setView(v) {
  view = v;
  try { sessionStorage.setItem('wordsy:view', v); } catch { /* ignore */ }
  render();
  window.scrollTo(0, 0);
}

// ---------- Events ----------

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  switch (el.dataset.action) {
    case 'today-flip': if (!state.today.screen.flipped) commit(flipQuiz(state)); break;
    case 'today-grade': commit(gradeQuiz(state, el.dataset.knew === '1', now())); break;
    case 'today-next': commit(advance(state, WORDS)); break;
    case 'view': setView(el.dataset.view); break;
    case 'relearn': commit(toggleRelearn(state, el.dataset.id)); break;
    case 'open-word': sheetWordId = el.dataset.id; render(); break;
    case 'close-word': sheetWordId = null; render(); break;
    case 'share': shareWord(el.dataset.id, el); break;
    case 'practice': {
      const day = archiveDays(state).find((d) => d.date === el.dataset.date);
      if (day) { practice = { session: startPractice(day.wordIds), dayNumber: day.dayNumber }; render(); window.scrollTo(0, 0); }
      break;
    }
    case 'practice-flip':
      if (!practice.session.current.flipped) { practice = { ...practice, session: practiceFlip(practice.session) }; render(); }
      break;
    case 'practice-grade': {
      const out = practiceGrade(practice.session, state, el.dataset.knew === '1', now());
      practice = { ...practice, session: out.session };
      commit(out.state);
      break;
    }
    case 'practice-next': practice = { ...practice, session: practiceNext(practice.session) }; render(); break;
    case 'practice-done': practice = null; render(); break;
    default: break;
  }
});

// Clicking the dim backdrop closes the word sheet.
$('overlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) { sheetWordId = null; render(); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetWordId) { sheetWordId = null; render(); } });

$('search').addEventListener('input', renderArchive);

// Remember which days the user opened or closed (toggle doesn't bubble, so capture it).
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (!(d instanceof HTMLDetailsElement) || !d.dataset.date || $('search').value.trim()) return;
  if (!openDays) openDays = new Set([...document.querySelectorAll('details.day[open]')].map((x) => x.dataset.date));
  if (d.open) openDays.add(d.dataset.date); else openDays.delete(d.dataset.date);
}, true);

// A new visit always lands on Today so a new word or quiz isn't missed.
function foreground() {
  const before = state.today;
  const next = onForeground(state, WORDS, now());
  if (next.today !== before && (next.today.date !== before?.date || next.today.visits !== before?.visits)) {
    view = 'today';
    practice = null;
    sheetWordId = null;
    try { sessionStorage.setItem('wordsy:view', 'today'); } catch { /* ignore */ }
  }
  commit(next);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') // Backstop: if saved state is unusable in a way validation missed, start fresh rather than show a blank app.
try {
  foreground();
} catch (err) {
  console.error('Wordsy: resetting unusable saved state', err);
  state = initialState();
  foreground();
}
  else { state = onHidden(state, now()); save(state); }
});
window.addEventListener('pagehide', () => { state = onHidden(state, now()); save(state); });

// Heartbeat: if the app is killed without a pagehide, the last-seen time is still recent.
setInterval(() => {
  if (document.visibilityState === 'visible') { state = onHidden(state, now()); save(state); }
}, 60 * 1000);

window.addEventListener('resize', fitAll);
if (document.fonts?.ready) document.fonts.ready.then(fitAll);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
}

// Backstop: if saved state is unusable in a way validation missed, start fresh rather than show a blank app.
try {
  foreground();
} catch (err) {
  console.error('Wordsy: resetting unusable saved state', err);
  state = initialState();
  foreground();
}
