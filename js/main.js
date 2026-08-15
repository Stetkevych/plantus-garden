// main.js — hub, economy loop, run launcher, results and quiz.

import { setupCanvas, Input, runLoop, VW, VH, rr, circle, text } from './core/engine.js';
import { drawPlant } from './core/plantart.js';
import { STAGES, MAX_STAGE, SPECIES, GAMES, PALETTE, PLOT_UNLOCK_COST } from './data/config.js';
import { FACTS, pickQuiz } from './data/biology.js';
import * as S from './core/state.js';

import { createVineGarden } from './games/vine-garden.js';
import { createCloudBarrage } from './games/cloud-barrage.js';
import { createBeeRush } from './games/bee-rush.js';
import { createSeedCrush } from './games/seed-crush.js';
import { createPlantSurvivors } from './games/plant-survivors.js';

const FACTORIES = {
  vine: createVineGarden,
  clouds: createCloudBarrage,
  bee: createBeeRush,
  seeds: createSeedCrush,
  survivors: createPlantSurvivors,
};
const GLYPH = { vine: '🌿', clouds: '☁', bee: '🐝', seeds: '🌰', survivors: '🛡' };

const BUILD = 'b4';
const $ = (id) => document.getElementById(id);
const hub = $('hub'), play = $('play'), overlay = $('overlay'), sheet = $('sheet');

let selected = null;
let stopRun = null;
let runInput = null;

/* =========================================================
   Garden bed canvas
   ========================================================= */
const gc = $('gardenCanvas');
const gctx = gc.getContext('2d');
const GW = 960, GH = 380, SOIL = 236;
const plotX = (i) => 96 + i * 192;

(function scaleGarden() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  gc.width = GW * dpr; gc.height = GH * dpr;
  gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
})();

let gt = 0;
function drawGarden(now) {
  gt = now / 1000;
  gctx.clearRect(0, 0, GW, GH);

  // sky wash + sun
  const sky = gctx.createLinearGradient(0, 0, 0, SOIL);
  sky.addColorStop(0, '#204536');
  sky.addColorStop(1, '#1A3227');
  gctx.fillStyle = sky;
  gctx.fillRect(0, 0, GW, SOIL);

  gctx.fillStyle = 'rgba(255,201,60,0.13)';
  circle(gctx, 862, 62, 46 + Math.sin(gt * 0.8) * 3); gctx.fill();
  gctx.fillStyle = 'rgba(255,201,60,0.9)';
  circle(gctx, 862, 62, 21); gctx.fill();

  // soil
  const soil = gctx.createLinearGradient(0, SOIL, 0, GH);
  soil.addColorStop(0, '#42301F');
  soil.addColorStop(1, '#2A1D14');
  gctx.fillStyle = soil;
  gctx.fillRect(0, SOIL, GW, GH - SOIL);
  gctx.fillStyle = 'rgba(139,224,106,0.22)';
  gctx.fillRect(0, SOIL, GW, 3);

  S.state.plots.forEach((plot, i) => {
    const x = plotX(i);
    const sp = SPECIES[plot.species];
    const isSel = selected === i;

    if (isSel) {
      gctx.fillStyle = 'rgba(139,224,106,0.07)';
      rr(gctx, x - 88, 22, 176, GH - 60, 18); gctx.fill();
      gctx.strokeStyle = 'rgba(139,224,106,0.4)'; gctx.lineWidth = 2;
      rr(gctx, x - 88, 22, 176, GH - 60, 18); gctx.stroke();
    }

    if (!plot.unlocked) {
      gctx.fillStyle = 'rgba(18,33,26,0.5)';
      rr(gctx, x - 70, SOIL - 128, 140, 150, 14); gctx.fill();
      gctx.setLineDash([7, 7]);
      gctx.strokeStyle = 'rgba(234,242,226,0.28)'; gctx.lineWidth = 2;
      rr(gctx, x - 70, SOIL - 128, 140, 150, 14); gctx.stroke();
      gctx.setLineDash([]);
      text(gctx, '✿', x, SOIL - 66, { size: 30, color: 'rgba(234,242,226,0.4)', align: 'center' });
      text(gctx, `${PLOT_UNLOCK_COST[i]} plantus`, x, SOIL - 34, { size: 15, color: PALETTE.petal, align: 'center' });
      text(gctx, 'to open this bed', x, SOIL - 16, { size: 11, color: 'rgba(234,242,226,0.45)', align: 'center', font: 'Karla, sans-serif', weight: 600 });
    } else {
      gctx.fillStyle = 'rgba(0,0,0,0.22)';
      gctx.beginPath(); gctx.ellipse(x, SOIL + 6, 44, 9, 0, 0, Math.PI * 2); gctx.fill();
      drawPlant(gctx, x, SOIL, 214, plot.species, plot.stage, gt + i);

      if (plot.stage === MAX_STAGE) {
        for (let k = 0; k < 3; k++) {
          const px = x + Math.sin(gt * 0.9 + k * 2.1) * 52;
          const py = SOIL - 150 + Math.cos(gt * 1.3 + k) * 26;
          gctx.fillStyle = 'rgba(255,201,60,0.75)';
          circle(gctx, px, py, 2.6); gctx.fill();
        }
      }
    }

    // label plate
    const label = plot.unlocked ? sp.name : 'Locked bed';
    gctx.fillStyle = 'rgba(18,33,26,0.72)';
    const w = 152;
    rr(gctx, x - w / 2, GH - 40, w, 28, 14); gctx.fill();
    text(gctx, label, x, GH - 26, { size: 14, color: plot.unlocked ? PALETTE.paper : 'rgba(234,242,226,0.5)', align: 'center' });
    text(gctx, plot.unlocked ? `${plot.stage}/${MAX_STAGE}` : '', x + w / 2 - 16, GH - 26, { size: 12, color: PALETTE.chloro, align: 'center' });
  });

  requestAnimationFrame(drawGarden);
}
requestAnimationFrame(drawGarden);

