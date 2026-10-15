// art.js — procedural houseplants for the Lab, driven by the Unity aesthetic
// fields: PrimaryColor / SecondaryColor names become paints, BodyShape picks a
// silhouette, and growth stage sets the size.

const PAINT = {
  'green': '#4F9D4A', 'velvet green': '#2F6B3A', 'soft green': '#8CC08A', 'white green': '#CFE6C4',
  'velvet black green': '#1F3324', 'lime green': '#A6D84A', 'emerald': '#1E8A5A', 'deep green': '#1F5E3A',
  'deep forest green': '#1B4730', 'dark olive': '#4B5A2A', 'dark green': '#234D2C', 'black purple': '#3A2240',
  'black green': '#1C2B20', 'silver': '#C9D3D0', 'silver white': '#E4ECEA', 'red': '#C8423C', 'white': '#F4F6F2',
  'wax pink': '#E8A6B5', 'rose': '#D9708A', 'plum': '#7A3C68', 'pink': '#F08CB0', 'pink cream': '#F3C7CF',
  'pale beige': '#E5DCC2', 'lavender': '#B9A6E0', 'ivory': '#F2EDDA', 'dark mosaic': '#3E4A3A',
  'dark bronze': '#6B4A2A', 'cream white': '#F1EEDC', 'cream pink': '#F1D0D0', 'black': '#151515',
};

