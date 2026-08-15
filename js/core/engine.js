// engine.js — logical 480x720 portrait canvas, input, loop, drawing helpers.

export const VW = 480;
export const VH = 720;

export function setupCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = VW * dpr;
  canvas.height = VH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  return ctx;
}

/** Maps real pointer coords into the 480x720 logical space. */
function toLogical(canvas, clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / r.width) * VW,
    y: ((clientY - r.top) / r.height) * VH,
  };
}

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();      // cleared each frame
    this.pointer = { x: VW / 2, y: VH / 2, down: false, justDown: false, justUp: false };
    this.swipe = null;             // 'left' | 'right' | 'up' | 'down', cleared each frame
    this._start = null;
    this._bind();
  }

  _bind() {
    const c = this.canvas;
    this._onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
    };
    this._onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);

    const down = (x, y) => {
      const p = toLogical(c, x, y);
      this.pointer.x = p.x; this.pointer.y = p.y;
      this.pointer.down = true; this.pointer.justDown = true;
      this._start = { ...p, t: performance.now() };
    };
    const move = (x, y) => {
      const p = toLogical(c, x, y);
      this.pointer.x = p.x; this.pointer.y = p.y;
    };
    const up = () => {
      this.pointer.down = false; this.pointer.justUp = true;
      if (this._start) {
        const dx = this.pointer.x - this._start.x;
        const dy = this.pointer.y - this._start.y;
        const dt = performance.now() - this._start.t;
        if (dt < 600 && Math.hypot(dx, dy) > 28) {
          this.swipe = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'down' : 'up');
        }
        this._start = null;
      }
    };

    this._onPD = (e) => { c.setPointerCapture?.(e.pointerId); down(e.clientX, e.clientY); };
    this._onPM = (e) => move(e.clientX, e.clientY);
    this._onPU = () => up();
    c.addEventListener('pointerdown', this._onPD);
    c.addEventListener('pointermove', this._onPM);
    window.addEventListener('pointerup', this._onPU);
    c.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  key(...names) { return names.some((n) => this.keys.has(n)); }
  hit(...names) { return names.some((n) => this.pressed.has(n)); }

  endFrame() {
    this.pressed.clear();
    this.swipe = null;
    this.pointer.justDown = false;
    this.pointer.justUp = false;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('pointerup', this._onPU);
    this.canvas.removeEventListener('pointerdown', this._onPD);
    this.canvas.removeEventListener('pointermove', this._onPM);
  }
}

/** Runs a game object exposing update(dt)/draw(ctx) and a boolean `over`. */
export function runLoop(game, ctx, input, onEnd) {
  let raf = 0;
  let last = performance.now();
  let stopped = false;

  const frame = (now) => {
    if (stopped) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    game.update(dt);
    ctx.clearRect(0, 0, VW, VH);
    game.draw(ctx);
    input.endFrame();
    if (game.over) { stopped = true; onEnd(game.result()); return; }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => { stopped = true; cancelAnimationFrame(raf); };
}

/* ---------------- drawing helpers ---------------- */

export function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

export function text(ctx, str, x, y, {
  size = 16, color = '#EAF2E2', align = 'left', weight = 700,
  font = '"Baloo 2", system-ui, sans-serif', baseline = 'alphabetic',
} = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
  ctx.restore();
}

export function hudBar(ctx, { score, label, right }) {
  ctx.save();
  ctx.fillStyle = 'rgba(18,33,26,0.82)';
  ctx.fillRect(0, 0, VW, 46);
  ctx.fillStyle = 'rgba(139,224,106,0.25)';
  ctx.fillRect(0, 45, VW, 1);
  ctx.restore();
  text(ctx, String(score), 14, 32, { size: 26, color: '#EAF2E2' });
  if (label) text(ctx, label, 14 + ctx.measureText(String(score)).width + 46, 31, { size: 13, color: '#8BE06A', weight: 600 });
  if (right) text(ctx, right, VW - 14, 30, { size: 15, color: '#FFC93C', align: 'right' });
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* Simple particle pool used by several games. */
export class Particles {
  constructor() { this.list = []; }
  burst(x, y, color, n = 10, speed = 120, life = 0.6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, r: 2 + Math.random() * 3 });
    }
  }
  update(dt, gravity = 220) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      circle(ctx, p.x, p.y, p.r);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** Floating "+12" style score popups. */
export class Floaters {
  constructor() { this.list = []; }
  add(x, y, str, color = '#FFC93C', size = 18) {
    this.list.push({ x, y, str, color, size, life: 0.9 });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.life -= dt; f.y -= 34 * dt;
      if (f.life <= 0) this.list.splice(i, 1);
    }
  }
  draw(ctx) {
    for (const f of this.list) {
      ctx.globalAlpha = Math.min(1, f.life / 0.4);
      text(ctx, f.str, f.x, f.y, { size: f.size, color: f.color, align: 'center' });
    }
    ctx.globalAlpha = 1;
  }
}
