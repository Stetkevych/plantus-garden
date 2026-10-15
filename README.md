# PlantUs

A biology learning platform built around plants. Photograph a real plant and get a
field-guide synopsis of what it is. Every find is pressed into your **herbarium**.
Keep a living **digital garden** watered, and play seven botanical arcade games. All of
it feeds one points economy: **sun** tokens and **plantus** tokens.

**Live:** https://d2pxu1hyg5qt5r.cloudfront.net

| Tab | What it does |
|---|---|
| 🌱 Garden | Five beds that grow through six stages. Soil moisture drains in real time, at a different rate for each species. Wilted or waterlogged plants will not grow. Keeping every bed healthy pays a daily care streak. |
| 📷 Scan | Take or upload a photo and Bedrock identifies it. You get the common and scientific names, family, confidence, the features that support the ID, care needs, native range, toxicity, lookalikes, and a biology fact linked to a field guide topic. |
| 📚 Herbarium | Every species you have found, with photos, dates and optional location. Search, filter by plant type, rank up from *Seed collector* to *Master botanist*. |
| 🎮 Games | Seven mini-games (below) that pay sun. |
| 🧪 Lab | A standalone prototype of the Unity design, at [`/lab/index.html`](https://d2pxu1hyg5qt5r.cloudfront.net/lab/index.html). See below. |

---

## How points work

| Action | Sun ☀ | Plantus ✿ |
|---|---|---|
| Play a mini-game | ~55–100 per competent run | — |
| Correct post-game quiz | +15 | — |
| Scan a **new species** | +30 | +4 common / +8 uncommon / +15 rare |
| Scan a species you have seen | +8 | — |
| Daily care (every open bed healthy) | +10, +2 per streak day (cap +20) | +6 every 7th day |
| Grow a plant one stage | spends 30–600 | +5 to +48 |
| Open a new bed | — | spends 20–130 |

Scans and growth also unlock **field guide** entries, so the real-world finds and the
game teach the same 16 topics.

---

## Architecture

```
 browser ──► CloudFront ──► S3 (site, private)
    │
    ├──► Cognito user pool          sign up / sign in (email + password)
    │
    └──► API Gateway (HTTP, JWT) ──► Lambda  backend/src/handler.mjs
                                       ├─► Bedrock Converse   photo → synopsis JSON
                                       ├─► DynamoDB           saves, finds, species tally, daily quota
                                       └─► S3 (photos, private, served by presigned URL)
```

Everything is one CloudFormation stack, `plantus` (`backend/template.yaml`), in the
**personal AWS account 856132197839** (`insightac` CLI profile), region `us-east-1`.

| Route | |
|---|---|
| `GET /health` | public |
| `GET/PUT /save` | the player's garden save, synced across devices |
| `POST /identify` | `{ image: dataURL, lat?, lng? }` → synopsis, archived as a find |
| `GET /finds` | the herbarium, newest first, with presigned photo URLs |
| `DELETE /finds/{id}` | remove a find and its photo |

Each player gets **25 scans per UTC day** (`DailyScanLimit`). A failed or "not a plant"
scan does not count. Nova Pro costs well under a cent per scan.

### Plant identification model

The model is the `ModelId` stack parameter. It defaults to **Amazon Nova Pro**
(`us.amazon.nova-pro-v1:0`), because that works in this account today. To switch to Claude:

1. Bedrock console → *Model catalog* → any Anthropic model → submit the one-time
   Anthropic use-case form. Only the account owner can do this.
2. `MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0 ./deploy/deploy.sh`

All model output is parsed and coerced into a fixed shape (`normalise()` in the
handler) before it reaches the browser.

---

## Run it locally

```bash
cd backend && npm install          # once: AWS SDK for the local server
npm run dev                        # http://localhost:8080
```

The dev server serves the site and runs the **real** Lambda handler in-process,
against the deployed table, photo bucket and Bedrock. Cognito is stubbed, so any email
and password signs in. Stubbed users get a `local-` id and never mix with real players.

For the games alone, with no backend, `./serve.sh` still works. The Scan and Herbarium
tabs then say they need the cloud.

## Deploy

```bash
./deploy/deploy.sh          # stack + site
./deploy/deploy.sh site     # site files only, ~20 s
```

The script pins the `insightac` profile, unsets any ambient `AWS_*` keys, and **refuses
to run unless the account is 856132197839**. That way the work account can never be
deployed to by accident. It writes `cloud-config.json` (API URL, Cognito ids) and
invalidates CloudFront.

## PlantUs Lab (Unity prototype)

**Open:** https://d2pxu1hyg5qt5r.cloudfront.net/lab/index.html (or `/lab/index.html` on the dev server)

The Unity C# prototype in `unity/` is brought to the web as a self-contained page with its
own save (`plantus.lab.v1`). It does not touch the main garden or need an account.

- **Growing table:** a table of the plants you are growing, one row per pot, showing
  stage, growth %, water, health, status and a countdown to the next stage. Pots drain
  every minute, faster for high-speed plants. A dry plant stops growing and then loses
  health. Each stage pays XP, and a plant in bloom can be cut for leaves.
- **Seed vault:** all 21 plants from `plantDatabase.cs`, with every stat, trait, attack and
  aesthetic. Unlocking follows `PlantUnlockSystem.cs` exactly: tier level gates
  (1/2/5/9/14/20) and leaf costs (0/50/120/250/500/1000).
- **Arena:** a Juvenile or older plant fights a wild challenger. Every hit is
  `PlantCombatLogic.ResolveAttack`, ported line for line: dodge cap, base damage,
  element wheel, crits and trait bonuses. Lab additions are HP ×4 so fights last a few
  rounds, stats scaled by growth stage, and small real effects for Poison, Root/Bind and
  Healer, which the C# only names.
- **Tester tools:** skip time ahead, add leaves or levels, reset.

`lab/plants.js` is generated from the C#, so edit the C# and then run:

```bash
node tools/unity-to-js.mjs
```

CI fails if the two drift apart. `Sessionmanager.cs` from the prototype is deliberately
not in the repo, because it contained a hardcoded login.

## Test it

```bash
node test/smoke.mjs                 # runs every game headlessly with random input, checks nothing throws
node test/balance.mjs               # drives every game with a competent bot, reports score/payout spread
node test/lab.test.mjs              # Lab: unlock rules, growth, combat math vs the C#
cd backend && npm test              # API: model-output parsing, normalisation, auth guard
```

`balance.mjs` is the one that matters when tuning. It exists because a game can be
completely crash-free and still be unplayable — the first version of Plant Survivors
killed every plant inside 30 seconds, and the vine's turn queue was acting on
directions two ticks stale. Both only showed up under bot play.

Current medians for a competent run:

| Game | Median score | Median sun | Objective met |
|---|---|---|---|
| Vine Garden | ~450 | ~65 | endless |
| Cloud Barrage | ~2750 | ~72 | ~90% |
| Bee Rush | ~2000 | ~68 | endless |
| Seed Crush | ~5800 | ~67 | ~88% |
| Plant Survivors | ~920 | ~60 | rare |
| Forest Dash | ~18000 | ~71 | endless |
| Seed Storm | ~3400 | ~74 | ~50% |

Payout rates in `js/data/config.js` are tuned so no game is a shortcut.

### Pacing

Every real-time game drives its difficulty from **elapsed time** through one shared
curve, `ramp(t, from, to, tau)` in `js/core/engine.js`. It starts exactly at a calm
opening pace and eases steadily toward a cap: about 63% of the way there after `tau`
seconds and 95% after `3·tau`, with no steps or jumps. Bee Rush and Forest Dash used to
scale with distance, which feeds back on itself (faster means more distance, which
means faster still) and made late runs lurch.

| Game | What ramps | Start → cap | tau |
|---|---|---|---|
| Vine Garden | step time (also tightens with length) | 0.165 s → 0.125 s | 90 s |
| Bee Rush | speed, spawn gap | 300 → 700 px/s, 0.95 → 0.45 s | 80 s |
| Forest Dash | speed, row gap, double-blocked rows, full-width walls | 16 → 50, 1.15 → 0.5 s, 30 → 75%, 0 → 35% | 75 s |
| Plant Survivors | spawn gap (and pest strength by wave) | 2.1 → 0.55 s | 75 s |
| Seed Storm | spawn gap, hail gap, swarm size | 1.6 → 0.45 s, 6 → 2.2 s | 50 s |
| Cloud Barrage | turn-based: sky drops every 5, then 4, then 3 shots | — | — |
| Seed Crush | turn-based puzzle with a move limit, no clock | — | — |

---

## The loop

```
mini-game  ──►  sun tokens  ──►  spend on growth  ──►  plantus tokens  ──►  new beds
     ▲                                   │
     └──────── field guide entries ◄──────┘
```

**Growth stages**, shared by every plant and every game's visual language:

| # | Stage | Sun cost (sunflower) |
|---|---|---|
| 0 | Seedling | — |
| 1 | Early growth, small leaves | 30 |
| 2 | Medium growth | 70 |
| 3 | Larger leaves | 140 |
| 4 | Advanced growth, flower buds | 240 |
| 5 | Fully blooming | 380 |

Costs scale per species (`costMul`): a cactus is cheaper, an oak is much dearer.
Every stage-up pays plantus and unlocks a field guide entry.

## The seven games

**Vine Garden** — Snake. Your vine never stops growing, so the challenge is routing
around damage. Nodes become leaves, then buds, then blooms *on your own body* as you
pass the length thresholds. Hazards: caterpillars and beetles that move, spreading
fungus, static broken bark, slippery water patches that eat a turn, and hot spots that
scorch length off the tail.

**Cloud Barrage** — Bubble shooter with the win condition inverted. You are not
clearing the board; every cloud you burst becomes rain that falls on the garden strip
below, and each plant needs a different amount: cactus 2, sunflower 5, fern 6, rose 8,
oak 15. You win by growing all five, so you have to burst *over the right plant*.
Rain clouds carry triple water, storm clouds chain to their neighbours, snow clouds
freeze what surrounds them, sun clouds pay sun tokens directly, rainbow clouds match
anything. Every six shots the sky rolls in one row closer.

**Bee Rush** — Three-lane endless runner. Touch a flower and it blooms instantly
behind you. Consecutive hits build the pollination combo — 5 for ×2, 10 for ×3, 15 for
×4. Obstacles are spider webs, raindrops, birds, branches, sprinklers, falling leaves
and trellises; the ground ones can be hopped. Bee Swarm splits you into 3 and then 5
bees, which pollinate lanes you are not flying in.

**Seed Crush** — Match 3. Cleared seeds fill a germination tray with three species
objectives. Match 4 makes a sprout that clears a line, match 5 makes a taproot that
clears every seed of one kind, and cascades multiply up to ×5.

**Plant Survivors** — Survivor-like. Your thorns fire themselves; your job is
positioning, because the pests are hunting the three plants, not you. Pollen orbs
level you up and every upgrade on offer is a real plant defence — thicker bark, root
recovery, pollen nova, wider roots. Hold the beds for 120 seconds.

**Forest Dash** is a three-lane runner on a pseudo-3D forest trail, and the runner
is *your* plant: the most-grown bed in your garden, in its current stage, scurrying
on root legs. Jump fallen logs and brambles, slide under low branches, and switch
lanes around stumps. You are also drying out the whole time, so water drops are fuel.
Sunflecks are the big prize, as they are for real understory plants. Sap shields and
root reach (a drop magnet) turn up in the open lane. Deeper in, some rows wall off all
three lanes, so you have to read which one you can jump or slide through.

**Seed Storm** is an arena shooter. Your plant is rooted in the middle of a clearing,
and aphid swarms, wasps, slugs and beetles pour in from every side. Move inside the
ring to dodge, and your seed pod fires at the nearest threat by itself. Hailstones
can't be shot: a red line warns where each one will cross, so get out of the way.
Every kill ripens the pod, and a ripe pod splits in a 360° burst that shoves
everything back (explosive dispersal). Hold out for 90 seconds.

## The biology layer

Learning is on the reward path rather than bolted on:

- **Field guide** — 18 entries on photosynthesis, stomata, xylem and phloem,
  transpiration, germination, pollination, tropism, dispersal, sunflecks, explosive
  seed pods and plant defence.
  Entries unlock by growing plants and by playing each game for the first time.
- **Post-run quiz** — one question drawn from the game you just played. Correct
  answers pay 15 sun, and wrong ones still explain the answer.
- **Mechanics carry the lesson** — the five different water requirements in Cloud
  Barrage are the actual teaching moment, not a caption under it. Same for
  germination requirements in Seed Crush and defence strategies in Plant Survivors.

---

## Continuous integration

`.github/workflows/ci.yml` runs the API unit tests and both game harnesses on every push and pull request, and
uploads the balance report as an artifact so you can see the difficulty spread of a
change without running it locally.

`.github/workflows/deploy.yml` deploys to S3 and invalidates CloudFront, but only if
the repository has the AWS variables set. Configure them under
**Settings -> Secrets and variables -> Actions**:

| Kind | Name | Example |
|---|---|---|
| Variable | `AWS_REGION` | `us-east-1` |
| Variable | `S3_BUCKET` | `plantus-garden-prod` |
| Variable | `CLOUDFRONT_DISTRIBUTION_ID` | `E1234EXAMPLE` |
| Secret | `AWS_ROLE_ARN` | `arn:aws:iam::123456789012:role/github-deploy` |

It authenticates with OIDC rather than long-lived keys, so the IAM role needs a trust
policy naming GitHub's OIDC provider and this repository. Until `S3_BUCKET` is set the
deploy job is skipped, so a fresh clone never tries to deploy and fail.

## Layout

```
index.html               app shell — hub, play view, overlay sheets
css/style.css            the whole visual identity
js/main.js               hub, tabs, care UI, economy loop, run launcher, results, quiz
js/views/field.js        scan, herbarium, account sheets
js/core/cloud.js         Cognito auth, API client, cross-device save sync
js/core/engine.js        canvas scaling, input, loop, particles, draw helpers
js/core/state.js         save file, tokens, growth rules, soil moisture, find rewards
js/core/plantart.js      procedural plant renderer, 6 stages × 5 plant forms
js/data/config.js        stages, species, hazards, power-ups, payout rates
js/data/biology.js       field guide entries and quiz bank
js/games/*.js            one file per mini-game
test/smoke.mjs           crash harness
test/balance.mjs         difficulty and economy harness
backend/template.yaml    the whole AWS stack (site, Cognito, API, Lambda, DynamoDB, S3)
backend/src/handler.mjs  the API
backend/dev/server.mjs   local dev server (real handler, stubbed Cognito)
deploy/deploy.sh         account-pinned deploy of stack + site
lab/                     PlantUs Lab: sim.js (rules), combat.js (C# port), art.js, lab.js (UI)
unity/                   the original Unity C# prototype (source of lab/plants.js)
tools/unity-to-js.mjs    C# -> lab/plants.js converter
.github/workflows/       test and deploy pipelines
```

Save data lives in `localStorage` under `plantus.save.v1`, and is pushed to the API
1.5 s after any change while signed in. On sign-in, if this device last synced the same
account, the newer save wins. Otherwise the save that has progressed further wins.

## Controls

| | Keyboard | Touch |
|---|---|---|
| Vine Garden | arrows / WASD | swipe |
| Cloud Barrage | ← → aim, space fire | drag to aim, tap to fire |
| Bee Rush | ← → lanes, ↑ hop | swipe |
| Seed Crush | — | tap two seeds, or drag |
| Plant Survivors | WASD, 1/2/3 to pick upgrades | drag to move, tap a card |
| Forest Dash | ← → lanes, ↑ jump, ↓ slide | swipe |
| Seed Storm | WASD, space to burst the pod | drag to move, tap your pod to burst |

## Known limits

- The 3D garden needs `vendor/three.core.js`, which three.module.js imports but which
  was never committed, so the hub always falls back to the 2D garden. Add the file
  from the same three.js release to turn 3D back on. The wilt and waterlogging visuals
  are already wired into `garden3d.js`.
- Cognito sends verification emails from its built-in sender, which allows about 50
  emails a day. Switch the user pool to SES before any real launch.
- `deploy/deploy-s3.sh` and `.github/workflows/deploy.yml` are the original site-only
  deploy path. `deploy/deploy.sh` replaces them for the full stack.

- Fonts load from Google Fonts. If you need a fully self-hosted deploy, download
  Baloo 2 and Karla into `assets/` and swap the `<link>` in `index.html`.
- No audio yet. `js/core/engine.js` is where a small WebAudio bleep layer would go.
- Cloud Barrage's win rate is high for a near-optimal player (97% in the harness).
  If you want it tighter, reduce `SHOTS` in `js/games/cloud-barrage.js` or speed up
  the descent interval from every 6 shots to every 5.
