// seed-storm.js — You are a seed pod rooted in the middle of a clearing, and
// everything is coming for you from every direction. Move inside the ring to
// dodge, your pod fires seeds at the nearest threat by itself, and when the
// pod is ripe you split it open in a 360° burst — explosive dispersal, the way
// a squirting cucumber or a sandbox tree launches its seeds.

import { VW, VH, circle, rr, text, hudBar, Particles, Floaters, clamp, rand, pick, ramp } from '../core/engine.js';
import { PALETTE, SUN_RATE } from '../data/config.js';
import { drawPlant } from '../core/plantart.js';

export const ARENA = { x: VW / 2, y: 400, r: 205 };
const SURVIVE = 90;
const BURST_KILLS = 14;

export const FOES = {
  aphid:  { name: 'Aphid swarm', hp: 1, speed: 82,  r: 8,  pts: 6,  color: '#A8D46A' },
  beetle: { name: 'Beetle',      hp: 5, speed: 42,  r: 15, pts: 25, color: '#C97B3A' },
  wasp:   { name: 'Wasp',        hp: 2, speed: 112, r: 11, pts: 15, color: PALETTE.pollen },
  slug:   { name: 'Slug',        hp: 3, speed: 30,  r: 13, pts: 18, color: '#B7A58A' },
  hail:   { name: 'Hailstone',   hp: Infinity, speed: 230, r: 9, pts: 0, color: '#DCEEF7' },  // dodge only
};

