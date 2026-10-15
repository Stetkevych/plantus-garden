// forest-dash.js — Three-lane forest runner in pseudo-3D. Your own plant runs the
// trail on its roots: jump fallen logs, slide under low branches, switch lanes
// around stumps. It is also drying out the whole time, so water drops are not
// a bonus, they are fuel — and sunflecks are the big prize, as they are for
// every real plant on a shaded forest floor.

import { VW, VH, rr, circle, text, hudBar, Particles, Floaters, clamp, pick } from '../core/engine.js';
import { PALETTE, SUN_RATE } from '../data/config.js';
import { drawPlant } from '../core/plantart.js';

// Projection: world distance d (0 = the player, FAR = horizon) maps to a scale.
const HY = 210;                // horizon line
const PY = 612;                // the player's feet
const FOCAL = 9;
const FAR = 70;
const LANE_W = 150;            // lane spacing at the player's depth
const scaleAt = (d) => FOCAL / (FOCAL + Math.max(-FOCAL * 0.9, d));
const yAt = (d) => HY + (PY - HY) * scaleAt(d);
const xAt = (lane, d) => VW / 2 + (lane - 1) * LANE_W * scaleAt(d);

export const OBSTACLES = {
  log:    { name: 'Fallen log',   need: 'jump',  color: PALETTE.bark },
  branch: { name: 'Low branch',   need: 'slide', color: '#6E4629' },
  stump:  { name: 'Tree stump',   need: 'lane',  color: '#7A5233' },
  thorns: { name: 'Bramble patch', need: 'jump', color: '#9C4A5A' },
};

const PICKUPS = {
  drop:     { color: PALETTE.rain },
  sunfleck: { color: PALETTE.pollen },
  sap:      { color: '#FF9F45' },      // shield
  magnet:   { color: '#C79BE8' },
};

