// balance.mjs — drive each game with a competent heuristic bot.
// Crash-free is not the same as playable; this checks the difficulty curve and payouts.

import { createVineGarden } from '../js/games/vine-garden.js';
import { createCloudBarrage } from '../js/games/cloud-barrage.js';
import { createBeeRush } from '../js/games/bee-rush.js';
import { createSeedCrush } from '../js/games/seed-crush.js';
import { createPlantSurvivors } from '../js/games/plant-survivors.js';
import { SUN_RATE } from '../js/data/config.js';

const noop = () => {};
const ctx = new Proxy({}, {
  get(t, k) {
    if (k === 'measureText') return () => ({ width: 24 });
    if (k === 'createLinearGradient') return () => ({ addColorStop: noop });
    if (k in t) return t[k];
    return noop;
  },
  set(t, k, v) { t[k] = v; return true; },
});

function mkInput() {
  const keys = new Set(), pressed = new Set();
  const pointer = { x: 240, y: 400, down: false, justDown: false, justUp: false };
  return {
    keys, pressed, pointer, swipe: null,
    key: (...n) => n.some((x) => keys.has(x)),
    hit: (...n) => n.some((x) => pressed.has(x)),
    clear() { pressed.clear(); keys.clear(); this.swipe = null; pointer.justDown = false; pointer.justUp = false; },
    tap(k) { pressed.add(k); keys.add(k); },
  };
}

const stats = (arr) => {
  const s = arr.slice().sort((a, b) => a - b);
  return { min: s[0], med: s[(s.length / 2) | 0], max: s[s.length - 1], avg: Math.round(s.reduce((a, b) => a + b, 0) / s.length) };
};

/* ---------------- Vine: greedy safe pathing ---------------- */
function botVine() {
  const g = createVineGarden(), input = mkInput();
  let lastKey = null;
  const COLS = 16, ROWS = Math.floor((720 - 60 - 8) / 30);
  let frames = 0;
  while (!g.over && frames < 60 * 240) {
    input.clear();
    const h = g.body[0];
    const target = g.nodes.length
      ? g.nodes.reduce((a, b) => (Math.abs(a.x - h.x) + Math.abs(a.y - h.y) <= Math.abs(b.x - h.x) + Math.abs(b.y - h.y) ? a : b))
      : { x: 8, y: 11 };
    const opts = [
      { d: [0, -1], k: 'arrowup' }, { d: [0, 1], k: 'arrowdown' },
      { d: [-1, 0], k: 'arrowleft' }, { d: [1, 0], k: 'arrowright' },
    ];
    let best = null, bs = 1e9;
    for (const o of opts) {
      const nx = h.x + o.d[0], ny = h.y + o.d[1];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (o.d[0] === -g.dir.x && o.d[1] === -g.dir.y) continue;
      if (g.body.some((b, i) => i < g.body.length - 1 && b.x === nx && b.y === ny)) continue;
      const hz = g.hazards.find((z) => z.x === nx && z.y === ny);
      if (hz && !['water'].includes(hz.type)) continue;
      let score = Math.abs(nx - target.x) + Math.abs(ny - target.y);
      // avoid squeezing against walls
      if (nx === 0 || ny === 0 || nx === COLS - 1 || ny === ROWS - 1) score += 1.5;
      if (score < bs) { bs = score; best = o; }
    }
    if (best && best.k !== lastKey) { input.tap(best.k); lastKey = best.k; }
    g.input(input); g.update(1 / 60); g.draw(ctx);
    frames++;
  }
  return g.result();
}

/* ---------------- Clouds: simulate the shot, prefer matches over the thirstiest plant ---------------- */
const CR = 21, CLEFT = 40, CCW = 50, CRH = 43, CTOP = 62, CVW = 480;
const ccols = (r) => (r % 2 === 0 ? 9 : 8);
const ccx = (r, c) => CLEFT + c * CCW + (r % 2 ? CCW / 2 : 0);
const ccy = (r) => CTOP + r * CRH;
const CNE = { even: [[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]], odd: [[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]] };

function cNeighbours(grid, r, c) {
  const offs = r % 2 === 0 ? CNE.even : CNE.odd;
  const out = [];
  for (const [dr, dc] of offs) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= grid.length || nc < 0 || nc >= ccols(nr)) continue;
    out.push([nr, nc]);
  }
  return out;
}

