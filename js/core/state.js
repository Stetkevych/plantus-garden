// state.js — save file, token economy, growth rules, plant care and field finds.

import { SPECIES, SPECIES_ORDER, PLOT_UNLOCK_COST, MAX_STAGE, cost, plantusFor, CARE, FIND_REWARD } from '../data/config.js';
import { STAGE_FACTS, GAME_FACTS } from '../data/biology.js';

const KEY = 'plantus.save.v1';

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((f) => f(state));

function fresh() {
  const now = Date.now();
  return {
    sun: 40,
    plantus: 0,
    plots: SPECIES_ORDER.map((sp, i) => ({ species: sp, stage: 0, unlocked: i === 0, water: CARE.start })),
    facts: ['germination'],
    played: {},
    best: {},
    totals: { sunEarned: 40, quizRight: 0, quizAsked: 0, blooms: 0, waterings: 0, finds: 0 },
    care: { clock: now, streak: 0, lastDay: null },
    herb: { rewarded: [] },          // species keys already paid out as "new"
    updatedAt: now,
  };
}

/** Fill in anything an older or remote save is missing. */
function upgrade(parsed) {
  const base = fresh();
  const out = {
    ...base, ...parsed,
    totals: { ...base.totals, ...(parsed.totals || {}) },
    care: { ...base.care, ...(parsed.care || {}) },
    herb: { ...base.herb, ...(parsed.herb || {}) },
  };
  out.plots = base.plots.map((bp, i) => {
    const p = (parsed.plots || [])[i] || {};
    return { ...bp, ...p, water: Number.isFinite(p.water) ? p.water : CARE.start };
  });
  return out;
}

