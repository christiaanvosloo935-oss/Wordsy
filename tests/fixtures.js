export const W = ['alpha', 'bravo', 'charlie', 'delta', 'echo'].map((w) => ({
  id: w, word: w, ipa: `/${w}/`, pos: 'noun', definition: `Meaning of ${w}.`,
  examples: [`An ${w} here.`, `Another ${w}.`, `A third ${w}.`],
}));
export const at = (y, m, d, h = 9, min = 0) => new Date(y, m - 1, d, h, min).getTime();
export const MIN = 60 * 1000;