// Trace a droplet and report the cell it would occupy, mirroring the game's own snap rule.
function simulate(grid, angle) {
  let x = CVW / 2, y = 668;
  let dx = Math.cos(angle) * 5, dy = Math.sin(angle) * 5;
  for (let step = 0; step < 900; step++) {
    x += dx; y += dy;
    if (x < CR + 4) { x = CR + 4; dx = Math.abs(dx); }
    if (x > CVW - CR - 4) { x = CVW - CR - 4; dx = -Math.abs(dx); }
    let hit = y <= CTOP - 2;
    if (!hit) {
      for (let r = 0; r < grid.length && !hit; r++)
        for (let c = 0; c < ccols(r); c++)
          if (grid[r] && grid[r][c] && Math.hypot(ccx(r, c) - x, ccy(r) - y) < CR * 1.85) { hit = true; break; }
    }
    if (hit) {
      let best = null, bd = 1e9;
      for (let r = 0; r < grid.length + 1; r++) {
        for (let c = 0; c < ccols(r); c++) {
          if (grid[r] && grid[r][c]) continue;
          const touching = r === 0 || cNeighbours(grid, r, c).some(([nr, nc]) => grid[nr] && grid[nr][nc]);
          if (!touching) continue;
          const d = Math.hypot(ccx(r, c) - x, ccy(r) - y);
          if (d < bd) { bd = d; best = [r, c]; }
        }
      }
      return best;
    }
    if (y < -40) return null;
  }
  return null;
}

function groupSize(grid, r, c, type) {
  const seen = new Set([`${r},${c}`]);
  const stack = [[r, c]];
  let n = 1;
  while (stack.length) {
    const [ar, ac] = stack.pop();
    for (const [nr, nc] of cNeighbours(grid, ar, ac)) {
      const k = `${nr},${nc}`;
      if (seen.has(k)) continue;
      const cl = grid[nr] && grid[nr][nc];
      if (!cl || cl.frozen > 0) continue;
      if (!(cl.type === type || cl.type === 'rainbow' || type === 'rainbow')) continue;
      seen.add(k); stack.push([nr, nc]); n++;
    }
  }
  return n;
}

function botClouds() {
  const g = createCloudBarrage(), input = mkInput();
  let frames = 0, cool = 0;
  while (!g.over && frames < 60 * 400) {
    input.clear();
    if (!g.shot && cool <= 0) {
      const need = g.plants.filter((p) => !p.done);
      const target = need.length ? need.reduce((a, b) => (a.need - a.water <= b.need - b.water ? a : b)) : g.plants[0];
      let bestAngle = -Math.PI / 2, bestVal = -1e9;
      for (let a = -Math.PI + 0.32; a < -0.32; a += 0.035) {
        const spot = simulate(g.grid, a);
        if (!spot) continue;
        const [r, c] = spot;
        const size = groupSize(g.grid, r, c, g.current);
        const x = ccx(r, c);
        // reward a burst, then reward bursting where the thirsty plant will catch the rain
        let val = size >= 3 ? 100 + size * 12 - Math.abs(x - target.x) * 0.35 : -Math.abs(x - target.x) * 0.1 - r;
        if (val > bestVal) { bestVal = val; bestAngle = a; }
      }
      input.pointer.x = 240 + Math.cos(bestAngle) * 260;
      input.pointer.y = 668 + Math.sin(bestAngle) * 260;
      g.input(input);
      input.pointer.justUp = true;
      cool = 10;
    }
    g.input(input); g.update(1 / 60); g.draw(ctx);
    cool -= 1;
    frames++;
  }
  return { ...g.result(), won: g.won };
}

/* ---------------- Bee: pick the safe lane with a flower ---------------- */
function botBee() {
  const g = createBeeRush(), input = mkInput();
  let frames = 0;
  while (!g.over && frames < 60 * 300) {
    input.clear();
    const danger = (lane) => g.items.some((i) => i.kind === 'obstacle' && i.lane === lane && i.y > 300 && i.y < 600);
    const reward = (lane) => g.items.some((i) => (i.kind === 'flower' || i.kind === 'boost') && i.lane === lane && i.y > 200 && i.y < 560);
    const score = (lane) => (lane < 0 || lane > 2 ? -99 : (danger(lane) ? -10 : 0) + (reward(lane) ? 3 : 0));
    const here = score(g.lane), left = score(g.lane - 1), right = score(g.lane + 1);
    if (left > here && left >= right) input.tap('arrowleft');
    else if (right > here) input.tap('arrowright');
    const ground = g.items.find((i) => i.kind === 'obstacle' && i.lane === g.lane && i.y > 470 && i.y < 545);
    if (ground && g.hop <= 0) input.tap('arrowup');
    g.input(input); g.update(1 / 60); g.draw(ctx);
    frames++;
  }
  return g.result();
}

