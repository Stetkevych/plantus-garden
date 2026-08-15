// plantart.js — one renderer, six growth stages, five plant forms.
// Used by the garden hub and by the Cloud Barrage garden strip so growth reads identically.

import { circle } from './engine.js';
import { SPECIES } from '../data/config.js';

const sway = (t, i) => Math.sin(t * 1.4 + i * 1.1) * 0.10;

function leaf(ctx, x, y, len, ang, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.restore();
}

function bloom(ctx, x, y, r, petal, open) {
  const petals = 7;
  ctx.save();
  ctx.translate(x, y);
  if (open < 1) {
    // a bud: closed sepals
    ctx.fillStyle = '#5FB544';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.55, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = petal;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.45, r * 0.34, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.fillStyle = petal;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.78, r * 0.36, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#8A5A38';
  circle(ctx, 0, 0, r * 0.42); ctx.fill();
  ctx.fillStyle = 'rgba(255,201,60,0.55)';
  circle(ctx, 0, 0, r * 0.24); ctx.fill();
  ctx.restore();
}

/**
 * Draw a plant standing on the soil line.
 * @param stage 0..5  (seedling, small leaves, medium, large leaves, buds, bloom)
 * @param size overall height budget in px
 */
export function drawPlant(ctx, x, baseY, size, speciesId, stage, t = 0) {
  const sp = SPECIES[speciesId] || SPECIES.sunflower;
  const grow = [0.16, 0.3, 0.5, 0.72, 0.88, 1][stage] ?? 0.16;
  const h = size * grow;

  ctx.save();

  if (sp.form === 'succulent') {
    const w = size * 0.30 * (0.55 + grow * 0.65);
    const bh = h * 0.8;
    ctx.fillStyle = sp.stem;
    ctx.beginPath();
    ctx.ellipse(x, baseY - bh * 0.5, w, bh * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x + (i * w) / 2.6, baseY - bh * 0.98);
      ctx.lineTo(x + (i * w) / 2.6, baseY - bh * 0.06);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(234,242,226,0.75)';
    ctx.lineWidth = 1;
    const spines = 3 + stage * 2;
    for (let i = 0; i < spines; i++) {
      const a = -Math.PI / 2 + (i / (spines - 1) - 0.5) * 2.2;
      const px = x + Math.cos(a) * w, py = baseY - bh * 0.5 + Math.sin(a) * bh * 0.55;
      ctx.beginPath(); ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * 5, py + Math.sin(a) * 5);
      ctx.stroke();
    }
    if (stage >= 4) bloom(ctx, x, baseY - bh - 4, size * 0.11, sp.petal, stage >= 5 ? 1 : 0);
    ctx.restore();
    return;
  }

  if (sp.form === 'tree') {
    const tw = size * 0.09 * (0.5 + grow);
    ctx.fillStyle = sp.stem;
    ctx.beginPath();
    ctx.moveTo(x - tw, baseY);
    ctx.lineTo(x - tw * 0.55, baseY - h);
    ctx.lineTo(x + tw * 0.55, baseY - h);
    ctx.lineTo(x + tw, baseY);
    ctx.closePath(); ctx.fill();
    const blobs = 1 + stage;
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * Math.PI * 2 + t * 0.3;
      const r = size * (0.10 + grow * 0.13);
      ctx.fillStyle = i % 2 ? sp.leaf : '#6FCB52';
      circle(ctx, x + Math.cos(a) * r * 0.9, baseY - h - r * 0.25 + Math.sin(a) * r * 0.5, r);
      ctx.fill();
    }
    if (stage >= 4) {
      for (let i = 0; i < 3; i++) {
        bloom(ctx, x - 16 + i * 16, baseY - h - size * 0.16, size * 0.05, sp.petal, stage >= 5 ? 1 : 0);
      }
    }
    ctx.restore();
    return;
  }

  if (sp.form === 'fern') {
    const fronds = 2 + stage;
    for (let i = 0; i < fronds; i++) {
      const side = i % 2 ? 1 : -1;
      const a = -Math.PI / 2 + side * (0.25 + (i / fronds) * 0.6) + sway(t, i);
      ctx.save();
      ctx.translate(x, baseY);
      ctx.rotate(a);
      ctx.strokeStyle = sp.stem; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(h * 0.9, 0); ctx.stroke();
      const pinnae = 5 + stage;
      for (let j = 1; j <= pinnae; j++) {
        const px = (h * 0.9 * j) / (pinnae + 1);
        const pl = (h * 0.20) * (1 - j / (pinnae + 2));
        leaf(ctx, px, 0, pl, -0.7, sp.leaf);
        leaf(ctx, px, 0, pl, 0.7, sp.leaf);
      }
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  // herb / shrub: stem + paired leaves + buds/blooms
  ctx.strokeStyle = sp.stem;
  ctx.lineWidth = Math.max(2.5, size * 0.028 * (0.6 + grow));
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + Math.sin(t * 1.2) * h * 0.06, baseY - h * 0.55, x, baseY - h);
  ctx.stroke();

  const pairs = [0, 1, 2, 3, 3, 3][stage];
  const leafLen = size * [0.06, 0.10, 0.15, 0.20, 0.21, 0.22][stage];
  for (let i = 0; i < pairs; i++) {
    const ly = baseY - h * (0.28 + (i * 0.55) / Math.max(1, pairs));
    leaf(ctx, x, ly, leafLen, -0.55 + sway(t, i), sp.leaf);
    leaf(ctx, x, ly, leafLen, Math.PI + 0.55 - sway(t, i + 3), sp.leaf);
  }

  if (stage === 0) {
    leaf(ctx, x, baseY - h * 0.75, size * 0.07, -0.8, sp.leaf);
    leaf(ctx, x, baseY - h * 0.75, size * 0.07, Math.PI + 0.8, sp.leaf);
  }

  if (stage === 4) bloom(ctx, x, baseY - h - size * 0.03, size * 0.075, sp.petal, 0);
  if (stage === 5) {
    bloom(ctx, x, baseY - h - size * 0.04, size * 0.11, sp.petal, 1);
    if (sp.form === 'shrub') {
      bloom(ctx, x - size * 0.16, baseY - h * 0.72, size * 0.075, sp.petal, 1);
      bloom(ctx, x + size * 0.16, baseY - h * 0.6, size * 0.075, sp.petal, 1);
    }
  }
  ctx.restore();
}
