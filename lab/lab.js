// lab.js — UI for the PlantUs Lab: the growing table, the seed vault and the
// arena. Rules live in sim.js and combat.js; this file only draws and wires.

import { PLANTS, TIERS, TIER_LEVEL, TIER_COST } from './plants.js';
import * as L from './sim.js';
import * as C from './combat.js';
import { drawHouseplant, ELEMENT } from './art.js';

const KEY = 'plantus.lab.v1';
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tierTag = (t) => `<span class="tier" style="color:var(--t-${t})">${t}</span>`;
const elTag = (e) => `<span class="el" style="color:${ELEMENT[e]?.color}">${ELEMENT[e]?.icon || ''} ${e}</span>`;
const mins = (m) => (m < 1 ? `${Math.max(1, Math.round(m * 60))}s` : `${Math.round(m)}m`);

/* ------------------------------------------------------------ save */

let offset = 0;                     // tester fast-forward, in ms
const now = () => Date.now() + offset;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      offset = s.offset || 0;
      return s.save;
    }
  } catch { /* fall through */ }
  return L.freshSave(now());
}
let save = load();
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ save, offset })); } catch { /* private mode */ }
}

/* ------------------------------------------------------------ chrome */

function renderPlayer() {
  $('lvl').textContent = save.level;
  const need = L.RULES.xpPerLevel(save.level);
  $('xpFill').style.width = `${Math.min(100, (save.xp / need) * 100)}%`;
  $('xpText').textContent = `${Math.floor(save.xp)} / ${need} xp`;
  $('leaves').textContent = save.leaves;
}
function bump(id) { const el = $(id).parentElement; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

let toastT = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 3800);
}

function sheet(html) {
  $('sheet').innerHTML = html;
  $('overlay').hidden = false;
  $('sheet').querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeSheet));
}
function closeSheet() { $('overlay').hidden = true; $('sheet').innerHTML = ''; }
$('overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay') closeSheet(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

let tab = 'grow';
document.querySelectorAll('.tab').forEach((b) => (b.onclick = () => {
  tab = b.dataset.tab;
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('is-on', x === b));
  ['grow', 'vault', 'arena'].forEach((id) => ($(id).hidden = id !== tab));
  if (tab === 'vault') renderVault();
  if (tab === 'arena') renderArena();
}));

/* ------------------------------------------------------------ canvases */

// Every <canvas data-plant> on screen is redrawn each frame so plants sway.
function paintCanvases(t) {
  document.querySelectorAll('canvas[data-plant]').forEach((c) => {
    if (!c.offsetParent) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const p = L.BY_ID[c.dataset.plant];
    const pot = c.dataset.pot !== undefined ? save.pots[+c.dataset.pot] : null;
    const stage = pot ? L.stageOf(pot.growth) : +(c.dataset.stage ?? 4);
    const wilt = pot && !pot.withered ? Math.max(0, (50 - pot.health) / 50) * (pot.water <= 0 ? 1 : 0.5) : 0;
    // pot + rim take ~0.3 of `size`, the grown plant the rest, so 0.74 fills the frame
    drawHouseplant(ctx, w / 2, h - 2, h * 0.74, p, stage, t / 1000, { wilt, dead: !!pot?.withered });
  });
  requestAnimationFrame(paintCanvases);
}
requestAnimationFrame(paintCanvases);
const plantCanvas = (id, size, extra = '') => `<canvas data-plant="${id}" ${extra} style="width:${size}px;height:${size}px"></canvas>`;

/* ------------------------------------------------------------ growing table */

let growSig = '';
function signature() {
  return save.pots.map((p) => (p ? `${p.id}:${L.stageOf(p.growth)}:${L.potStatus(p, now())}` : '-')).join('|') + `|${save.unlocked.length}|${save.pots.length}`;
}

