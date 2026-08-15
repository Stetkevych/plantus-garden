// build-single-file.mjs — flatten the ES modules into one self-contained .html
// so it can be opened straight from the filesystem, no server required.
//
//   node build/build-single-file.mjs
//
// Each game is wrapped in an IIFE because several of them use the same local
// constant names (TOP, COLS, CELL...) and would collide once flattened.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// Drop import lines; strip the `export` keyword but keep the declaration.
function strip(src) {
  return src
    .replace(/^\s*import\s+[^;]+;\s*$/gm, '')
    .replace(/^export\s+/gm, '')
    .trim();
}

const CORE = [
  'js/data/config.js',
  'js/data/biology.js',
  'js/core/engine.js',
  'js/core/plantart.js',
  'js/core/state.js',
].map((p) => `/* ===== ${p} ===== */\n${strip(read(p))}`).join('\n\n');

// state.js is consumed as a namespace (S.state, S.grow...), so rebuild that shape.
// `state` is reassigned by reset(), hence the getter rather than a plain copy.
const STATE_SHIM = `
/* ===== namespace shim for main.js ===== */
const S = {
  get state() { return state; },
  save, reset, addSun, addPlantus, unlockFact, growthCost, canGrow, grow,
  plotUnlockCost, unlockPlot, recordRun, recordQuiz, onChange,
};`;

const GAMES = [
  ['js/games/vine-garden.js', 'createVineGarden'],
  ['js/games/cloud-barrage.js', 'createCloudBarrage'],
  ['js/games/bee-rush.js', 'createBeeRush'],
  ['js/games/seed-crush.js', 'createSeedCrush'],
  ['js/games/plant-survivors.js', 'createPlantSurvivors'],
].map(([p, fn]) => `/* ===== ${p} ===== */
const ${fn} = (() => {
${strip(read(p))}
return ${fn};
})();`).join('\n\n');

const MAIN = `/* ===== js/main.js ===== */
(() => {
${strip(read('js/main.js'))}
})();`;

const css = read('css/style.css');
const html = read('index.html');

// Reuse the real markup: take everything inside <body>, minus the module script.
const body = html
  .slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .trim();

const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
<meta name="theme-color" content="#12211A" />
<title>Plantus Garden</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Karla:wght@400;500;700&display=swap" rel="stylesheet" />
<style>
${css}
</style>
</head>
<body>
${body}
<script>
"use strict";
${CORE}
${STATE_SHIM}
${GAMES}
${MAIN}
</script>
</body>
</html>
`;

mkdirSync(join(ROOT, 'dist'), { recursive: true });
writeFileSync(join(ROOT, 'dist/plantus-garden.html'), out);
console.log(`built dist/plantus-garden.html  (${(out.length / 1024).toFixed(0)} KB)`);
