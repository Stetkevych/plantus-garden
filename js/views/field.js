// field.js — the real-world half of PlantUs: camera scans, the herbarium of
// everything you have found, and the account sheet that makes both possible.

import * as S from '../core/state.js';
import * as C from '../core/cloud.js';
import { FACTS } from '../data/biology.js';
import { rankFor, nextRank, FIND_REWARD } from '../data/config.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TYPE_ICON = {
  tree: '🌳', shrub: '🌿', herb: '🌱', flower: '🌸', succulent: '🪴', cactus: '🌵', fern: '🌿',
  grass: '🌾', vine: '🍃', moss: '🟩', aquatic: '💧', houseplant: '🪴', fungus: '🍄', other: '🌱',
};

let ui = null;            // { showSheet, closeSheet, toast, bump, goTab }
let finds = null;         // cached herbarium, newest first
let findsLoading = false;
let herbFilter = { q: '', type: 'all' };
let lastResult = null;
let scanning = false;

export function initField(hooks) {
  ui = hooks;
  $('cameraInput').addEventListener('change', onPick);
  $('libraryInput').addEventListener('change', onPick);
  $('herbSearch').addEventListener('input', (e) => { herbFilter.q = e.target.value; renderHerbarium(); });
  $('accountBtn').onclick = openAccount;

  C.onAuth(() => {
    finds = null;
    lastResult = null;
    renderAccountBtn();
    renderScan();
    renderHerbarium();
  });
  C.onSync(renderAccountBtn);
  renderAccountBtn();
  renderScan();
  renderHerbarium();
}

/** Called when a tab becomes visible. */
export function showScan() { renderScan(); }
export function showHerbarium() {
  renderHerbarium();
  if (C.user() && !finds && !findsLoading) loadFinds();
}

/* =================================================================== account */

function renderAccountBtn() {
  const btn = $('accountBtn');
  const u = C.user();
  if (!C.isConfigured()) { btn.hidden = true; return; }
  btn.hidden = false;
  const s = C.getSyncStatus();
  btn.classList.toggle('is-in', !!u);
  btn.dataset.sync = s;
  btn.textContent = u ? u.email[0].toUpperCase() : 'Sign in';
  btn.title = u ? `${u.email} · ${s === 'synced' ? 'garden saved to the cloud' : s === 'error' ? 'sync failed, will retry' : s}` : 'Sign in to scan plants and sync your garden';
}

function openAccount() {
  const u = C.user();
  if (u) {
    const s = C.getSyncStatus();
    ui.showSheet(`
      <h2>Your account</h2>
      <p class="reason">${esc(u.email)}</p>
      <ul class="stat-list">
        <li><span>Garden save</span><b>${s === 'synced' ? 'Synced' : s === 'syncing' ? 'Syncing…' : s === 'error' ? 'Retrying' : 'Local'}</b></li>
        <li><span>Plants found</span><b>${S.state.totals.finds}</b></li>
        <li><span>Species in herbarium</span><b>${S.state.herb.rewarded.length}</b></li>
      </ul>
      <p class="fine">Your garden, tokens and herbarium follow you to any device you sign in on.</p>
      <div class="sheet-actions">
        <button class="btn btn--ghost btn--full" id="signOutBtn">Sign out</button>
        <button class="btn btn--full" data-close>Done</button>
      </div>`);
    $('signOutBtn').onclick = () => { C.signOut(); ui.closeSheet(); ui.toast('Signed out. This device is back to a fresh garden.'); };
    return;
  }
  authSheet('signin');
}

