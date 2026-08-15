// seed-crush.js — Match 3. Cleared seeds drop into the germination tray, and a seed
// only counts as germinated once the tray has water, warmth and oxygen — the three real
// requirements. Match 4 makes a sprout that clears a line; match 5 makes a taproot that
// clears every seed of one kind.

import { VW, VH, rr, circle, text, hudBar, Particles, Floaters, pick, randInt } from '../core/engine.js';
import { PALETTE, SUN_RATE } from '../data/config.js';

const COLS = 8, ROWS = 8, CELL = 56;
const OX = 16, OY = 176;
const MOVES = 26;

const SEEDS = [
  { id: 'sunflower', color: '#FFC93C', name: 'Sunflower' },
  { id: 'bean',      color: '#8BE06A', name: 'Bean' },
  { id: 'pumpkin',   color: '#FF9F45', name: 'Pumpkin' },
  { id: 'corn',      color: '#F0E27A', name: 'Corn' },
  { id: 'apple',     color: '#FF7EA8', name: 'Apple' },
  { id: 'acorn',     color: '#B98453', name: 'Acorn' },
];
const byId = (id) => SEEDS.find((s) => s.id === id);

let uid = 0;

export function createSeedCrush() {
  const g = {
    grid: [],
    sel: null,
    moves: MOVES,
    score: 0,
    cleared: 0,
    cascade: 0,
    bestCascade: 0,
    phase: 'idle',
    timer: 0,
    fx: new Particles(),
    floats: new Floaters(),
    t: 0,
    over: false,
    reason: '',
    shake: 0,
    banner: '',
    bannerT: 0,
    swapBack: null,
  };

  const targets = [];
  const chosen = SEEDS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  chosen.forEach((s, i) => targets.push({ id: s.id, need: [14, 11, 9][i], got: 0 }));
  g.targets = targets;

  const at = (c, r) => (g.grid[r] ? g.grid[r][c] : null);

  function newCell(type) {
    return { type: type || pick(SEEDS).id, special: null, id: uid++, fall: 0, pop: 0, spawn: 1 };
  }

  // build a board with no starting matches
  for (let r = 0; r < ROWS; r++) {
    g.grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      let cell;
      let guard = 0;
      do {
        cell = newCell();
        guard++;
      } while (guard < 30 && makesRun(c, r, cell.type));
      g.grid[r][c] = cell;
    }
  }

  function makesRun(c, r, type) {
    const l1 = at(c - 1, r), l2 = at(c - 2, r);
    if (l1 && l2 && l1.type === type && l2.type === type) return true;
    const u1 = at(c, r - 1), u2 = at(c, r - 2);
    if (u1 && u2 && u1.type === type && u2.type === type) return true;
    return false;
  }

  function findMatches() {
    const marks = new Set();
    const runs = [];
    for (let r = 0; r < ROWS; r++) {
      let run = 1;
      for (let c = 1; c <= COLS; c++) {
        const same = c < COLS && at(c, r) && at(c - 1, r) && at(c, r).type === at(c - 1, r).type;
        if (same) run++;
        else {
          if (run >= 3) { const cells = []; for (let k = c - run; k < c; k++) { marks.add(`${k},${r}`); cells.push([k, r]); } runs.push({ cells, len: run, dir: 'h' }); }
          run = 1;
        }
      }
    }
    for (let c = 0; c < COLS; c++) {
      let run = 1;
      for (let r = 1; r <= ROWS; r++) {
        const same = r < ROWS && at(c, r) && at(c, r - 1) && at(c, r).type === at(c, r - 1).type;
        if (same) run++;
        else {
          if (run >= 3) { const cells = []; for (let k = r - run; k < r; k++) { marks.add(`${c},${k}`); cells.push([c, k]); } runs.push({ cells, len: run, dir: 'v' }); }
          run = 1;
        }
      }
    }
    return { marks, runs };
  }

  function trigger(c, r, out) {
    const cell = at(c, r);
    if (!cell || !cell.special) return;
    const sp = cell.special;
    cell.special = null;
    if (sp === 'row') for (let k = 0; k < COLS; k++) out.add(`${k},${r}`);
    if (sp === 'col') for (let k = 0; k < ROWS; k++) out.add(`${c},${k}`);
    if (sp === 'super') {
      const type = cell.type;
      for (let rr2 = 0; rr2 < ROWS; rr2++) for (let cc = 0; cc < COLS; cc++) if (at(cc, rr2) && at(cc, rr2).type === type) out.add(`${cc},${rr2}`);
    }
    g.shake = 0.25;
  }

  function resolve() {
    const { marks, runs } = findMatches();
    if (!marks.size) return false;

    g.cascade += 1;
    g.bestCascade = Math.max(g.bestCascade, g.cascade);

    // specials created by long runs
    const upgrades = [];
    for (const run of runs) {
      if (run.len === 4) upgrades.push({ cell: run.cells[Math.floor(run.len / 2)], special: run.dir === 'h' ? 'col' : 'row' });
      if (run.len >= 5) upgrades.push({ cell: run.cells[Math.floor(run.len / 2)], special: 'super' });
    }

    const all = new Set(marks);
    for (const k of marks) {
      const [c, r] = k.split(',').map(Number);
      trigger(c, r, all);
    }

    const mult = Math.min(5, g.cascade);
    let gained = 0;
    for (const k of all) {
      const [c, r] = k.split(',').map(Number);
      const cell = at(c, r);
      if (!cell) continue;
      const keep = upgrades.find((u) => u.cell[0] === c && u.cell[1] === r);
      if (keep) continue;
      const seed = byId(cell.type);
      g.fx.burst(OX + c * CELL + CELL / 2, OY + r * CELL + CELL / 2, seed.color, 8, 110, 0.45);
      const tgt = g.targets.find((t) => t.id === cell.type);
      if (tgt && tgt.got < tgt.need) {
        tgt.got += 1;
        if (tgt.got === tgt.need) {
          g.score += 350;
          g.banner = `${byId(tgt.id).name} germinated`; g.bannerT = 1.8;
        }
      }
      g.grid[r][c] = null;
      g.cleared += 1;
      gained += 30 * mult;
    }
    for (const u of upgrades) {
      const cell = at(u.cell[0], u.cell[1]);
      if (cell) { cell.special = u.special; cell.pop = 0.3; }
    }
    g.score += gained;
    if (mult >= 2) {
      g.floats.add(VW / 2, OY - 16, `cascade ×${mult}`, PALETTE.pollen, 18);
      g.score += 40 * mult;
    }
    return true;
  }

  function gravity() {
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (g.grid[r][c]) {
          if (write !== r) {
            g.grid[write][c] = g.grid[r][c];
            g.grid[write][c].fall = (write - r) * CELL;
            g.grid[r][c] = null;
          }
          write--;
        }
      }
      for (let r = write; r >= 0; r--) {
        g.grid[r][c] = newCell();
        g.grid[r][c].fall = (write + 1 - r) * CELL + CELL;
      }
    }
  }

  function trySwap(a, b) {
    const A = at(a.c, a.r), B = at(b.c, b.r);
    if (!A || !B) return;
    g.grid[a.r][a.c] = B; g.grid[b.r][b.c] = A;

    // a super seed swapped onto anything detonates immediately
    const specialHit = A.special === 'super' || B.special === 'super';
    const { marks } = findMatches();
    if (!marks.size && !specialHit) {
      g.grid[a.r][a.c] = A; g.grid[b.r][b.c] = B;
      g.swapBack = 0.2;
      g.banner = 'No match there'; g.bannerT = 0.9;
      return;
    }
    if (specialHit && !marks.size) {
      const sup = A.special === 'super' ? { c: b.c, r: b.r } : { c: a.c, r: a.r };
      const other = A.special === 'super' ? A : B;
      const out = new Set();
      other.type = (A.special === 'super' ? B : A).type;
      trigger(sup.c, sup.r, out);
      for (const k of out) { const [c, r] = k.split(',').map(Number); if (g.grid[r][c]) { g.grid[r][c] = null; g.cleared++; g.score += 40; } }
    }
    g.moves -= 1;
    g.cascade = 0;
    g.phase = 'resolve';
    g.timer = 0.05;
  }

  g.update = (dt) => {
    g.t += dt;
    g.shake = Math.max(0, g.shake - dt);
    g.bannerT = Math.max(0, g.bannerT - dt);
    if (g.swapBack !== null && g.swapBack > 0) { g.swapBack -= dt; if (g.swapBack <= 0) g.swapBack = null; }
    g.fx.update(dt, 90);
    g.floats.update(dt);

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = at(c, r);
      if (!cell) continue;
      if (cell.fall > 0) cell.fall = Math.max(0, cell.fall - 900 * dt);
      if (cell.pop > 0) cell.pop = Math.max(0, cell.pop - dt * 2.2);
      if (cell.spawn > 0) cell.spawn = Math.max(0, cell.spawn - dt * 4);
    }

    if (g.phase === 'resolve') {
      g.timer -= dt;
      if (g.timer <= 0) {
        const did = resolve();
        gravity();
        if (did) { g.timer = 0.24; }
        else {
          g.phase = 'idle';
          if (g.targets.every((t) => t.got >= t.need)) {
            g.score += g.moves * 60;
            g.over = true; g.reason = 'Every seed in the tray germinated.';
          } else if (g.moves <= 0) {
            g.over = true; g.reason = 'Out of moves.';
          }
        }
      }
    }
  };

  g.input = (input) => {
    if (g.phase !== 'idle' || g.over) return;
    const p = input.pointer;
    const c = Math.floor((p.x - OX) / CELL), r = Math.floor((p.y - OY) / CELL);
    const inside = c >= 0 && r >= 0 && c < COLS && r < ROWS;

    const adjacent = (a) => Math.abs(a.c - c) + Math.abs(a.r - r) === 1;

    // Tap-tap or drag, both end in the same place.
    if (p.justDown) {
      if (!inside) { g.sel = null; return; }
      if (g.sel && adjacent(g.sel)) { const from = g.sel; g.sel = null; trySwap(from, { c, r }); }
      else g.sel = { c, r };
      return;
    }
    if (p.down && inside && g.sel && adjacent(g.sel)) {
      const from = g.sel; g.sel = null;
      trySwap(from, { c, r });
    }
  };

  g.draw = (ctx) => {
    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);

    const bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#22392C');
    bg.addColorStop(1, PALETTE.ink);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);

    // germination tray objectives
    text(ctx, 'GERMINATION TRAY', VW / 2, 72, { size: 12, color: 'rgba(234,242,226,0.55)', align: 'center', font: 'Karla, sans-serif', weight: 700 });
    g.targets.forEach((t, i) => {
      const w = 142, x = 12 + i * (w + 9), y = 84;
      const done = t.got >= t.need;
      ctx.fillStyle = 'rgba(18,33,26,0.7)';
      rr(ctx, x, y, w, 62, 12); ctx.fill();
      ctx.strokeStyle = done ? PALETTE.chloro : 'rgba(139,224,106,0.2)';
      ctx.lineWidth = 2; rr(ctx, x, y, w, 62, 12); ctx.stroke();
      drawSeed(ctx, x + 26, y + 26, byId(t.id), null, g.t, 0.72);
      text(ctx, `${Math.min(t.got, t.need)}/${t.need}`, x + 52, y + 26, { size: 17, color: done ? PALETTE.chloro : PALETTE.paper });
      text(ctx, byId(t.id).name, x + 52, y + 42, { size: 10, color: 'rgba(234,242,226,0.55)', font: 'Karla, sans-serif', weight: 600 });
      const bw = w - 20;
      ctx.fillStyle = 'rgba(234,242,226,0.12)';
      rr(ctx, x + 10, y + 50, bw, 6, 3); ctx.fill();
      ctx.fillStyle = done ? PALETTE.chloro : byId(t.id).color;
      rr(ctx, x + 10, y + 50, Math.max(3, bw * Math.min(1, t.got / t.need)), 6, 3); ctx.fill();
    });

    // board
    ctx.fillStyle = 'rgba(18,33,26,0.55)';
    rr(ctx, OX - 6, OY - 6, COLS * CELL + 12, ROWS * CELL + 12, 16); ctx.fill();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = at(c, r);
        const x = OX + c * CELL + CELL / 2;
        const y = OY + r * CELL + CELL / 2;
        ctx.fillStyle = (c + r) % 2 ? 'rgba(139,224,106,0.045)' : 'rgba(139,224,106,0.08)';
        rr(ctx, OX + c * CELL + 2, OY + r * CELL + 2, CELL - 4, CELL - 4, 10); ctx.fill();
        if (!cell) continue;
        const sel = g.sel && g.sel.c === c && g.sel.r === r;
        const scale = 0.86 + cell.pop * 0.3 + (sel ? 0.12 + Math.sin(g.t * 9) * 0.04 : 0) - cell.spawn * 0.3;
        drawSeed(ctx, x, y - cell.fall, byId(cell.type), cell.special, g.t + c + r, scale);
        if (sel) {
          ctx.strokeStyle = PALETTE.paper; ctx.lineWidth = 2.5;
          rr(ctx, OX + c * CELL + 3, OY + r * CELL + 3, CELL - 6, CELL - 6, 10); ctx.stroke();
        }
      }
    }

    // soil line + sprouts earned
    ctx.fillStyle = '#3A2A1E';
    ctx.fillRect(0, VH - 66, VW, 66);
    ctx.fillStyle = 'rgba(139,224,106,0.18)';
    ctx.fillRect(0, VH - 66, VW, 3);
    const sprouts = Math.min(22, Math.floor(g.cleared / 4));
    for (let i = 0; i < sprouts; i++) {
      const x = 16 + i * 21;
      const h = 12 + (i % 3) * 5;
      ctx.strokeStyle = PALETTE.chloroDk; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(x, VH - 12); ctx.lineTo(x + Math.sin(g.t + i) * 2, VH - 12 - h); ctx.stroke();
      ctx.fillStyle = PALETTE.chloro;
      ctx.beginPath(); ctx.ellipse(x - 5, VH - 12 - h, 6, 3.4, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 5, VH - 14 - h, 6, 3.4, 0.5, 0, Math.PI * 2); ctx.fill();
    }

    g.fx.draw(ctx);
    g.floats.draw(ctx);
    ctx.restore();

    hudBar(ctx, { score: g.score, label: 'MATCH AND GERMINATE', right: `${g.moves} moves` });
    if (g.bannerT > 0) {
      ctx.globalAlpha = Math.min(1, g.bannerT);
      text(ctx, g.banner, VW / 2, OY - 22, { size: 17, color: PALETTE.chloro, align: 'center' });
      ctx.globalAlpha = 1;
    }
  };

  g.result = () => ({
    score: g.score,
    sun: Math.max(1, Math.floor(g.score * SUN_RATE.seeds)),
    reason: g.reason,
    stats: [
      ['Seeds cleared', g.cleared],
      ['Best cascade', `×${g.bestCascade}`],
      ['Trays completed', `${g.targets.filter((t) => t.got >= t.need).length} / 3`],
    ],
    lesson: 'A seed germinates with water, oxygen and warmth. Light is optional — plenty of seeds sprout in the dark.',
  });

  return g;
}

