// sim.js — the Lab's rules: player progress, the unlock system (a direct port
// of unity/PlantUnlockSystem.cs), and the growing table. No DOM in here, so
// test/lab.test.mjs can drive it with a fake clock.

import { PLANTS, STARTER_IDS, TIER_LEVEL, TIER_COST, TIERS } from './plants.js';

export const BY_ID = Object.fromEntries(PLANTS.map((p) => [p.id, p]));
export const tierIndex = (tier) => TIERS.indexOf(tier);

export const STAGES = ['Seed', 'Sprout', 'Juvenile', 'Mature', 'Blooming'];
/** Growth % at which each stage begins. */
export const STAGE_AT = [0, 15, 40, 70, 100];

// Prototype pacing: minutes of well-watered growth from seed to bloom.
export const GROW_MINUTES = { Starter: 3, Common: 5, Rare: 10, Epic: 18, Legendary: 30, Mythic: 45 };

export const RULES = {
  startLeaves: 60,
  startPots: 3,
  maxPots: 6,
  potCost: [0, 0, 0, 60, 120, 200],   // cost of pot #n (index), first three free
  pour: 40,
  thirsty: 15,                        // below this, growth stops
  healthLossPerMin: 4,                // while bone dry
  healthRegenPerMin: 2,               // while watered
  bloomCooldownMin: 3,
  xpPerLevel: (lvl) => 80 * lvl,
};

/** Fast plants transpire more: speed drives how quickly the pot dries. */
export const drainPerMin = (plant) => 8 + plant.stats.speed / 10;
export const bloomLeaves = (plant) => 15 * (tierIndex(plant.tier) + 1);
export const stageXp = (plant, stage) => 4 * (tierIndex(plant.tier) + 1) * stage;

export const stageOf = (growth) => {
  let s = 0;
  STAGE_AT.forEach((at, i) => { if (growth >= at) s = i; });
  return s;
};

/* ------------------------------------------------------------ player */

export function freshSave(now = Date.now()) {
  const save = {
    v: 1,
    level: 1,
    xp: 0,
    leaves: RULES.startLeaves,
    unlocked: [],
    pots: Array.from({ length: RULES.startPots }, () => null),
    clock: now,
    stats: { battles: 0, wins: 0, blooms: 0, harvested: 0 },
  };
  initializeStarterPlants(save);
  return save;
}

// --- PlantUnlockSystem.cs, method for method ---

export function initializeStarterPlants(save) {
  for (const id of STARTER_IDS) if (!save.unlocked.includes(id)) save.unlocked.push(id);
  if (save.level < 1) save.level = 1;
}
export const isPlantUnlocked = (save, id) => save.unlocked.includes(id);
export const getRequiredLevelForPlant = (id) => (BY_ID[id] ? TIER_LEVEL[BY_ID[id].tier] : -1);
export const getUnlockCostForPlant = (id) => (BY_ID[id] ? TIER_COST[BY_ID[id].tier] : -1);

export function canUnlockPlant(save, id) {
  const p = BY_ID[id];
  if (!p || save.unlocked.includes(id)) return false;
  return save.level >= TIER_LEVEL[p.tier] && save.leaves >= TIER_COST[p.tier];
}

export function unlockPlant(save, id) {
  if (!canUnlockPlant(save, id)) return false;
  save.leaves -= TIER_COST[BY_ID[id].tier];
  save.unlocked.push(id);
  return true;
}

export const getUnlockedPlants = (save) => save.unlocked.map((id) => BY_ID[id]).filter(Boolean);
export const getPlantsAvailableAtLevel = (lvl) => PLANTS.filter((p) => lvl >= TIER_LEVEL[p.tier]);
export const getPlantsByTier = (tier) => PLANTS.filter((p) => p.tier === tier);
export const getCurrentlyUnlockablePlants = (save) => PLANTS.filter((p) => canUnlockPlant(save, p.id));

/** Award XP, levelling up as many times as it covers. Returns levels gained. */
export function addXp(save, n) {
  save.xp += n;
  let gained = 0;
  while (save.xp >= RULES.xpPerLevel(save.level)) {
    save.xp -= RULES.xpPerLevel(save.level);
    save.level += 1;
    gained += 1;
  }
  return gained;
}

/* ------------------------------------------------------------ growing table */

