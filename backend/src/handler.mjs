// handler.mjs — the whole PlantUs API in one Lambda.
//
//   GET    /health          no auth, liveness check
//   GET    /save            the player's synced garden save
//   PUT    /save            replace it
//   POST   /identify        photo -> Bedrock -> plant synopsis, archived as a find
//   GET    /finds           the player's herbarium, newest first
//   DELETE /finds/{id}      remove one find and its photo
//
// The player id is the Cognito `sub`, taken from the JWT the HTTP API has
// already verified. Nothing here trusts a user id sent in the body.
//
// Table layout (single table, pk = USER#<sub>):
//   SAVE                    { state, updatedAt }
//   FIND#<iso>#<id>         one sighting, with the full synopsis
//   SPECIES#<latin>         { count, firstSeen } — how "new species" is decided
//   QUOTA#<yyyy-mm-dd>      { n, ttl } — daily identify counter

import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand,
  QueryCommand, DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const TABLE = process.env.TABLE;
const PHOTO_BUCKET = process.env.PHOTO_BUCKET;
const MODEL_ID = process.env.MODEL_ID || 'us.amazon.nova-pro-v1:0';
const DAILY_SCAN_LIMIT = Number(process.env.DAILY_SCAN_LIMIT || 25);
const REGION = process.env.AWS_REGION || 'us-east-1';

const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;   // decoded; the client sends ~200 KB
const MAX_SAVE_BYTES = 200 * 1024;

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({ region: REGION });
const bedrock = new BedrockRuntimeClient({ region: REGION });

// Field guide ids the model may link a sighting to (js/data/biology.js).
export const TOPICS = [
  'photosynthesis', 'chlorophyll', 'stomata', 'xylem', 'transpiration', 'roots',
  'germination', 'pollination', 'nectar', 'seeddispersal', 'tropism', 'defence',
  'fungusFact', 'water_need', 'bark', 'bloomcycle', 'sunflecks', 'ballistic',
];
const PLANT_TYPES = ['tree', 'shrub', 'herb', 'flower', 'succulent', 'cactus', 'fern', 'grass', 'vine', 'moss', 'aquatic', 'houseplant', 'fungus', 'other'];
const RARITY = ['common', 'uncommon', 'rare'];

/* ------------------------------------------------------------------ http */

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const fail = (statusCode, error, extra = {}) => json(statusCode, { error, ...extra });

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function handler(event) {
  const route = event.routeKey || `${event.requestContext?.http?.method} ${event.rawPath}`;
  if (route === 'GET /health') return json(200, { ok: true, model: MODEL_ID });

  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return fail(401, 'Sign in first.');
  const pk = `USER#${sub}`;

  try {
    switch (route) {
      case 'GET /save': return await getSave(pk);
      case 'PUT /save': return await putSave(pk, parseBody(event));
      case 'POST /identify': return await identify(pk, sub, parseBody(event));
      case 'GET /finds': return await listFinds(pk);
      case 'DELETE /finds/{id}': return await deleteFind(pk, event.pathParameters?.id);
      default: return fail(404, `No route ${route}`);
    }
  } catch (err) {
    console.error(route, err);
    return fail(500, 'Something went wrong on our side. Try again in a moment.');
  }
}

/* ------------------------------------------------------------------ save */

async function getSave(pk) {
  const { Item } = await db.send(new GetCommand({ TableName: TABLE, Key: { pk, sk: 'SAVE' } }));
  return json(200, Item ? { state: Item.state, updatedAt: Item.updatedAt } : { state: null, updatedAt: 0 });
}

async function putSave(pk, body) {
  if (!body || typeof body.state !== 'object' || body.state === null) return fail(400, 'Expected { state }.');
  if (JSON.stringify(body.state).length > MAX_SAVE_BYTES) return fail(413, 'Save is too large.');
  const updatedAt = Number(body.updatedAt) || Date.now();
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: { pk, sk: 'SAVE', state: body.state, updatedAt },
  }));
  return json(200, { ok: true, updatedAt });
}

/* ------------------------------------------------------------------ identify */