export function createForestDash({ species = 'sunflower', stage = 3 } = {}) {
  const g = {
    species, stage: clamp(stage, 2, 5),
    lane: 1, x: VW / 2,
    jump: 0,            // seconds left in the air
    slide: 0,           // seconds left sliding
    speed: 16,          // world units per second
    dist: 0,
    score: 0,
    water: 100,
    leaves: 3,
    shield: false,
    magnetT: 0,
    invuln: 0,
    combo: 0,
    bestCombo: 0,
    drops: 0,
    flecks: 0,
    dodged: 0,
    items: [],
    trees: [],
    rowT: 0.6,
    fx: new Particles(),
    floats: new Floaters(),
    t: 0,
    shake: 0,
    over: false,
    reason: '',
    banner: '', bannerT: 0, bannerColor: PALETTE.pollen,
  };

  for (let d = 2; d < FAR; d += 4) g.trees.push(tree(d));

  function tree(d) {
    return { d, side: Math.random() < 0.5 ? -1 : 1, off: 1.9 + Math.random() * 1.6, h: 0.8 + Math.random() * 0.6, hue: Math.random() };
  }

  const mult = () => (g.combo >= 20 ? 3 : g.combo >= 8 ? 2 : 1);
  const say = (msg, color = PALETTE.pollen) => { g.banner = msg; g.bannerT = 1.4; g.bannerColor = color; };

  /** One row of the trail. At least one lane is always passable by lane-switching. */
  function spawnRow() {
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    // Deep in the woods, some rows wall off every lane: one of them is always a
    // log or a branch, so there is still a way through if you read it in time.
    if (g.dist > 900 && Math.random() < Math.min(0.35, (g.dist - 900) / 5000)) {
      const way = pick(['log', 'branch', 'thorns']);
      g.items.push({ kind: 'obs', type: way, lane: lanes[0], d: FAR });
      g.items.push({ kind: 'obs', type: pick(['stump', way === 'branch' ? 'log' : 'branch']), lane: lanes[1], d: FAR });
      g.items.push({ kind: 'obs', type: 'stump', lane: lanes[2], d: FAR });
      return;
    }
    const hard = Math.min(0.75, 0.35 + g.dist / 4000);
    const nObs = Math.random() < hard ? 2 : 1;
    for (let i = 0; i < nObs; i++) {
      const type = pick(i === 0 ? ['log', 'branch', 'stump', 'thorns'] : ['log', 'branch', 'thorns', 'stump']);
      g.items.push({ kind: 'obs', type, lane: lanes[i], d: FAR });
    }
    // the open lane often carries something worth having
    const free = lanes[nObs];
    const r = Math.random();
    if (r < 0.06) g.items.push({ kind: 'pick', type: pick(['sap', 'magnet']), lane: free, d: FAR });
    else if (r < 0.2) g.items.push({ kind: 'pick', type: 'sunfleck', lane: free, d: FAR });
    else if (r < 0.85) for (let k = 0; k < 3; k++) g.items.push({ kind: 'pick', type: 'drop', lane: free, d: FAR + k * 2.2 });
  }

  function hit(item) {
    const o = OBSTACLES[item.type];
    g.combo = 0;
    if (g.shield) {
      g.shield = false;
      g.invuln = 1;
      g.fx.burst(g.x, PY - 60, PICKUPS.sap.color, 20, 200);
      say('Sap shield sealed the wound', PICKUPS.sap.color);
      return;
    }
    g.leaves -= 1;
    g.invuln = 1.2;
    g.shake = 0.35;
    g.fx.burst(g.x, PY - 50, PALETTE.chloro, 16, 180);
    say(`${o.name}! Lost a leaf`, PALETTE.danger);
    if (g.leaves <= 0) { g.over = true; g.reason = `${o.name} took your last leaf after ${Math.floor(g.dist)} m.`; }
  }

  function collect(item) {
    const p = PICKUPS[item.type];
    if (item.type === 'drop') {
      g.water = Math.min(100, g.water + 7);
      g.drops += 1;
      g.combo += 1;
      g.bestCombo = Math.max(g.bestCombo, g.combo);
      const pts = 10 * mult();
      g.score += pts;
      g.floats.add(g.x, PY - 120, `+${pts}`, PALETTE.rain, 15);
    } else if (item.type === 'sunfleck') {
      g.flecks += 1;
      const pts = 60 * mult();
      g.score += pts;
      g.floats.add(g.x, PY - 130, `+${pts} sunfleck`, PALETTE.pollen, 18);
      say('Sunfleck! A burst of full light');
    } else if (item.type === 'sap') {
      g.shield = true;
      say('Sap shield', p.color);
    } else if (item.type === 'magnet') {
      g.magnetT = 8;
      say('Root reach: drops come to you', p.color);
    }
    g.fx.burst(g.x, PY - 80, p.color, 8, 120, 0.4);
  }

  g.input = (input) => {
    if (input.hit('arrowleft', 'a') || input.swipe === 'left') g.lane = Math.max(0, g.lane - 1);
    if (input.hit('arrowright', 'd') || input.swipe === 'right') g.lane = Math.min(2, g.lane + 1);
    if ((input.hit('arrowup', 'w', ' ') || input.swipe === 'up') && g.jump <= 0) { g.jump = 0.62; g.slide = 0; }
    if ((input.hit('arrowdown', 's') || input.swipe === 'down') && g.slide <= 0) { g.slide = 0.6; g.jump = 0; }
  };

  g.update = (dt) => {
    if (g.over) return;
    g.t += dt;
    g.speed = Math.min(54, 16 + g.dist / 90);
    const step = g.speed * dt;
    g.dist += step;
    g.score += step * 0.5 * mult();
    g.x += (xAt(g.lane, 0) - g.x) * Math.min(1, dt * 16);
    g.jump = Math.max(0, g.jump - dt);
    g.slide = Math.max(0, g.slide - dt);
    g.invuln = Math.max(0, g.invuln - dt);
    g.magnetT = Math.max(0, g.magnetT - dt);
    g.shake = Math.max(0, g.shake - dt);
    g.bannerT = Math.max(0, g.bannerT - dt);

    // transpiration never stops
    g.water -= dt * (3.2 + g.speed * 0.06);
    if (g.water <= 0) { g.water = 0; g.over = true; g.reason = `Dried out after ${Math.floor(g.dist)} m. Water drops are fuel, not a bonus.`; }

    g.rowT -= dt * (g.speed / 16);
    if (g.rowT <= 0) { spawnRow(); g.rowT = Math.max(0.42, 1.15 - g.dist / 2500); }

    for (const tr of g.trees) { tr.d -= step; if (tr.d < -2) Object.assign(tr, tree(FAR)); }

    for (let i = g.items.length - 1; i >= 0; i--) {
      const it = g.items[i];
      const was = it.d;
      it.d -= step;
      if (it.kind === 'pick' && g.magnetT > 0 && it.type === 'drop' && it.d < 14) it.lane = g.lane;
      // resolve when the item crosses the player's depth
      if (was > 0.6 && it.d <= 0.6) {
        if (it.kind === 'obs' && it.lane === g.lane && g.invuln <= 0) {
          const need = OBSTACLES[it.type].need;
          const cleared = (need === 'jump' && g.jump > 0) || (need === 'slide' && g.slide > 0);
          if (cleared) {
            g.dodged += 1;
            const pts = 15 * mult();
            g.score += pts;
            g.floats.add(g.x, PY - 140, need === 'jump' ? `hop +${pts}` : `duck +${pts}`, PALETTE.chloro, 14);
          } else hit(it);
        } else if (it.kind === 'obs') {
          g.dodged += 1;
        } else if (it.kind === 'pick' && it.lane === g.lane) {
          collect(it);
          g.items.splice(i, 1);
          continue;
        }
      }
      if (it.d < -3) g.items.splice(i, 1);
    }
    g.fx.update(dt);
    g.floats.update(dt);
  };

  g.draw = (ctx) => {
    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);

    // canopy sky with shafts of light
    const sky = ctx.createLinearGradient(0, 0, 0, HY);
    sky.addColorStop(0, '#142A20');
    sky.addColorStop(1, '#2C5340');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VW, HY + 2);
    for (let k = 0; k < 4; k++) {
      const x = ((k * 137 + g.dist * 0.6) % (VW + 200)) - 100;
      ctx.fillStyle = 'rgba(255,214,107,0.06)';
      ctx.beginPath(); ctx.moveTo(x, 46); ctx.lineTo(x + 50, 46); ctx.lineTo(x + 170, VH); ctx.lineTo(x + 60, VH); ctx.closePath(); ctx.fill();
    }

    // forest floor
    const floor = ctx.createLinearGradient(0, HY, 0, VH);
    floor.addColorStop(0, '#20402F');
    floor.addColorStop(1, '#3B2A1B');
    ctx.fillStyle = floor;
    ctx.fillRect(0, HY, VW, VH - HY);

    // the trail: a dirt band narrowing to the horizon, with lane seams
    const edge = (side, d) => VW / 2 + side * LANE_W * 1.6 * scaleAt(d);
    ctx.fillStyle = '#5A4128';
    ctx.beginPath();
    ctx.moveTo(edge(-1, FAR), yAt(FAR)); ctx.lineTo(edge(1, FAR), yAt(FAR));
    ctx.lineTo(edge(1, -1.5), yAt(-1.5)); ctx.lineTo(edge(-1, -1.5), yAt(-1.5));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
    for (const s of [-0.5, 0.5]) {
      ctx.beginPath(); ctx.moveTo(VW / 2 + s * LANE_W * 2 * scaleAt(FAR), yAt(FAR)); ctx.lineTo(VW / 2 + s * LANE_W * 2 * scaleAt(-1.5), yAt(-1.5)); ctx.stroke();
    }
    // moving ground ticks sell the speed
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let d = (-(g.dist % 5)) + 5; d < FAR; d += 5) {
      const s = scaleAt(d);
      ctx.fillRect(VW / 2 - LANE_W * 1.5 * s, yAt(d), LANE_W * 3 * s, Math.max(1, 3 * s));
    }

    // far-to-near: trees and items interleaved by depth
    const things = [
      ...g.trees.map((tr) => ({ d: tr.d, draw: () => drawTree(ctx, tr) })),
      ...g.items.map((it) => ({ d: it.d, draw: () => drawItem(ctx, it, g.t) })),
    ].filter((o) => o.d > -1.5).sort((a, b) => b.d - a.d);
    for (const o of things) if (o.d > 0.6) o.draw();

    // the runner
    const air = g.jump > 0 ? Math.sin((1 - g.jump / 0.62) * Math.PI) : 0;
    const py = PY - air * 120;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(g.x, PY + 4, 34 - air * 12, 9, 0, 0, Math.PI * 2); ctx.fill();
    if (g.invuln > 0 && Math.floor(g.t * 14) % 2) ctx.globalAlpha = 0.45;
    drawRunner(ctx, g.x, py, g.species, g.stage, g.t, g.slide > 0, g.water);
    ctx.globalAlpha = 1;
    if (g.shield) {
      ctx.strokeStyle = 'rgba(255,159,69,0.75)'; ctx.lineWidth = 3;
      circle(ctx, g.x, py - 55, 62); ctx.stroke();
    }
    for (const o of things) if (o.d <= 0.6) o.draw();

    g.fx.draw(ctx);
    g.floats.draw(ctx);
    ctx.restore();

    // HUD
    hudBar(ctx, { score: Math.floor(g.score), label: mult() > 1 ? `×${mult()} streak` : `${Math.floor(g.dist)} m`, right: '🍃'.repeat(g.leaves) });
    rr(ctx, 14, 56, 160, 12, 6); ctx.fillStyle = 'rgba(18,33,26,0.8)'; ctx.fill();
    rr(ctx, 14, 56, 1.6 * g.water, 12, 6); ctx.fillStyle = g.water < 25 ? PALETTE.danger : PALETTE.rain; ctx.fill();
    text(ctx, g.water < 25 ? 'drying out!' : 'water', 182, 66, { size: 12, color: g.water < 25 ? PALETTE.danger : PALETTE.rain, weight: 700, font: 'Karla, sans-serif' });
    if (g.magnetT > 0) text(ctx, `root reach ${Math.ceil(g.magnetT)}s`, VW - 14, 66, { size: 12, color: PICKUPS.magnet.color, align: 'right', font: 'Karla, sans-serif' });
    if (g.bannerT > 0) {
      ctx.globalAlpha = Math.min(1, g.bannerT * 2);
      text(ctx, g.banner, VW / 2, 120, { size: 20, color: g.bannerColor, align: 'center' });
      ctx.globalAlpha = 1;
    }
    if (g.t < 3.5) {
      text(ctx, '← → switch lanes · ↑ jump logs · ↓ slide under branches', VW / 2, 150, { size: 13, color: 'rgba(234,242,226,0.75)', align: 'center', font: 'Karla, sans-serif', weight: 600 });
    }
  };

  g.result = () => ({
    score: Math.floor(g.score),
    sun: Math.max(1, Math.floor(g.score * SUN_RATE.dash)),
    reason: g.reason || 'Run complete.',
    stats: [
      ['Distance', `${Math.floor(g.dist)} m`],
      ['Sunflecks caught', g.flecks],
      ['Water drops', g.drops],
      ['Obstacles cleared', g.dodged],
      ['Best streak', g.bestCombo],
    ],
    lesson: 'Under a forest canopy, a plant gets only a few percent of full sunlight. Brief sunflecks that slip through gaps can supply more than half of an understory plant\'s daily photosynthesis, which is why they are worth the detour.',
  });

  return g;
}

