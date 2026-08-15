// cloud-barrage.js — Bubble shooter, but you are not clearing the board.
// Every burst becomes rain that falls on the garden below, and each plant needs a
// different amount of water. Cactus 2. Sunflower 5. Fern 6. Rose 8. Oak 15.
// You win by growing all five, not by emptying the sky.

import { VW, VH, rr, circle, text, hudBar, Particles, Floaters, clamp, pick } from '../core/engine.js';
import { PALETTE, SUN_RATE, SPECIES } from '../data/config.js';
import { drawPlant } from '../core/plantart.js';

const R = 21;             // cloud radius
const CW = 50;            // column pitch
const RH = 43;            // row pitch
const LEFT = 40;
const TOP = 62;
const GARDEN_Y = 470;     // clouds must never reach this line
const SOIL_Y = 612;
const LAUNCH = { x: VW / 2, y: 668 };
const SHOTS = 26;

const TYPES = {
  cumulus: { color: '#9FD8EE', water: 1, name: 'Cumulus' },
  rain:    { color: '#4FA8D8', water: 3, name: 'Rain cloud' },
  storm:   { color: '#6C5CA8', water: 1, name: 'Storm cloud' },
  snow:    { color: '#DCEEF7', water: 2, name: 'Snow cloud' },
  sun:     { color: '#FFC93C', water: 1, name: 'Sun cloud' },
  rainbow: { color: '#FF7EA8', water: 2, name: 'Rainbow cloud' },
};
const BASIC = ['cumulus', 'rain', 'storm', 'snow', 'sun'];

const colsIn = (r) => (r % 2 === 0 ? 9 : 8);
const cx = (r, c) => LEFT + c * CW + (r % 2 ? CW / 2 : 0);
const cy = (r) => TOP + r * RH;

