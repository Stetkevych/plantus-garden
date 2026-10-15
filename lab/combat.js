// combat.js — unity/plantcombatLogic.cs ported line for line, plus a battle
// loop around it. `rng` is injectable so tests can make fights deterministic.
//
// The C# resolves a single attack and only *names* most trait effects. The Lab
// gives four of them a small real effect so fights read the way the traits
// promise; those are marked "Lab extension" below.

import { BY_ID, STAGES } from './sim.js';

// C# rng.Next(1, 101): an integer 1..100
const roll100 = (rng) => 1 + Math.floor(rng() * 100);

export function hasElementAdvantage(a, d) {
  return (
    (a === 'Nature' && d === 'Water') ||
    (a === 'Water' && d === 'Fire') ||
    (a === 'Fire' && d === 'Nature') ||
    (a === 'Light' && d === 'Shadow') ||
    (a === 'Shadow' && d === 'Psychic') ||
    (a === 'Psychic' && d === 'Crystal') ||
    (a === 'Crystal' && d === 'Air') ||
    (a === 'Air' && d === 'Poison') ||
    (a === 'Poison' && d === 'Nature') ||
    (a === 'Electric' && d === 'Water')
  );
}

export function calculateBaseDamage(attacker, defender) {
  // C# integer division: Defense / 2 truncates
  const raw = attacker.stats.attack - Math.trunc(defender.stats.defense / 2);
  return raw < 5 ? 5 : raw;
}

export const rollCrit = (attacker, rng) => roll100(rng) <= attacker.stats.critChance;

export function checkDodge(attacker, defender, rng) {
  const gap = defender.stats.speed - attacker.stats.speed;
  if (gap <= 0) return false;
  const chance = Math.min(20, Math.trunc(gap / 4));
  return roll100(rng) <= chance;
}

function applyTraitModifiers(attacker, defender, result) {
  let m = 0;
  for (const trait of attacker.traits) {
    switch (trait) {
      case 'Glass Cannon': m += 0.15; result.effects.push('Glass Cannon Bonus'); break;
      case 'High Crit': if (result.isCrit) { m += 0.15; result.effects.push('High Crit Bonus'); } break;
      case 'Tank': case 'Tanky': break;
      case 'Piercing': m += 0.10; result.effects.push('Piercing Bonus'); break;
      case 'Poison': result.effects.push('Poison Applied'); break;
      case 'Root': result.effects.push('Root Chance'); break;
      case 'Bind': result.effects.push('Bind Chance'); break;
      case 'Confusion Chance': result.effects.push('Confusion Chance'); break;
      case 'Blind Chance': result.effects.push('Blind Chance'); break;
      case 'Silence': result.effects.push('Silence Chance'); break;
      case 'Healer': result.effects.push('Heal Pulse'); break;
      case 'Rapid Fire': m += 0.12; result.effects.push('Rapid Fire Bonus'); break;
      case 'Assassin':
        if (attacker.stats.speed > defender.stats.speed) { m += 0.20; result.effects.push('Assassin Speed Bonus'); }
        break;
      case 'AoE Bruiser': m += 0.08; result.effects.push('AoE Force'); break;
      case 'Very Fast': m += 0.10; result.effects.push('Speed Strike Bonus'); break;
      default: break;
    }
  }
  return m;
}

/** PlantCombatLogic.ResolveAttack */
export function resolveAttack(attacker, defender, rng = Math.random) {
  const result = {
    attackerId: attacker.id, defenderId: defender.id, attackName: attacker.power.attackName,
    baseDamage: 0, finalDamage: 0, isCrit: false, isDodged: false, hasElementAdvantage: false, effects: [], summary: '',
  };

  if (checkDodge(attacker, defender, rng)) {
    result.isDodged = true;
    result.summary = `${defender.name} dodged ${attacker.name}'s ${attacker.power.attackName}.`;
    return result;
  }

  const base = calculateBaseDamage(attacker, defender);
  result.baseDamage = base;
  let multiplier = 1;

  if (hasElementAdvantage(attacker.element, defender.element)) {
    multiplier += 0.25;
    result.hasElementAdvantage = true;
    result.effects.push('Element Advantage');
  }
  if (rollCrit(attacker, rng)) {
    multiplier += 0.75;
    result.isCrit = true;
    result.effects.push('Critical Hit');
  }
  multiplier += applyTraitModifiers(attacker, defender, result);

  result.finalDamage = Math.max(1, Math.round(base * multiplier));

  let s = `${attacker.name} used ${result.attackName} on ${defender.name} for ${result.finalDamage} damage`;
  if (result.isCrit) s += ' (CRIT)';
  if (result.hasElementAdvantage) s += ' (Element Advantage)';
  if (result.effects.length) s += `. Effects: ${result.effects.join(', ')}`;
  result.summary = s + '.';
  return result;
}

