// bee-rush.js — Endless runner. You are a bee. Touching a flower pollinates it and it
// blooms instantly behind you. Consecutive hits build a pollination combo; the Bee Swarm
// booster splits you into 3 then 5 bees so you cover lanes you are not flying in.

import { VW, VH, rr, circle, text, hudBar, Particles, Floaters, clamp, rand, pick } from '../core/engine.js';
import { PALETTE, SUN_RATE } from '../data/config.js';

const LANES = [96, 240, 384];
const BEE_Y = 560;
const GROUND = 620;

const OBSTACLES = {
  web:       { name: 'Spider web', h: 54, ground: false, color: 'rgba(234,242,226,0.55)' },
  raindrop:  { name: 'Raindrop',   h: 40, ground: false, color: PALETTE.rain },
  bird:      { name: 'Bird',       h: 46, ground: false, color: '#8FA9C9' },
  branch:    { name: 'Branch',     h: 34, ground: true,  color: PALETTE.bark },
  sprinkler: { name: 'Sprinkler',  h: 44, ground: true,  color: '#63C7F0' },
  leaf:      { name: 'Falling leaf', h: 36, ground: false, color: '#C6E86A' },
  structure: { name: 'Trellis',    h: 40, ground: true,  color: '#6E4629' },
};

const BOOSTS = {
  life:    { name: 'Extra life',       color: PALETTE.petal },
  shield:  { name: 'Pollen shield',    color: PALETTE.pollen },
  speed:   { name: 'Bee speed',        color: '#FF9F45' },
  magnet:  { name: 'Pollen magnet',    color: '#C79BE8' },
  superp:  { name: 'Super pollination', color: PALETTE.chloro },
  swarm:   { name: 'Bee swarm',        color: PALETTE.pollen },
};