gc.addEventListener('click', (e) => {
  const r = gc.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * GW;
  let best = 0, bd = 1e9;
  S.state.plots.forEach((_, i) => {
    const d = Math.abs(plotX(i) - x);
    if (d < bd) { bd = d; best = i; }
  });
  selectPlot(best);
});

/* =========================================================
   Plot panel
   ========================================================= */
function selectPlot(i) {
  selected = i;
  renderPlot();
  $('plotPanel').hidden = false;
  $('plotPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderPlot() {
  if (selected === null) return;
  const plot = S.state.plots[selected];
  const sp = SPECIES[plot.species];
  const locked = !plot.unlocked;

  $('plotName').textContent = locked ? 'Locked bed' : sp.name;
  $('plotLatin').textContent = locked ? `Opens as ${sp.name}` : sp.latin;
  $('plotStage').textContent = locked ? 'Closed' : STAGES[plot.stage].name;

  const track = $('stageTrack');
  track.innerHTML = '';
  STAGES.forEach((_, k) => {
    const s = document.createElement('span');
    if (!locked && k < plot.stage) s.className = 'on';
    if (!locked && k === plot.stage) s.className = 'now';
    track.appendChild(s);
  });

  $('plotCaption').textContent = locked
    ? `This bed is waiting. Plantus tokens are minted by growing what you already have — bring ${PLOT_UNLOCK_COST[selected]} back here and the ${sp.name.toLowerCase()} goes in.`
    : STAGES[plot.stage].caption;
  $('plotTrait').textContent = locked ? '' : sp.trait;

  const btn = $('growBtn');
  if (locked) {
    const c = PLOT_UNLOCK_COST[selected];
    btn.textContent = `Open bed — ${c} plantus`;
    btn.disabled = S.state.plantus < c;
    btn.onclick = () => {
      if (S.unlockPlot(selected)) { bump('plantusCount'); renderPlot(); }
    };
  } else if (plot.stage >= MAX_STAGE) {
    btn.textContent = 'Fully bloomed';
    btn.disabled = true;
    btn.onclick = null;
  } else {
    const c = S.growthCost(selected);
    btn.textContent = `Grow to ${STAGES[plot.stage + 1].name.toLowerCase()} — ${c} sun`;
    btn.disabled = S.state.sun < c;
    btn.onclick = () => doGrow(selected);
  }
}

function doGrow(i) {
  const res = S.grow(i);
  if (!res) return;
  bump('sunCount'); bump('plantusCount');
  renderPlot();

  const stage = STAGES[res.stage];
  const fact = res.factId ? FACTS[res.factId] : null;
  showSheet(`
    <h2>${stage.name}</h2>
    <p class="reason">${SPECIES[S.state.plots[i].species].name} · ${res.spent} sun spent</p>
    <div class="score-row">
      <span class="big" style="color:var(--petal)">+${res.plantus}</span>
      <span class="earn" style="background:rgba(255,126,168,.16);color:var(--petal)">plantus earned</span>
    </div>
    <div class="lesson"><strong>What just happened</strong>${stage.caption}</div>
    ${fact ? `<div class="unlock"><span class="ico">📖</span><div><h4>Field guide: ${fact.title}</h4><p>${fact.body}</p></div></div>` : ''}
    <div class="sheet-actions">
      <button class="btn btn--full" data-close>Back to the garden</button>
    </div>
  `);
}

$('closePlot').onclick = () => { $('plotPanel').hidden = true; selected = null; };

/* =========================================================
   Wallet + field guide
   ========================================================= */
function bump(id) {
  const el = $(id).parentElement;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 220);
}