export function paint(name) {
  const k = String(name || '').toLowerCase().trim();
  if (PAINT[k]) return PAINT[k];
  // unknown names still get a stable, plant-ish colour
  let h = 0;
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${90 + (h % 70)}, 45%, ${30 + (h % 25)}%)`;
}

export function formOf(plant) {
  const s = (plant.aesthetic.bodyShape || '').toLowerCase();
  if (/vine|trailing|hanging|curtain|rope|coin/.test(s)) return 'trailing';
  if (/rosette|low/.test(s)) return 'rosette';
  if (/elephant|heart|spear|shield|ear/.test(s)) return 'broadleaf';
  if (/trunk|cane|stalk|upright|stem|crown/.test(s)) return 'upright';
  return 'cluster';
}

export const ELEMENT = {
  Nature: { icon: '🌿', color: '#6FCB52' }, Poison: { icon: '☠', color: '#A56BE0' },
  Water: { icon: '💧', color: '#63C7F0' }, Fire: { icon: '🔥', color: '#FF8A4C' },
  Shadow: { icon: '🌑', color: '#8E86B8' }, Light: { icon: '✨', color: '#FFD86B' },
  Electric: { icon: '⚡', color: '#F4E04D' }, Psychic: { icon: '🔮', color: '#E07BD0' },
  Crystal: { icon: '💎', color: '#7FE3E0' }, Air: { icon: '🌬', color: '#C9E8F5' },
};

function leaf(ctx, x, y, len, wid, ang, fill, vein) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -wid, len, 0);
  ctx.quadraticCurveTo(len * 0.5, wid, 0, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  if (vein) {
    ctx.strokeStyle = vein;
    ctx.lineWidth = Math.max(1, wid * 0.12);
    ctx.beginPath(); ctx.moveTo(len * 0.05, 0); ctx.lineTo(len * 0.9, 0); ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw a potted plant standing on (cx, baseY). `size` is the full-grown
 * height. `wilt` 0..1 droops it; `dead` greys it out.
 */
export function drawHouseplant(ctx, cx, baseY, size, plant, stage, t = 0, { wilt = 0, dead = false } = {}) {
  const a = plant.aesthetic;
  const main = paint(a.primaryColor), accent = paint(a.secondaryColor);
  const grow = [0.12, 0.3, 0.55, 0.8, 1][stage] ?? 0.12;
  const h = size * grow;
  const sway = Math.sin(t * 1.6 + cx) * 0.04;
  const droop = wilt * 0.7;

  // pot
  const pw = size * 0.34, ph = size * 0.24;
  ctx.save();
  ctx.fillStyle = '#B5653A';
  ctx.beginPath();
  ctx.moveTo(cx - pw / 2, baseY - ph);
  ctx.lineTo(cx + pw / 2, baseY - ph);
  ctx.lineTo(cx + pw * 0.38, baseY);
  ctx.lineTo(cx - pw * 0.38, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#C97A4A';
  ctx.fillRect(cx - pw * 0.56, baseY - ph - size * 0.05, pw * 1.12, size * 0.06);
  ctx.fillStyle = '#4A3220';
  ctx.fillRect(cx - pw * 0.48, baseY - ph - size * 0.03, pw * 0.96, size * 0.025);
  ctx.restore();

  const soil = baseY - ph - size * 0.03;
  ctx.save();
  if (dead) ctx.filter = 'grayscale(1) brightness(0.6)';
  else if (wilt > 0) ctx.filter = `saturate(${1 - wilt * 0.6}) sepia(${wilt * 0.4})`;

  if (stage === 0) {
    // a seed just breaking the soil
    ctx.fillStyle = '#8A5A38';
    ctx.beginPath(); ctx.ellipse(cx, soil - 2, size * 0.035, size * 0.025, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }

  const form = formOf(plant);
  const n = 2 + stage * (form === 'broadleaf' ? 1 : 2);
  const L = size * (form === 'broadleaf' ? 0.38 : 0.28) * (0.5 + grow * 0.6);
  const W = L * (form === 'broadleaf' ? 0.55 : 0.38);

  if (form === 'trailing') {
    // a low crown on the soil, then strands that arch over the rim and hang
    for (let i = 0; i < 3 + stage; i++) {
      const ang = -Math.PI + ((i + 0.5) / (3 + stage)) * Math.PI;
      leaf(ctx, cx, soil, L * 0.6, W * 0.9, ang + sway, i % 2 ? main : accent, null);
    }
    const strands = Math.min(6, 1 + stage);
    for (let i = 0; i < strands; i++) {
      const dir = i % 2 ? 1 : -1;
      const len = size * (0.12 + stage * 0.09) * (0.75 + (i % 3) * 0.2) * (1 - droop * 0.2);
      const x0 = cx + dir * pw * (0.25 + (i >> 1) * 0.12);
      const rim = soil - size * 0.03;
      const segs = 5;
      let x = x0, y = rim;
      ctx.strokeStyle = main; ctx.lineWidth = Math.max(1.2, size * 0.012);
      for (let k = 1; k <= segs; k++) {
        const f = k / segs;
        const nx = x0 + dir * (pw * 0.35 * Math.sin(f * Math.PI * 0.6) + Math.sin(t * 1.3 + i + k) * size * 0.006);
        const ny = rim + len * f;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
        leaf(ctx, nx, ny, L * 0.42, W * 0.7, Math.PI / 2 + dir * 0.9 + sway, k % 2 ? main : accent, null);
        x = nx; y = ny;
      }
    }
  } else if (form === 'rosette') {
    for (let i = 0; i < n + 2; i++) {
      const ang = -Math.PI + (i / (n + 1)) * Math.PI;
      leaf(ctx, cx, soil, L * 1.1, W * 1.2, ang + sway + droop * 0.4 * Math.sign(Math.cos(ang)), i % 2 ? main : accent, accent);
    }
  } else {
    const stemTop = soil - h * (1 - droop * 0.35);
    ctx.strokeStyle = form === 'upright' ? paint('dark bronze') : main;
    ctx.lineWidth = form === 'upright' ? Math.max(2, size * 0.03) : 2;
    if (form !== 'cluster') {
      ctx.beginPath();
      ctx.moveTo(cx, soil);
      ctx.quadraticCurveTo(cx + sway * size, (soil + stemTop) / 2, cx + sway * size * 2 + droop * size * 0.2, stemTop);
      ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const f = (i + 1) / (n + 1);
      const y = soil - (soil - stemTop) * (form === 'cluster' ? 0.15 : f);
      const dir = i % 2 ? 1 : -1;
      const x = cx + sway * size * 2 * f;
      const ang = (dir > 0 ? -0.5 : Math.PI + 0.5) + dir * droop * 0.9 + sway;
      if (form === 'cluster') {
        ctx.strokeStyle = main; ctx.lineWidth = 2;
        const tipX = cx + dir * (i * size * 0.03), tipY = soil - h * (0.4 + 0.6 * f) * (1 - droop * 0.4);
        ctx.beginPath(); ctx.moveTo(cx, soil); ctx.lineTo(tipX, tipY); ctx.stroke();
        leaf(ctx, tipX, tipY, L, W, ang, i % 2 ? main : accent, accent);
      } else {
        leaf(ctx, x, y, L * (form === 'broadleaf' ? 1 : 0.8 + f * 0.3), W, ang, i % 3 === 2 ? accent : main, accent);
      }
    }
  }

  // blooms / aura at full growth
  if (stage === 4 && !dead) {
    for (let k = 0; k < 4; k++) {
      const px = cx + Math.sin(t * 1.1 + k * 1.7) * size * 0.32;
      const py = soil - h * 0.75 + Math.cos(t * 1.4 + k) * size * 0.14;
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.arc(px, py, size * 0.018, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
