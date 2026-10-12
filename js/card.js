// Share-as-picture: pure layout helpers (tested in Node) and the canvas drawing (browser only).

// ---------- Pure helpers ----------

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Splits a sentence into runs, marking the word (or an inflection of it) as highlighted.
export function splitHighlight(sentence, word) {
  const stem = escapeRegExp(word.toLowerCase().slice(0, Math.max(4, word.length - 2)));
  const m = new RegExp(`${stem}[\\p{L}-]*`, 'iu').exec(sentence);
  if (!m) return [{ text: sentence, hl: false }];
  const out = [];
  if (m.index > 0) out.push({ text: sentence.slice(0, m.index), hl: false });
  out.push({ text: m[0], hl: true });
  const rest = sentence.slice(m.index + m[0].length);
  if (rest) out.push({ text: rest, hl: false });
  return out;
}

// Lays runs out on lines no wider than maxWidth. `measure(text, hl)` returns a width.
// Returns lines, each an array of runs (spaces between words are inside the runs).
// Pieces with no space between them (a highlighted word and its comma) never separate.
export function layoutRuns(runs, measure, maxWidth) {
  const words = [];
  let current = [];
  for (const run of runs) {
    for (const part of run.text.split(/(\s+)/)) {
      if (part === '') continue;
      if (/^\s+$/.test(part)) {
        if (current.length) { words.push(current); current = []; }
      } else {
        current.push({ text: part, hl: run.hl });
      }
    }
  }
  if (current.length) words.push(current);

  const wordWidth = (w) => w.reduce((n, r) => n + measure(r.text, r.hl), 0);
  const space = measure(' ', false);
  const lines = [];
  let line = [];
  let lineWidth = 0;
  for (const w of words) {
    const ww = wordWidth(w);
    if (line.length && lineWidth + space + ww > maxWidth) {
      lines.push(line);
      line = [];
      lineWidth = 0;
    }
    if (line.length) { line.push({ text: ' ', hl: false }); lineWidth += space; }
    line.push(...w);
    lineWidth += ww;
  }
  if (line.length) lines.push(line);
  return lines;
}

// Largest whole font size (<= start, >= min) at which `measure(text, size)` fits maxWidth.
export function fitSize(measure, text, maxWidth, start, min) {
  let size = start;
  while (size > min && measure(text, size) > maxWidth) size -= 1;
  return size;
}

export function cardFileName(word) {
  const slug = word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `wordsy-${slug || 'word'}.png`;
}

// ---------- Canvas drawing (browser only) ----------

export const CARD_W = 1080;
export const CARD_H = 1350;

const FONT = {
  display: "'Newsreader', Georgia, serif",
  body: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
};

// Colours come from the app's CSS variables, so the picture matches the phone's current theme.
export function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name) => cs.getPropertyValue(name).trim();
  return { bg: v('--bg'), fg: v('--fg'), muted: v('--muted'), accent: v('--accent'), card: v('--card'), line: v('--line') };
}

