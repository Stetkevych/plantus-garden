// plant-survivors.js — Survivor-like. You do not attack; your thorns fire themselves.
// Your job is positioning: the pests are not hunting you, they are hunting the three plants.
// Every upgrade on offer is a real plant defence strategy.

import { VW, VH, rr, circle, text, hudBar, Particles, Floaters, clamp, rand, pick } from '../core/engine.js';
import { PALETTE, SUN_RATE, HAZARDS } from '../data/config.js';
import { drawPlant } from '../core/plantart.js';

const TOP = 46;
const SURVIVE = 120;

const PESTS = {
  caterpillar: { hp: 26, speed: 34, dmg: 5,  r: 13, xp: 2, color: '#A8D46A' },
  beetle:      { hp: 18, speed: 68, dmg: 4,  r: 11, xp: 3, color: '#C97B3A' },
  spider:      { hp: 30, speed: 44, dmg: 7,  r: 13, xp: 4, color: '#7B6FA8' },
  fungus:      { hp: 22, speed: 26, dmg: 8,  r: 14, xp: 3, color: '#C79BE8' },
};

const UPGRADES = [
  { id: 'rate',   name: 'Faster thorns',   desc: 'Thorns fire 18% more often.',            bio: 'Constant low-level defence is cheaper than one big response.' },
  { id: 'count',  name: 'More thorns',     desc: 'One extra thorn per volley.',            bio: 'Prickles are skin outgrowths — plants make them by the thousand.' },
  { id: 'dmg',    name: 'Sharper thorns',  desc: 'Thorns hit 30% harder.',                 bio: 'Sharper points mean less energy spent per attacker.' },
  { id: 'speed',  name: 'Quick footing',   desc: 'You move 15% faster.',                   bio: 'Getting between pest and plant beats out-damaging it.' },
  { id: 'nova',   name: 'Pollen nova',     desc: 'A pollen burst pushes pests back.',      bio: 'Some plants release irritant powders when disturbed.' },
  { id: 'bark',   name: 'Thicker bark',    desc: 'Plants take 25% less damage.',           bio: 'Bark is dead corky armour over the living phloem.' },
  { id: 'heal',   name: 'Root recovery',   desc: 'Plants slowly regrow health.',           bio: 'Stored root sugar lets a chewed plant rebuild leaves.' },
  { id: 'magnet', name: 'Wider roots',     desc: 'Collect pollen from further away.',      bio: 'Root systems usually spread wider than the canopy above.' },
];

