// Shrinks an element's font size until its text fits on one line, but not below minPx.
export function fitText(el, minPx = 14) {
  el.style.fontSize = '';
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth && size > minPx) {
    size -= 1;
    el.style.fontSize = `${size}px`;
  }
}