/* ------------------------------------------------------------ battles */

// Growth stage scales a plant's stats; seeds and sprouts cannot fight.
export const STAGE_POWER = [0, 0, 0.7, 0.85, 1];
// Unity Health values are ~55-100 against ~40-60 damage hits; the Lab
// multiplies HP so a fight lasts a few rounds instead of one exchange.
export const HP_SCALE = 4;

/** A plant at a growth stage, with stats scaled for battle. */
export function fighter(id, stage) {
  const p = BY_ID[id];
  const k = STAGE_POWER[stage] || 0;
  const s = p.stats;
  return {
    ...p,
    stage,
    stageName: STAGES[stage],
    stats: {
      ...s,
      attack: Math.round(s.attack * k),
      defense: Math.round(s.defense * k),
      speed: Math.round(s.speed * (0.8 + 0.2 * k)),
    },
    maxHp: Math.round(s.health * HP_SCALE * k),
  };
}

/**
 * Fight until one side drops or 30 turns pass. Faster plant moves first.
 * Returns the full log so the UI can replay it.
 */
export function battle(a, b, rng = Math.random) {
  const side = (f) => ({ f, hp: f.maxHp, poison: 0, held: false });
  const A = side(a), B = side(b);
  let [cur, other] = a.stats.speed >= b.stats.speed ? [A, B] : [B, A];
  const log = [];

  for (let turn = 1; turn <= 30 && A.hp > 0 && B.hp > 0; turn++) {
    // Lab extension: Poison ticks at the start of the poisoned plant's turn.
    if (cur.poison > 0) {
      const dot = Math.max(1, Math.round(cur.f.maxHp * 0.06));
      cur.hp = Math.max(0, cur.hp - dot);
      cur.poison -= 1;
      log.push({ turn, who: cur.f.id, text: `${cur.f.name} takes ${dot} poison damage.`, hpA: A.hp, hpB: B.hp, kind: 'dot' });
      if (cur.hp <= 0) break;
    }

    if (cur.held) {
      cur.held = false;
      log.push({ turn, who: cur.f.id, text: `${cur.f.name} is held in place and loses the turn.`, hpA: A.hp, hpB: B.hp, kind: 'held' });
    } else {
      const r = resolveAttack(cur.f, other.f, rng);
      other.hp = Math.max(0, other.hp - r.finalDamage);
      log.push({ turn, who: cur.f.id, text: r.summary, dmg: r.finalDamage, crit: r.isCrit, dodged: r.isDodged, adv: r.hasElementAdvantage, hpA: A.hp, hpB: B.hp, kind: 'hit' });

      if (!r.isDodged) {
        // Lab extensions for the traits the C# only names.
        if (r.effects.includes('Poison Applied')) other.poison = 2;
        if ((r.effects.includes('Root Chance') || r.effects.includes('Bind Chance')) && rng() < 0.25) other.held = true;
        if (r.effects.includes('Heal Pulse')) {
          const heal = Math.round(cur.f.maxHp * 0.08);
          cur.hp = Math.min(cur.f.maxHp, cur.hp + heal);
          log.push({ turn, who: cur.f.id, text: `${cur.f.name} pulses and heals ${heal}.`, hpA: A.hp, hpB: B.hp, kind: 'heal' });
        }
      }
    }
    [cur, other] = [other, cur];
  }

  const winner = A.hp === B.hp ? null : A.hp > B.hp ? 'a' : 'b';
  return { log, winner, hpA: A.hp, hpB: B.hp, maxA: a.maxHp, maxB: b.maxHp };
}

/** A wild challenger near the player's level, for the arena. */
export function wildOpponent(level, plants, tierLevel, rng = Math.random) {
  const pool = plants.filter((p) => tierLevel[p.tier] <= level + 1);
  const p = pool[Math.floor(rng() * pool.length)];
  const stage = level >= 6 ? 4 : level >= 3 ? 3 : 2;
  return fighter(p.id, stage);
}