/* ---------------- drawing ---------------- */

function drawTree(ctx, tr) {
  const s = scaleAt(tr.d);
  const x = VW / 2 + tr.side * LANE_W * tr.off * s * 1.3;
  const y = yAt(tr.d);
  const h = 260 * tr.h * s;
  ctx.fillStyle = '#4A3220';
  ctx.fillRect(x - 10 * s, y - h, 20 * s, h);
  ctx.fillStyle = tr.hue < 0.5 ? '#2E6B3F' : '#3D7F48';
  circle(ctx, x, y - h, 70 * s); ctx.fill();
  ctx.fillStyle = 'rgba(139,224,106,0.18)';
  circle(ctx, x - 20 * s, y - h - 18 * s, 38 * s); ctx.fill();
}

function drawItem(ctx, it, t) {
  const s = scaleAt(it.d);
  const x = xAt(it.lane, it.d), y = yAt(it.d);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (it.kind === 'obs') {
    const o = OBSTACLES[it.type];
    ctx.fillStyle = o.color;
    if (it.type === 'log') {
      rr(ctx, -62, -34, 124, 34, 16); ctx.fill();
      ctx.fillStyle = '#B98453'; ctx.beginPath(); ctx.ellipse(-58, -17, 10, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6E4629'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(-58, -17, 5, 9, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (it.type === 'branch') {
      // posts at the lane edges, a bough across at head height
      ctx.fillRect(-64, -150, 10, 150); ctx.fillRect(54, -150, 10, 150);
      rr(ctx, -72, -152, 144, 22, 10); ctx.fill();
      ctx.fillStyle = PALETTE.chloroDk;
      for (let k = -2; k <= 2; k++) { circle(ctx, k * 28, -126, 12); ctx.fill(); }
    } else if (it.type === 'stump') {
      rr(ctx, -48, -96, 96, 96, 10); ctx.fill();
      ctx.fillStyle = '#B98453'; ctx.beginPath(); ctx.ellipse(0, -96, 48, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7A5233'; ctx.lineWidth = 2;
      for (const r of [10, 22, 34]) { ctx.beginPath(); ctx.ellipse(0, -96, r, r * 0.29, 0, 0, Math.PI * 2); ctx.stroke(); }
    } else {
      ctx.strokeStyle = o.color; ctx.lineWidth = 4;
      for (let k = -3; k <= 3; k++) {
        ctx.beginPath(); ctx.moveTo(k * 16, 0);
        ctx.quadraticCurveTo(k * 16 + 14, -26, k * 16 - 4, -34); ctx.stroke();
      }
      ctx.fillStyle = PALETTE.petal;
      for (let k = -2; k <= 2; k += 2) { circle(ctx, k * 16, -30, 4); ctx.fill(); }
    }
  } else {
    const bob = Math.sin(t * 5 + it.d) * 6;
    if (it.type === 'drop') {
      ctx.fillStyle = PALETTE.rain;
      ctx.beginPath(); ctx.moveTo(0, -64 + bob); ctx.quadraticCurveTo(16, -38 + bob, 0, -28 + bob); ctx.quadraticCurveTo(-16, -38 + bob, 0, -64 + bob); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; circle(ctx, -4, -42 + bob, 3); ctx.fill();
    } else if (it.type === 'sunfleck') {
      ctx.fillStyle = 'rgba(255,201,60,0.25)'; circle(ctx, 0, -60 + bob, 34); ctx.fill();
      ctx.fillStyle = PALETTE.pollen; circle(ctx, 0, -60 + bob, 18); ctx.fill();
      ctx.strokeStyle = PALETTE.pollen; ctx.lineWidth = 3;
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + t;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 24, -60 + bob + Math.sin(a) * 24); ctx.lineTo(Math.cos(a) * 32, -60 + bob + Math.sin(a) * 32); ctx.stroke();
      }
    } else {
      const c = PICKUPS[it.type].color;
      ctx.fillStyle = 'rgba(18,33,26,0.85)'; circle(ctx, 0, -60 + bob, 24); ctx.fill();
      ctx.strokeStyle = c; ctx.lineWidth = 4; circle(ctx, 0, -60 + bob, 24); ctx.stroke();
      text(ctx, it.type === 'sap' ? '⬡' : '∪', 0, -52 + bob, { size: 24, color: c, align: 'center' });
    }
  }
  ctx.restore();
}

function drawRunner(ctx, x, y, species, stage, t, sliding, water) {
  ctx.save();
  // root legs scurrying
  const run = t * 18;
  ctx.strokeStyle = '#8A5A38'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const ph = run + k * Math.PI / 2;
    const lx = x - 18 + k * 12;
    ctx.beginPath(); ctx.moveTo(lx, y - 14); ctx.lineTo(lx + Math.sin(ph) * 8, y - Math.max(0, Math.cos(ph)) * 6); ctx.stroke();
  }
  // pot body
  ctx.fillStyle = '#B5653A';
  ctx.beginPath(); ctx.moveTo(x - 24, y - 46); ctx.lineTo(x + 24, y - 46); ctx.lineTo(x + 18, y - 12); ctx.lineTo(x - 18, y - 12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#C97A4A'; ctx.fillRect(x - 28, y - 52, 56, 8);
  // the plant: squashed flat on a slide, sagging when dry
  ctx.translate(x, y - 50);
  if (sliding) ctx.scale(1.25, 0.45);
  if (water < 25) ctx.rotate(Math.sin(t * 2) * 0.05 + 0.18);
  drawPlant(ctx, 0, 0, 120, species, stage, t);
  ctx.restore();
}