function renderGrow(force = false) {
  const sig = signature();
  if (!force && sig === growSig) { updateGrow(); return; }
  growSig = sig;

  const unlocked = L.getUnlockedPlants(save).sort((a, b) => L.tierIndex(a.tier) - L.tierIndex(b.tier));
  $('growBody').innerHTML = save.pots.map((pot, i) => {
    if (!pot) {
      return `<tr class="empty-row"><td>${'<div style="width:64px;height:64px;border:2px dashed var(--line);border-radius:12px"></div>'}</td>
        <td colspan="6" data-l="Pot ${i + 1}">Empty pot. Choose an unlocked plant to sow.</td>
        <td><div class="plant-pick"><select data-sow="${i}">${unlocked.map((p) => `<option value="${p.id}">${esc(p.name)} (${p.tier})</option>`).join('')}</select>
        <button class="btn btn--sm" data-plantbtn="${i}">Sow</button></div></td></tr>`;
    }
    const p = L.BY_ID[pot.id];
    return `<tr data-row="${i}">
      <td>${plantCanvas(p.id, 76, `data-pot="${i}"`)}</td>
      <td class="pname" data-l="Plant"><b>${esc(p.name)}</b><i>${esc(p.latin)}</i>${tierTag(p.tier)}</td>
      <td data-l="Element">${elTag(p.element)}</td>
      <td data-l="Stage"><div class="meter"><span data-f="stage"></span><div class="bar2 g"><span data-f="growth"></span></div><small data-f="next"></small></div></td>
      <td data-l="Water"><div class="meter"><div class="bar2 w" data-f="wbar"><span data-f="water"></span></div><small data-f="wtext"></small></div></td>
      <td data-l="Health"><div class="meter"><div class="bar2 h"><span data-f="health"></span></div><small data-f="htext"></small></div></td>
      <td data-l="Status"><span class="status" data-f="status"></span></td>
      <td><div class="acts">
        <button class="btn btn--sm btn--water" data-water="${i}">💧 Water</button>
        <button class="btn btn--sm btn--gold" data-cut="${i}">✂ Cuttings</button>
        <button class="btn btn--sm btn--ghost" data-info="${p.id}">Info</button>
        <button class="btn btn--sm btn--ghost" data-compost="${i}">Compost</button>
      </div></td></tr>`;
  }).join('');

  $('growBody').querySelectorAll('[data-plantbtn]').forEach((b) => (b.onclick = () => {
    const i = +b.dataset.plantbtn;
    const id = $('growBody').querySelector(`[data-sow="${i}"]`).value;
    const r = L.plantSeed(save, i, id, now());
    if (r.error) toast(r.error); else toast(`${L.BY_ID[id].name} sown. Keep it watered.`);
    commit(true);
  }));
  $('growBody').querySelectorAll('[data-water]').forEach((b) => (b.onclick = () => { L.water(save, +b.dataset.water); commit(); }));
  $('growBody').querySelectorAll('[data-cut]').forEach((b) => (b.onclick = () => {
    const n = L.collectBloom(save, +b.dataset.cut, now());
    if (n) { toast(`Took cuttings: +${n} 🍃`); bump('leaves'); }
    commit(true);
  }));
  $('growBody').querySelectorAll('[data-info]').forEach((b) => (b.onclick = () => openPlant(b.dataset.info)));
  $('growBody').querySelectorAll('[data-compost]').forEach((b) => (b.onclick = () => {
    const i = +b.dataset.compost;
    const name = L.BY_ID[save.pots[i].id].name;
    sheet(`<h2>Compost the ${esc(name)}?</h2><p class="lede">The pot is emptied and you get 10% of its tier cost back in leaves. The plant stays unlocked, so you can sow it again.</p>
      <div class="sheet-actions"><button class="btn btn--ghost" data-close>Keep it</button><button class="btn btn--danger" id="doCompost">Compost</button></div>`);
    $('doCompost').onclick = () => { const r = L.compost(save, i); closeSheet(); toast(`Composted. +${r} 🍃`); commit(true); };
  }));
  updateGrow();
}