function drawSeed(ctx, x, y, seed, special, t, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  if (special) {
    ctx.strokeStyle = special === 'super' ? PALETTE.paper : PALETTE.pollen;
    ctx.lineWidth = 3;
    circle(ctx, 0, 0, 25 + Math.sin(t * 6) * 1.5); ctx.stroke();
  }

  ctx.fillStyle = seed.color;
  if (seed.id === 'sunflower') {
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 17, 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(18,33,26,0.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(5, 10); ctx.stroke();
  } else if (seed.id === 'bean') {
    ctx.beginPath();
    ctx.moveTo(-13, -4); ctx.quadraticCurveTo(0, -20, 13, -4);
    ctx.quadraticCurveTo(16, 12, 0, 15); ctx.quadraticCurveTo(-16, 12, -13, -4);
    ctx.fill();
  } else if (seed.id === 'pumpkin') {
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(18,33,26,0.35)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 11, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (seed.id === 'corn') {
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.quadraticCurveTo(15, -4, 10, 14);
    ctx.lineTo(-10, 14); ctx.quadraticCurveTo(-15, -4, 0, -16);
    ctx.fill();
  } else if (seed.id === 'apple') {
    circle(ctx, 0, 2, 14); ctx.fill();
    ctx.strokeStyle = '#5FB544'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.quadraticCurveTo(6, -19, 12, -17); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(0, 4, 11, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6E4629';
    ctx.beginPath(); ctx.ellipse(0, -9, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-1.5, -18, 3, 6);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  circle(ctx, -4, -6, 3.4); ctx.fill();
  ctx.restore();
}
