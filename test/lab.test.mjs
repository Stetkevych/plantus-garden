// lab.test.mjs — rules for the Lab prototype (growing table, unlocks, combat).
// node test/lab.test.mjs

import assert from 'node:assert/strict';
import { PLANTS, TIER_LEVEL } from '../lab/plants.js';
import * as L from '../lab/sim.js';
import * as C from '../lab/combat.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`ok  ${name}`); };
const MIN = 60000;
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

t('roster parsed from Unity C#', () => {
  assert.equal(PLANTS.length, 21);
  for (const p of PLANTS) {
    assert.ok(p.name && p.latin && p.tier && p.element, p.id);
    assert.ok(p.stats.health > 0 && p.stats.attack > 0 && p.power.attackName, p.id);
  }
});

t('starters are unlocked on a fresh save', () => {
  const s = L.freshSave(0);
  assert.deepEqual(s.unlocked.sort(), ['hoya_kerrii', 'maranta_leuconeura', 'string_of_turtles']);
  assert.equal(s.level, 1);
});

t('unlock rules match PlantUnlockSystem.cs', () => {
  const s = L.freshSave(0);
  s.leaves = 1000;
  assert.equal(L.canUnlockPlant(s, 'ficus_elastica_tineke'), false);   // Common needs level 2
  s.level = 2;
  assert.equal(L.unlockPlant(s, 'ficus_elastica_tineke'), true);
  assert.equal(s.leaves, 950);
  assert.equal(L.unlockPlant(s, 'ficus_elastica_tineke'), false);      // already unlocked
  assert.equal(L.canUnlockPlant(s, 'spiritus_sancti'), false);         // Mythic needs 20
  assert.equal(L.getRequiredLevelForPlant('spiritus_sancti'), 20);
  assert.equal(L.getUnlockCostForPlant('nope'), -1);
  assert.ok(L.getPlantsAvailableAtLevel(5).every((p) => TIER_LEVEL[p.tier] <= 5));
});

t('a watered starter grows from seed to bloom', () => {
  const s = L.freshSave(0);
  L.plantSeed(s, 0, 'string_of_turtles', 0);
  let now = 0;
  const events = [];
  for (let m = 0; m < 8; m++) { L.water(s, 0); now += MIN; events.push(...L.tick(s, now)); }
  assert.equal(L.stageOf(s.pots[0].growth), 4);
  assert.deepEqual(events.filter((e) => e.type === 'stage').map((e) => e.stage), [1, 2, 3, 4]);
  assert.ok(s.level >= 1 && s.xp + s.level > 1);
});

t('growth stops when dry and the plant withers if neglected', () => {
  const s = L.freshSave(0);
  L.plantSeed(s, 0, 'hoya_kerrii', 0);
  const events = L.tick(s, 120 * MIN);
  const pot = s.pots[0];
  assert.equal(pot.withered, true);
  assert.ok(pot.growth < 100);
  assert.ok(events.some((e) => e.type === 'withered'));
  assert.equal(L.water(s, 0), false);
});

t('cuttings pay leaves and respect the cooldown', () => {
  const s = L.freshSave(0);
  L.plantSeed(s, 0, 'string_of_turtles', 0);
  s.pots[0].growth = 100;
  const before = s.leaves;
  assert.equal(L.collectBloom(s, 0, 10 * MIN), 15);
  assert.equal(s.leaves, before + 15);
  assert.equal(L.stageOf(s.pots[0].growth), 3);
  s.pots[0].growth = 100;
  assert.equal(L.collectBloom(s, 0, 11 * MIN), 0);
});

t('pots cost leaves after the first three', () => {
  const s = L.freshSave(0);
  assert.equal(L.nextPotCost(s), 60);
  assert.equal(L.buyPot(s), true);
  assert.equal(s.pots.length, 4);
  assert.equal(L.buyPot(s), false);   // 0 leaves left
});

t('element wheel matches the C#', () => {
  assert.equal(C.hasElementAdvantage('Nature', 'Water'), true);
  assert.equal(C.hasElementAdvantage('Water', 'Nature'), false);
  assert.equal(C.hasElementAdvantage('Electric', 'Water'), true);
});

t('resolveAttack: base damage, crit and element math', () => {
  const a = C.fighter('string_of_turtles', 4), d = C.fighter('ficus_audrey', 4);
  // speed 88 vs 46, so no dodge roll is possible; first roll decides crit
  const noCrit = C.resolveAttack(a, d, seq(0.99));
  assert.equal(noCrit.baseDamage, Math.max(5, 60 - Math.trunc(81 / 2)));
  assert.equal(noCrit.isCrit, false);
  assert.equal(noCrit.hasElementAdvantage, false);
  const crit = C.resolveAttack(a, d, seq(0));
  assert.equal(crit.isCrit, true);
  assert.equal(crit.finalDamage, Math.round(noCrit.baseDamage * 1.75));
});

t('dodge is capped at 20%', () => {
  const slow = C.fighter('colocasia_black_magic', 4);
  const blur = { ...slow, stats: { ...slow.stats, speed: 200 } };   // gap 162 -> 40%, capped to 20
  assert.equal(C.checkDodge(slow, blur, seq(0.195)), true);   // roll 20
  assert.equal(C.checkDodge(slow, blur, seq(0.205)), false);  // roll 21
  const fast = C.fighter('monstera_obliqua', 4);              // real roster: gap 57 -> 14%
  assert.equal(C.checkDodge(slow, fast, seq(0.135)), true);
  assert.equal(C.checkDodge(slow, fast, seq(0.145)), false);
});

t('battles finish and name a winner', () => {
  const r = C.battle(C.fighter('hoya_kerrii', 3), C.fighter('string_of_turtles', 3), seq(0.5, 0.1, 0.9, 0.3));
  assert.ok(r.log.length > 2);
  assert.ok(r.winner === 'a' || r.winner === 'b' || r.winner === null);
  assert.ok(r.hpA === 0 || r.hpB === 0 || r.log.length >= 30);
});

t('seedlings cannot fight', () => {
  assert.equal(C.fighter('hoya_kerrii', 1).maxHp, 0);
});

console.log(`\n${n} passed`);