function updateGrow() {
  const t = now();
  save.pots.forEach((pot, i) => {
    const row = $('growBody').querySelector(`[data-row="${i}"]`);
    if (!pot || !row) return;
    const f = (k) => row.querySelector(`[data-f="${k}"]`);
    const st = L.stageOf(pot.growth);
    const status = L.potStatus(pot, t);
    f('stage').textContent = `${L.STAGES[st]} · ${Math.floor(pot.growth)}%`;
    f('growth').style.width = `${pot.growth}%`;
    f('next').textContent = pot.withered ? 'withered'
      : st >= 4 ? (L.canCollect(pot, t) ? 'cuttings ready' : `cuttings in ${mins((L.RULES.bloomCooldownMin * 60000 - (t - pot.lastBloom)) / 60000)}`)
      : pot.water <= L.RULES.thirsty ? 'paused, needs water'
      : `${L.STAGES[st + 1]} in ${mins(L.minutesToNextStage(pot))}`;
    f('water').style.width = `${pot.water}%`;
    f('wbar').classList.toggle('low', pot.water <= L.RULES.thirsty);
    f('wtext').textContent = `${Math.round(pot.water)}% · −${L.drainPerMin(L.BY_ID[pot.id]).toFixed(0)}/min`;
    f('health').style.width = `${pot.health}%`;
    f('htext').textContent = `${Math.round(pot.health)}%`;
    const s = f('status');
    s.className = `status ${status}`;
    s.textContent = { growing: 'Growing', thirsty: 'Thirsty', parched: 'Parched!', ready: 'Cuttings ready', blooming: 'Blooming', withered: 'Withered' }[status];
    row.querySelector('[data-water]').disabled = pot.withered || pot.water >= 100;
    row.querySelector('[data-cut]').disabled = !L.canCollect(pot, t);
  });

  const filled = save.pots.filter(Boolean);
  const thirsty = filled.filter((p) => !p.withered && p.water <= L.RULES.thirsty).length;
  $('growSummary').innerHTML = `<span><b>${filled.length}</b> / ${save.pots.length} pots</span>
    <span><b>${filled.filter((p) => L.stageOf(p.growth) >= 2 && !p.withered).length}</b> battle-ready</span>
    ${thirsty ? `<span style="color:var(--pollen)">💧 <b style="color:inherit">${thirsty}</b> need water</span>` : ''}`;
  const c = L.nextPotCost(save);
  const bp = $('buyPot');
  bp.textContent = c === null ? `All ${L.RULES.maxPots} pots placed` : `+ Add a pot (${c} 🍃)`;
  bp.disabled = c === null || save.leaves < c;
}
$('buyPot').onclick = () => { if (L.buyPot(save)) { toast('New pot on the table.'); bump('leaves'); commit(true); } };

/* ------------------------------------------------------------ vault */