const SYSTEM = `You are the field botanist inside PlantUs, a biology learning game. You look at one photo and identify the plant in it.
Respond with ONLY a JSON object, no prose and no code fences. Be accurate first and kind second: if you are unsure, say so through a lower confidence and a less specific name (genus or family) rather than guessing a species.

If the photo does not clearly show a plant (or a fungus, lichen or alga), return:
{"isPlant": false, "message": "<one friendly sentence on what you see and how to take a better plant photo>"}

Otherwise return exactly these keys:
{
  "isPlant": true,
  "confidence": <number 0-1>,
  "commonName": "<most widely used English name>",
  "scientificName": "<Genus species, or Genus sp. if unsure>",
  "family": "<botanical family, e.g. Asteraceae>",
  "plantType": "<one of: ${PLANT_TYPES.join(', ')}>",
  "summary": "<2-3 sentences a curious 12-year-old would enjoy: what it is and how to recognise it>",
  "identifyingFeatures": ["<visible feature in THIS photo that supports the ID>", "<another>"],
  "nativeRange": "<where it is native>",
  "care": {"light": "<short>", "water": "<short>", "soil": "<short>"},
  "biology": "<one real plant-biology fact about this plant, 1-2 sentences>",
  "relatedTopic": "<one of: ${TOPICS.join(', ')}> — the field guide topic the biology fact best illustrates",
  "toxicity": "<short note on toxicity to people and pets, or 'Not known to be toxic'>",
  "rarity": "<one of: ${RARITY.join(', ')}> — how often a person would come across it",
  "lookalikes": ["<a plant often confused with it>"]
}`;

function decodeImage(body) {
  if (!body || typeof body.image !== 'string') return { error: 'Expected { image: <base64 jpeg/png/webp> }.' };
  let b64 = body.image;
  let format = (body.format || '').toLowerCase();
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,/.exec(b64);
  if (m) { format = m[1]; b64 = b64.slice(m[0].length); }
  if (format === 'jpg') format = 'jpeg';
  if (!['jpeg', 'png', 'webp'].includes(format)) format = 'jpeg';
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length < 1000) return { error: 'That image is empty or too small.' };
  if (bytes.length > MAX_IMAGE_BYTES) return { error: 'That image is too large. Try a smaller photo.' };
  return { bytes, format };
}

/** Pull the first balanced JSON object out of a model reply. */
export function extractJson(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const list = (v, n, len) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, n).map((x) => clip(x, len)) : []);

/** Never hand the client raw model output: coerce every field to a known shape. */
export function normalise(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.isPlant === false) {
    return { isPlant: false, message: clip(raw.message, 300) || 'I could not find a plant in that photo. Try filling the frame with leaves or flowers.' };
  }
  const commonName = clip(raw.commonName, 80);
  const scientificName = clip(raw.scientificName, 80);
  if (!commonName && !scientificName) return null;
  const care = raw.care && typeof raw.care === 'object' ? raw.care : {};
  const conf = Number(raw.confidence);
  return {
    isPlant: true,
    confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5,
    commonName: commonName || scientificName,
    scientificName: scientificName || commonName,
    family: clip(raw.family, 60),
    plantType: PLANT_TYPES.includes(raw.plantType) ? raw.plantType : 'other',
    summary: clip(raw.summary, 600),
    identifyingFeatures: list(raw.identifyingFeatures, 4, 160),
    nativeRange: clip(raw.nativeRange, 160),
    care: { light: clip(care.light, 120), water: clip(care.water, 120), soil: clip(care.soil, 120) },
    biology: clip(raw.biology, 400),
    relatedTopic: TOPICS.includes(raw.relatedTopic) ? raw.relatedTopic : 'photosynthesis',
    toxicity: clip(raw.toxicity, 200),
    rarity: RARITY.includes(raw.rarity) ? raw.rarity : 'common',
    lookalikes: list(raw.lookalikes, 3, 80),
  };
}

export const speciesKey = (name) =>
  name.toLowerCase().replace(/\s+sp{1,2}\.?$/, '').replace(/[^a-z\s-]/g, '').trim().replace(/\s+/g, ' ');

export async function askModel(bytes, format) {
  const res = await bedrock.send(new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: SYSTEM }],
    messages: [{
      role: 'user',
      content: [
        { image: { format, source: { bytes } } },
        { text: 'Identify the plant in this photo. JSON only.' },
      ],
    }],
    inferenceConfig: { maxTokens: 1200, temperature: 0.2 },
  }));
  const text = (res.output?.message?.content || []).map((c) => c.text || '').join('');
  return normalise(extractJson(text));
}

async function takeQuota(pk) {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const { Attributes } = await db.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk, sk: `QUOTA#${day}` },
      UpdateExpression: 'ADD n :one SET #ttl = if_not_exists(#ttl, :ttl)',
      ConditionExpression: 'attribute_not_exists(n) OR n < :lim',
      ExpressionAttributeNames: { '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':one': 1, ':lim': DAILY_SCAN_LIMIT, ':ttl': Math.floor(Date.now() / 1000) + 3 * 86400 },
      ReturnValues: 'UPDATED_NEW',
    }));
    return { ok: true, left: DAILY_SCAN_LIMIT - Attributes.n };
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return { ok: false, left: 0 };
    throw err;
  }
}

