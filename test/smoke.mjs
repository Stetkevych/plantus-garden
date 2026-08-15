// smoke.mjs — run every game headlessly with random input and assert nothing throws.
// node test/smoke.mjs

import { createVineGarden } from '../js/games/vine-garden.js';
import { createCloudBarrage } from '../js/games/cloud-barrage.js';
import { createBeeRush } from '../js/games/bee-rush.js';
import { createSeedCrush } from '../js/games/seed-crush.js';
import { createPlantSurvivors } from '../js/games/plant-survivors.js';

function fakeCtx() {
  const noop = () => {};
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k === 'measureText') return () => ({ width: 24 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
      if (k === 'canvas') return { width: 480, height: 720 };
      if (k in t) return t[k];
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  return ctx;
}

function fakeInput(mode) {
  const keys = new Set();
  const pressed = new Set();
  const pointer = { x: 240, y: 400, down: false, justDown: false, justUp: false };
  const dirs = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  return {
    keys, pressed, pointer, swipe: null,
    key: (...n) => n.some((x) => keys.has(x)),
    hit: (...n) => n.some((x) => pressed.has(x)),
    tick() {
      pressed.clear();
      keys.clear();
      pointer.justDown = false; pointer.justUp = false;
      this.swipe = null;
      if (Math.random() < 0.25) { const d = dirs[(Math.random() * 4) | 0]; pressed.add(d); keys.add(d); }
      if (Math.random() < 0.1) { pressed.add(' '); }
      if (mode === 'pointer') {
        pointer.x = Math.random() * 480;
        pointer.y = 60 + Math.random() * 640;
        pointer.down = Math.random() < 0.5;
        if (Math.random() < 0.2) pointer.justDown = true;
        if (Math.random() < 0.2) pointer.justUp = true;
      }
      if (Math.random() < 0.15) pressed.add(String(1 + ((Math.random() * 3) | 0)));
    },
  };
}

const CASES = [
  ['Vine Garden', createVineGarden, 'keys'],
  ['Cloud Barrage', createCloudBarrage, 'pointer'],
  ['Bee Rush', createBeeRush, 'keys'],
  ['Seed Crush', createSeedCrush, 'pointer'],
  ['Plant Survivors', createPlantSurvivors, 'pointer'],
];

const RUNS = 40;
const MAX_FRAMES = 12000;
let failures = 0;

for (const [name, factory, mode] of CASES) {
  let ended = 0, frames = 0, scoreSum = 0, maxScore = 0;
  const t0 = Date.now();
  for (let run = 0; run < RUNS; run++) {
    const ctx = fakeCtx();
    const input = fakeInput(mode);
    let game;
    try {
      game = factory();
      let f = 0;
      while (!game.over && f < MAX_FRAMES) {
        input.tick();
        game.input(input);
        game.update(1 / 60);
        game.draw(ctx);
        f++;
      }
      frames += f;
      const res = game.result();
      if (typeof res.score !== 'number' || Number.isNaN(res.score)) throw new Error('bad score: ' + res.score);
      if (typeof res.sun !== 'number' || Number.isNaN(res.sun) || res.sun < 0) throw new Error('bad sun: ' + res.sun);
      if (!Array.isArray(res.stats) || !res.lesson) throw new Error('missing result fields');
      scoreSum += res.score;
      maxScore = Math.max(maxScore, res.score);
      if (game.over) ended++;
    } catch (err) {
      failures++;
      console.error(`✗ ${name} run ${run} frame-crash:`, err.stack?.split('\n').slice(0, 4).join('\n'));
      break;
    }
  }
  const ms = Date.now() - t0;
  console.log(
    `✓ ${name.padEnd(17)} ${RUNS} runs · ${frames} frames · ${ended}/${RUNS} reached an end state · ` +
    `avg score ${Math.round(scoreSum / RUNS)} · max ${maxScore} · ${ms}ms`
  );
}

console.log(failures ? `\n${failures} FAILURES` : '\nAll games ran clean.');
process.exit(failures ? 1 : 0);