let vaultTier = 'all';
function renderVault() {
  $('tierChips').innerHTML = ['all', ...TIERS].map((t) =>
    `<button class="chip ${vaultTier === t ? 'is-on' : ''}" data-tier="${t}">${t === 'all' ? 'All tiers' : `${t} · Lv ${TIER_LEVEL[t]}`}</button>`).join('');
  $('tierChips').querySelectorAll('.chip').forEach((c) => (c.onclick = () => { vaultTier = c.dataset.tier; renderVault(); }));

  const list = PLANTS.filter((p) => vaultTier === 'all' || p.tier === vaultTier)
    .sort((a, b) => L.tierIndex(a.tier) - L.tierIndex(b.tier) || a.name.localeCompare(b.name));
  $('vaultBody').innerHTML = list.map((p) => {
    const have = L.isPlantUnlocked(save, p.id);
    const can = L.canUnlockPlant(save, p.id);
    const lvlOk = save.level >= TIER_LEVEL[p.tier];
    const s = p.stats;
    const action = have ? '<span class="status growing">Unlocked</span>'
      : can ? `<button class="btn btn--sm" data-unlock="${p.id}">Unlock · ${TIER_COST[p.tier]} 🍃</button>`
      : `<span class="gate">${lvlOk ? `Need ${TIER_COST[p.tier]} 🍃` : `🔒 Level ${TIER_LEVEL[p.tier]}`}</span>`;
    return `<tr class="${have ? '' : 'locked'}" data-open="${p.id}">
      <td>${plantCanvas(p.id, 56, 'data-stage="4"')}</td>
      <td class="pname"><b>${esc(p.name)}</b><i>${esc(p.latin)}</i></td>
      <td data-l="Tier">${tierTag(p.tier)}</td>
      <td data-l="Element">${elTag(p.element)}</td>
      <td class="num" data-l="HP">${s.health}</td><td class="num" data-l="ATK">${s.attack}</td><td class="num" data-l="DEF">${s.defense}</td>
      <td class="num" data-l="SPD">${s.speed}</td><td class="num" data-l="CRIT">${s.critChance}%</td>
      <td data-l="Range">${s.range}</td>
      <td data-l="Traits"><div class="traits">${p.traits.map((t) => `<span>${esc(t)}</span>`).join('')}</div></td>
      <td>${action}</td></tr>`;
  }).join('');
  $('vaultBody').querySelectorAll('[data-unlock]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); doUnlock(b.dataset.unlock); }));
  $('vaultBody').querySelectorAll('[data-open]').forEach((r) => (r.onclick = () => openPlant(r.dataset.open)));
}

function doUnlock(id) {
  if (L.unlockPlant(save, id)) {
    toast(`${L.BY_ID[id].name} unlocked. Sow it on your growing table.`);
    bump('leaves');
    commit(true);
    if (tab === 'vault') renderVault();
    closeSheet();
  }
}

function openPlant(id) {
  const p = L.BY_ID[id], a = p.aesthetic, pw = p.power, s = p.stats;
  const have = L.isPlantUnlocked(save, id);
  const bar = (k, v, max = 110) => `<div><span>${k}</span><i><span style="width:${Math.min(100, (v / max) * 100)}%"></span></i><b>${v}</b></div>`;
  sheet(`
    <div class="sheet-top">${plantCanvas(id, 110, 'data-stage="4"')}
      <div><h2>${esc(p.name)}</h2><p class="latin">${esc(p.latin)}</p>${tierTag(p.tier)} ${elTag(p.element)}</div></div>
    <h4>Stats</h4>
    <div class="statbars">${bar('HP', s.health)}${bar('ATK', s.attack)}${bar('DEF', s.defense)}${bar('SPD', s.speed)}${bar('CRIT', s.critChance, 30)}</div>
    <dl class="kv" style="margin-top:10px"><dt>Range</dt><dd>${s.range}</dd><dt>Energy cost</dt><dd>${s.energyCost}</dd><dt>Traits</dt><dd>${p.traits.map(esc).join(', ')}</dd></dl>
    <h4>Signature attack · ${esc(pw.attackName)}</h4>
    <dl class="kv"><dt>Does</dt><dd>${esc(pw.attackDescription)}</dd><dt>Projectile</dt><dd>${esc(pw.projectileVisual)}</dd>
      <dt>Impact</dt><dd>${esc(pw.impactVisual)}</dd><dt>Special</dt><dd>${esc(pw.specialEffectVisual)}</dd><dt>Sound</dt><dd>${esc(pw.soundStyle)}</dd></dl>
    <h4>Look</h4>
    <dl class="kv"><dt>Colours</dt><dd>${esc(a.primaryColor)} / ${esc(a.secondaryColor)}</dd><dt>Body</dt><dd>${esc(a.bodyShape)}</dd>
      <dt>Leaves</dt><dd>${esc(a.leafStyle)}</dd><dt>Rarity look</dt><dd>${esc(a.rarityLook)}</dd><dt>Aura</dt><dd>${esc(a.auraEffect)}</dd><dt>Idle</dt><dd>${esc(a.idleAnimationStyle)}</dd></dl>
    <div class="sheet-actions">
      ${have ? '' : L.canUnlockPlant(save, id) ? `<button class="btn" id="sheetUnlock">Unlock · ${TIER_COST[p.tier]} 🍃</button>` : `<span class="gate">Needs level ${TIER_LEVEL[p.tier]} and ${TIER_COST[p.tier]} 🍃</span>`}
      <button class="btn btn--ghost" data-close>Close</button>
    </div>`);
  const u = $('sheetUnlock'); if (u) u.onclick = () => doUnlock(id);
}

/* ------------------------------------------------------------ arena */

let pick = null, foe = null, fight = null;
function renderArena() {
  const ready = save.pots.map((p, i) => ({ p, i })).filter(({ p }) => p && !p.withered && L.stageOf(p.growth) >= 2);
  const body = $('arenaBody');
  if (!ready.length) {
    body.innerHTML = `<div class="panel empty"><h3>No fighters yet</h3><p>Grow a plant to <b>Juvenile</b> (40%) on your table to send it into the arena.</p></div>`;
    return;
  }
  if (pick === null || !ready.some((r) => r.i === pick)) pick = ready[0].i;
  const pot = save.pots[pick];
  const me = C.fighter(pot.id, L.stageOf(pot.growth));
  if (!foe) foe = C.wildOpponent(save.level, PLANTS, TIER_LEVEL);
  const advMe = C.hasElementAdvantage(me.element, foe.element), advFoe = C.hasElementAdvantage(foe.element, me.element);

  const fcard = (f, side, adv) => `<div class="fcard">${plantCanvas(f.id, 96, side === 'me' ? `data-pot="${pick}"` : `data-stage="${f.stage}"`)}
    <h3>${esc(f.name)}</h3><div>${tierTag(f.tier)} ${elTag(f.element)}</div><p class="atk">${esc(f.power.attackName)} · ${f.stageName}</p>
    <small>ATK ${f.stats.attack} · DEF ${f.stats.defense} · SPD ${f.stats.speed} · CRIT ${f.stats.critChance}%</small>
    ${adv ? '<div class="fine" style="color:var(--chloro)">Element advantage +25%</div>' : ''}
    <div class="hp"><span id="hp-${side}" style="width:100%"></span></div><div class="hpt" id="hpt-${side}">${f.maxHp} / ${f.maxHp} HP</div></div>`;

  body.innerHTML = `
    <div class="panel">
      <h4 style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--chloro)">Choose your fighter</h4>
      <div class="pick-grid">${ready.map(({ p, i }) => `<button class="pick ${i === pick ? 'is-on' : ''}" data-pick="${i}">
        ${plantCanvas(p.id, 56, `data-pot="${i}"`)}<b>${esc(L.BY_ID[p.id].name)}</b><small>${L.STAGES[L.stageOf(p.growth)]} · ${Math.round(p.health)}% health</small></button>`).join('')}</div>
      <div class="versus">${fcard(me, 'me', advMe)}<div class="vs">VS${advMe ? '<small>you have the edge</small>' : advFoe ? '<small style="color:var(--danger)">they have the edge</small>' : ''}</div>${fcard(foe, 'foe', advFoe)}</div>
      <div class="log" id="fightLog" hidden></div>
      <div class="result" id="fightResult" hidden></div>
      <div class="arena-actions">
        <button class="btn btn--xl" id="fightBtn">⚔️ Fight</button>
        <button class="btn btn--ghost" id="rerollBtn">New challenger</button>
      </div>
    </div>`;
  body.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => { if (!fight) { pick = +b.dataset.pick; renderArena(); } }));
  $('rerollBtn').onclick = () => { if (!fight) { foe = null; renderArena(); } };
  $('fightBtn').onclick = () => runFight(me, foe);
}