function renderWallet() {
  $('sunCount').textContent = S.state.sun;
  $('plantusCount').textContent = S.state.plantus;
  // contextual hint under the bed
  const next = S.state.plots
    .map((p, i) => ({ i, p, c: S.growthCost(i) }))
    .filter((o) => o.p.unlocked && o.c !== null)
    .sort((a, b) => a.c - b.c)[0];
  $('bedHint').textContent = next
    ? (S.state.sun >= next.c
        ? `You can afford to grow the ${SPECIES[next.p.species].name.toLowerCase()} now — tap its plot`
        : `Tap a plot to tend it · cheapest growth costs ${next.c} sun, you have ${S.state.sun}`)
    : 'Every open bed is in full bloom — spend plantus to open another';

  const t = S.state.totals;
  $('statLine').textContent =
    `${t.sunEarned} sun earned all-time · ${t.blooms} full blooms · quiz ${t.quizRight}/${t.quizAsked}`;
}

function renderFacts() {
  const grid = $('factGrid');
  grid.innerHTML = '';
  const ids = Object.keys(FACTS);
  $('factCount').textContent = S.state.facts.length;
  $('factTotal').textContent = ids.length;
  ids.forEach((id) => {
    const f = FACTS[id];
    const has = S.state.facts.includes(id);
    const el = document.createElement('article');
    el.className = `fact${has ? '' : ' locked'}`;
    el.innerHTML = has
      ? `<span class="tag">${f.tag}</span><h4>${f.title}</h4><p>${f.body}</p>`
      : `<span class="tag">${f.tag}</span><h4>Not collected</h4><p>Keep playing and growing to unlock this entry.</p>`;
    grid.appendChild(el);
  });
}

function renderGames() {
  const grid = $('gameGrid');
  grid.innerHTML = '';
  GAMES.forEach((g) => {
    const btn = document.createElement('button');
    btn.className = 'game-card';
    const best = S.state.best[g.id];
    btn.innerHTML = `
      <span class="glyph" aria-hidden="true">${GLYPH[g.id]}</span>
      <span class="tag">${g.tag}</span>
      <h3>${g.title}</h3>
      <p class="verb">${g.verb}</p>
      <p class="best">${best ? `Best ${best}` : 'Not played yet'}</p>`;
    btn.onclick = () => startRun(g.id);
    grid.appendChild(btn);
  });
}

function renderAll() {
  renderWallet();
  renderFacts();
  renderGames();
  if (selected !== null) renderPlot();
}
S.onChange(renderAll);
renderAll();

/* =========================================================
   Running a game
   ========================================================= */
const gameCanvas = $('gameCanvas');
const gameCtx = setupCanvas(gameCanvas);

function startRun(id) {
  const meta = GAMES.find((g) => g.id === id);
  $('playTitle').textContent = meta.title;
  $('playHint').textContent = meta.hint;
  hub.hidden = true;
  play.hidden = false;
  document.body.classList.add('playing');
  window.scrollTo(0, 0);

  const game = FACTORIES[id]();
  runInput = new Input(gameCanvas);

  const wrapped = {
    update(dt) { game.input(runInput); game.update(dt); },
    draw(ctx) { game.draw(ctx); },
    get over() { return game.over; },
    result: () => game.result(),
  };

  stopRun = runLoop(wrapped, gameCtx, runInput, (res) => finishRun(id, res));
}

function endRunCleanup() {
  if (stopRun) { stopRun(); stopRun = null; }
  if (runInput) { runInput.destroy(); runInput = null; }
  play.hidden = true;
  hub.hidden = false;
  document.body.classList.remove('playing');
}

$('quitBtn').onclick = () => endRunCleanup();
$('homeBtn').onclick = () => { if (!play.hidden) endRunCleanup(); window.scrollTo({ top: 0, behavior: 'smooth' }); };

