// config.js — single source of truth for growth, species, economy, hazards, power-ups.

export const PALETTE = {
  ink: '#12211A',
  ink2: '#1B3026',
  moss: '#2C4A3A',
  mossLt: '#3D6650',
  chloro: '#8BE06A',
  chloroDk: '#5FB544',
  pollen: '#FFC93C',
  petal: '#FF7EA8',
  rain: '#63C7F0',
  rainDk: '#3E9BC4',
  paper: '#EAF2E2',
  bark: '#8A5A38',
  barkLt: '#B98453',
  danger: '#E2564A',
  fungus: '#C79BE8',
  snow: '#DCEEF7',
  storm: '#6C5CA8',
};

// Six growth stages. Index === stage. Costs are in SUN tokens.
export const STAGES = [
  {
    key: 'seedling',
    name: 'Seedling',
    cost: 0,
    plantus: 0,
    caption: 'A seed has broken its coat. Cotyledons feed it until leaves take over.',
  },
  {
    key: 'small_leaves',
    name: 'Early growth — small leaves',
    cost: 30,
    plantus: 5,
    caption: 'First true leaves open. Chlorophyll starts capturing light.',
  },
  {
    key: 'medium',
    name: 'Medium growth',
    cost: 70,
    plantus: 8,
    caption: 'The stem thickens. Xylem and phloem move water up and sugar down.',
  },
  {
    key: 'large_leaves',
    name: 'Larger leaves',
    cost: 140,
    plantus: 12,
    caption: 'Bigger leaf area means more light captured — and more water lost.',
  },
  {
    key: 'buds',
    name: 'Advanced growth — flower buds',
    cost: 240,
    plantus: 18,
    caption: 'The plant switches from growing to reproducing. Buds form.',
  },
  {
    key: 'bloom',
    name: 'Fully blooming',
    cost: 380,
    plantus: 30,
    caption: 'Petals open to advertise nectar. Pollinators do the rest.',
  },
];

export const MAX_STAGE = STAGES.length - 1;

// Species. `water` is the Cloud Barrage requirement — deliberately very different
// per plant so the player learns that water need is a real botanical trait.
export const SPECIES = {
  sunflower: {
    id: 'sunflower', name: 'Sunflower', latin: 'Helianthus annuus',
    water: 5, costMul: 1, form: 'herb',
    petal: '#FFC93C', leaf: '#8BE06A', stem: '#5FB544',
    trait: 'Heliotropic — young heads track the sun across the sky.',
  },
  cactus: {
    id: 'cactus', name: 'Barrel Cactus', latin: 'Ferocactus wislizeni',
    water: 2, costMul: 0.8, form: 'succulent',
    petal: '#FF9F45', leaf: '#5FB544', stem: '#3D8C4E',
    trait: 'Stores water in its stem and opens its stomata only at night.',
  },
  fern: {
    id: 'fern', name: 'Lady Fern', latin: 'Athyrium filix-femina',
    water: 6, costMul: 1.1, form: 'fern',
    petal: '#8BE06A', leaf: '#6FCB52', stem: '#4A9A3C',
    trait: 'Reproduces with spores, not seeds — no flowers at all.',
  },
  rose: {
    id: 'rose', name: 'Garden Rose', latin: 'Rosa gallica',
    water: 8, costMul: 1.3, form: 'shrub',
    petal: '#FF7EA8', leaf: '#6FCB52', stem: '#4A9A3C',
    trait: 'Thorns are prickles — outgrowths of the skin, not modified stems.',
  },
  oak: {
    id: 'oak', name: 'Oak Sapling', latin: 'Quercus robur',
    water: 15, costMul: 1.6, form: 'tree',
    petal: '#C6E86A', leaf: '#5FB544', stem: '#8A5A38',
    trait: 'A mature oak can move over 150 litres of water a day by transpiration.',
  },
};

export const SPECIES_ORDER = ['sunflower', 'cactus', 'fern', 'rose', 'oak'];

// Plots beyond the first are bought with PLANTUS tokens.
export const PLOT_UNLOCK_COST = [0, 20, 45, 80, 130];

// Hazards shared across games — each carries the biology reason it exists.
export const HAZARDS = {
  caterpillar: { name: 'Caterpillar', color: '#A8D46A', why: 'Chewing insect. Eats leaf tissue, cutting photosynthesis.' },
  beetle:      { name: 'Beetle',      color: '#C97B3A', why: 'Bores into stems and disrupts the xylem water column.' },
  spider:      { name: 'Spider',      color: '#7B6FA8', why: 'Its web traps pollinators before they reach the flower.' },
  fungus:      { name: 'Fungus',      color: '#C79BE8', why: 'Spreads by spores across wet tissue and rots it.' },
  bark:        { name: 'Broken bark', color: '#8A5A38', why: 'A wound in the bark lets pathogens past the plant\'s skin.' },
  water:       { name: 'Water patch', color: '#63C7F0', why: 'Waterlogged soil starves roots of oxygen.' },
  hotspot:     { name: 'Hot spot',    color: '#E2564A', why: 'Heat forces stomata shut, so the plant stops taking in CO2.' },
};

// Power-ups shared across games.
export const POWERUPS = {
  supersun:   { name: 'Super Sun',   color: '#FFC93C', dur: 8, why: 'More light means a faster rate of photosynthesis.' },
  waterdrop:  { name: 'Water Drop',  color: '#63C7F0', dur: 0, why: 'Water is a raw ingredient of photosynthesis.' },
  barkshield: { name: 'Bark Shield', color: '#B98453', dur: 0, why: 'Bark is armour — a corky outer layer that blocks attackers.' },
  superbloom: { name: 'Super Bloom', color: '#FF7EA8', dur: 6, why: 'A mass flowering event overwhelms herbivores with sheer numbers.' },
  butterfly:  { name: 'Butterfly',   color: '#FF9F45', dur: 8, why: 'Butterflies carry pollen between flowers as they feed.' },
};

// Economy: how raw score converts into SUN tokens per game.
// Tuned against the bot harness in test/balance.mjs so a competent run pays roughly
// 65 sun in every game. No mini-game should be the shortcut.
export const SUN_RATE = {
  vine: 0.155,
  clouds: 0.023,
  bee: 0.041,
  seeds: 0.011,
  survivors: 0.054,
};

export const GAMES = [
  { id: 'vine',      title: 'Vine Garden',     tag: 'Snake',          verb: 'Grow one unbroken vine',  hint: 'Arrows / WASD / swipe' },
  { id: 'clouds',    title: 'Cloud Barrage',   tag: 'Bubble shooter', verb: 'Burst clouds, make rain', hint: 'Aim and tap to fire' },
  { id: 'bee',       title: 'Bee Rush',        tag: 'Endless runner', verb: 'Pollinate at speed',      hint: 'Left / right / up to hop' },
  { id: 'seeds',     title: 'Seed Crush',      tag: 'Match 3',        verb: 'Match and germinate',     hint: 'Drag a seed onto its neighbour' },
  { id: 'survivors', title: 'Plant Survivors', tag: 'Survivor-like',  verb: 'Defend the beds',         hint: 'WASD / drag to move' },
];

export const cost = (species, stage) =>
  Math.round(STAGES[stage].cost * SPECIES[species].costMul);

export const plantusFor = (species, stage) =>
  Math.round(STAGES[stage].plantus * SPECIES[species].costMul);