/* ---------------- Seeds: search the board for a scoring swap ---------------- */
function botSeeds() {
  const g = createSeedCrush(), input = mkInput();
  const COLS = 8, ROWS = 8, CELL = 56, OX = 16, OY = 176;
  const px = (c) => OX + c * CELL + CELL / 2;
  const py = (r) => OY + r * CELL + CELL / 2;
  let frames = 0, pending = null, phase = 0;

  const wouldMatch = (a, b) => {
    const A = g.grid[a.r][a.c], B = g.grid[b.r][b.c];
    if (!A || !B) return 0;
    g.grid[a.r][a.c] = B; g.grid[b.r][b.c] = A;
    let best = 0;
    for (const [c, r] of [[a.c, a.r], [b.c, b.r]]) {
      const type = g.grid[r][c].type;
      let hcount = 1;
      for (let k = c - 1; k >= 0 && g.grid[r][k] && g.grid[r][k].type === type; k--) hcount++;
      for (let k = c + 1; k < COLS && g.grid[r][k] && g.grid[r][k].type === type; k++) hcount++;
      let vcount = 1;
      for (let k = r - 1; k >= 0 && g.grid[k][c] && g.grid[k][c].type === type; k--) vcount++;
      for (let k = r + 1; k < ROWS && g.grid[k][c] && g.grid[k][c].type === type; k++) vcount++;
      best = Math.max(best, hcount, vcount);
    }
    g.grid[a.r][a.c] = A; g.grid[b.r][b.c] = B;
    return best >= 3 ? best : 0;
  };

  while (!g.over && frames < 60 * 600) {
    input.clear();
    if (g.phase === 'idle' && !pending) {
      let best = null, bv = 0;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        for (const [dc, dr] of [[1, 0], [0, 1]]) {
          const c2 = c + dc, r2 = r + dr;
          if (c2 >= COLS || r2 >= ROWS) continue;
          const v = wouldMatch({ c, r }, { c: c2, r: r2 });
          if (v > bv) { bv = v; best = [{ c, r }, { c: c2, r: r2 }]; }
        }
      }
      if (best) { pending = best; phase = 0; }
      else { g.over = true; g.reason = 'no moves available'; break; }
    }
    if (pending) {
      if (phase === 0) { input.pointer.x = px(pending[0].c); input.pointer.y = py(pending[0].r); input.pointer.justDown = true; input.pointer.down = true; phase = 1; }
      else { input.pointer.x = px(pending[1].c); input.pointer.y = py(pending[1].r); input.pointer.down = true; pending = null; phase = 0; }
    }
    g.input(input); g.update(1 / 60); g.draw(ctx);
    frames++;
  }
  return g.result();
}

/* ---------------- Survivors: kite pests away from the beds ---------------- */
function botSurvivors() {
  const g = createPlantSurvivors(), input = mkInput();
  let frames = 0;
  while (!g.over && frames < 60 * 400) {
    input.clear();
    if (g.choosing) { input.tap('1'); g.input(input); frames++; continue; }
    const live = g.plants.filter((p) => p.hp > 0);
    // stand between the pests and the most threatened plant
    let tx = 240, ty = 400;
    if (live.length && g.pests.length) {
      const threat = live.reduce((a, b) => (a.hp <= b.hp ? a : b));
      const near = g.pests.reduce((a, b) =>
        (Math.hypot(a.x - threat.x, a.y - threat.y) <= Math.hypot(b.x - threat.x, b.y - threat.y) ? a : b));
      tx = (near.x + threat.x) / 2;
      ty = (near.y + threat.y) / 2;
      const d = Math.hypot(near.x - tx, near.y - ty);
      if (d < 50) { tx += (tx - near.x) * 1.2; ty += (ty - near.y) * 1.2; }
    }
    input.pointer.x = Math.max(14, Math.min(466, tx));
    input.pointer.y = Math.max(60, Math.min(706, ty));
    input.pointer.down = true;
    g.input(input); g.update(1 / 60); g.draw(ctx);
    frames++;
  }
  return { ...g.result(), time: g.time };
}

const RUNS = 30;
const rows = [];
for (const [name, bot, id] of [
  ['Vine Garden', botVine, 'vine'],
  ['Cloud Barrage', botClouds, 'clouds'],
  ['Bee Rush', botBee, 'bee'],
  ['Seed Crush', botSeeds, 'seeds'],
  ['Plant Survivors', botSurvivors, 'survivors'],
]) {
  const scores = [], suns = [];
  let wins = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = bot();
    scores.push(r.score); suns.push(r.sun);
    if (r.won || /full season|full bloom|germinated/.test(r.reason || '')) wins++;
  }
  const s = stats(scores), u = stats(suns);
  const suggested = (65 / Math.max(1, s.med)) * 1;
  rows.push({ name, id, score: s, sun: u, winRate: Math.round((wins / RUNS) * 100), suggested });
}

console.log('\nCompetent-player results over', RUNS, 'runs each\n');
console.log('game              score min/med/max        sun min/med/max     objective met');
console.log('-'.repeat(78));
for (const r of rows) {
  console.log(
    r.name.padEnd(18) +
    `${r.score.min}/${r.score.med}/${r.score.max}`.padEnd(23) +
    `${r.sun.min}/${r.sun.med}/${r.sun.max}`.padEnd(20) +
    `${r.winRate}%`
  );
}

console.log('\nSUN_RATE that would put the median run at ~65 sun:');
for (const r of rows) console.log(`  ${r.id.padEnd(11)} ${r.suggested.toFixed(4)}  (currently ${SUN_RATE[r.id]})`);

console.log('\nRuns needed to fully bloom one sunflower (860 sun total):');
for (const r of rows) {
  console.log(`  ${r.name.padEnd(18)} ~${Math.ceil(860 / Math.max(1, r.sun.med))} runs at median payout`);
}