function finishRun(id, res) {
  const rec = S.recordRun(id, res.score, res.sun);
  endRunCleanup();

  const q = pickQuiz(id);
  const fact = rec.newFact ? FACTS[rec.newFact] : null;

  showSheet(`
    <h2>${GAMES.find((g) => g.id === id).title}</h2>
    <p class="reason">${res.reason}</p>
    <div class="score-row">
      <span class="big">${res.score}</span>
      <span class="earn">+${res.sun} sun</span>
    </div>
    <ul class="stat-list">
      ${res.stats.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('')}
      <li><span>Personal best</span><b>${rec.best}</b></li>
    </ul>
    <div class="lesson"><strong>The biology</strong>${res.lesson}</div>
    ${fact ? `<div class="unlock"><span class="ico">📖</span><div><h4>Field guide: ${fact.title}</h4><p>${fact.body}</p></div></div>` : ''}
    <div class="quiz" id="quizBox">
      <p>${q.q}</p>
      <div class="quiz-opts">
        ${q.a.map((opt, i) => `<button class="quiz-opt" data-i="${i}">${opt}</button>`).join('')}
      </div>
      <p class="quiz-feedback" id="quizFeedback">Answer correctly for +15 sun.</p>
    </div>
    <div class="sheet-actions">
      <button class="btn btn--full" data-again="${id}">Play again</button>
      <button class="btn btn--ghost btn--full" data-close>Spend sun in the garden</button>
    </div>
  `);

  let answered = false;
  sheet.querySelectorAll('.quiz-opt').forEach((btn) => {
    btn.onclick = () => {
      if (answered) return;
      answered = true;
      const i = Number(btn.dataset.i);
      const right = i === q.correct;
      btn.classList.add(right ? 'right' : 'wrong');
      if (!right) sheet.querySelector(`.quiz-opt[data-i="${q.correct}"]`).classList.add('right');
      S.recordQuiz(right);
      if (right) { S.addSun(15); bump('sunCount'); }
      $('quizFeedback').textContent = right ? `Correct. +15 sun. ${q.why}` : q.why;
    };
  });
}

/* =========================================================
   Sheet plumbing
   ========================================================= */
function showSheet(html) {
  sheet.innerHTML = html;
  overlay.hidden = false;
  sheet.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeSheet));
  sheet.querySelectorAll('[data-again]').forEach((b) => (b.onclick = () => { closeSheet(); startRun(b.dataset.again); }));
  sheet.querySelector('button')?.focus();
}
function closeSheet() { overlay.hidden = true; sheet.innerHTML = ''; }
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSheet(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) closeSheet(); });

$('resetBtn').onclick = () => {
  showSheet(`
    <h2>Clear your save?</h2>
    <p class="reason">Every plant, token and field guide entry goes back to the start. This cannot be undone.</p>
    <div class="sheet-actions">
      <button class="btn btn--full" style="background:var(--danger);color:#fff" id="confirmReset">Clear it</button>
      <button class="btn btn--ghost btn--full" data-close>Keep my garden</button>
    </div>`);
  $('confirmReset').onclick = () => { S.reset(); selected = null; $('plotPanel').hidden = true; closeSheet(); };
};


/* =========================================================
   Boot screen and distraction-free play
   ========================================================= */

// Fullscreen can only be requested from a real user gesture, which is what the
// Play button is for. iOS Safari has no Fullscreen API on iPhone, so the PWA
// manifest covers that case instead ("Add to Home Screen").
function goFullscreen() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (fn) { try { fn.call(el, { navigationUI: 'hide' }); } catch { fn.call(el); } }
}
function exitFullscreen() {
  const fn = document.exitFullscreen || document.webkitExitFullscreen;
  if (fn && (document.fullscreenElement || document.webkitFullscreenElement)) {
    try { fn.call(document); } catch { /* already out */ }
  }
}

const boot = $('boot');
function dismissBoot() {
  boot.style.opacity = '0';
  boot.style.transition = 'opacity .25s ease';
  setTimeout(() => { boot.hidden = true; boot.style.display = 'none'; }, 250);
  document.querySelector('.games')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
document.querySelector('.boot-inner p').textContent = `Five games. One garden. \u00b7 ${BUILD}`;
$('bootPlay').onclick = () => { goFullscreen(); dismissBoot(); };
$('bootWindowed').onclick = () => dismissBoot();

// Keep the canvas crisp when the viewport changes (rotation, fullscreen toggle).
window.addEventListener('resize', () => {
  if (!play.hidden) gameCanvas.getBoundingClientRect();
});
