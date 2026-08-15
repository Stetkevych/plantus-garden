// state.js — save file, token economy, growth rules.

import { SPECIES_ORDER, PLOT_UNLOCK_COST, MAX_STAGE, cost, plantusFor } from '../data/config.js';
import { STAGE_FACTS, GAME_FACTS } from '../data/biology.js';

const KEY = 'plantus.save.v1';

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((f) => f(state));

function fresh() {
  return {
    sun: 40,
    plantus: 0,
    plots: SPECIES_ORDER.map((sp, i) => ({ species: sp, stage: 0, unlocked: i === 0 })),
    facts: ['germination'],
    played: {},
    best: {},
    totals: { sunEarned: 40, quizRight: 0, quizAsked: 0, blooms: 0 },
  };
}

export let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw);
    const base = fresh();
    return { ...base, ...parsed, totals: { ...base.totals, ...(parsed.totals || {}) } };
  } catch {
    return fresh();
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

function commit() { save(); emit(); }

export function reset() {
  state = fresh();
  commit();
}

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

/* ---------- growth ---------- */

export function growthCost(i) {
  const p = state.plots[i];
  if (!p || p.stage >= MAX_STAGE) return null;
  return cost(p.species, p.stage + 1);
}

export function canGrow(i) {
  const c = growthCost(i);
  return c !== null && state.sun >= c;
}

/**
 * Spend SUN to advance one growth stage. Returns a report, or null if blocked.
 * Growing is the only way to mint PLANTUS — the positive-outcome currency.
 */
export function grow(i) {
  const p = state.plots[i];
  if (!p || !p.unlocked || p.stage >= MAX_STAGE) return null;
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
  commit();
  return true;
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