function authSheet(mode, email = '', msg = '') {
  const titles = {
    signin: ['Sign in', 'Scan plants, keep a herbarium, and carry your garden between devices.'],
    signup: ['Create an account', 'Free. We only use your email to sign you in.'],
    confirm: ['Check your email', `We sent a 6-digit code to ${esc(email)}.`],
    forgot: ['Reset your password', 'We will email you a code.'],
    reset: ['Choose a new password', `Enter the code sent to ${esc(email)}.`],
  };
  const [title, lede] = titles[mode];
  const field = (id, label, type, extra = '') =>
    `<label class="field"><span>${label}</span><input id="${id}" type="${type}" ${extra} /></label>`;

  let fields = '';
  if (mode === 'signin' || mode === 'signup' || mode === 'forgot') fields += field('fEmail', 'Email', 'email', `autocomplete="email" value="${esc(email)}"`);
  if (mode === 'confirm' || mode === 'reset') fields += field('fCode', 'Code', 'text', 'inputmode="numeric" autocomplete="one-time-code" maxlength="8"');
  if (mode === 'signin') fields += field('fPass', 'Password', 'password', 'autocomplete="current-password"');
  if (mode === 'signup' || mode === 'reset') fields += field('fPass', 'Password', 'password', 'autocomplete="new-password" minlength="8"') + '<p class="fine">At least 8 characters, including a number.</p>';

  const primary = { signin: 'Sign in', signup: 'Create account', confirm: 'Verify', forgot: 'Send code', reset: 'Save password' }[mode];
  const links = {
    signin: '<button class="link-btn" data-mode="signup">New here? Create an account</button><button class="link-btn" data-mode="forgot">Forgot password</button>',
    signup: '<button class="link-btn" data-mode="signin">Already have an account? Sign in</button>',
    confirm: '<button class="link-btn" id="resendBtn">Send a new code</button>',
    forgot: '<button class="link-btn" data-mode="signin">Back to sign in</button>',
    reset: '<button class="link-btn" data-mode="signin">Back to sign in</button>',
  }[mode];

  ui.showSheet(`
    <h2>${title}</h2>
    <p class="reason">${lede}</p>
    <form class="auth-form" id="authForm" novalidate>
      ${fields}
      <p class="form-msg" id="formMsg" role="alert">${esc(msg)}</p>
      <button class="btn btn--full" type="submit" id="authSubmit">${primary}</button>
    </form>
    <div class="auth-links">${links}</div>
    <div class="sheet-actions"><button class="btn btn--ghost btn--full" data-close>Not now</button></div>`);

  const form = $('authForm');
  form.querySelector('input')?.focus();
  document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => authSheet(b.dataset.mode, $('fEmail')?.value || email)));
  const resend = $('resendBtn');
  if (resend) resend.onclick = async () => {
    try { await C.resendCode(email); $('formMsg').textContent = 'New code sent.'; } catch (e) { $('formMsg').textContent = e.message; }
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('authSubmit');
    const val = (id) => $(id)?.value || '';
    const em = val('fEmail') || email;
    btn.disabled = true;
    $('formMsg').textContent = '';
    try {
      if (mode === 'signin') {
        await C.signIn(em, val('fPass'));
        ui.closeSheet();
        ui.toast('Signed in. Your garden is synced.');
      } else if (mode === 'signup') {
        if (!/^\S+@\S+\.\S+$/.test(em)) throw new Error('Enter a valid email.');
        await C.signUp(em, val('fPass'));
        pendingPassword = val('fPass');
        authSheet('confirm', em);
      } else if (mode === 'confirm') {
        await C.confirmSignUp(em, val('fCode'));
        if (pendingPassword) {
          await C.signIn(em, pendingPassword);
          pendingPassword = '';
          ui.closeSheet();
          ui.toast('Account ready. Go find a plant!');
        } else authSheet('signin', em, 'Verified. Sign in to continue.');
      } else if (mode === 'forgot') {
        await C.forgotPassword(em);
        authSheet('reset', em);
      } else if (mode === 'reset') {
        await C.confirmForgotPassword(em, val('fCode'), val('fPass'));
        authSheet('signin', em, 'Password changed. Sign in with the new one.');
      }
    } catch (err) {
      if (err.code === 'UserNotConfirmedException') { authSheet('confirm', em, err.message); return; }
      $('formMsg').textContent = err.message;
      btn.disabled = false;
    }
  };
}
let pendingPassword = '';

/* =================================================================== scan */

function renderScan() {
  const body = $('scanBody');
  if (!C.isConfigured()) {
    body.innerHTML = `<div class="panel empty"><span class="empty-ico">📡</span><h3>Scanning needs the PlantUs cloud</h3>
      <p>This copy of the game is running offline. Open the hosted version to identify plants.</p></div>`;
    return;
  }
  if (!C.user()) {
    body.innerHTML = `<div class="panel empty"><span class="empty-ico">🔍</span><h3>Sign in to start scanning</h3>
      <p>Your finds are saved to your own herbarium, so we need to know whose it is.</p>
      <button class="btn" id="scanSignIn">Sign in or create an account</button></div>`;
    $('scanSignIn').onclick = () => authSheet('signin');
    return;
  }
  if (scanning) return;   // the in-progress card owns the body
  if (lastResult) { renderResult(lastResult); return; }

  body.innerHTML = `
    <div class="panel capture">
      <div class="capture-art" aria-hidden="true"><span>🌿</span></div>
      <div class="capture-copy">
        <h3>Get the whole plant, then get close</h3>
        <p>Leaves and flowers in focus, filling most of the frame, in daylight. One plant per photo.</p>
        <div class="capture-actions">
          <button class="btn btn--xl" id="takePhoto">📷 Take a photo</button>
          <button class="btn btn--ghost" id="pickPhoto">Upload from library</button>
        </div>
        <label class="check"><input type="checkbox" id="useLocation" /> <span>Save where I found it (uses your location)</span></label>
      </div>
    </div>
    <div class="reward-strip">
      <div><b>+${FIND_REWARD.newSpeciesSun} ☀</b><span>new species</span></div>
      <div><b>+4–15 ✿</b><span>by rarity</span></div>
      <div><b>+${FIND_REWARD.repeatSun} ☀</b><span>seen before</span></div>
      <div><b>📖</b><span>field guide entry</span></div>
    </div>`;
  $('takePhoto').onclick = () => $('cameraInput').click();
  $('pickPhoto').onclick = () => $('libraryInput').click();
}