function runFight(me, them) {
  if (fight) return;
  const res = C.battle(me, them);
  fight = res;
  $('fightBtn').disabled = true; $('rerollBtn').disabled = true;
  const log = $('fightLog'); log.hidden = false; log.innerHTML = '';
  let k = 0;
  const step = () => {
    if (k >= res.log.length) return finish();
    const e = res.log[k++];
    const cls = [e.who === me.id && e.kind !== 'dot' ? 'me' : 'them', e.crit ? 'crit' : '', e.dodged ? 'dodged' : '', e.kind].join(' ');
    log.insertAdjacentHTML('beforeend', `<p class="${cls}">T${e.turn} · ${esc(e.text)}</p>`);
    log.scrollTop = log.scrollHeight;
    $('hp-me').style.width = `${(e.hpA / res.maxA) * 100}%`; $('hpt-me').textContent = `${e.hpA} / ${res.maxA} HP`;
    $('hp-foe').style.width = `${(e.hpB / res.maxB) * 100}%`; $('hpt-foe').textContent = `${e.hpB} / ${res.maxB} HP`;
    setTimeout(step, 420);
  };
  const finish = () => {
    save.stats.battles += 1;
    const pot = save.pots[pick];
    const r = $('fightResult'); r.hidden = false;
    if (res.winner === 'a') {
      const leaves = 20 + 8 * L.tierIndex(them.tier), xp = 25 + 10 * L.tierIndex(them.tier);
      save.leaves += leaves; save.stats.wins += 1;
      const lv = L.addXp(save, xp);
      r.innerHTML = `🏆 ${esc(me.name)} wins! <span style="color:var(--chloro)">+${leaves} 🍃 · +${xp} xp</span>${lv ? ' · <span style="color:var(--pollen)">Level up!</span>' : ''}`;
      bump('leaves');
    } else {
      if (pot) pot.health = Math.max(5, pot.health - 25);
      r.innerHTML = res.winner === 'b'
        ? `🥀 ${esc(them.name)} wins. Your plant took a beating (−25 health), so water it so it recovers.`
        : '🤝 Time ran out: a draw. Your plant is tired (−25 health).';
    }
    commit(true);
    $('fightBtn').textContent = 'Fight again';
    $('fightBtn').disabled = false; $('rerollBtn').disabled = false;
    $('fightBtn').onclick = () => { fight = null; foe = null; renderArena(); };
    fight = null;
  };
  step();
}

