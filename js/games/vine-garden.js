// vine-garden.js — Snake, re-read as a vine. You never stop growing; you route around damage.
// Plant connection: every node you take becomes a leaf, then a bud, then a bloom on your own vine.

import { VW, VH, rr, circle, text, hudBar, Particles, Floaters, randInt, pick } from '../core/engine.js';
import { PALETTE, SUN_RATE, HAZARDS, POWERUPS } from '../data/config.js';

const CELL = 30;
const COLS = 16;
const TOP = 60;
const ROWS = Math.floor((VH - TOP - 8) / CELL);

const VINE_STAGES = [
  { at: 0,  name: 'Seedling' },
  { at: 6,  name: 'Small leaves' },
  { at: 12, name: 'Medium growth' },
  { at: 20, name: 'Larger leaves' },
  { at: 30, name: 'Flower buds' },
  { at: 42, name: 'Full bloom' },
];

const key = (x, y) => `${x},${y}`;

export function createVineGarden() {
  const g = {
    body: [{ x: 7, y: 12 }, { x: 7, y: 13 }, { x: 7, y: 14 }],
    dir: { x: 0, y: -1 },
    queue: [],
    tick: 0,
    speed: 0.165,
    score: 0,
    leaves: 0,
    nodes: [],
    hazards: [],
    powerups: [],
    fx: new Particles(),
    floats: new Floaters(),
    shield: false,
    doubleT: 0,
    magnetT: 0,
    bloomT: 0,
    slipT: 0,
    hazardTimer: 4,
    puTimer: 9,
    t: 0,
    over: false,
    dead: null,
    shake: 0,
  };

  const occupied = () => {
    const s = new Set();
    g.body.forEach((b) => s.add(key(b.x, b.y)));
    g.hazards.forEach((h) => s.add(key(h.x, h.y)));
    g.nodes.forEach((n) => s.add(key(n.x, n.y)));
    g.powerups.forEach((p) => s.add(key(p.x, p.y)));
    return s;
  };

  function freeCell() {
    const taken = occupied();
    for (let i = 0; i < 200; i++) {
      const x = randInt(0, COLS - 1), y = randInt(0, ROWS - 1);
      if (!taken.has(key(x, y))) return { x, y };
    }
    return null;
  }

  function spawnNode(kind) {
    const c = freeCell();
    if (c) g.nodes.push({ ...c, kind: kind || (g.leaves >= 12 && Math.random() < 0.3 ? 'flower' : 'leaf'), bob: Math.random() * 6 });
  }

  function spawnHazard() {
    const c = freeCell();
    if (!c) return;
    const pool = g.t < 25 ? ['caterpillar', 'bark', 'water'] : ['caterpillar', 'beetle', 'spider', 'fungus', 'bark', 'water', 'hotspot'];
    const type = pick(pool);
    g.hazards.push({
      ...c, type,
      dir: pick([{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]),
      moveT: 0,
      age: 0,
    });
  }

  function spawnPowerup() {
    const c = freeCell();
    if (!c) return;
    g.powerups.push({ ...c, type: pick(['supersun', 'waterdrop', 'barkshield', 'superbloom', 'butterfly']), life: 14 });
  }

  for (let i = 0; i < 3; i++) spawnNode('leaf');
  g.hazards.push({ ...freeCell(), type: 'bark', dir: { x: 0, y: 0 }, moveT: 0, age: 0 });

  const stageIndex = () => {
    let s = 0;
    VINE_STAGES.forEach((v, i) => { if (g.leaves >= v.at) s = i; });
    return s;
  };

  function die(reason) {
    if (g.shield) {
      g.shield = false;
      g.floats.add(g.body[0].x * CELL + CELL / 2, TOP + g.body[0].y * CELL, 'Bark held!', PALETTE.barkLt, 16);
      g.fx.burst(g.body[0].x * CELL + CELL / 2, TOP + g.body[0].y * CELL + CELL / 2, PALETTE.barkLt, 18, 160);
      g.hazards = g.hazards.filter((h) => !(h.x === g.body[0].x && h.y === g.body[0].y));
      g.shake = 0.35;
      return;
    }
    g.dead = reason;
    g.over = true;
  }

  function step() {
    if (g.queue.length && !g.slipT) {
      const n = g.queue.shift();
      if (n.x !== -g.dir.x || n.y !== -g.dir.y) g.dir = n;
    }
    if (g.slipT > 0) g.slipT -= 1;

    const head = { x: g.body[0].x + g.dir.x, y: g.body[0].y + g.dir.y };

    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) return die('You grew off the trellis.');
    if (g.body.some((b, i) => i < g.body.length - 1 && b.x === head.x && b.y === head.y)) return die('The vine tangled in itself.');

    const hz = g.hazards.find((h) => h.x === head.x && h.y === head.y);
    if (hz) {
      if (hz.type === 'water') {
        g.slipT = 1;
        g.floats.add(head.x * CELL + CELL / 2, TOP + head.y * CELL, 'slip', PALETTE.rain, 14);
      } else if (hz.type === 'hotspot') {
        g.hazards = g.hazards.filter((h) => h !== hz);
        g.score = Math.max(0, g.score - 15);
        for (let i = 0; i < 3 && g.body.length > 3; i++) g.body.pop();
        g.leaves = Math.max(0, g.leaves - 2);
        g.shake = 0.3;
        g.fx.burst(head.x * CELL + CELL / 2, TOP + head.y * CELL + CELL / 2, PALETTE.danger, 16, 140);
        g.floats.add(head.x * CELL + CELL / 2, TOP + head.y * CELL, 'scorched', PALETTE.danger, 15);
      } else {
        return die(`${HAZARDS[hz.type].name} got the vine.`);
      }
    }

    g.body.unshift(head);

    const ni = g.nodes.findIndex((n) => n.x === head.x && n.y === head.y);
    if (ni >= 0) {
      const node = g.nodes[ni];
      g.nodes.splice(ni, 1);
      const base = node.kind === 'flower' ? 25 : 10;
      const pts = base * (g.doubleT > 0 ? 2 : 1);
      g.score += pts;
      g.leaves += 1;
      g.floats.add(head.x * CELL + CELL / 2, TOP + head.y * CELL, `+${pts}`, node.kind === 'flower' ? PALETTE.petal : PALETTE.chloro);
      g.fx.burst(head.x * CELL + CELL / 2, TOP + head.y * CELL + CELL / 2, node.kind === 'flower' ? PALETTE.petal : PALETTE.chloro, 12, 130);
      spawnNode();
      if (Math.random() < 0.35) spawnNode();
      g.speed = Math.max(0.075, 0.165 - g.leaves * 0.0022);
    } else {
      g.body.pop();
    }

    const pi = g.powerups.findIndex((p) => p.x === head.x && p.y === head.y);
    if (pi >= 0) {
      const p = g.powerups[pi];
      g.powerups.splice(pi, 1);
      applyPower(p.type, head);
    }

    // hazards act on the same tick
    for (const h of g.hazards) {
      h.age += 1;
      if (h.type === 'caterpillar' || h.type === 'beetle') {
        h.moveT += 1;
        const every = h.type === 'beetle' ? 1 : 2;
        if (h.moveT >= every) {
          h.moveT = 0;
          let nx = h.x + h.dir.x, ny = h.y + h.dir.y;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
            h.dir = { x: -h.dir.x, y: -h.dir.y };
            nx = h.x + h.dir.x; ny = h.y + h.dir.y;
          }
          h.x = nx; h.y = ny;
          if (h.x === g.body[0].x && h.y === g.body[0].y) die(`${HAZARDS[h.type].name} got the vine.`);
        }
      }
      if (h.type === 'fungus' && h.age % 14 === 0 && g.hazards.length < 26) {
        const d = pick([{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]);
        const nx = h.x + d.x, ny = h.y + d.y;
        const clash = g.hazards.some((o) => o.x === nx && o.y === ny) || g.body.some((b) => b.x === nx && b.y === ny);
        if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && !clash) {
          g.hazards.push({ x: nx, y: ny, type: 'fungus', dir: { x: 0, y: 0 }, moveT: 0, age: 1 });
        }
      }
    }
  }

  function applyPower(type, at) {
    const px = at.x * CELL + CELL / 2, py = TOP + at.y * CELL + CELL / 2;
    g.fx.burst(px, py, POWERUPS[type].color, 20, 170);
    const label = POWERUPS[type].name;
    g.floats.add(px, py - 6, label, POWERUPS[type].color, 16);
    if (type === 'supersun') g.doubleT = 8;
    if (type === 'waterdrop') { for (let i = 0; i < 3; i++) g.body.push({ ...g.body[g.body.length - 1] }); g.leaves += 1; }
    if (type === 'barkshield') g.shield = true;
    if (type === 'superbloom') { g.bloomT = 6; g.nodes.forEach((n) => (n.kind = 'flower')); }
    if (type === 'butterfly') g.magnetT = 8;
  }

  g.update = (dt) => {
    g.t += dt;
    g.shake = Math.max(0, g.shake - dt);
    g.doubleT = Math.max(0, g.doubleT - dt);
    g.magnetT = Math.max(0, g.magnetT - dt);
    g.bloomT = Math.max(0, g.bloomT - dt);
    g.fx.update(dt, 40);
    g.floats.update(dt);

    g.hazardTimer -= dt;
    if (g.hazardTimer <= 0) { spawnHazard(); g.hazardTimer = Math.max(4.5, 11 - g.t * 0.08); }
    g.puTimer -= dt;
    if (g.puTimer <= 0) { spawnPowerup(); g.puTimer = 13 + Math.random() * 6; }
    g.powerups.forEach((p) => (p.life -= dt));
    g.powerups = g.powerups.filter((p) => p.life > 0);

    if (g.magnetT > 0 && g.nodes.length) {
      const h = g.body[0];
      let best = null, bd = 99;
      for (const n of g.nodes) {
        const d = Math.abs(n.x - h.x) + Math.abs(n.y - h.y);
        if (d < bd) { bd = d; best = n; }
      }
      if (best && bd > 1 && Math.floor(g.t * 4) % 2 === 0) {
        const dx = Math.sign(h.x - best.x), dy = Math.sign(h.y - best.y);
        if (Math.abs(h.x - best.x) > Math.abs(h.y - best.y)) best.x += dx; else best.y += dy;
      }
    }

    g.tick += dt;
    while (g.tick >= g.speed && !g.over) { g.tick -= g.speed; step(); }
  };

  g.input = (input) => {
    // Only queue a genuine change of direction. Without this, rapid input stacks
    // duplicates and the vine ends up steering on decisions two ticks old.
    const set = (x, y) => {
      const last = g.queue.length ? g.queue[g.queue.length - 1] : g.dir;
      if (last.x === x && last.y === y) return;
      if (last.x === -x && last.y === -y) return;
      if (g.queue.length < 2) g.queue.push({ x, y });
    };
    if (input.hit('arrowup', 'w')) set(0, -1);
    if (input.hit('arrowdown', 's')) set(0, 1);
    if (input.hit('arrowleft', 'a')) set(-1, 0);
    if (input.hit('arrowright', 'd')) set(1, 0);
    if (input.swipe === 'up') set(0, -1);
    if (input.swipe === 'down') set(0, 1);
    if (input.swipe === 'left') set(-1, 0);
    if (input.swipe === 'right') set(1, 0);
  };

  g.draw = (ctx) => {
    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);

    ctx.fillStyle = PALETTE.ink2;
    ctx.fillRect(0, TOP, VW, ROWS * CELL);
    ctx.strokeStyle = 'rgba(139,224,106,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, TOP); ctx.lineTo(x * CELL, TOP + ROWS * CELL); ctx.stroke(); }
    for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, TOP + y * CELL); ctx.lineTo(VW, TOP + y * CELL); ctx.stroke(); }

    for (const h of g.hazards) drawHazard(ctx, h, g.t);
    for (const n of g.nodes) {
      const cx = n.x * CELL + CELL / 2, cy = TOP + n.y * CELL + CELL / 2 + Math.sin(g.t * 2 + n.bob) * 2;
      if (n.kind === 'flower') {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + g.t * 0.5;
          ctx.fillStyle = PALETTE.petal;
          circle(ctx, cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 4.6); ctx.fill();
        }
        ctx.fillStyle = PALETTE.pollen; circle(ctx, cx, cy, 4.5); ctx.fill();
      } else {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(g.t + n.bob) * 0.3);
        ctx.fillStyle = PALETTE.chloro;
        ctx.beginPath();
        ctx.moveTo(-9, 0); ctx.quadraticCurveTo(0, -8, 9, 0); ctx.quadraticCurveTo(0, 8, -9, 0); ctx.fill();
        ctx.restore();
      }
    }

    for (const p of g.powerups) {
      const cx = p.x * CELL + CELL / 2, cy = TOP + p.y * CELL + CELL / 2;
      const pulse = 1 + Math.sin(g.t * 6) * 0.08;
      ctx.globalAlpha = p.life < 3 && Math.floor(p.life * 6) % 2 === 0 ? 0.35 : 1;
      ctx.fillStyle = POWERUPS[p.type].color;
      circle(ctx, cx, cy, 11 * pulse); ctx.fill();
      ctx.fillStyle = PALETTE.ink;
      text(ctx, powerGlyph(p.type), cx, cy + 5, { size: 14, align: 'center' });
      ctx.globalAlpha = 1;
    }

    // vine body: older segments carry more mature growth
    const st = stageIndex();
    for (let i = g.body.length - 1; i >= 0; i--) {
      const b = g.body[i];
      const cx = b.x * CELL + CELL / 2, cy = TOP + b.y * CELL + CELL / 2;
      const isHead = i === 0;
      ctx.fillStyle = isHead ? PALETTE.chloro : (i % 2 ? PALETTE.chloroDk : '#54A33C');
      rr(ctx, cx - CELL / 2 + 2, cy - CELL / 2 + 2, CELL - 4, CELL - 4, isHead ? 10 : 8);
      ctx.fill();
      if (!isHead && i % 3 === 0 && st >= 1) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(i * 0.7 + Math.sin(g.t * 1.5 + i) * 0.15);
        ctx.fillStyle = PALETTE.chloro;
        const L = 6 + st * 1.6;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * 0.6, -L * 0.5, L * 1.6, 0);
        ctx.quadraticCurveTo(L * 0.6, L * 0.5, 0, 0); ctx.fill();
        ctx.restore();
      }
      if (!isHead && st >= 4 && i % 7 === 0) {
        const open = st >= 5;
        ctx.fillStyle = open ? PALETTE.petal : '#7FBF5A';
        if (open) {
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 + g.t;
            circle(ctx, cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, 3.6); ctx.fill();
          }
          ctx.fillStyle = PALETTE.pollen; circle(ctx, cx, cy, 3); ctx.fill();
        } else { circle(ctx, cx, cy, 5); ctx.fill(); }
      }
      if (isHead) {
        ctx.fillStyle = PALETTE.ink;
        const ex = g.dir.x * 4, ey = g.dir.y * 4;
        circle(ctx, cx - 4 + ex, cy - 2 + ey, 2.4); ctx.fill();
        circle(ctx, cx + 4 + ex, cy - 2 + ey, 2.4); ctx.fill();
        if (g.shield) {
          ctx.strokeStyle = PALETTE.barkLt; ctx.lineWidth = 3;
          circle(ctx, cx, cy, CELL * 0.62); ctx.stroke();
        }
      }
    }

    g.fx.draw(ctx);
    g.floats.draw(ctx);
    ctx.restore();

    hudBar(ctx, { score: g.score, label: VINE_STAGES[st].name.toUpperCase(), right: `${g.leaves} nodes` });
    let bx = VW - 14;
    const badge = (on, label, color) => {
      if (!on) return;
      const w = ctx.measureText(label).width + 20;
      ctx.fillStyle = color;
      rr(ctx, bx - w, 52, w, 22, 11); ctx.fill();
      text(ctx, label, bx - w / 2, 67, { size: 12, color: PALETTE.ink, align: 'center' });
      bx -= w + 6;
    };
    ctx.font = '700 12px "Baloo 2", sans-serif';
    badge(g.doubleT > 0, 'x2 SUN', PALETTE.pollen);
    badge(g.magnetT > 0, 'BUTTERFLY', '#FF9F45');
    badge(g.shield, 'BARK', PALETTE.barkLt);
  };

  g.result = () => ({
    score: g.score,
    sun: Math.max(1, Math.floor(g.score * SUN_RATE.vine)),
    reason: g.dead || 'Run complete.',
    stats: [
      ['Nodes absorbed', g.leaves],
      ['Vine length', g.body.length],
      ['Growth reached', VINE_STAGES[stageIndex()].name],
    ],
    lesson: 'A vine grows toward light and around damage — that is phototropism doing the steering.',
  });

  return g;
}