/** Downscale on the device: faster uploads and well under the API limits. */
async function toJpeg(file, max = 1280) {
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    src = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('That file is not an image we can read. Try a JPEG or PNG.'));
      img.src = URL.createObjectURL(file);
    });
  }
  const w0 = src.width, h0 = src.height;
  const k = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

function where() {
  return new Promise((res) => {
    if (!navigator.geolocation) return res({});
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: +p.coords.latitude.toFixed(4), lng: +p.coords.longitude.toFixed(4) }),
      () => res({}),
      { timeout: 6000, maximumAge: 300000 },
    );
  });
}

async function onPick(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  const wantLoc = $('useLocation')?.checked;
  const body = $('scanBody');
  scanning = true;
  let dataUrl;
  try {
    dataUrl = await toJpeg(file);
  } catch (err) {
    scanning = false;
    renderScan();
    ui.toast(err.message);
    return;
  }
  body.innerHTML = `
    <div class="panel scanning">
      <div class="scan-photo"><img src="${dataUrl}" alt="Your photo" /><span class="scan-beam"></span></div>
      <p class="scan-status">Reading leaf shape, venation and flowers…</p>
    </div>`;
  const msgs = ['Reading leaf shape, venation and flowers…', 'Comparing against known families…', 'Writing your field notes…'];
  let m = 0;
  const spin = setInterval(() => { const el = body.querySelector('.scan-status'); if (el) el.textContent = msgs[++m % msgs.length]; }, 2200);

  try {
    const loc = wantLoc ? await where() : {};
    const res = await C.identify(dataUrl, loc);
    clearInterval(spin);
    scanning = false;
    if (!res.isPlant) {
      lastResult = null;
      body.innerHTML = `<div class="panel empty"><span class="empty-ico">🤔</span><h3>No plant found</h3><p>${esc(res.message)}</p>
        <button class="btn" id="retryScan">Try another photo</button></div>`;
      $('retryScan').onclick = () => renderScan();
      return;
    }
    const reward = S.recordFind(res);
    if (reward.sun) ui.bump('sunCount');
    if (reward.plantus) ui.bump('plantusCount');
    lastResult = { find: res, reward, localPhoto: dataUrl };
    if (finds) finds.unshift({ ...res, photoUrl: res.photoUrl || dataUrl });
    renderResult(lastResult);
  } catch (err) {
    clearInterval(spin);
    scanning = false;
    renderScan();
    ui.toast(err.message);
  }
}

