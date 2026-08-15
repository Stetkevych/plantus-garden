# Plantus Garden

Five botanical arcade games feeding one garden. Play a mini-game to win **sun tokens**,
spend sun in the garden to advance a plant's growth, and healthy growth mints
**plantus tokens** — the currency that opens new beds.

No build step, no dependencies, no framework. Vanilla ES modules and canvas, so the
whole thing is static files you can drop on S3.

---

## Run it locally

```bash
./serve.sh          # http://localhost:8080
./serve.sh 3000     # or pick a port
```

ES modules require HTTP — opening `index.html` from the filesystem will not work.

## Test it

```bash
node test/smoke.mjs      # runs every game headlessly with random input, checks nothing throws
node test/balance.mjs    # drives every game with a competent bot, reports score/payout spread
```

`balance.mjs` is the one that matters when tuning. It exists because a game can be
completely crash-free and still be unplayable — the first version of Plant Survivors
killed every plant inside 30 seconds, and the vine's turn queue was acting on
directions two ticks stale. Both only showed up under bot play.

Current medians for a competent run:

| Game | Median score | Median sun | Objective met |
|---|---|---|---|
| Vine Garden | 450 | 69 | endless |
| Cloud Barrage | 2740 | 80 | 97% |
| Bee Rush | 2414 | 98 | endless |
| Seed Crush | 5570 | 61 | 83% |
| Plant Survivors | 1052 | 56 | 10% |

Payout rates in `js/data/config.js` are tuned so no game is a shortcut.

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

## The five games

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

## The biology layer

Learning is on the reward path rather than bolted on:

- **Field guide** — 16 entries on photosynthesis, stomata, xylem and phloem,
  transpiration, germination, pollination, tropism, dispersal and plant defence.
  Entries unlock by growing plants and by playing each game for the first time.
- **Post-run quiz** — one question drawn from the game you just played. Correct
  answers pay 15 sun, and wrong ones still explain the answer.
- **Mechanics carry the lesson** — the five different water requirements in Cloud
  Barrage are the actual teaching moment, not a caption under it. Same for
  germination requirements in Seed Crush and defence strategies in Plant Survivors.

---

## Deploy to AWS

### Option A — CloudFront in front of a private bucket (recommended)

```bash
aws cloudformation deploy \
  --template-file deploy/infrastructure.yaml \
  --stack-name plantus-garden \
  --parameter-overrides BucketName=your-unique-bucket-name

aws cloudformation describe-stacks --stack-name plantus-garden \
  --query 'Stacks[0].Outputs' --output table
```

Then push the files, passing the distribution id so the cache is invalidated:

```bash
chmod +x deploy/deploy-s3.sh
./deploy/deploy-s3.sh your-unique-bucket-name E1234EXAMPLE
```

The bucket stays private; CloudFront reads it through an Origin Access Control, and
HTTP is redirected to HTTPS.

### Option B — plain S3 website hosting

```bash
./deploy/deploy-s3.sh your-unique-bucket-name
aws s3 website s3://your-unique-bucket-name --index-document index.html
```

You will need a public-read bucket policy, and you get no HTTPS. Fine for a quick
look, not for anything real.

### Cache behaviour

`index.html` goes up as `no-cache, must-revalidate`; CSS and JS get a 300 second TTL.
There is no content hashing in the filenames, so **pass the distribution id on every
deploy** or clients will hold stale modules for five minutes.

---

## Continuous integration

`.github/workflows/ci.yml` runs both harnesses on every push and pull request, and
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
js/main.js               hub, economy loop, run launcher, results, quiz
js/core/engine.js        canvas scaling, input, loop, particles, draw helpers
js/core/state.js         save file, tokens, growth rules
js/core/plantart.js      procedural plant renderer, 6 stages × 5 plant forms
js/data/config.js        stages, species, hazards, power-ups, payout rates
js/data/biology.js       field guide entries and quiz bank
js/games/*.js            one file per mini-game
test/smoke.mjs           crash harness
test/balance.mjs         difficulty and economy harness
deploy/                  S3 deploy script and CloudFormation stack
.github/workflows/       test and deploy pipelines
```

Save data lives in `localStorage` under `plantus.save.v1`. There is no backend, so a
player's garden is per-browser — if you want cross-device saves later, `js/core/state.js`
is the only file that needs to change.

## Controls

| | Keyboard | Touch |
|---|---|---|
| Vine Garden | arrows / WASD | swipe |
| Cloud Barrage | ← → aim, space fire | drag to aim, tap to fire |
| Bee Rush | ← → lanes, ↑ hop | swipe |
| Seed Crush | — | tap two seeds, or drag |
| Plant Survivors | WASD, 1/2/3 to pick upgrades | drag to move, tap a card |

## Known limits

- Fonts load from Google Fonts. If you need a fully self-hosted deploy, download
  Baloo 2 and Karla into `assets/` and swap the `<link>` in `index.html`.
- No audio yet. `js/core/engine.js` is where a small WebAudio bleep layer would go.
- Cloud Barrage's win rate is high for a near-optimal player (97% in the harness).
  If you want it tighter, reduce `SHOTS` in `js/games/cloud-barrage.js` or speed up
  the descent interval from every 6 shots to every 5.