export function createSeedStorm({ species = 'sunflower', stage = 3 } = {}) {
  const g = {
    species, stage: clamp(stage, 2, 5),
    p: { x: ARENA.x, y: ARENA.y, r: 16 },
    hp: 3,
    inv: 0,
    foes: [],
    seeds: [],
    warn: [],
    drops: [],
    fireT: 0,
    rate: 0.3,
    spawnT: 1.2,
    hailT: 9,
    kills: 0,
    burstCharge: 0,
    bursts: 0,
    score: 0,
    time: 0,
    fx: new Particles(),
    floats: new Floaters(),
    shake: 0,
    over: false,
    won: false,
    reason: '',
    banner: '', bannerT: 0, bannerColor: PALETTE.pollen,
    dragFrom: null,
  };

  const say = (msg, color = PALETTE.pollen) => { g.banner = msg; g.bannerT = 1.5; g.bannerColor = color; };
  const edgePoint = (a, r = ARENA.r + 24) => ({ x: ARENA.x + Math.cos(a) * r, y: ARENA.y + Math.sin(a) * r });
  const intensity = () => ramp(g.time, 1, 4, 50);   // 1 -> ~3.5 over the round

  function spawnWave() {
    const roll = Math.random();
    const a = rand(0, Math.PI * 2);
    if (roll < 0.4) {
      for (let k = 0; k < 4 + Math.floor(intensity()); k++) addFoe('aphid', a + rand(-0.25, 0.25), rand(0, 30));
    } else if (roll < 0.62) addFoe('wasp', a);
    else if (roll < 0.82) addFoe('slug', a);
    else addFoe('beetle', a);
    // later waves arrive from two sides at once
    if (g.time > 35 && Math.random() < 0.5) addFoe(pick(['wasp', 'slug', 'beetle']), a + Math.PI + rand(-0.6, 0.6));
  }

  function addFoe(type, a, extra = 0) {
    const f = FOES[type];
    const pt = edgePoint(a, ARENA.r + 24 + extra);
    g.foes.push({ type, x: pt.x, y: pt.y, hp: f.hp, max: f.hp, wob: rand(0, 6), vx: 0, vy: 0 });
  }

  function hail() {
    // telegraphed: a red marker at the rim, then a fast straight line across
    const a = Math.atan2(g.p.y - ARENA.y, g.p.x - ARENA.x) + rand(-0.5, 0.5) + Math.PI;
    g.warn.push({ a, t: 0.9 });
  }

  function hurt(by) {
    if (g.inv > 0) return;
    g.hp -= 1;
    g.inv = 1.3;
    g.shake = 0.3;
    g.fx.burst(g.p.x, g.p.y, PALETTE.danger, 16, 200);
    say(`${FOES[by].name} hit you`, PALETTE.danger);
    if (g.hp <= 0) { g.over = true; g.reason = `Overrun by a ${FOES[by].name.toLowerCase()} at ${Math.floor(g.time)} s.`; }
  }

  function kill(f, i) {
    const def = FOES[f.type];
    g.kills += 1;
    g.score += def.pts;
    g.burstCharge = Math.min(BURST_KILLS, g.burstCharge + 1);
    g.fx.burst(f.x, f.y, def.color, 10, 140, 0.45);
    g.floats.add(f.x, f.y - 10, `+${def.pts}`, PALETTE.chloro, 14);
    if (Math.random() < 0.08) g.drops.push({ x: f.x, y: f.y, t: 8 });
    g.foes.splice(i, 1);
    if (g.burstCharge === BURST_KILLS) say('Pod is ripe! SPACE / tap the pod to burst', PALETTE.petal);
  }

  function burst() {
    if (g.burstCharge < BURST_KILLS) return;
    g.burstCharge = 0;
    g.bursts += 1;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      g.seeds.push({ x: g.p.x, y: g.p.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, life: 0.6, dmg: 3 });
    }
    // the shock of the pod splitting shoves everything back
    for (const f of g.foes) {
      if (f.type === 'hail') continue;
      const dx = f.x - g.p.x, dy = f.y - g.p.y, d = Math.hypot(dx, dy) || 1;
      if (d < 160) { f.vx += (dx / d) * 380; f.vy += (dy / d) * 380; }
    }
    g.shake = 0.25;
    g.fx.burst(g.p.x, g.p.y, PALETTE.petal, 30, 320, 0.7);
    say('Explosive dispersal!', PALETTE.petal);
  }

  g.input = (input) => {
    let mx = 0, my = 0;
    if (input.key('arrowleft', 'a')) mx -= 1;
    if (input.key('arrowright', 'd')) mx += 1;
    if (input.key('arrowup', 'w')) my -= 1;
    if (input.key('arrowdown', 's')) my += 1;
    if (input.hit(' ', 'e')) burst();

    const pt = input.pointer;
    if (pt.justDown) {
      // tapping your own pod splits it; anywhere else starts a drag
      if (Math.hypot(pt.x - g.p.x, pt.y - g.p.y) < 34 && g.burstCharge >= BURST_KILLS) burst();
      else g.dragFrom = { x: pt.x, y: pt.y, px: g.p.x, py: g.p.y };
    }
    if (!pt.down) g.dragFrom = null;
    g.move = { mx, my, drag: g.dragFrom && pt.down ? { tx: g.dragFrom.px + (pt.x - g.dragFrom.x) * 1.2, ty: g.dragFrom.py + (pt.y - g.dragFrom.y) * 1.2 } : null };
  };

  g.update = (dt) => {
    if (g.over) return;
    g.time += dt;
    g.inv = Math.max(0, g.inv - dt);
    g.shake = Math.max(0, g.shake - dt);
    g.bannerT = Math.max(0, g.bannerT - dt);

    // movement inside the ring
    const sp = 175;
    const m = g.move || { mx: 0, my: 0 };
    if (m.drag) {
      g.p.x += clamp(m.drag.tx - g.p.x, -sp * dt * 1.4, sp * dt * 1.4);
      g.p.y += clamp(m.drag.ty - g.p.y, -sp * dt * 1.4, sp * dt * 1.4);
    } else if (m.mx || m.my) {
      const l = Math.hypot(m.mx, m.my);
      g.p.x += (m.mx / l) * sp * dt;
      g.p.y += (m.my / l) * sp * dt;
    }
    const dx = g.p.x - ARENA.x, dy = g.p.y - ARENA.y, dd = Math.hypot(dx, dy);
    const lim = ARENA.r - g.p.r;
    if (dd > lim) { g.p.x = ARENA.x + (dx / dd) * lim; g.p.y = ARENA.y + (dy / dd) * lim; }

    // spawning ramps up through the round
    g.spawnT -= dt;
    if (g.spawnT <= 0) { spawnWave(); g.spawnT = ramp(g.time, 1.6, 0.45, 50); }
    g.hailT -= dt;
    if (g.hailT <= 0) { hail(); g.hailT = ramp(g.time, 6, 2.2, 50); }
    for (let i = g.warn.length - 1; i >= 0; i--) {
      const w = g.warn[i];
      w.t -= dt;
      if (w.t <= 0) {
        const s = edgePoint(w.a);
        const tx = ARENA.x - Math.cos(w.a) * ARENA.r, ty = ARENA.y - Math.sin(w.a) * ARENA.r;
        const l = Math.hypot(tx - s.x, ty - s.y);
        g.foes.push({ type: 'hail', x: s.x, y: s.y, hp: Infinity, vx: ((tx - s.x) / l) * FOES.hail.speed, vy: ((ty - s.y) / l) * FOES.hail.speed, straight: true });
        g.warn.splice(i, 1);
      }
    }

    // auto-fire at the nearest shootable threat
    g.fireT -= dt;
    if (g.fireT <= 0) {
      let best = null, bd = 300;
      for (const f of g.foes) {
        if (f.type === 'hail') continue;
        const d = Math.hypot(f.x - g.p.x, f.y - g.p.y);
        if (d < bd) { bd = d; best = f; }
      }
      if (best) {
        const a = Math.atan2(best.y - g.p.y, best.x - g.p.x);
        g.seeds.push({ x: g.p.x, y: g.p.y, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, life: 0.8, dmg: 1 });
        g.fireT = Math.max(0.14, g.rate - g.time / 600);
      } else g.fireT = 0.05;
    }

    for (let i = g.seeds.length - 1; i >= 0; i--) {
      const s = g.seeds[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      let gone = s.life <= 0;
      for (let j = g.foes.length - 1; j >= 0 && !gone; j--) {
        const f = g.foes[j];
        if (f.type === 'hail') continue;
        if (Math.hypot(f.x - s.x, f.y - s.y) < FOES[f.type].r + 4) {
          f.hp -= s.dmg;
          gone = true;
          if (f.hp <= 0) kill(f, j);
          else g.fx.burst(s.x, s.y, '#EAF2E2', 3, 60, 0.2);
        }
      }
      if (gone) g.seeds.splice(i, 1);
    }

    for (let i = g.foes.length - 1; i >= 0; i--) {
      const f = g.foes[i];
      const def = FOES[f.type];
      if (f.straight) {
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (Math.hypot(f.x - ARENA.x, f.y - ARENA.y) > ARENA.r + 60) { g.foes.splice(i, 1); continue; }
      } else {
        const ax = g.p.x - f.x, ay = g.p.y - f.y, l = Math.hypot(ax, ay) || 1;
        let vx = (ax / l) * def.speed, vy = (ay / l) * def.speed;
        if (f.type === 'wasp') { f.wob += dt * 7; vx += (-ay / l) * Math.sin(f.wob) * 120; vy += (ax / l) * Math.sin(f.wob) * 120; }
        f.x += (vx + f.vx) * dt; f.y += (vy + f.vy) * dt;
        f.vx *= 0.9; f.vy *= 0.9;
      }
      if (Math.hypot(f.x - g.p.x, f.y - g.p.y) < def.r + g.p.r - 3) {
        hurt(f.type);
        if (f.type !== 'hail') { g.fx.burst(f.x, f.y, def.color, 8, 120, 0.4); g.foes.splice(i, 1); }
        if (g.over) return;
      }
    }

    for (let i = g.drops.length - 1; i >= 0; i--) {
      const d = g.drops[i];
      d.t -= dt;
      if (Math.hypot(d.x - g.p.x, d.y - g.p.y) < 26) {
        if (g.hp < 3) { g.hp += 1; say('Water drop: +1 health', PALETTE.rain); } else { g.score += 20; }
        g.drops.splice(i, 1);
      } else if (d.t <= 0) g.drops.splice(i, 1);
    }

    g.score += dt * 4;
    if (g.time >= SURVIVE) {
      g.won = true; g.over = true;
      g.score += 150;
      g.reason = `You held the clearing for the full ${SURVIVE} seconds.`;
    }
    g.fx.update(dt, 0);
    g.floats.update(dt);
  };

  g.draw = (ctx) => {
    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7);
    ctx.fillStyle = '#1B3026';
    ctx.fillRect(0, 0, VW, VH);
    // undergrowth outside the ring
    for (let k = 0; k < 60; k++) {
      const a = k * 2.4, r = ARENA.r + 30 + (k * 37) % 180;
      ctx.fillStyle = k % 3 ? 'rgba(95,181,68,0.22)' : 'rgba(61,102,80,0.5)';
      circle(ctx, ARENA.x + Math.cos(a) * r, ARENA.y + Math.sin(a) * r, 14 + (k % 5) * 4); ctx.fill();
    }
    // the clearing
    const soil = ctx.createRadialGradient(ARENA.x, ARENA.y, 20, ARENA.x, ARENA.y, ARENA.r);
    soil.addColorStop(0, '#5A4128'); soil.addColorStop(1, '#3A2A1B');
    ctx.fillStyle = soil; circle(ctx, ARENA.x, ARENA.y, ARENA.r); ctx.fill();
    ctx.strokeStyle = 'rgba(139,224,106,0.4)'; ctx.lineWidth = 3; circle(ctx, ARENA.x, ARENA.y, ARENA.r); ctx.stroke();

    // hail warnings
    for (const w of g.warn) {
      const s = edgePoint(w.a, ARENA.r);
      ctx.strokeStyle = `rgba(226,86,74,${0.4 + 0.5 * Math.sin(w.t * 20) ** 2})`; ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(ARENA.x - Math.cos(w.a) * ARENA.r, ARENA.y - Math.sin(w.a) * ARENA.r); ctx.stroke();
      ctx.setLineDash([]);
      text(ctx, '!', s.x, s.y + 7, { size: 22, color: PALETTE.danger, align: 'center' });
    }

    for (const d of g.drops) {
      ctx.fillStyle = PALETTE.rain;
      ctx.beginPath(); ctx.moveTo(d.x, d.y - 12); ctx.quadraticCurveTo(d.x + 9, d.y + 2, d.x, d.y + 8); ctx.quadraticCurveTo(d.x - 9, d.y + 2, d.x, d.y - 12); ctx.fill();
    }
    for (const s of g.seeds) {
      ctx.fillStyle = s.dmg > 1 ? PALETTE.petal : '#E5DCC2';
      ctx.beginPath(); ctx.ellipse(s.x, s.y, 5, 3, Math.atan2(s.vy, s.vx), 0, Math.PI * 2); ctx.fill();
    }
    for (const f of g.foes) drawFoe(ctx, f, g.time);

    // you: a pod on a sturdy stem, your own plant behind it
    if (g.inv > 0 && Math.floor(g.time * 14) % 2) ctx.globalAlpha = 0.5;
    drawPlant(ctx, g.p.x, g.p.y + 10, 96, g.species, g.stage, g.time);
    const ripe = g.burstCharge >= BURST_KILLS;
    ctx.fillStyle = ripe ? PALETTE.petal : '#7FB04E';
    ctx.beginPath(); ctx.ellipse(g.p.x, g.p.y, g.p.r, g.p.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(g.p.x - g.p.r + 3, g.p.y); ctx.lineTo(g.p.x + g.p.r - 3, g.p.y); ctx.stroke();
    if (ripe) { ctx.strokeStyle = `rgba(255,126,168,${0.5 + 0.4 * Math.sin(g.time * 8)})`; ctx.lineWidth = 3; circle(ctx, g.p.x, g.p.y, g.p.r + 8); ctx.stroke(); }
    ctx.globalAlpha = 1;

    g.fx.draw(ctx);
    g.floats.draw(ctx);
    ctx.restore();

    hudBar(ctx, { score: Math.floor(g.score), label: `${Math.max(0, Math.ceil(SURVIVE - g.time))} s left`, right: '♥'.repeat(Math.max(0, g.hp)) });
    // pod ripeness meter
    text(ctx, 'Pod', 14, 72, { size: 13, color: PALETTE.petal, font: 'Karla, sans-serif' });
    rr(ctx, 46, 62, 150, 12, 6); ctx.fillStyle = 'rgba(18,33,26,0.8)'; ctx.fill();
    rr(ctx, 46, 62, (150 * g.burstCharge) / BURST_KILLS, 12, 6); ctx.fillStyle = PALETTE.petal; ctx.fill();
    if (g.bannerT > 0) {
      ctx.globalAlpha = Math.min(1, g.bannerT * 2);
      text(ctx, g.banner, VW / 2, 150, { size: 19, color: g.bannerColor, align: 'center' });
      ctx.globalAlpha = 1;
    }
    if (g.time < 4) text(ctx, 'WASD / drag to move · seeds fire themselves · dodge the hail', VW / 2, 650, { size: 13, color: 'rgba(234,242,226,0.75)', align: 'center', font: 'Karla, sans-serif', weight: 600 });
  };

  g.result = () => ({
    score: Math.floor(g.score),
    sun: Math.max(1, Math.floor(g.score * SUN_RATE.storm)),
    won: g.won,
    reason: g.reason || 'Round over.',
    stats: [
      ['Survived', `${Math.floor(g.time)} s`],
      ['Pests stopped', g.kills],
      ['Pod bursts', g.bursts],
    ],
    lesson: 'Some plants throw their own seeds. Pods dry unevenly, tension builds in the walls, and they split violently. The sandbox tree flings seeds at over 200 km/h, and getting them away from the parent means less competition for light and water.',
  });

  return g;
}