export function createBeeRush() {
  const g = {
    lane: 1,
    x: LANES[1],
    hop: 0,
    speed: 300,
    dist: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    pollinated: 0,
    lives: 2,
    shield: false,
    magnetT: 0,
    superT: 0,
    speedT: 0,
    swarm: 1,
    swarmT: 0,
    invuln: 0,
    items: [],
    spawnT: 0,
    fx: new Particles(),
    floats: new Floaters(),
    scroll: 0,
    t: 0,
    over: false,
    reason: '',
    shake: 0,
    banner: '',
    bannerT: 0,
  };

  const mult = () => (g.combo >= 15 ? 4 : g.combo >= 10 ? 3 : g.combo >= 5 ? 2 : 1);

  function say(msg, color = PALETTE.pollen) { g.banner = msg; g.bannerT = 1.5; g.bannerColor = color; }

  function spawn() {
    const laneSet = [0, 1, 2];
    const roll = Math.random();

    if (roll < 0.10) {
      const type = pick(Object.keys(BOOSTS));
      g.items.push({ kind: 'boost', type, lane: pick(laneSet), y: -50, wob: Math.random() * 6 });
      return;
    }

    // Never fill all three lanes with obstacles — always leave a way through.
    const blocked = Math.random() < 0.45 ? 2 : 1;
    const shuffled = laneSet.sort(() => Math.random() - 0.5);
    const obsLanes = shuffled.slice(0, blocked);
    const freeLanes = shuffled.slice(blocked);

    for (const l of obsLanes) {
      g.items.push({ kind: 'obstacle', type: pick(Object.keys(OBSTACLES)), lane: l, y: -50, wob: Math.random() * 6 });
    }
    for (const l of freeLanes) {
      if (Math.random() < 0.85) {
        g.items.push({ kind: 'flower', lane: l, y: -50 - rand(0, 40), hue: pick([PALETTE.petal, PALETTE.pollen, '#FF9F45', '#C79BE8']), wob: Math.random() * 6 });
      }
    }
  }

  function hitObstacle(item) {
    if (g.invuln > 0) return;
    if (g.shield) {
      g.shield = false;
      g.invuln = 1.0;
      say('Shield absorbed it', PALETTE.pollen);
      g.fx.burst(g.x, BEE_Y, PALETTE.pollen, 18, 160);
      item.dead = true;
      return;
    }
    if (g.swarm > 1) {
      g.swarm = Math.max(1, g.swarm - 2);
      g.invuln = 1.0;
      say('Lost part of the swarm', PALETTE.danger);
      g.fx.burst(g.x, BEE_Y, PALETTE.pollen, 20, 180);
      item.dead = true;
      return;
    }
    g.lives -= 1;
    g.combo = 0;
    g.shake = 0.4;
    g.invuln = 1.4;
    g.fx.burst(g.x, BEE_Y, PALETTE.danger, 24, 200);
    item.dead = true;
    if (g.lives <= 0) { g.over = true; g.reason = `${OBSTACLES[item.type].name} ended the run.`; }
    else say(`${g.lives} ${g.lives === 1 ? 'life' : 'lives'} left`, PALETTE.danger);
  }

  function pollinate(item, byLane) {
    item.dead = true;
    g.combo += 1;
    g.bestCombo = Math.max(g.bestCombo, g.combo);
    g.pollinated += 1;
    const base = g.superT > 0 ? 40 : 20;
    const pts = base * mult();
    g.score += pts;
    const px = LANES[byLane];
    g.floats.add(px, item.y, `+${pts}`, item.hue);
    g.fx.burst(px, item.y, item.hue, 14, 140, 0.6);
    if (g.combo === 5) say('Pollination combo  x2', PALETTE.chloro);
    if (g.combo === 10) say('Pollination combo  x3', PALETTE.pollen);
    if (g.combo === 15) say('SUPER POLLINATION  x4', PALETTE.petal);
  }

  function takeBoost(item) {
    item.dead = true;
    const c = BOOSTS[item.type].color;
    g.fx.burst(LANES[item.lane], item.y, c, 22, 180);
    say(BOOSTS[item.type].name, c);
    if (item.type === 'life') g.lives += 1;
    if (item.type === 'shield') g.shield = true;
    if (item.type === 'speed') g.speedT = 6;
    if (item.type === 'magnet') g.magnetT = 8;
    if (item.type === 'superp') g.superT = 7;
    if (item.type === 'swarm') { g.swarm = g.swarm === 1 ? 3 : 5; g.swarmT = 9; }
  }

  g.update = (dt) => {
    g.t += dt;
    g.shake = Math.max(0, g.shake - dt);
    g.bannerT = Math.max(0, g.bannerT - dt);
    g.invuln = Math.max(0, g.invuln - dt);
    g.magnetT = Math.max(0, g.magnetT - dt);
    g.superT = Math.max(0, g.superT - dt);
    g.speedT = Math.max(0, g.speedT - dt);
    if (g.swarmT > 0) { g.swarmT -= dt; if (g.swarmT <= 0) g.swarm = 1; }
    if (g.hop > 0) g.hop = Math.max(0, g.hop - dt);

    g.fx.update(dt, 30);
    g.floats.update(dt);

    const boost = g.speedT > 0 ? 1.45 : 1;
    g.speed = Math.min(760, 300 + g.dist * 0.030) * boost;
    g.dist += g.speed * dt;
    g.scroll = (g.scroll + g.speed * dt) % 80;
    g.score += g.speed * dt * 0.012;

    g.x += (LANES[g.lane] - g.x) * Math.min(1, dt * 16);

    g.spawnT -= dt;
    if (g.spawnT <= 0) { spawn(); g.spawnT = clamp(0.95 - g.dist * 0.000035, 0.42, 1.0); }

    // lanes the swarm covers
    const covered = g.swarm >= 5 ? [0, 1, 2] : g.swarm >= 3 ? [g.lane - 1, g.lane, g.lane + 1].filter((l) => l >= 0 && l < 3) : [g.lane];

    for (const it of g.items) {
      it.y += g.speed * dt;

      if (g.magnetT > 0 && it.kind === 'flower' && it.lane !== g.lane && it.y > 260 && it.y < BEE_Y) {
        it.lane = it.lane < g.lane ? it.lane + 1 : it.lane - 1;
      }

      const near = Math.abs(it.y - BEE_Y) < 34;
      if (!near || it.dead) continue;

      if (it.kind === 'flower' && covered.includes(it.lane)) pollinate(it, it.lane);
      else if (it.kind === 'boost' && covered.includes(it.lane)) takeBoost(it);
      else if (it.kind === 'obstacle' && it.lane === g.lane) {
        const isGround = OBSTACLES[it.type].ground;
        if (isGround && g.hop > 0) { /* hopped it */ }
        else hitObstacle(it);
      }
    }

    g.items = g.items.filter((it) => {
      if (it.dead) return false;
      if (it.y > VH + 60) {
        if (it.kind === 'flower') g.combo = 0;   // a missed flower breaks the chain
        return false;
      }
      return true;
    });
  };

  g.input = (input) => {
    if (input.hit('arrowleft', 'a') || input.swipe === 'left') g.lane = Math.max(0, g.lane - 1);
    if (input.hit('arrowright', 'd') || input.swipe === 'right') g.lane = Math.min(2, g.lane + 1);
    if (input.hit('arrowup', 'w', ' ') || input.swipe === 'up') { if (g.hop <= 0) g.hop = 0.55; }
  };

  g.draw = (ctx) => {
    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7);

    const sky = ctx.createLinearGradient(0, 0, 0, VH);
    sky.addColorStop(0, '#2B4C5E');
    sky.addColorStop(0.55, '#2C5340');
    sky.addColorStop(1, '#1B3026');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VW, VH);

    // lane beds
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(139,224,106,0.05)' : 'rgba(139,224,106,0.09)';
      ctx.fillRect(LANES[i] - 66, 46, 132, VH - 46);
    }
    ctx.strokeStyle = 'rgba(234,242,226,0.10)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const x = (LANES[i] + LANES[i + 1]) / 2;
      ctx.setLineDash([26, 34]);
      ctx.lineDashOffset = -g.scroll;
      ctx.beginPath(); ctx.moveTo(x, 46); ctx.lineTo(x, VH); ctx.stroke();
    }
    ctx.setLineDash([]);

    // speed streaks
    ctx.strokeStyle = 'rgba(234,242,226,0.07)';
    for (let i = 0; i < 14; i++) {
      const y = ((i * 80) + g.scroll * 2) % (VH + 80) - 40;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke();
    }

    for (const it of g.items) {
      const x = LANES[it.lane];
      if (it.kind === 'flower') drawFlower(ctx, x, it.y, it.hue, g.t + it.wob);
      else if (it.kind === 'boost') drawBoost(ctx, x, it.y, it.type, g.t + it.wob);
      else drawObstacle(ctx, x, it.y, it.type, g.t + it.wob);
    }

    // bees
    const lift = Math.sin((1 - g.hop / 0.55) * Math.PI) * 34 * (g.hop > 0 ? 1 : 0);
    const positions = g.swarm >= 5
      ? [[LANES[0], BEE_Y + 22], [LANES[1], BEE_Y + 22], [LANES[2], BEE_Y + 22], [g.x - 30, BEE_Y - 26], [g.x + 30, BEE_Y - 26]]
      : g.swarm >= 3
        ? [[g.x - 62, BEE_Y + 14], [g.x + 62, BEE_Y + 14], [g.x, BEE_Y]]
        : [[g.x, BEE_Y]];

    if (g.hop > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(g.x, BEE_Y + 26, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    const blink = g.invuln > 0 && Math.floor(g.t * 14) % 2 === 0;
    ctx.globalAlpha = blink ? 0.35 : 1;
    for (const [bx, by] of positions) drawBee(ctx, bx, by - lift, g.t, g.shield);
    ctx.globalAlpha = 1;

    g.fx.draw(ctx);
    g.floats.draw(ctx);
    ctx.restore();

    hudBar(ctx, {
      score: Math.floor(g.score),
      label: `${Math.floor(g.dist / 10)}m`,
      right: `${'♥'.repeat(Math.min(5, g.lives))}${g.shield ? '  ⬡' : ''}`,
    });

    if (g.combo >= 2) {
      const m = mult();
      ctx.fillStyle = m >= 3 ? PALETTE.petal : PALETTE.chloro;
      rr(ctx, VW / 2 - 62, 54, 124, 26, 13); ctx.fill();
      text(ctx, `${g.combo} in a row  ×${m}`, VW / 2, 72, { size: 14, color: PALETTE.ink, align: 'center' });
    }
    if (g.swarm > 1) text(ctx, `SWARM ×${g.swarm}`, VW - 14, 100, { size: 13, color: PALETTE.pollen, align: 'right' });
    if (g.superT > 0) text(ctx, 'SUPER POLLINATION', VW - 14, 118, { size: 13, color: PALETTE.chloro, align: 'right' });
    if (g.magnetT > 0) text(ctx, 'MAGNET', VW - 14, 136, { size: 13, color: '#C79BE8', align: 'right' });

    if (g.bannerT > 0) {
      ctx.globalAlpha = Math.min(1, g.bannerT);
      text(ctx, g.banner, VW / 2, 130, { size: 20, color: g.bannerColor || PALETTE.pollen, align: 'center' });
      ctx.globalAlpha = 1;
    }
  };

  g.result = () => ({
    score: Math.floor(g.score),
    sun: Math.max(1, Math.floor(g.score * SUN_RATE.bee)),
    reason: g.reason || 'Run complete.',
    stats: [
      ['Flowers pollinated', g.pollinated],
      ['Best combo', g.bestCombo],
      ['Distance', `${Math.floor(g.dist / 10)} m`],
    ],
    lesson: 'The bee is not trying to pollinate. It wants nectar — pollen just sticks to it and rubs off on the next flower.',
  });

  return g;
}

