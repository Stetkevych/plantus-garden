// handler.test.mjs — the parts of the API that turn model output into data.
// node test/handler.test.mjs   (no AWS calls)

import assert from 'node:assert/strict';
process.env.TABLE = 'test'; process.env.PHOTO_BUCKET = 'test';
const { extractJson, normalise, speciesKey, TOPICS, handler } = await import('../src/handler.mjs');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`ok  ${name}`); };

t('extracts JSON wrapped in prose and fences', () => {
  const j = extractJson('Sure!\n```json\n{"isPlant": true, "commonName": "Fern {x}", "nested": {"a": 1}}\n``` done');
  assert.equal(j.commonName, 'Fern {x}');
  assert.equal(j.nested.a, 1);
});

t('returns null on malformed JSON', () => {
  assert.equal(extractJson('{"isPlant": tru'), null);
  assert.equal(extractJson('no json here'), null);
});

t('normalises a full plant answer and clamps fields', () => {
  const f = normalise({
    isPlant: true, confidence: 1.7, commonName: 'Common Sunflower', scientificName: 'Helianthus annuus',
    family: 'Asteraceae', plantType: 'flower', summary: 'x'.repeat(2000), relatedTopic: 'pollination',
    rarity: 'legendary', identifyingFeatures: ['big yellow head', 42, 'rough leaves'], care: { light: 'Full sun' },
  });
  assert.equal(f.confidence, 1);
  assert.equal(f.rarity, 'common');               // unknown rarity falls back
  assert.equal(f.summary.length, 600);
  assert.deepEqual(f.identifyingFeatures, ['big yellow head', 'rough leaves']);
  assert.equal(f.care.water, '');
  assert.ok(TOPICS.includes(f.relatedTopic));
});

t('unknown topic and type fall back to safe values', () => {
  const f = normalise({ isPlant: true, commonName: 'Thing', plantType: 'spaceship', relatedTopic: 'warp' });
  assert.equal(f.plantType, 'other');
  assert.equal(f.relatedTopic, 'photosynthesis');
  assert.equal(f.scientificName, 'Thing');
});

t('not-a-plant answer keeps a friendly message', () => {
  assert.deepEqual(normalise({ isPlant: false, message: 'That is a cat.' }), { isPlant: false, message: 'That is a cat.' });
  assert.match(normalise({ isPlant: false }).message, /plant/);
});

t('rejects answers with no name at all', () => {
  assert.equal(normalise({ isPlant: true }), null);
  assert.equal(normalise(null), null);
});

t('species keys are stable across formatting', () => {
  assert.equal(speciesKey('Helianthus annuus'), 'helianthus annuus');
  assert.equal(speciesKey('  Helianthus   Annuus '), 'helianthus annuus');
  assert.equal(speciesKey('Monstera sp.'), 'monstera');
  assert.equal(speciesKey('Rosa × damascena'), 'rosa damascena');
});

const r = await handler({ routeKey: 'GET /finds', requestContext: {} });
t('rejects requests without a verified user', () => assert.equal(r.statusCode, 401));
const h = await handler({ routeKey: 'GET /health' });
t('health is public', () => assert.equal(h.statusCode, 200));

console.log(`\n${n} passed`);
