// biology.js — the learning layer.
// Facts unlock through play; quizzes pay out SUN so learning is on the reward path.

export const FACTS = {
  photosynthesis: {
    title: 'Photosynthesis',
    body: 'Leaves take in carbon dioxide and water and use light energy to build sugar, releasing oxygen. Light, water and CO2 in — food and oxygen out.',
    tag: 'Leaf',
  },
  chlorophyll: {
    title: 'Why leaves are green',
    body: 'Chlorophyll absorbs red and blue light strongly but reflects green, so green is the colour that bounces back to your eye.',
    tag: 'Leaf',
  },
  stomata: {
    title: 'Stomata',
    body: 'Tiny mouths on the underside of a leaf. They open to let CO2 in, and close in heat or drought to stop water escaping.',
    tag: 'Leaf',
  },
  xylem: {
    title: 'Xylem and phloem',
    body: 'Xylem carries water up from the roots. Phloem carries sugar down from the leaves. Two pipes, opposite directions.',
    tag: 'Stem',
  },
  transpiration: {
    title: 'Transpiration',
    body: 'Water evaporating from leaves pulls a continuous thread of water up the stem — the plant drinks without a pump.',
    tag: 'Water',
  },
  roots: {
    title: 'Root hairs',
    body: 'Roots absorb water through microscopic hairs. They need oxygen too, which is why drowned soil kills plants.',
    tag: 'Root',
  },
  germination: {
    title: 'Germination',
    body: 'A seed needs water, oxygen and the right warmth to wake up. Light is not required — many seeds sprout underground in the dark.',
    tag: 'Seed',
  },
  pollination: {
    title: 'Pollination',
    body: 'Pollen must travel from anther to stigma. Insects do it by accident while feeding on nectar, and get paid in sugar.',
    tag: 'Flower',
  },
  nectar: {
    title: 'Nectar guides',
    body: 'Many petals carry ultraviolet stripes we cannot see. To a bee they are landing lights pointing straight at the nectar.',
    tag: 'Flower',
  },
  seeddispersal: {
    title: 'Seed dispersal',
    body: 'Seeds travel by wind, water, animal fur or gut. Moving away from the parent means less competition for light and water.',
    tag: 'Seed',
  },
  tropism: {
    title: 'Tropism',
    body: 'Plants move by growing. Shoots bend toward light (phototropism), roots grow down with gravity (gravitropism).',
    tag: 'Growth',
  },
  defence: {
    title: 'Plant defence',
    body: 'Thorns, bitter chemicals, thick bark and sticky resin are all defences. Some plants even call in wasps to attack caterpillars.',
    tag: 'Defence',
  },
  fungusFact: {
    title: 'Fungal disease',
    body: 'Fungi spread as spores and need moisture to invade. Good airflow and dry leaves are a plant\'s best protection.',
    tag: 'Defence',
  },
  water_need: {
    title: 'Water need varies',
    body: 'A cactus stores water and needs almost none. An oak moves over 150 litres on a hot day. Same rain, very different plants.',
    tag: 'Water',
  },
  bark: {
    title: 'Bark',
    body: 'Bark is dead corky tissue on the outside and living phloem just beneath. Damage it in a ring and the tree starves.',
    tag: 'Stem',
  },
  bloomcycle: {
    title: 'From bud to bloom',
    body: 'A bud is a packed-up flower. When the plant has enough stored sugar it commits to opening — an expensive, one-shot investment.',
    tag: 'Flower',
  },
};

// Which fact is awarded when a plant reaches each stage.
export const STAGE_FACTS = ['germination', 'chlorophyll', 'xylem', 'photosynthesis', 'bloomcycle', 'pollination'];

// Extra facts unlocked by playing each game at least once.
export const GAME_FACTS = {
  vine: 'tropism',
  clouds: 'water_need',
  bee: 'nectar',
  seeds: 'seeddispersal',
  survivors: 'defence',
};

// Post-game quiz. One question, drawn from the game you just played.
export const QUIZ = {
  vine: [
    { q: 'A vine grows toward a gap in the canopy. What is that called?',
      a: ['Phototropism', 'Germination', 'Transpiration'], correct: 0,
      why: 'Growth bending toward light is phototropism.' },
    { q: 'Which tissue carries sugar from the leaves down the stem?',
      a: ['Xylem', 'Phloem', 'Bark'], correct: 1,
      why: 'Phloem moves sugar. Xylem moves water upward.' },
    { q: 'Why does a damaged patch of bark put a plant at risk?',
      a: ['It looks untidy', 'It lets pathogens past the outer defence', 'It stops photosynthesis'], correct: 1,
      why: 'Bark is the plant\'s skin. A wound is an open door for disease.' },
  ],
  clouds: [
    { q: 'Which plant here needs the least water?',
      a: ['Oak sapling', 'Rose', 'Barrel cactus'], correct: 2,
      why: 'A cactus stores water in its stem and loses very little.' },
    { q: 'What pulls water up a tall stem without any pump?',
      a: ['Transpiration', 'Gravity', 'Pollination'], correct: 0,
      why: 'Evaporation from the leaves drags the water column upward.' },
    { q: 'Why is constantly waterlogged soil bad for roots?',
      a: ['Too cold', 'Roots cannot get oxygen', 'Too much sugar'], correct: 1,
      why: 'Roots respire. Standing water blocks the air they need.' },
  ],
  bee: [
    { q: 'What is the bee actually collecting when it pollinates?',
      a: ['Nectar and pollen', 'Seeds', 'Sap'], correct: 0,
      why: 'It feeds on nectar and carries pollen by accident.' },
    { q: 'Pollen has to reach which part of the flower?',
      a: ['The anther', 'The stigma', 'The root'], correct: 1,
      why: 'Anther makes pollen, stigma receives it.' },
    { q: 'Why are many petals patterned in ultraviolet?',
      a: ['To repel birds', 'To guide insects to nectar', 'To block sunlight'], correct: 1,
      why: 'They are landing lights for pollinators that see UV.' },
  ],
  seeds: [
    { q: 'Which three things does a seed need to germinate?',
      a: ['Water, oxygen, warmth', 'Light, soil, wind', 'Sugar, nitrogen, light'], correct: 0,
      why: 'Most seeds germinate fine in total darkness.' },
    { q: 'Why do plants spread their seeds far from home?',
      a: ['To find better soil colour', 'To avoid competing with the parent', 'To stay warm'], correct: 1,
      why: 'Distance means less competition for light and water.' },
    { q: 'What feeds a seedling before its first leaves open?',
      a: ['The soil', 'Stored food in the seed', 'Rainwater'], correct: 1,
      why: 'Cotyledons carry the packed lunch.' },
  ],
  survivors: [
    { q: 'A caterpillar damages a plant mainly by:',
      a: ['Eating leaf area used for photosynthesis', 'Drinking the roots', 'Blocking pollen'], correct: 0,
      why: 'Less leaf means less food made.' },
    { q: 'Which is a genuine plant defence?',
      a: ['Bitter chemicals in the leaves', 'Running away', 'Closing its roots'], correct: 0,
      why: 'Chemical defence is extremely common — think caffeine and nicotine.' },
    { q: 'Fungal attacks spread fastest when leaves are:',
      a: ['Dry and airy', 'Wet and crowded', 'Cold and bright'], correct: 1,
      why: 'Spores need moisture to germinate on the leaf surface.' },
  ],
};

export function pickQuiz(gameId) {
  const bank = QUIZ[gameId] || QUIZ.vine;
  return bank[Math.floor(Math.random() * bank.length)];
}