const NEI_EVEN = [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
const NEI_ODD = [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];

export function createCloudBarrage() {
  const plants = [
    { sp: 'cactus', need: SPECIES.cactus.water },
    { sp: 'sunflower', need: SPECIES.sunflower.water },
    { sp: 'fern', need: SPECIES.fern.water },
    { sp: 'rose', need: SPECIES.rose.water },
    { sp: 'oak', need: SPECIES.oak.water },
  ].map((p, i) => ({ ...p, water: 0, x: 48 + i * 96, done: false, flash: 0 }));

  const g = {
    grid: [],
    drops: [],
    shot: null,
    next: pick(BASIC),
    current: pick(BASIC),
    angle: -Math.PI / 2,
    shots: SHOTS,
    score: 0,
    delivered: 0,
    wasted: 0,
    sunBonus: 0,
    plants,
    fx: new Particles(),
    floats: new Floaters(),
    t: 0,
    over: false,
    won: false,
    reason: '',
    shake: 0,
    sinceDrop: 0,
    message: '',
    messageT: 0,
  };

  // starting sky: 5 rows
  for (let r = 0; r < 5; r++) {
    const row = [];
    for (let c = 0; c < colsIn(r); c++) {
      row.push(Math.random() < 0.92 ? { type: weighted(), frozen: 0 } : null);
    }
    g.grid.push(row);
  }

  function weighted() {
    const roll = Math.random();
    if (roll < 0.40) return 'cumulus';
    if (roll < 0.66) return 'rain';
    if (roll < 0.80) return 'storm';
    if (roll < 0.91) return 'snow';
    if (roll < 0.985) return 'sun';
    return 'rainbow';
  }

  const cell = (r, c) => (g.grid[r] && g.grid[r][c]) || null;

  function neighbours(r, c) {
    const offs = r % 2 === 0 ? NEI_EVEN : NEI_ODD;
    const out = [];
    for (const [dr, dc] of offs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= g.grid.length) continue;
      if (nc < 0 || nc >= colsIn(nr)) continue;
      out.push([nr, nc]);
    }
    return out;
  }

  function pickShotType() {
    const present = new Set();
    g.grid.forEach((row) => row.forEach((c) => c && present.add(c.type)));
    const pool = BASIC.filter((t) => present.has(t));
    if (!pool.length) return 'rainbow';
    return Math.random() < 0.06 ? 'rainbow' : pick(pool);
  }

  function fire() {
    if (g.shot || g.over) return;
    g.shot = {
      x: LAUNCH.x, y: LAUNCH.y,
      vx: Math.cos(g.angle) * 620, vy: Math.sin(g.angle) * 620,
      type: g.current,
    };
    g.current = g.next;
    g.next = pickShotType();
    g.shots -= 1;
  }

  function snap(px, py) {
    let best = null, bd = 1e9;
    const maxR = g.grid.length + 1;
    for (let r = 0; r < maxR; r++) {
      if (!g.grid[r]) g.grid[r] = new Array(colsIn(r)).fill(null);
      for (let c = 0; c < colsIn(r); c++) {
        if (g.grid[r][c]) continue;
        const touching = r === 0 || neighbours(r, c).some(([nr, nc]) => cell(nr, nc));
        if (!touching) continue;
        const d = Math.hypot(cx(r, c) - px, cy(r) - py);
        if (d < bd) { bd = d; best = [r, c]; }
      }
    }
    return best;
  }

  function matchGroup(r, c) {
    const type = cell(r, c).type;
    const seen = new Set([`${r},${c}`]);
    const stack = [[r, c]];
    const group = [[r, c]];
    while (stack.length) {
      const [ar, ac] = stack.pop();
      for (const [nr, nc] of neighbours(ar, ac)) {
        const k = `${nr},${nc}`;
        if (seen.has(k)) continue;
        const cl = cell(nr, nc);
        if (!cl || cl.frozen > 0) continue;
        const compatible = cl.type === type || cl.type === 'rainbow' || type === 'rainbow';
        if (!compatible) continue;
        seen.add(k); stack.push([nr, nc]); group.push([nr, nc]);
      }
    }
    return group;
  }

  function rainFrom(x, y, type) {
    const amount = TYPES[type].water;
    for (let i = 0; i < amount; i++) {
      g.drops.push({ x: x + (Math.random() - 0.5) * 26, y: y + i * 8, vy: 180 + Math.random() * 90, type });
    }
    if (type === 'sun') { g.sunBonus += 3; g.score += 30; g.floats.add(x, y, '+3 sun', PALETTE.pollen, 15); }
  }

  function pop(list, chained = false) {
    const seen = new Set();
    const queue = [...list];
    while (queue.length) {
      const [r, c] = queue.shift();
      const k = `${r},${c}`;
      if (seen.has(k)) continue;
      const cl = cell(r, c);
      if (!cl) continue;
      seen.add(k);
      g.grid[r][c] = null;
      const x = cx(r, c), y = cy(r);
      g.fx.burst(x, y, TYPES[cl.type].color, 10, 110, 0.5);
      rainFrom(x, y, cl.type);
      g.score += chained ? 8 : 12;

      if (cl.type === 'storm') {
        g.shake = 0.28;
        for (const [nr, nc] of neighbours(r, c)) if (cell(nr, nc)) queue.push([nr, nc]);
      }
      if (cl.type === 'snow') {
        for (const [nr, nc] of neighbours(r, c)) {
          const n = cell(nr, nc);
          if (n) n.frozen = 3;
        }
      }
    }
    return seen.size;
  }

  function dropFloaters() {
    // anything not connected to the ceiling falls, and falling clouds still rain
    const keep = new Set();
    const stack = [];
    for (let c = 0; c < colsIn(0); c++) if (cell(0, c)) { stack.push([0, c]); keep.add(`0,${c}`); }
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [nr, nc] of neighbours(r, c)) {
        const k = `${nr},${nc}`;
        if (keep.has(k) || !cell(nr, nc)) continue;
        keep.add(k); stack.push([nr, nc]);
      }
    }
    let n = 0;
    for (let r = 0; r < g.grid.length; r++) {
      for (let c = 0; c < colsIn(r); c++) {
        if (cell(r, c) && !keep.has(`${r},${c}`)) {
          const cl = g.grid[r][c];
          g.grid[r][c] = null;
          rainFrom(cx(r, c), cy(r), cl.type);
          g.fx.burst(cx(r, c), cy(r), TYPES[cl.type].color, 6, 80, 0.5);
          g.score += 16;
          n++;
        }
      }
    }
    if (n) { g.message = `${n} clouds cut loose`; g.messageT = 1.6; g.score += n * 4; }
  }

  function descend() {
    g.grid.unshift(new Array(colsIn(0)).fill(null).map(() => (Math.random() < 0.85 ? { type: weighted(), frozen: 0 } : null)));
    // parity flipped for every row, so re-pack rows to their new width
    for (let r = 0; r < g.grid.length; r++) {
      const want = colsIn(r);
      while (g.grid[r].length < want) g.grid[r].push(null);
      if (g.grid[r].length > want) g.grid[r].length = want;
    }
    g.message = 'The sky rolls in';
    g.messageT = 1.6;
  }

  function place(r, c, type) {
    g.grid[r][c] = { type, frozen: 0 };
    const group = matchGroup(r, c);
    if (group.length >= 3) {
      const popped = pop(group);
      g.score += Math.max(0, popped - 3) * 14;
      if (popped >= 5) { g.message = `${popped}-cloud burst`; g.messageT = 1.4; }
      dropFloaters();
    }
    g.grid.forEach((row) => row.forEach((cl) => { if (cl && cl.frozen > 0) cl.frozen -= 1; }));

    g.sinceDrop += 1;
    if (g.sinceDrop >= 5) { g.sinceDrop = 0; descend(); }

    for (let r2 = 0; r2 < g.grid.length; r2++) {
      for (let c2 = 0; c2 < colsIn(r2); c2++) {
        if (cell(r2, c2) && cy(r2) + R > GARDEN_Y) { end(false, 'The clouds smothered the garden.'); return; }
      }
    }
    if (g.shots <= 0 && !g.plants.every((p) => p.done)) {
      // let the last drops land before judging
      g.graceT = 2.2;
    }
  }

  function end(won, reason) {
    if (g.over) return;
    g.won = won; g.reason = reason; g.over = true;
  }

  g.graceT = null;

  g.update = (dt) => {
    g.t += dt;
    g.shake = Math.max(0, g.shake - dt);
    g.messageT = Math.max(0, g.messageT - dt);
    g.fx.update(dt, 60);
    g.floats.update(dt);
    g.plants.forEach((p) => (p.flash = Math.max(0, p.flash - dt)));

    if (g.shot) {
      const s = g.shot;
      const steps = 4;
      for (let i = 0; i < steps && g.shot; i++) {
        s.x += (s.vx * dt) / steps;
        s.y += (s.vy * dt) / steps;
        if (s.x < R + 4) { s.x = R + 4; s.vx = Math.abs(s.vx); }
        if (s.x > VW - R - 4) { s.x = VW - R - 4; s.vx = -Math.abs(s.vx); }

        let hit = s.y <= TOP - 2;
        if (!hit) {
          outer:
          for (let r = 0; r < g.grid.length; r++) {
            for (let c = 0; c < colsIn(r); c++) {
              if (!cell(r, c)) continue;
              if (Math.hypot(cx(r, c) - s.x, cy(r) - s.y) < R * 1.85) { hit = true; break outer; }
            }
          }
        }
        if (hit) {
          const spot = snap(s.x, s.y);
          const type = s.type;
          g.shot = null;
          if (spot) place(spot[0], spot[1], type);
          break;
        }
        if (s.y < -40) { g.shot = null; }
      }
    }

    // rain falls and waters whichever plant it lands on
    for (let i = g.drops.length - 1; i >= 0; i--) {
      const d = g.drops[i];
      d.vy += 260 * dt;
      d.y += d.vy * dt;
      if (d.y >= SOIL_Y - 26) {
        g.drops.splice(i, 1);
        const p = g.plants.find((pl) => Math.abs(pl.x - d.x) < 46);
        if (p && !p.done) {
          p.water += 1;
          p.flash = 0.4;
          g.delivered += 1;
          g.score += 14;
          g.fx.burst(d.x, SOIL_Y - 20, PALETTE.rain, 6, 70, 0.4);
          if (p.water >= p.need) {
            p.done = true;
            p.water = p.need;
            g.score += 90;
            g.floats.add(p.x, SOIL_Y - 90, 'In bloom!', PALETTE.petal, 17);
            g.fx.burst(p.x, SOIL_Y - 70, PALETTE.petal, 26, 180, 0.9);
          }
        } else {
          g.wasted += 1;
          if (p && p.done) g.floats.add(d.x, SOIL_Y - 40, 'already full', 'rgba(234,242,226,0.6)', 12);
        }
      }
    }

    if (g.plants.every((p) => p.done)) {
      g.score += g.shots * 30;
      end(true, 'Every plant reached full bloom.');
    }

    if (g.graceT !== null) {
      g.graceT -= dt;
      if (g.graceT <= 0 && !g.over) end(false, 'Out of droplets before the garden was watered.');
    }
  };

  g.input = (input) => {
    if (g.over) return;
    const px = input.pointer.x, py = input.pointer.y;
    if (py < LAUNCH.y - 10) {
      g.angle = Math.atan2(py - LAUNCH.y, px - LAUNCH.x);
    }
    if (input.key('arrowleft', 'a')) g.angle -= 1.8 * (1 / 60);
    if (input.key('arrowright', 'd')) g.angle += 1.8 * (1 / 60);
    g.angle = clamp(g.angle, -Math.PI + 0.30, -0.30);
    if (input.pointer.justUp || input.hit(' ', 'arrowup', 'w')) fire();
  };

  g.draw = (ctx) => {
    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);

    // sky
    const sky = ctx.createLinearGradient(0, 46, 0, GARDEN_Y);
    sky.addColorStop(0, '#1E3A4A');
    sky.addColorStop(1, '#2A4A46');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 46, VW, GARDEN_Y - 46);

    // garden
    const grd = ctx.createLinearGradient(0, GARDEN_Y, 0, VH);
    grd.addColorStop(0, '#254036');
    grd.addColorStop(1, PALETTE.ink);
    ctx.fillStyle = grd;
    ctx.fillRect(0, GARDEN_Y, VW, VH - GARDEN_Y);
    ctx.fillStyle = '#3A2A1E';
    ctx.fillRect(0, SOIL_Y, VW, VH - SOIL_Y);
    ctx.fillStyle = 'rgba(139,224,106,0.15)';
    ctx.fillRect(0, SOIL_Y, VW, 3);

    // aim guide
    if (!g.shot) {
      let ax = LAUNCH.x, ay = LAUNCH.y, dx = Math.cos(g.angle), dy = Math.sin(g.angle);
      ctx.strokeStyle = 'rgba(99,199,240,0.35)';
      ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(ax, ay);
      for (let i = 0; i < 260; i++) {
        ax += dx * 5; ay += dy * 5;
        if (ax < R + 4 || ax > VW - R - 4) { dx = -dx; }
        if (ay < TOP) break;
        ctx.lineTo(ax, ay);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }

    // clouds
    for (let r = 0; r < g.grid.length; r++) {
      for (let c = 0; c < colsIn(r); c++) {
        const cl = cell(r, c);
        if (!cl) continue;
        drawCloud(ctx, cx(r, c), cy(r), cl, g.t, r + c);
      }
    }

    // plants + water meters
    for (const p of g.plants) {
      const frac = p.water / p.need;
      const stage = p.done ? 5 : Math.min(4, Math.floor(frac * 5));
      drawPlant(ctx, p.x, SOIL_Y, 132, p.sp, stage, g.t);
      const bw = 66, bx = p.x - bw / 2, by = SOIL_Y + 16;
      ctx.fillStyle = 'rgba(18,33,26,0.75)';
      rr(ctx, bx, by, bw, 12, 6); ctx.fill();
      ctx.fillStyle = p.done ? PALETTE.chloro : PALETTE.rain;
      rr(ctx, bx, by, Math.max(4, bw * Math.min(1, frac)), 12, 6); ctx.fill();
      if (p.flash > 0) {
        ctx.strokeStyle = `rgba(234,242,226,${p.flash * 2})`;
        ctx.lineWidth = 2; rr(ctx, bx - 2, by - 2, bw + 4, 16, 8); ctx.stroke();
      }
      text(ctx, `${p.water}/${p.need}`, p.x, by + 28, { size: 13, color: p.done ? PALETTE.chloro : PALETTE.paper, align: 'center' });
      text(ctx, SPECIES[p.sp].name, p.x, by + 43, { size: 10, color: 'rgba(234,242,226,0.55)', align: 'center', weight: 600, font: 'Karla, sans-serif' });
    }

    // rain
    ctx.strokeStyle = PALETTE.rain;
    ctx.lineWidth = 2.4;
    for (const d of g.drops) {
      ctx.strokeStyle = TYPES[d.type].color;
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x, d.y + 9); ctx.stroke();
    }

    // launcher
    ctx.save();
    ctx.translate(LAUNCH.x, LAUNCH.y);
    ctx.rotate(g.angle + Math.PI / 2);
    ctx.fillStyle = PALETTE.moss;
    rr(ctx, -9, -34, 18, 40, 8); ctx.fill();
    ctx.fillStyle = PALETTE.chloroDk;
    rr(ctx, -6, -38, 12, 16, 6); ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.moss;
    circle(ctx, LAUNCH.x, LAUNCH.y, 20); ctx.fill();

    if (!g.shot) drawCloud(ctx, LAUNCH.x, LAUNCH.y, { type: g.current, frozen: 0 }, g.t, 0, 0.8);
    drawCloud(ctx, LAUNCH.x + 62, LAUNCH.y + 12, { type: g.next, frozen: 0 }, g.t, 3, 0.55);
    text(ctx, 'next', LAUNCH.x + 62, LAUNCH.y + 38, { size: 10, color: 'rgba(234,242,226,0.5)', align: 'center', font: 'Karla, sans-serif' });

    if (g.shot) drawCloud(ctx, g.shot.x, g.shot.y, { type: g.shot.type, frozen: 0 }, g.t, 0);

    g.fx.draw(ctx);
    g.floats.draw(ctx);
    ctx.restore();

    hudBar(ctx, { score: g.score, label: 'WATER THE GARDEN', right: `${g.shots} droplets` });
    if (g.messageT > 0) {
      ctx.globalAlpha = Math.min(1, g.messageT);
      text(ctx, g.message, VW / 2, GARDEN_Y - 14, { size: 17, color: PALETTE.pollen, align: 'center' });
      ctx.globalAlpha = 1;
    }
  };

  g.result = () => ({
    score: g.score,
    sun: Math.max(1, Math.floor(g.score * SUN_RATE.clouds)) + g.sunBonus,
    reason: g.reason,
    stats: [
      ['Plants bloomed', `${g.plants.filter((p) => p.done).length} / 5`],
      ['Water delivered', g.delivered],
      ['Rain wasted', g.wasted],
    ],
    lesson: 'Same rain, different plants: a cactus needed 2 and the oak needed 15. Water requirement is a species trait.',
  });

  return g;
}