function drawFoe(ctx, f, t) {
  const def = FOES[f.type];
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.fillStyle = def.color;
  if (f.type === 'hail') {
    circle(ctx, 0, 0, def.r); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; circle(ctx, -3, -3, 3); ctx.fill();
  } else if (f.type === 'aphid') {
    ctx.beginPath(); ctx.ellipse(0, 0, def.r, def.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  } else if (f.type === 'wasp') {
    ctx.beginPath(); ctx.ellipse(0, 0, def.r, def.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2B2410'; ctx.fillRect(-2, -def.r * 0.6, 3, def.r * 1.2); ctx.fillRect(4, -def.r * 0.5, 3, def.r);
    ctx.fillStyle = 'rgba(234,242,226,0.6)';
    const flap = Math.sin(t * 40) * 3;
    ctx.beginPath(); ctx.ellipse(0, -def.r * 0.8, 6, 3 + flap * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  } else if (f.type === 'beetle') {
    ctx.beginPath(); ctx.ellipse(0, 0, def.r, def.r * 1.1, Math.atan2(f.y, f.x), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -def.r); ctx.lineTo(0, def.r); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(0, 0, def.r * 1.3, def.r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = def.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(def.r, -4); ctx.lineTo(def.r + 6, -12); ctx.moveTo(def.r - 4, -6); ctx.lineTo(def.r, -14); ctx.stroke();
  }
  if (Number.isFinite(f.max) && f.max > 1 && f.hp < f.max) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-12, -def.r - 9, 24, 4);
    ctx.fillStyle = PALETTE.chloro; ctx.fillRect(-12, -def.r - 9, 24 * (f.hp / f.max), 4);
  }
  ctx.restore();
}