async function loadFonts(w) {
  try {
    await Promise.all([
      document.fonts.load(`600 100px ${FONT.display}`, `${w.word}Wordsy`),
      document.fonts.load(`400 100px ${FONT.display}`, w.definition),
      document.fonts.load(`italic 400 100px ${FONT.display}`, w.pos),
      document.fonts.load(`400 100px ${FONT.body}`, w.examples[0]),
      document.fonts.load(`600 100px ${FONT.body}`, w.examples[0]),
      document.fonts.load(`400 100px ${FONT.mono}`, w.ipa),
    ]);
  } catch { /* draw with fallback fonts rather than fail */ }
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Draws the card. Content is laid out first, shrunk if a long entry would not fit,
// then centred between the top padding and the footer.
// Returns where the content ended and where the footer starts.
export function drawCard(ctx, w, t) {
  const inset = 60;
  const pad = 76;
  const x0 = inset + pad;
  const textW = CARD_W - 2 * x0;
  const bodyTop = inset + pad;
  const footerBaseline = CARD_H - inset - 64;
  const limit = footerBaseline - 44 - 30;

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const display = (size, weight = 400, style = 'normal') => `${style} ${weight} ${size}px ${FONT.display}`;
  const widthOf = (font) => (text) => { ctx.font = font; return ctx.measureText(text).width; };

  const headword = w.word.charAt(0).toUpperCase() + w.word.slice(1);
  const size = fitSize((text, s) => widthOf(display(s, 600))(text), headword, textW, 170, 64);
  const exSegments = splitHighlight(w.examples[0], w.word);

  // Positions are relative to the top of the content; k scales the body text.
  const plan = (k) => {
    const defPx = Math.round(62 * k);
    const exPx = Math.round(44 * k);
    const defLH = Math.round(84 * k);
    const exLH = Math.round(64 * k);
    const defFont = display(defPx);
    const bodyFont = (hl) => `${hl ? 600 : 400} ${exPx}px ${FONT.body}`;
    const defLines = layoutRuns([{ text: w.definition, hl: false }], widthOf(defFont), textW);
    const exLines = layoutRuns(exSegments, (text, hl) => widthOf(bodyFont(hl))(text), textW - 30);
    const head = size * 0.85;
    const ipa = head + Math.round(size * 0.26) + 50;
    const pos = ipa + 86;
    const def0 = pos + 90;
    const rule = def0 + (defLines.length - 1) * defLH + 62;
    const exTop = rule + 44;
    const ex0 = exTop + exPx;
    const bottom = ex0 + (exLines.length - 1) * exLH + 14;
    return { defFont, defLines, defLH, bodyFont, exLines, exLH, head, ipa, pos, def0, rule, exTop, ex0, bottom };
  };
  let p = plan(1);
  for (const k of [0.92, 0.84, 0.76]) {
    if (bodyTop + p.bottom <= limit) break;
    p = plan(k);
  }
  const top = bodyTop + Math.max(0, Math.floor((limit - bodyTop - p.bottom) * 0.45));

  // Card.
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  roundedRect(ctx, inset, inset, CARD_W - 2 * inset, CARD_H - 2 * inset, 14);
  ctx.fillStyle = t.card;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = t.line;
  ctx.stroke();

  ctx.font = display(size, 600);
  ctx.fillStyle = t.fg;
  ctx.fillText(headword, x0, top + p.head);

  ctx.font = `400 38px ${FONT.mono}`;
  ctx.fillStyle = t.muted;
  ctx.fillText(w.ipa, x0, top + p.ipa);

  ctx.font = display(46, 400, 'italic');
  ctx.fillStyle = t.accent;
  ctx.fillText(w.pos, x0, top + p.pos);

  ctx.font = p.defFont;
  ctx.fillStyle = t.fg;
  p.defLines.forEach((line, i) => {
    ctx.fillText(line.map((r) => r.text).join(''), x0, top + p.def0 + i * p.defLH);
  });

  ctx.fillStyle = t.line;
  ctx.fillRect(x0, top + p.rule, textW, 2);
  ctx.fillRect(x0, top + p.exTop - 6, 5, p.bottom - p.exTop + 6);
  p.exLines.forEach((line, i) => {
    let x = x0 + 30;
    for (const run of line) {
      ctx.font = p.bodyFont(run.hl);
      ctx.fillStyle = run.hl ? t.accent : t.fg;
      ctx.fillText(run.text, x, top + p.ex0 + i * p.exLH);
      x += ctx.measureText(run.text).width;
    }
  });

  // Footer.
  ctx.font = display(44, 600);
  ctx.fillStyle = t.accent;
  ctx.fillText('Wordsy', x0, footerBaseline);
  ctx.font = `400 28px ${FONT.body}`;
  ctx.fillStyle = t.muted;
  ctx.textAlign = 'right';
  ctx.fillText('Three curious words a day', x0 + textW, footerBaseline);
  ctx.textAlign = 'left';

  return { bottom: top + p.bottom, limit };
}

export async function renderCardBlob(w) {
  await loadFonts(w);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  drawCard(canvas.getContext('2d'), w, readTheme());
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the picture'))), 'image/png');
  });
}