function drawBee(ctx, x, y, t, shield) {
  ctx.save();
  ctx.translate(x, y);
  const flap = Math.sin(t * 40) * 0.5;
  if (shield) {
    ctx.strokeStyle = 'rgba(255,201,60,0.8)';
    ctx.lineWidth = 3;
    circle(ctx, 0, 0, 26 + Math.sin(t * 6) * 2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(234,242,226,0.55)';
  ctx.save(); ctx.rotate(-0.5 + flap);
  ctx.beginPath(); ctx.ellipse(-4, -10, 13, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.rotate(0.5 - flap);
  ctx.beginPath(); ctx.ellipse(4, -10, 13, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  ctx.fillStyle = PALETTE.pollen;
  ctx.beginPath(); ctx.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3A2E12';
  ctx.beginPath(); ctx.ellipse(-3, 0, 3.4, 11.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(5, 0, 3, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3A2E12';
  circle(ctx, -11, -3, 2); ctx.fill();
  ctx.restore();
}

function drawFlower(ctx, x, y, hue, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = PALETTE.chloroDk; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 30); ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 0.6;
    ctx.fillStyle = hue;
    ctx.beginPath(); ctx.ellipse(Math.cos(a) * 12, Math.sin(a) * 12, 8, 8, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = PALETTE.pollen; circle(ctx, 0, 0, 8); ctx.fill();
  ctx.fillStyle = '#8A5A38'; circle(ctx, 0, 0, 4); ctx.fill();
  ctx.restore();
}

function drawBoost(ctx, x, y, type, t) {
  const c = BOOSTS[type].color;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 2) * 0.2);
  ctx.fillStyle = 'rgba(18,33,26,0.8)';
  circle(ctx, 0, 0, 21); ctx.fill();
  ctx.strokeStyle = c; ctx.lineWidth = 3;
  circle(ctx, 0, 0, 21); ctx.stroke();
  const glyph = { life: '♥', shield: '⬡', speed: '»', magnet: '∪', superp: '✿', swarm: '≡' }[type];
  text(ctx, glyph, 0, 7, { size: 20, color: c, align: 'center' });
  ctx.restore();
}

function drawObstacle(ctx, x, y, type, t) {
  const o = OBSTACLES[type];
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = o.color;
  ctx.strokeStyle = o.color;

  if (type === 'web') {
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 32, Math.sin(a) * 26); ctx.stroke();
    }
    for (let r = 10; r <= 30; r += 10) {
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (type === 'raindrop') {
    ctx.beginPath();
    ctx.moveTo(0, -22); ctx.quadraticCurveTo(16, 4, 0, 20); ctx.quadraticCurveTo(-16, 4, 0, -22);
    ctx.fill();
  } else if (type === 'bird') {
    ctx.lineWidth = 5; ctx.lineCap = 'round';
    const f = Math.sin(t * 12) * 8;
    ctx.beginPath();
    ctx.moveTo(-26, 0 + f); ctx.quadraticCurveTo(-10, -12, 0, 0);
    ctx.quadraticCurveTo(10, -12, 26, 0 + f);
    ctx.stroke();
    ctx.fillStyle = '#5F7796'; circle(ctx, 0, 2, 7); ctx.fill();
  } else if (type === 'branch') {
    rr(ctx, -46, -8, 92, 16, 8); ctx.fill();
    ctx.fillStyle = PALETTE.chloroDk;
    circle(ctx, -24, -12, 8); ctx.fill();
    circle(ctx, 20, 12, 7); ctx.fill();
  } else if (type === 'sprinkler') {
    ctx.fillStyle = '#8FA9C9';
    rr(ctx, -6, -4, 12, 26, 4); ctx.fill();
    ctx.strokeStyle = PALETTE.rain; ctx.lineWidth = 3;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.quadraticCurveTo(i * 16, -26 - Math.sin(t * 6) * 4, i * 30, -6);
      ctx.stroke();
    }
  } else if (type === 'leaf') {
    ctx.save(); ctx.rotate(Math.sin(t * 3) * 0.8);
    ctx.beginPath();
    ctx.moveTo(-24, 0); ctx.quadraticCurveTo(0, -20, 24, 0); ctx.quadraticCurveTo(0, 20, -24, 0);
    ctx.fill(); ctx.restore();
  } else {
    ctx.fillStyle = '#6E4629';
    for (let i = -1; i <= 1; i++) rr(ctx, i * 22 - 5, -18, 10, 40, 3), ctx.fill();
    rr(ctx, -40, -6, 80, 9, 4); ctx.fill();
  }
  ctx.restore();
}