async function giveBackQuota(pk) {
  const day = new Date().toISOString().slice(0, 10);
  await db.send(new UpdateCommand({
    TableName: TABLE, Key: { pk, sk: `QUOTA#${day}` },
    UpdateExpression: 'ADD n :neg', ExpressionAttributeValues: { ':neg': -1 },
  })).catch(() => {});
}

const photoUrl = (key) =>
  getSignedUrl(s3, new GetObjectCommand({ Bucket: PHOTO_BUCKET, Key: key }), { expiresIn: 6 * 3600 });

async function identify(pk, sub, body) {
  const img = decodeImage(body);
  if (img.error) return fail(400, img.error);

  const quota = await takeQuota(pk);
  if (!quota.ok) return fail(429, `That's all ${DAILY_SCAN_LIMIT} scans for today. Come back tomorrow, or go play for sun in the meantime.`, { scansLeft: 0 });

  let synopsis;
  try {
    synopsis = await askModel(img.bytes, img.format);
  } catch (err) {
    console.error('bedrock', err);
    await giveBackQuota(pk);
    return fail(502, 'The plant identifier is not answering right now. Your scan was not counted.');
  }
  if (!synopsis) {
    await giveBackQuota(pk);
    return fail(502, 'The identifier gave an answer we could not read. Your scan was not counted, so try again.');
  }
  if (!synopsis.isPlant) {
    await giveBackQuota(pk);
    return json(200, { ...synopsis, scansLeft: quota.left + 1 });
  }

  const id = randomUUID();
  const at = new Date().toISOString();
  const photoKey = `photos/${sub}/${id}.${img.format === 'jpeg' ? 'jpg' : img.format}`;
  await s3.send(new PutObjectCommand({
    Bucket: PHOTO_BUCKET, Key: photoKey, Body: img.bytes,
    ContentType: `image/${img.format}`, CacheControl: 'private, max-age=86400',
  }));

  const species = speciesKey(synopsis.scientificName) || speciesKey(synopsis.commonName);
  const { Attributes } = await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { pk, sk: `SPECIES#${species}` },
    UpdateExpression: 'ADD #c :one SET firstSeen = if_not_exists(firstSeen, :at), commonName = :cn',
    ExpressionAttributeNames: { '#c': 'count' },
    ExpressionAttributeValues: { ':one': 1, ':at': at, ':cn': synopsis.commonName },
    ReturnValues: 'UPDATED_NEW',
  }));
  const isNewSpecies = Attributes.count === 1;

  const find = {
    id, at, species, isNewSpecies, photoKey,
    lat: Number.isFinite(body.lat) ? body.lat : undefined,
    lng: Number.isFinite(body.lng) ? body.lng : undefined,
    note: clip(body.note, 280) || undefined,
    model: MODEL_ID,
    ...synopsis,
  };
  await db.send(new PutCommand({ TableName: TABLE, Item: { pk, sk: `FIND#${at}#${id}`, ...find } }));

  return json(200, { ...find, photoUrl: await photoUrl(photoKey), scansLeft: quota.left });
}

/* ------------------------------------------------------------------ herbarium */

async function listFinds(pk) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await db.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :p)',
      ExpressionAttributeValues: { ':pk': pk, ':p': 'FIND#' },
      ScanIndexForward: false,
      ExclusiveStartKey,
    }));
    items.push(...page.Items);
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey && items.length < 1000);

  const finds = await Promise.all(items.map(async ({ pk: _p, sk: _s, ...f }) => ({
    ...f, photoUrl: f.photoKey ? await photoUrl(f.photoKey) : null,
  })));
  return json(200, { finds });
}

async function deleteFind(pk, id) {
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return fail(400, 'Bad find id.');
  const { Items } = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :p)',
    FilterExpression: 'id = :id',
    ExpressionAttributeValues: { ':pk': pk, ':p': 'FIND#', ':id': id },
  }));
  const item = Items?.[0];
  if (!item) return fail(404, 'That find is already gone.');

  await db.send(new DeleteCommand({ TableName: TABLE, Key: { pk, sk: item.sk } }));
  if (item.photoKey) await s3.send(new DeleteObjectCommand({ Bucket: PHOTO_BUCKET, Key: item.photoKey })).catch(() => {});

  // Keep the species tally honest so re-finding a deleted plant counts as new again.
  const { Attributes } = await db.send(new UpdateCommand({
    TableName: TABLE, Key: { pk, sk: `SPECIES#${item.species}` },
    UpdateExpression: 'ADD #c :neg', ExpressionAttributeNames: { '#c': 'count' },
    ExpressionAttributeValues: { ':neg': -1 }, ReturnValues: 'UPDATED_NEW',
  }));
  if (Attributes.count <= 0) {
    await db.send(new DeleteCommand({ TableName: TABLE, Key: { pk, sk: `SPECIES#${item.species}` } }));
  }
  return json(200, { ok: true });
}