function drawCloud(ctx, x, y, cl, t, seed = 0, scale = 1) {
  const type = TYPES[cl.type];
  const r = R * scale;
  const bob = Math.sin(t * 1.6 + seed) * 1.5 * scale;
  ctx.save();
  ctx.translate(x, y + bob);

  if (cl.type === 'rainbow') {
    const grad = ctx.createLinearGradient(-r, -r, r, r);
    ['#FF7EA8', '#FFC93C', '#8BE06A', '#63C7F0'].forEach((c, i, a) => grad.addColorStop(i / (a.length - 1), c));
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = type.color;
  }
  circle(ctx, -r * 0.45, r * 0.12, r * 0.62); ctx.fill();
  circle(ctx, r * 0.45, r * 0.12, r * 0.58); ctx.fill();
  circle(ctx, 0, -r * 0.22, r * 0.78); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  circle(ctx, -r * 0.2, -r * 0.4, r * 0.32); ctx.fill();

  if (cl.type === 'storm') {
    ctx.fillStyle = PALETTE.pollen;
    ctx.beginPath();
    ctx.moveTo(-3 * scale, -6 * scale); ctx.lineTo(4 * scale, -1 * scale);
    ctx.lineTo(0, 0); ctx.lineTo(5 * scale, 8 * scale);
    ctx.lineTo(-4 * scale, 1 * scale); ctx.lineTo(1 * scale, 0);
    ctx.closePath(); ctx.fill();
  }
  if (cl.type === 'sun') {
    ctx.strokeStyle = '#FFF3C4'; ctx.lineWidth = 2 * scale;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 0.6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
      ctx.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
      ctx.stroke();
    }
  }
  if (cl.type === 'rain') {
    ctx.strokeStyle = '#BEE9FF'; ctx.lineWidth = 2 * scale;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 7 * scale, r * 0.5);
      ctx.lineTo(i * 7 * scale - 2, r * 0.85);
      ctx.stroke();
    }
  }
  if (cl.type === 'snow') {
    ctx.strokeStyle = '#7FB8D8'; ctx.lineWidth = 1.6 * scale;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(a) * r * 0.42, -Math.sin(a) * r * 0.42);
      ctx.lineTo(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42);
      ctx.stroke();
    }
  }
  if (cl.frozen > 0) {
    ctx.fillStyle = 'rgba(220,238,247,0.55)';
    circle(ctx, 0, 0, r * 0.95); ctx.fill();
    ctx.strokeStyle = '#DCEEF7'; ctx.lineWidth = 2;
    circle(ctx, 0, 0, r * 0.95); ctx.stroke();
  }
  ctx.restore();
}
