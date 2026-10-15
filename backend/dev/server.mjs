// server.mjs — local development server for PlantUs.
//
//   cd backend && npm run dev          # http://localhost:8080
//
// Serves the site, and runs the REAL Lambda handler in-process against the
// deployed table, photo bucket and Bedrock model (credentials from the
// `insightac` profile). Cognito is stubbed so you can sign in with any email
// and password without creating a real account; stubbed users get a `local-`
// id, so their data never mixes with real players.

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.env.PORT || 8080);
const PROFILE = process.env.PLANTUS_PROFILE || 'insightac';
const STACK = process.env.PLANTUS_STACK || 'plantus';

// Same guard as deploy.sh: ambient keys belong to another account.
delete process.env.AWS_ACCESS_KEY_ID;
delete process.env.AWS_SECRET_ACCESS_KEY;
delete process.env.AWS_SESSION_TOKEN;
process.env.AWS_PROFILE = PROFILE;
process.env.AWS_REGION ||= 'us-east-1';

function stackOutputs() {
  const raw = execFileSync('aws', ['cloudformation', 'describe-stacks', '--stack-name', STACK,
    '--profile', PROFILE, '--region', process.env.AWS_REGION, '--query', 'Stacks[0].Outputs', '--output', 'json'], { encoding: 'utf8' });
  return Object.fromEntries(JSON.parse(raw).map((o) => [o.OutputKey, o.OutputValue]));
}

const out = stackOutputs();
process.env.TABLE = out.TableName;
process.env.PHOTO_BUCKET = out.PhotoBucketName;
process.env.MODEL_ID ||= out.ModelId;
const { handler } = await import('../src/handler.mjs');

/* ---------------- cognito stub ---------------- */

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function fakeToken(email) {
  const sub = 'local-' + createHash('sha256').update(email).digest('hex').slice(0, 24);
  const now = Math.floor(Date.now() / 1000);
  return `${b64url({ alg: 'none' })}.${b64url({ sub, email, aud: 'local', exp: now + 3600, iat: now })}.x`;
}
function cognitoStub(target, body) {
  switch (target.split('.').pop()) {
    case 'SignUp': case 'ConfirmSignUp': case 'ResendConfirmationCode':
    case 'ForgotPassword': case 'ConfirmForgotPassword':
      return {};
    case 'InitiateAuth': {
      const email = body.AuthParameters?.USERNAME || 'dev@plantus.test';
      const t = fakeToken(email);
      return { AuthenticationResult: { IdToken: t, AccessToken: t, RefreshToken: `refresh:${email}`, ExpiresIn: 3600 } };
    }
    default: return null;
  }
}

/* ---------------- http ---------------- */

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const readBody = (req) => new Promise((res) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => res(Buffer.concat(c).toString('utf8'))); });

function claimsFrom(auth) {
  try { return JSON.parse(Buffer.from((auth || '').split('.')[1], 'base64url').toString()); } catch { return null; }
}

const ROUTES = [
  ['GET', /^\/health$/, '/health'], ['GET', /^\/save$/, '/save'], ['PUT', /^\/save$/, '/save'],
  ['POST', /^\/identify$/, '/identify'], ['GET', /^\/finds$/, '/finds'], ['DELETE', /^\/finds\/([^/]+)$/, '/finds/{id}'],
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const send = (code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };

  if (url.pathname === '/cloud-config.json') {
    return send(200, { region: process.env.AWS_REGION, apiUrl: `http://localhost:${PORT}/api`, clientId: 'local', cognitoEndpoint: `http://localhost:${PORT}/cognito` });
  }
  if (url.pathname === '/cognito' && req.method === 'POST') {
    const r = cognitoStub(req.headers['x-amz-target'] || '', JSON.parse(await readBody(req) || '{}'));
    return r ? send(200, r) : send(400, { __type: 'NotSupported', message: 'stub' });
  }
  if (url.pathname.startsWith('/api/')) {
    const path = url.pathname.slice(4);
    const hit = ROUTES.find(([m, re]) => m === req.method && re.test(path));
    if (!hit) return send(404, { error: 'no route' });
    const claims = claimsFrom(req.headers.authorization);
    const event = {
      routeKey: `${hit[0]} ${hit[2]}`,
      body: await readBody(req) || undefined,
      pathParameters: hit[2].includes('{id}') ? { id: path.match(hit[1])[1] } : undefined,
      requestContext: claims ? { authorizer: { jwt: { claims } } } : {},
    };
    if (!claims && hit[2] !== '/health') return send(401, { message: 'Unauthorized' });
    const t0 = Date.now();
    const r = await handler(event);
    console.log(`${event.routeKey} -> ${r.statusCode} (${Date.now() - t0} ms)`);
    res.writeHead(r.statusCode, r.headers); return res.end(r.body);
  }

  // static files
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (!p) p = 'index.html';
  const file = join(ROOT, p);
  if (!file.startsWith(ROOT) || /(^|[/\\])(backend|node_modules|\.git)([/\\]|$)/.test(p)) return send(404, 'not found', 'text/plain');
  try {
    if (!(await stat(file)).isFile()) throw new Error();
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch { send(404, 'not found', 'text/plain'); }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`PlantUs dev server on http://localhost:${PORT}`);
  console.log(`  table ${process.env.TABLE}, bucket ${process.env.PHOTO_BUCKET}, model ${process.env.MODEL_ID}`);
});