export function createPlantSurvivors() {
  const g = {
    p: { x: VW / 2, y: 470, r: 13, hp: 5, inv: 0 },
    plants: [
      { x: 100, y: 250, hp: 170, max: 170, sp: 'sunflower' },
      { x: 240, y: 170, hp: 170, max: 170, sp: 'rose' },
      { x: 380, y: 250, hp: 170, max: 170, sp: 'oak' },
    ],
    pests: [],
    thorns: [],
    orbs: [],
    drops: [],
    fx: new Particles(),
    floats: new Floaters(),
    time: 0,
    score: 0,
    kills: 0,
    level: 1,
    xp: 0,
    xpNeed: 6,
    fireT: 0,
    rate: 0.62,
    count: 1,
    dmg: 11,
    moveSpeed: 165,
    magnet: 70,
    barkRes: 0,
    healRate: 0,
    novaT: 0,
    novaEvery: 0,
    spawnT: 2.6,
    dblT: 0,
    invT: 0,
    choosing: null,
    over: false,
    reason: '',
    t: 0,
    shake: 0,
    banner: '',
    bannerT: 0,
  };

  const alive = () => g.plants.filter((p) => p.hp > 0);

  function spawnPest() {
    const wave = 1 + g.time / 26;
    const pool = g.time < 25 ? ['caterpillar'] : g.time < 55 ? ['caterpillar', 'beetle'] : g.time < 95 ? ['caterpillar', 'beetle', 'spider'] : Object.keys(PESTS);
    const type = pick(pool);
    const base = PESTS[type];
    const edge = Math.floor(rand(0, 4));
    let x, y;
    if (edge === 0) { x = rand(0, VW); y = TOP - 20; }
    else if (edge === 1) { x = rand(0, VW); y = VH + 20; }
    else if (edge === 2) { x = -20; y = rand(TOP, VH); }
    else { x = VW + 20; y = rand(TOP, VH); }
    g.pests.push({
      type, x, y,
      hp: base.hp * (1 + wave * 0.13),
      max: base.hp * (1 + wave * 0.13),
      speed: base.speed * (1 + wave * 0.038),
      r: base.r, flash: 0, t: rand(0, 6),
    });
  }

  function damagePest(pest, amount, fromX, fromY) {
    pest.hp -= amount;
    pest.flash = 0.12;
    if (pest.hp <= 0) {
      g.pests = g.pests.filter((p) => p !== pest);
      g.kills += 1;
      g.score += 12;
      g.fx.burst(pest.x, pest.y, PESTS[pest.type].color, 12, 130, 0.5);
      g.orbs.push({ x: pest.x, y: pest.y, v: PESTS[pest.type].xp, t: 0 });
      if (pest.type === 'fungus' && !pest.split) {
        for (let i = 0; i < 2; i++) {
          g.pests.push({ type: 'fungus', x: pest.x + rand(-14, 14), y: pest.y + rand(-14, 14), hp: 10, max: 10, speed: 40, r: 9, flash: 0, t: 0, split: true });
        }
      }
      if (Math.random() < 0.055) {
        g.drops.push({ x: pest.x, y: pest.y, type: pick(['supersun', 'waterdrop', 'barkshield', 'superbloom', 'butterfly']), life: 12 });
      }
    }
  }

  function fire() {
    if (!g.pests.length) return;
    const sorted = g.pests.slice().sort((a, b) => Math.hypot(a.x - g.p.x, a.y - g.p.y) - Math.hypot(b.x - g.p.x, b.y - g.p.y));
    for (let i = 0; i < g.count; i++) {
      const target = sorted[Math.min(i, sorted.length - 1)];
      const a = Math.atan2(target.y - g.p.y, target.x - g.p.x) + (i > 0 ? rand(-0.12, 0.12) : 0);
      g.thorns.push({ x: g.p.x, y: g.p.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 1.5 });
    }
  }

  function levelUp() {
    g.level += 1;
    g.xp -= g.xpNeed;
    g.xpNeed = Math.round(g.xpNeed * 1.42 + 2);
    const pool = UPGRADES.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    g.choosing = pool;
  }

  function apply(u) {
    if (u.id === 'rate') g.rate *= 0.82;
    if (u.id === 'count') g.count += 1;
    if (u.id === 'dmg') g.dmg *= 1.3;
    if (u.id === 'speed') g.moveSpeed *= 1.15;
    if (u.id === 'nova') { g.novaEvery = g.novaEvery ? g.novaEvery * 0.75 : 5; }
    if (u.id === 'bark') g.barkRes = Math.min(0.7, g.barkRes + 0.25);
    if (u.id === 'heal') g.healRate += 1.6;
    if (u.id === 'magnet') g.magnet += 55;
    g.choosing = null;
    g.banner = u.name; g.bannerT = 1.6;
  }

  function takeDrop(d) {
    const c = { supersun: PALETTE.pollen, waterdrop: PALETTE.rain, barkshield: PALETTE.barkLt, superbloom: PALETTE.petal, butterfly: '#FF9F45' }[d.type];
    g.fx.burst(d.x, d.y, c, 22, 180);
    if (d.type === 'supersun') { g.dblT = 8; g.banner = 'Super Sun — double damage'; }
    if (d.type === 'waterdrop') { g.plants.forEach((p) => { if (p.hp > 0) p.hp = Math.min(p.max, p.hp + 30); }); g.banner = 'Water Drop — plants recover'; }
    if (d.type === 'barkshield') { g.invT = 7; g.banner = 'Bark Shield — you are armoured'; }
    if (d.type === 'superbloom') {
      g.pests.forEach((p) => damagePest(p, 45, g.p.x, g.p.y));
      g.fx.burst(g.p.x, g.p.y, PALETTE.petal, 50, 300, 1.0);
      g.banner = 'Super Bloom';
    }
    if (d.type === 'butterfly') { g.orbs.forEach((o) => (o.pull = true)); g.banner = 'Butterfly — pollen drawn in'; }
    g.bannerT = 1.6;
  }

  g.update = (dt) => {
    if (g.choosing) { g.t += dt; return; }
    g.t += dt;
    g.time += dt;
    g.shake = Math.max(0, g.shake - dt);
    g.bannerT = Math.max(0, g.bannerT - dt);
    g.p.inv = Math.max(0, g.p.inv - dt);
    g.dblT = Math.max(0, g.dblT - dt);
    g.invT = Math.max(0, g.invT - dt);
    g.fx.update(dt, 0);
    g.floats.update(dt);
    g.score += dt * 6;

    if (g.healRate) g.plants.forEach((p) => { if (p.hp > 0) p.hp = Math.min(p.max, p.hp + g.healRate * dt); });

    g.spawnT -= dt;
    if (g.spawnT <= 0) {
      const n = 1 + Math.floor(g.time / 52);
      for (let i = 0; i < n; i++) spawnPest();
      g.spawnT = clamp(2.1 - g.time * 0.0080, 0.52, 2.1);
    }

    g.fireT -= dt;
    if (g.fireT <= 0) { fire(); g.fireT = g.rate; }

    if (g.novaEvery) {
      g.novaT -= dt;
      if (g.novaT <= 0) {
        g.novaT = g.novaEvery;
        g.fx.burst(g.p.x, g.p.y, PALETTE.pollen, 26, 220, 0.6);
        for (const p of g.pests) {
          const d = Math.hypot(p.x - g.p.x, p.y - g.p.y);
          if (d < 110) {
            const a = Math.atan2(p.y - g.p.y, p.x - g.p.x);
            p.x += Math.cos(a) * 34; p.y += Math.sin(a) * 34;
            damagePest(p, g.dmg * 0.8 * (g.dblT > 0 ? 2 : 1));
          }
        }
      }
    }

    for (let i = g.thorns.length - 1; i >= 0; i--) {
      const th = g.thorns[i];
      th.x += th.vx * dt; th.y += th.vy * dt; th.life -= dt;
      if (th.life <= 0 || th.x < -20 || th.x > VW + 20 || th.y < TOP - 20 || th.y > VH + 20) { g.thorns.splice(i, 1); continue; }
      for (const p of g.pests) {
        if (Math.hypot(p.x - th.x, p.y - th.y) < p.r + 4) {
          damagePest(p, g.dmg * (g.dblT > 0 ? 2 : 1));
          g.thorns.splice(i, 1);
          break;
        }
      }
    }

    const living = alive();
    for (const p of g.pests) {
      p.t += dt;
      p.flash = Math.max(0, p.flash - dt);
      let tx = g.p.x, ty = g.p.y;
      if (living.length) {
        let best = living[0], bd = 1e9;
        for (const pl of living) {
          const d = Math.hypot(pl.x - p.x, pl.y - p.y);
          if (d < bd) { bd = d; best = pl; }
        }
        tx = best.x; ty = best.y;
        if (bd < 34) {
          best.hp -= PESTS[p.type].dmg * (1 - g.barkRes) * dt;
          if (best.hp <= 0) {
            best.hp = 0;
            g.shake = 0.5;
            g.floats.add(best.x, best.y - 40, 'plant lost', PALETTE.danger, 17);
            g.fx.burst(best.x, best.y, PALETTE.danger, 30, 200);
          }
          continue;
        }
      }
      const a = Math.atan2(ty - p.y, tx - p.x);
      p.x += Math.cos(a) * p.speed * dt;
      p.y += Math.sin(a) * p.speed * dt;

      if (g.p.inv <= 0 && g.invT <= 0 && Math.hypot(p.x - g.p.x, p.y - g.p.y) < p.r + g.p.r) {
        g.p.hp -= 1;
        g.p.inv = 1.1;
        g.shake = 0.35;
        g.fx.burst(g.p.x, g.p.y, PALETTE.danger, 16, 150);
        if (g.p.hp <= 0) { g.over = true; g.reason = 'The gardener was overrun.'; }
      }
    }

    for (let i = g.orbs.length - 1; i >= 0; i--) {
      const o = g.orbs[i];
      o.t += dt;
      const d = Math.hypot(o.x - g.p.x, o.y - g.p.y);
      if (d < g.magnet || o.pull) {
        const a = Math.atan2(g.p.y - o.y, g.p.x - o.x);
        const s = o.pull ? 300 : 200;
        o.x += Math.cos(a) * s * dt; o.y += Math.sin(a) * s * dt;
      }
      if (d < 16) {
        g.orbs.splice(i, 1);
        g.xp += o.v;
        g.score += 4;
        if (g.xp >= g.xpNeed) levelUp();
      }
    }

    for (let i = g.drops.length - 1; i >= 0; i--) {
      const d = g.drops[i];
      d.life -= dt;
      if (d.life <= 0) { g.drops.splice(i, 1); continue; }
      if (Math.hypot(d.x - g.p.x, d.y - g.p.y) < 22) { takeDrop(d); g.drops.splice(i, 1); }
    }

    if (!alive().length) { g.over = true; g.reason = 'Every plant was destroyed.'; }
    if (g.time >= SURVIVE) {
      g.score += alive().length * 400 + 600;
      g.over = true;
      g.reason = 'You held the beds for the full season.';
    }
  };

  g.input = (input) => {
    if (g.choosing) {
      const cards = cardRects();
      if (input.pointer.justDown) {
        cards.forEach((r, i) => {
          const p = input.pointer;
          if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) apply(g.choosing[i]);
        });
      }
      if (input.hit('1')) apply(g.choosing[0]);
      if (input.hit('2')) apply(g.choosing[1]);
      if (input.hit('3')) apply(g.choosing[2]);
      return;
    }
    let dx = 0, dy = 0;
    if (input.key('arrowleft', 'a')) dx -= 1;
    if (input.key('arrowright', 'd')) dx += 1;
    if (input.key('arrowup', 'w')) dy -= 1;
    if (input.key('arrowdown', 's')) dy += 1;
    if (input.pointer.down) {
      const ddx = input.pointer.x - g.p.x, ddy = input.pointer.y - g.p.y;
      if (Math.hypot(ddx, ddy) > 8) { dx = ddx; dy = ddy; }
    }
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      const dt = 1 / 60;
      g.p.x = clamp(g.p.x + (dx / len) * g.moveSpeed * dt, 14, VW - 14);
      g.p.y = clamp(g.p.y + (dy / len) * g.moveSpeed * dt, TOP + 14, VH - 14);
    }
  };

  function cardRects() {
    return [0, 1, 2].map((i) => ({ x: 30, y: 200 + i * 128, w: VW - 60, h: 112 }));
  }

  g.draw = (ctx) => {
    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7);

    ctx.fillStyle = '#233A2C';
    ctx.fillRect(0, TOP, VW, VH - TOP);
    ctx.strokeStyle = 'rgba(139,224,106,0.05)';
    for (let i = 0; i < 20; i++) {
      ctx.beginPath(); ctx.moveTo(0, TOP + i * 36); ctx.lineTo(VW, TOP + i * 36); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * 36, TOP); ctx.lineTo(i * 36, VH); ctx.stroke();
    }

    for (const p of g.plants) {
      if (p.hp <= 0) {
        ctx.globalAlpha = 0.28;
        drawPlant(ctx, p.x, p.y + 30, 96, p.sp, 1, g.t);
        ctx.globalAlpha = 1;
        continue;
      }
      const frac = p.hp / p.max;
      ctx.fillStyle = 'rgba(18,33,26,0.5)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 30, 34, 10, 0, 0, Math.PI * 2); ctx.fill();
      drawPlant(ctx, p.x, p.y + 30, 96, p.sp, frac > 0.75 ? 5 : frac > 0.45 ? 4 : frac > 0.2 ? 2 : 1, g.t);
      ctx.fillStyle = 'rgba(18,33,26,0.8)';
      rr(ctx, p.x - 26, p.y + 36, 52, 7, 3.5); ctx.fill();
      ctx.fillStyle = frac > 0.5 ? PALETTE.chloro : frac > 0.25 ? PALETTE.pollen : PALETTE.danger;
      rr(ctx, p.x - 26, p.y + 36, 52 * frac, 7, 3.5); ctx.fill();
    }

    for (const d of g.drops) {
      const c = { supersun: PALETTE.pollen, waterdrop: PALETTE.rain, barkshield: PALETTE.barkLt, superbloom: PALETTE.petal, butterfly: '#FF9F45' }[d.type];
      ctx.globalAlpha = d.life < 3 && Math.floor(d.life * 6) % 2 === 0 ? 0.4 : 1;
      ctx.fillStyle = c;
      circle(ctx, d.x, d.y, 11 + Math.sin(g.t * 6) * 1.5); ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (const o of g.orbs) {
      ctx.fillStyle = PALETTE.pollen;
      circle(ctx, o.x, o.y, 4.5 + Math.sin(g.t * 8 + o.t) * 0.8); ctx.fill();
      ctx.globalAlpha = 0.3;
      circle(ctx, o.x, o.y, 9); ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (const p of g.pests) drawPest(ctx, p, g.t);

    ctx.strokeStyle = PALETTE.chloro;
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const th of g.thorns) {
      ctx.beginPath();
      ctx.moveTo(th.x, th.y);
      ctx.lineTo(th.x - th.vx * 0.018, th.y - th.vy * 0.018);
      ctx.stroke();
    }

    // gardener
    const blink = g.p.inv > 0 && Math.floor(g.t * 14) % 2 === 0;
    ctx.globalAlpha = blink ? 0.4 : 1;
    if (g.invT > 0) {
      ctx.strokeStyle = PALETTE.barkLt; ctx.lineWidth = 3;
      circle(ctx, g.p.x, g.p.y, 24 + Math.sin(g.t * 6) * 2); ctx.stroke();
    }
    if (g.magnet > 70) {
      ctx.strokeStyle = 'rgba(255,201,60,0.10)';
      ctx.lineWidth = 1.5;
      circle(ctx, g.p.x, g.p.y, g.magnet); ctx.stroke();
    }
    ctx.fillStyle = PALETTE.chloro;
    circle(ctx, g.p.x, g.p.y, 13); ctx.fill();
    ctx.fillStyle = PALETTE.ink;
    circle(ctx, g.p.x - 4, g.p.y - 3, 2.2); ctx.fill();
    circle(ctx, g.p.x + 4, g.p.y - 3, 2.2); ctx.fill();
    ctx.fillStyle = PALETTE.chloroDk;
    ctx.beginPath(); ctx.ellipse(g.p.x, g.p.y - 15, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    g.fx.draw(ctx);
    g.floats.draw(ctx);
    ctx.restore();

    const left = Math.max(0, Math.ceil(SURVIVE - g.time));
    hudBar(ctx, { score: Math.floor(g.score), label: `LV ${g.level}`, right: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` });

    // xp bar
    ctx.fillStyle = 'rgba(18,33,26,0.85)';
    ctx.fillRect(0, 46, VW, 8);
    ctx.fillStyle = PALETTE.pollen;
    ctx.fillRect(0, 46, VW * clamp(g.xp / g.xpNeed, 0, 1), 8);

    for (let i = 0; i < g.p.hp; i++) {
      ctx.fillStyle = PALETTE.petal;
      circle(ctx, 16 + i * 17, 70, 6); ctx.fill();
    }
    if (g.dblT > 0) text(ctx, 'SUPER SUN', VW - 14, 74, { size: 13, color: PALETTE.pollen, align: 'right' });

    if (g.bannerT > 0) {
      ctx.globalAlpha = Math.min(1, g.bannerT);
      text(ctx, g.banner, VW / 2, 104, { size: 18, color: PALETTE.chloro, align: 'center' });
      ctx.globalAlpha = 1;
    }

    if (g.choosing) {
      ctx.fillStyle = 'rgba(10,20,15,0.88)';
      ctx.fillRect(0, 0, VW, VH);
      text(ctx, `Level ${g.level}`, VW / 2, 130, { size: 34, color: PALETTE.paper, align: 'center' });
      text(ctx, 'Pick one defence', VW / 2, 158, { size: 15, color: 'rgba(234,242,226,0.6)', align: 'center', font: 'Karla, sans-serif', weight: 600 });
      cardRects().forEach((r, i) => {
        const u = g.choosing[i];
        ctx.fillStyle = '#1E3529';
        rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.fill();
        ctx.strokeStyle = PALETTE.chloro; ctx.lineWidth = 2;
        rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.stroke();
        text(ctx, `${i + 1}`, r.x + 22, r.y + 34, { size: 18, color: PALETTE.pollen });
        text(ctx, u.name, r.x + 46, r.y + 34, { size: 21, color: PALETTE.paper });
        text(ctx, u.desc, r.x + 46, r.y + 58, { size: 14, color: PALETTE.chloro, font: 'Karla, sans-serif', weight: 600 });
        wrapText(ctx, u.bio, r.x + 46, r.y + 80, r.w - 70, 15, { size: 12, color: 'rgba(234,242,226,0.55)', font: 'Karla, sans-serif', weight: 400 });
      });
    }
  };

  g.result = () => ({
    score: Math.floor(g.score),
    sun: Math.max(1, Math.floor(g.score * SUN_RATE.survivors)),
    reason: g.reason,
    stats: [
      ['Pests cleared', g.kills],
      ['Survived', `${Math.floor(g.time)}s of ${SURVIVE}s`],
      ['Plants standing', `${alive().length} / 3`],
    ],
    lesson: 'Real plants defend themselves chemically and structurally — thorns, bitter compounds, thick bark — because they cannot run.',
  });

  return g;
}

function wrapText(ctx, str, x, y, maxW, lh, style) {
  ctx.save();
  ctx.font = `${style.weight || 400} ${style.size}px ${style.font}`;
  ctx.fillStyle = style.color;
  ctx.textAlign = 'left';
  const words = str.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
  ctx.restore();
}

function drawPest(ctx, p, t) {
  const base = PESTS[p.type];
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = p.flash > 0 ? '#FFFFFF' : base.color;

  if (p.type === 'caterpillar') {
    for (let i = 0; i < 4; i++) {
      circle(ctx, -8 + i * 6, Math.sin(t * 8 + i) * 2, p.r * 0.55); ctx.fill();
    }
    ctx.fillStyle = PALETTE.ink;
    circle(ctx, 10, -1, 1.8); ctx.fill();
  } else if (p.type === 'beetle') {
    ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.78, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(18,33,26,0.65)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -p.r * 0.78); ctx.lineTo(0, p.r * 0.78); ctx.stroke();
  } else if (p.type === 'spider') {
    ctx.strokeStyle = p.flash > 0 ? '#FFF' : base.color;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.sin(t * 6) * 0.1;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * p.r * 1.5, Math.sin(a) * p.r * 1.5); ctx.stroke();
    }
    circle(ctx, 0, 0, p.r * 0.7); ctx.fill();
  } else {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + t;
      circle(ctx, Math.cos(a) * p.r * 0.45, Math.sin(a) * p.r * 0.45, p.r * 0.5); ctx.fill();
    }
  }

  if (p.hp < p.max) {
    ctx.fillStyle = 'rgba(18,33,26,0.7)';
    rr(ctx, -p.r, -p.r - 9, p.r * 2, 4, 2); ctx.fill();
    ctx.fillStyle = PALETTE.danger;
    rr(ctx, -p.r, -p.r - 9, p.r * 2 * (p.hp / p.max), 4, 2); ctx.fill();
  }
  ctx.restore();
}