/* ------------------------------------------------------------ loop */

function announce(events) {
  for (const e of events) {
    const name = L.BY_ID[e.id].name;
    if (e.type === 'stage') toast(`${name} reached ${L.STAGES[e.stage]} · +${e.xp} xp${e.levels ? ` · LEVEL ${save.level}!` : ''}`);
    if (e.type === 'wilting') toast(`${name} is wilting. Water it!`);
    if (e.type === 'withered') toast(`${name} withered. Compost it to free the pot.`);
    if (e.type === 'stage' && e.levels) bump('lvl');
  }
}

function commit(structural = false) {
  persist();
  renderPlayer();
  renderGrow(structural);
}

function loop() {
  const events = L.tick(save, now());
  if (events.length) announce(events);
  commit();
}
setInterval(loop, 1000);
loop();
renderGrow(true);

/* ------------------------------------------------------------ tester tools */

document.querySelectorAll('[data-ff]').forEach((b) => (b.onclick = () => {
  offset += +b.dataset.ff * 60000;
  loop();
  toast(`Skipped ahead ${b.dataset.ff} min.`);
}));
$('giveLeaves').onclick = () => { save.leaves += 200; bump('leaves'); commit(true); if (tab === 'vault') renderVault(); };
$('giveLevel').onclick = () => { save.level += 1; save.xp = 0; bump('lvl'); commit(true); if (tab === 'vault') renderVault(); };
$('resetLab').onclick = () => {
  sheet(`<h2>Reset the Lab?</h2><p class="lede">Clears your Lab level, leaves, unlocks and pots. Your main PlantUs garden is not touched.</p>
    <div class="sheet-actions"><button class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--danger" id="doReset">Reset</button></div>`);
  $('doReset').onclick = () => { offset = 0; save = L.freshSave(now()); pick = null; foe = null; closeSheet(); commit(true); if (tab !== 'grow') document.querySelector(`[data-tab="${tab}"]`).click(); };
};