export function plantSeed(save, potIndex, id, now = Date.now()) {
  if (!isPlantUnlocked(save, id)) return { error: 'Unlock that plant first.' };
  if (potIndex < 0 || potIndex >= save.pots.length) return { error: 'No such pot.' };
  if (save.pots[potIndex]) return { error: 'That pot is taken.' };
  save.pots[potIndex] = { id, growth: 0, water: 45, health: 100, plantedAt: now, lastBloom: 0, withered: false };
  return { ok: true };
}

export function water(save, potIndex) {
  const pot = save.pots[potIndex];
  if (!pot || pot.withered) return false;
  pot.water = Math.min(100, pot.water + RULES.pour);
  return true;
}

export function nextPotCost(save) {
  return save.pots.length >= RULES.maxPots ? null : RULES.potCost[save.pots.length];
}

export function buyPot(save) {
  const c = nextPotCost(save);
  if (c === null || save.leaves < c) return false;
  save.leaves -= c;
  save.pots.push(null);
  return true;
}

export function compost(save, potIndex) {
  const pot = save.pots[potIndex];
  if (!pot) return 0;
  const refund = Math.round(TIER_COST[BY_ID[pot.id].tier] * 0.1);
  save.leaves += refund;
  save.pots[potIndex] = null;
  return refund;
}

export const canCollect = (pot, now = Date.now()) =>
  !!pot && !pot.withered && stageOf(pot.growth) === 4 && now - pot.lastBloom >= RULES.bloomCooldownMin * 60000;

/** Take cuttings from a blooming plant: leaves now, and it drops back to Mature. */
export function collectBloom(save, potIndex, now = Date.now()) {
  const pot = save.pots[potIndex];
  if (!canCollect(pot, now)) return 0;
  const n = bloomLeaves(BY_ID[pot.id]);
  save.leaves += n;
  save.stats.harvested += n;
  pot.lastBloom = now;
  pot.growth = STAGE_AT[3];
  return n;
}

/**
 * Advance every pot by the real time since the last tick. Returns events
 * (stage-ups, wilts, deaths) so the UI can announce them.
 */
export function tick(save, now = Date.now()) {
  const minutes = Math.max(0, (now - save.clock) / 60000);
  save.clock = now;
  const events = [];
  if (minutes <= 0) return events;

  // Step in one-minute slices so a long absence plays out in order:
  // the pot dries, growth stops, then health falls.
  let left = minutes;
  while (left > 0) {
    const dt = Math.min(1, left);
    left -= dt;
    save.pots.forEach((pot, i) => {
      if (!pot || pot.withered) return;
      const p = BY_ID[pot.id];
      pot.water = Math.max(0, pot.water - drainPerMin(p) * dt);
      if (pot.water > RULES.thirsty) {
        const before = stageOf(pot.growth);
        pot.growth = Math.min(100, pot.growth + (100 / GROW_MINUTES[p.tier]) * dt * (0.5 + pot.health / 200));
        pot.health = Math.min(100, pot.health + RULES.healthRegenPerMin * dt);
        const after = stageOf(pot.growth);
        for (let s = before + 1; s <= after; s++) {
          const xp = stageXp(p, s);
          const levels = addXp(save, xp);
          if (s === 4) save.stats.blooms += 1;
          events.push({ type: 'stage', pot: i, id: p.id, stage: s, xp, levels });
        }
      } else if (pot.water <= 0) {
        const was = pot.health;
        pot.health = Math.max(0, pot.health - RULES.healthLossPerMin * dt);
        if (was > 0 && pot.health === 0) { pot.withered = true; events.push({ type: 'withered', pot: i, id: p.id }); }
        else if (was >= 50 && pot.health < 50) events.push({ type: 'wilting', pot: i, id: p.id });
      }
    });
  }
  return events;
}

/** How a pot is doing, for the table's status column. */
export function potStatus(pot, now = Date.now()) {
  if (!pot) return 'empty';
  if (pot.withered) return 'withered';
  if (pot.water <= 0) return 'parched';
  if (pot.water <= RULES.thirsty) return 'thirsty';
  if (stageOf(pot.growth) === 4) return canCollect(pot, now) ? 'ready' : 'blooming';
  return 'growing';
}

/** Minutes of watered growth left until the next stage. */
export function minutesToNextStage(pot) {
  const s = stageOf(pot.growth);
  if (s >= 4) return 0;
  const p = BY_ID[pot.id];
  const rate = (100 / GROW_MINUTES[p.tier]) * (0.5 + pot.health / 200);
  return (STAGE_AT[s + 1] - pot.growth) / rate;
}