export let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    return upgrade(JSON.parse(raw));
  } catch {
    return fresh();
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

function commit() { state.updatedAt = Date.now(); save(); emit(); }

export function reset() {
  state = fresh();
  commit();
}

/** Adopt a save that came from the cloud. Does not bump updatedAt. */
export function replaceState(remote) {
  state = upgrade(remote);
  settle();
  save();
  emit();
}

/** A rough measure of how far a save has come, used to pick between two saves. */
export const progressOf = (s) =>
  (s?.totals?.sunEarned || 0) + (s?.plantus || 0) * 4 + (s?.totals?.finds || 0) * 20 +
  (s?.plots || []).reduce((a, p) => a + (p.unlocked ? 50 + p.stage * 40 : 0), 0);

/* ---------- tokens ---------- */

export function addSun(n) {
  if (n <= 0) return;
  state.sun += n;
  state.totals.sunEarned += n;
  commit();
}

export function addPlantus(n) {
  if (n <= 0) return;
  state.plantus += n;
  commit();
}

/* ---------- field guide ---------- */

export function unlockFact(id) {
  if (!id || state.facts.includes(id)) return false;
  state.facts.push(id);
  commit();
  return true;
}

/* ---------- care ---------- */

const today = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const dayBefore = (d) => new Date(Date.parse(d) - 86400000).toISOString().slice(0, 10);

/**
 * Apply the moisture lost since the care clock last ran. Called before any read
 * that matters and on a timer, so the garden dries out even while the tab is
 * closed — the elapsed time is simply caught up on next load.
 */
export function settle(now = Date.now()) {
  const hours = Math.max(0, (now - (state.care.clock || now)) / 3600000);
  state.care.clock = now;
  if (hours <= 0) return false;
  let changed = false;
  state.plots.forEach((p) => {
    if (!p.unlocked) return;
    const next = Math.max(0, p.water - CARE.drainPerHour(p.species) * hours);
    if (Math.round(next) !== Math.round(p.water)) changed = true;
    p.water = next;
  });
  return changed;
}

/** Timer hook: catch up moisture and repaint if any plot visibly changed. */
export function tick() {
  if (settle()) { save(); emit(); }
}

export function zone(i) {
  const p = state.plots[i];
  if (!p || !p.unlocked) return 'locked';
  const sp = SPECIES[p.species];
  if (p.water < sp.thirsty) return 'thirsty';
  if (p.water > sp.soggy) return 'soggy';
  return 'healthy';
}

/** Hours until a healthy plot drops into thirsty, for the plot panel. */
export function hoursUntilThirsty(i) {
  const p = state.plots[i];
  const sp = SPECIES[p.species];
  return Math.max(0, (p.water - sp.thirsty) / CARE.drainPerHour(p.species));
}

/**
 * Pour one can on a plot. Returns what happened, including the once-a-day care
 * bonus when this pour leaves every open bed in its healthy band.
 */
export function water(i) {
  settle();
  const p = state.plots[i];
  if (!p || !p.unlocked) return null;
  const before = zone(i);
  p.water = Math.min(100, p.water + CARE.pour);
  state.totals.waterings += 1;
  const after = zone(i);

  let bonus = null;
  const allHealthy = state.plots.every((_, k) => !state.plots[k].unlocked || zone(k) === 'healthy');
  const d = today();
  if (allHealthy && state.care.lastDay !== d) {
    const streak = state.care.lastDay === dayBefore(d) ? state.care.streak + 1 : 1;
    const sun = CARE.dailyBonusSun + Math.min(CARE.streakSunCap, CARE.streakSunPerDay * (streak - 1));
    const plantus = streak % 7 === 0 ? CARE.weeklyPlantus : 0;
    state.care.streak = streak;
    state.care.lastDay = d;
    state.sun += sun;
    state.totals.sunEarned += sun;
    state.plantus += plantus;
    bonus = { streak, sun, plantus };
  }
  commit();
  return { before, after, water: p.water, bonus };
}

/** Streak is broken if yesterday went by without a full-garden care day. */
export function careStreak() {
  const d = today();
  const last = state.care.lastDay;
  if (!last) return 0;
  return last === d || last === dayBefore(d) ? state.care.streak : 0;
}
export const caredToday = () => state.care.lastDay === today();

/* ---------- growth ---------- */

export function growthCost(i) {
  const p = state.plots[i];
  if (!p || p.stage >= MAX_STAGE) return null;
  return cost(p.species, p.stage + 1);
}

export function canGrow(i) {
  const c = growthCost(i);
  return c !== null && state.sun >= c && zone(i) === 'healthy';
}

/**
 * Spend SUN to advance one growth stage. Returns a report, or null if blocked.
 * Growing is the only way to mint PLANTUS from the garden — and a wilted or
 * waterlogged plant cannot grow at all.
 */
export function grow(i) {
  settle();
  const p = state.plots[i];
  if (!p || !p.unlocked || p.stage >= MAX_STAGE) return null;
  if (zone(i) !== 'healthy') return null;
  const c = growthCost(i);
  if (state.sun < c) return null;

  state.sun -= c;
  p.stage += 1;

  const reward = plantusFor(p.species, p.stage);
  state.plantus += reward;

  const factId = STAGE_FACTS[p.stage];
  const isNewFact = factId && !state.facts.includes(factId);
  if (isNewFact) state.facts.push(factId);

  if (p.stage === MAX_STAGE) state.totals.blooms += 1;

  commit();
  return { stage: p.stage, spent: c, plantus: reward, factId: isNewFact ? factId : null };
}

export function plotUnlockCost(i) { return PLOT_UNLOCK_COST[i] ?? 999; }

export function unlockPlot(i) {
  const p = state.plots[i];
  if (!p || p.unlocked) return false;
  const c = plotUnlockCost(i);
  if (state.plantus < c) return false;
  state.plantus -= c;
  p.unlocked = true;
  p.water = CARE.start;
  commit();
  return true;
}

/* ---------- field finds ---------- */

/**
 * Pay out for a plant identified with the camera. The server says whether the
 * species is new to the herbarium; `herb.rewarded` makes sure deleting and
 * re-scanning a plant cannot farm the new-species bonus.
 */
export function recordFind(find) {
  const key = find.species;
  const isNew = !!find.isNewSpecies && !state.herb.rewarded.includes(key);
  const sun = isNew ? FIND_REWARD.newSpeciesSun : FIND_REWARD.repeatSun;
  const plantus = isNew ? (FIND_REWARD.newSpeciesPlantus[find.rarity] ?? FIND_REWARD.newSpeciesPlantus.common) : 0;
  if (isNew) state.herb.rewarded.push(key);
  state.sun += sun;
  state.totals.sunEarned += sun;
  state.plantus += plantus;
  state.totals.finds += 1;

  const factId = find.relatedTopic;
  const newFact = factId && !state.facts.includes(factId) ? factId : null;
  if (newFact) state.facts.push(newFact);
  commit();
  return { isNew, sun, plantus, newFact };
}

/* ---------- games ---------- */

export function recordRun(gameId, score, sun) {
  state.best[gameId] = Math.max(state.best[gameId] || 0, score);
  const firstTime = !state.played[gameId];
  state.played[gameId] = (state.played[gameId] || 0) + 1;
  state.sun += sun;
  state.totals.sunEarned += sun;

  let newFact = null;
  if (firstTime) {
    const f = GAME_FACTS[gameId];
    if (f && !state.facts.includes(f)) { state.facts.push(f); newFact = f; }
  }
  commit();
  return { best: state.best[gameId], newFact };
}

export function recordQuiz(right) {
  state.totals.quizAsked += 1;
  if (right) state.totals.quizRight += 1;
  commit();
}

settle();