function powerGlyph(t) {
  return { supersun: '☀', waterdrop: '💧', barkshield: '🛡', superbloom: '✿', butterfly: '🦋' }[t] || '?';
}

function drawHazard(ctx, h, t) {
  const cx = h.x * CELL + CELL / 2, cy = TOP + h.y * CELL + CELL / 2;
  const c = HAZARDS[h.type].color;
  ctx.save();
  if (h.type === 'bark') {
    ctx.fillStyle = '#6E4629';
    rr(ctx, cx - 14, cy - 14, 28, 28, 5); ctx.fill();
    ctx.strokeStyle = '#4A2E1A'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 8, cy - 12); ctx.lineTo(cx + 3, cy + 2); ctx.lineTo(cx - 4, cy + 12); ctx.stroke();
  } else if (h.type === 'water') {
    ctx.fillStyle = 'rgba(99,199,240,0.45)';
    ctx.beginPath(); ctx.ellipse(cx, cy, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(234,242,226,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(cx, cy, 8 + Math.sin(t * 3) * 2, 5, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (h.type === 'hotspot') {
    const p = 0.5 + Math.sin(t * 5) * 0.2;
    ctx.fillStyle = `rgba(226,86,74,${0.35 + p * 0.35})`;
    circle(ctx, cx, cy, 13); ctx.fill();
    ctx.fillStyle = PALETTE.pollen;
    circle(ctx, cx, cy, 5 + p * 2); ctx.fill();
  } else if (h.type === 'fungus') {
    ctx.fillStyle = c;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + t * 0.4;
      circle(ctx, cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 6); ctx.fill();
    }
    ctx.fillStyle = 'rgba(18,33,26,0.5)'; circle(ctx, cx, cy, 4); ctx.fill();
  } else if (h.type === 'spider') {
    ctx.strokeStyle = 'rgba(234,242,226,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14); ctx.stroke();
    }
    ctx.fillStyle = c; circle(ctx, cx, cy, 7); ctx.fill();
    ctx.fillStyle = PALETTE.paper; circle(ctx, cx - 2.5, cy - 1, 1.5); ctx.fill(); circle(ctx, cx + 2.5, cy - 1, 1.5); ctx.fill();
  } else if (h.type === 'beetle') {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(cx, cy, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(18,33,26,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.stroke();
  } else {
    ctx.fillStyle = c;
    for (let i = 0; i < 4; i++) circle(ctx, cx - 9 + i * 6, cy + Math.sin(t * 6 + i) * 2, 5.5), ctx.fill();
    ctx.fillStyle = PALETTE.ink; circle(ctx, cx + 9, cy - 1, 1.6); ctx.fill();
  }
  ctx.restore();
}