function synopsisHtml(f, { photo } = {}) {
  const pct = Math.round((f.confidence || 0) * 100);
  const fact = FACTS[f.relatedTopic];
  return `
    <div class="syn">
      <div class="syn-photo">${photo ? `<img src="${esc(photo)}" alt="${esc(f.commonName)}" />` : ''}
        <span class="badge badge--${esc(f.rarity)}">${esc(f.rarity)}</span>
      </div>
      <div class="syn-main">
        <p class="eyebrow">${TYPE_ICON[f.plantType] || '🌱'} ${esc(f.plantType)} · ${esc(f.family || 'family unknown')}</p>
        <h2>${esc(f.commonName)}</h2>
        <p class="latin">${esc(f.scientificName)}</p>
        <div class="confidence" title="How sure the identifier is">
          <span style="width:${pct}%"></span><b>${pct}% sure</b>
        </div>
        ${pct < 55 ? '<p class="fine warn">Not certain. A closer photo of the leaves or a flower will usually settle it.</p>' : ''}
        <p class="syn-summary">${esc(f.summary)}</p>
      </div>
    </div>
    ${f.identifyingFeatures?.length ? `<div class="syn-block"><h4>How we know</h4><ul class="ticks">${f.identifyingFeatures.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    <div class="care-grid">
      <div><span>☀ Light</span><p>${esc(f.care?.light || '—')}</p></div>
      <div><span>💧 Water</span><p>${esc(f.care?.water || '—')}</p></div>
      <div><span>🪨 Soil</span><p>${esc(f.care?.soil || '—')}</p></div>
    </div>
    <div class="lesson"><strong>The biology${fact ? ` · ${esc(fact.title)}` : ''}</strong>${esc(f.biology)}</div>
    <ul class="stat-list">
      ${f.nativeRange ? `<li><span>Native to</span><b class="txt">${esc(f.nativeRange)}</b></li>` : ''}
      ${f.toxicity ? `<li><span>Toxicity</span><b class="txt">${esc(f.toxicity)}</b></li>` : ''}
      ${f.lookalikes?.length ? `<li><span>Often confused with</span><b class="txt">${f.lookalikes.map(esc).join(', ')}</b></li>` : ''}
    </ul>`;
}

function renderResult({ find, reward, localPhoto }) {
  const fact = reward.newFact ? FACTS[reward.newFact] : null;
  $('scanBody').innerHTML = `
    <div class="panel result">
      <div class="result-reward ${reward.isNew ? 'is-new' : ''}">
        ${reward.isNew ? '<span class="new-tag">New species!</span>' : '<span class="seen-tag">Seen before · added another sighting</span>'}
        <span class="earn">+${reward.sun} sun</span>
        ${reward.plantus ? `<span class="earn earn--plantus">+${reward.plantus} plantus</span>` : ''}
      </div>
      ${synopsisHtml(find, { photo: localPhoto || find.photoUrl })}
      ${fact ? `<div class="unlock"><span class="ico">📖</span><div><h4>Field guide: ${esc(fact.title)}</h4><p>${esc(fact.body)}</p></div></div>` : ''}
      <div class="result-actions">
        <button class="btn btn--xl" id="scanAgain">📷 Scan another</button>
        <button class="btn btn--ghost" id="toHerb">Open herbarium</button>
        <button class="link-btn" id="dropFind">Wrong plant? Remove this find</button>
      </div>
    </div>`;
  $('scanAgain').onclick = () => { lastResult = null; renderScan(); $('cameraInput').click(); };
  $('toHerb').onclick = () => { lastResult = null; ui.goTab('herbarium'); };
  $('dropFind').onclick = () => confirmDelete(find, () => { lastResult = null; renderScan(); });
}

/* =================================================================== herbarium */

async function loadFinds() {
  findsLoading = true;
  renderHerbarium();
  try {
    finds = (await C.listFinds()).finds;
  } catch (err) {
    ui.toast(err.message);
    finds = null;
  }
  findsLoading = false;
  renderHerbarium();
}

/** One card per species, newest sighting first. */
function groupBySpecies(list) {
  const map = new Map();
  for (const f of list) {
    const g = map.get(f.species);
    if (g) g.sightings.push(f);
    else map.set(f.species, { key: f.species, latest: f, sightings: [f] });
  }
  return [...map.values()];
}

function renderHerbarium() {
  const body = $('herbBody');
  const tools = $('herbTools');
  const rankEl = $('herbRank');
  if (!C.isConfigured() || !C.user()) {
    tools.hidden = true; rankEl.innerHTML = '';
    body.innerHTML = `<div class="panel empty"><span class="empty-ico">📚</span><h3>${C.isConfigured() ? 'Sign in to see your herbarium' : 'The herbarium lives in the PlantUs cloud'}</h3>
      <p>Every plant you scan is pressed in here with its photo, date and field notes.</p>
      ${C.isConfigured() ? '<button class="btn" id="herbSignIn">Sign in</button>' : ''}</div>`;
    const b = $('herbSignIn'); if (b) b.onclick = () => authSheet('signin');
    return;
  }
  if (findsLoading || !finds) {
    tools.hidden = true;
    body.innerHTML = '<div class="panel empty"><span class="empty-ico spin">🌀</span><h3>Opening the herbarium…</h3></div>';
    return;
  }

  const groups = groupBySpecies(finds);
  const n = groups.length;
  const rank = rankFor(n), next = nextRank(n);
  $('herbTitle').textContent = n ? `${n} species, ${finds.length} sighting${finds.length === 1 ? '' : 's'}` : 'Every plant you have found';
  rankEl.innerHTML = `<span class="rank-name">${rank.name}</span>${next
    ? `<div class="rank-bar"><span style="width:${Math.round(((n - rank.at) / (next.at - rank.at)) * 100)}%"></span></div><span class="rank-next">${next.at - n} more species to ${next.name}</span>`
    : '<span class="rank-next">Top rank. Respect.</span>'}`;

  if (!n) {
    tools.hidden = true;
    body.innerHTML = `<div class="panel empty"><span class="empty-ico">🌱</span><h3>Nothing pressed yet</h3>
      <p>Go outside, or just look at the nearest houseplant. Your first scan is a guaranteed new species.</p>
      <button class="btn" id="herbScan">📷 Scan a plant</button></div>`;
    $('herbScan').onclick = () => ui.goTab('scan');
    return;
  }

  tools.hidden = false;
  const types = [...new Set(groups.map((g) => g.latest.plantType))].sort();
  if (herbFilter.type !== 'all' && !types.includes(herbFilter.type)) herbFilter.type = 'all';
  $('herbChips').innerHTML = ['all', ...types].map((t) =>
    `<button class="chip ${herbFilter.type === t ? 'is-on' : ''}" data-type="${esc(t)}">${t === 'all' ? 'All' : `${TYPE_ICON[t] || ''} ${esc(t)}`}</button>`).join('');
  $('herbChips').querySelectorAll('.chip').forEach((c) => (c.onclick = () => { herbFilter.type = c.dataset.type; renderHerbarium(); }));

  const q = herbFilter.q.trim().toLowerCase();
  const shown = groups.filter((g) => {
    const f = g.latest;
    if (herbFilter.type !== 'all' && f.plantType !== herbFilter.type) return false;
    if (!q) return true;
    return [f.commonName, f.scientificName, f.family].some((s) => (s || '').toLowerCase().includes(q));
  });

  body.innerHTML = shown.length
    ? `<div class="herb-grid">${shown.map((g, i) => {
        const f = g.latest;
        return `<button class="herb-card" data-i="${i}">
          <span class="herb-photo">${f.photoUrl ? `<img loading="lazy" src="${esc(f.photoUrl)}" alt="" />` : ''}<span class="badge badge--${esc(f.rarity)}">${esc(f.rarity)}</span></span>
          <span class="herb-meta">
            <b>${esc(f.commonName)}</b>
            <i>${esc(f.scientificName)}</i>
            <small>${g.sightings.length > 1 ? `${g.sightings.length} sightings · ` : ''}${new Date(f.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</small>
          </span>
        </button>`;
      }).join('')}</div>`
    : '<div class="panel empty"><h3>No matches</h3><p>Try a different search or filter.</p></div>';
  body.querySelectorAll('.herb-card').forEach((b) => (b.onclick = () => openSpecies(shown[Number(b.dataset.i)])));
}

function openSpecies(g) {
  const f = g.latest;
  ui.showSheet(`
    <div class="sheet-wide">
      ${synopsisHtml(f, { photo: f.photoUrl })}
      <div class="syn-block">
        <h4>Sightings (${g.sightings.length})</h4>
        <div class="sightings">${g.sightings.map((s) => `
          <div class="sighting">
            ${s.photoUrl ? `<img loading="lazy" src="${esc(s.photoUrl)}" alt="" />` : '<span class="sighting-ph"></span>'}
            <div>
              <b>${new Date(s.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</b>
              ${Number.isFinite(s.lat) ? `<a href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=16/${s.lat}/${s.lng}" target="_blank" rel="noopener">📍 map</a>` : ''}
              <button class="link-btn" data-del="${esc(s.id)}">Remove</button>
            </div>
          </div>`).join('')}</div>
      </div>
      <div class="sheet-actions"><button class="btn btn--full" data-close>Close</button></div>
    </div>`);
  document.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => {
    const s = g.sightings.find((x) => x.id === b.dataset.del);
    confirmDelete(s, () => renderHerbarium());
  }));
}

function confirmDelete(find, after) {
  ui.showSheet(`
    <h2>Remove this find?</h2>
    <p class="reason">${esc(find.commonName)} from ${new Date(find.at).toLocaleDateString()}. The photo is deleted too. Tokens you already earned stay yours.</p>
    <div class="sheet-actions">
      <button class="btn btn--full" style="background:var(--danger);color:#fff" id="confirmDel">Remove it</button>
      <button class="btn btn--ghost btn--full" data-close>Keep it</button>
    </div>`);
  $('confirmDel').onclick = async () => {
    $('confirmDel').disabled = true;
    try {
      await C.deleteFind(find.id);
      if (finds) finds = finds.filter((x) => x.id !== find.id);
      ui.closeSheet();
      ui.toast('Find removed.');
      after?.();
    } catch (err) {
      ui.closeSheet();
      ui.toast(err.message);
    }
  };
}
