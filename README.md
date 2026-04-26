# buddyAI — FinBot

Thai personal-finance LINE bot on Cloudflare Workers, powered by Claude Haiku 4.5
via Cloudflare AI Gateway. Single Worker handles the LINE webhook plus a daily
cron that pushes a stock-pick alert to subscribers. Users can also send a
screenshot of their broker portfolio — the bot extracts holdings via Claude
vision, asks for a one-tap confirmation, and from then on personalises chat
context and the daily alert to that portfolio.

## Stack

- **Runtime:** Cloudflare Workers (Wrangler ^3)
- **DB:** Cloudflare D1 (`finance-db`) — `users`, `messages`
- **Cache:** Cloudflare KV (`SESSION_KV`) — 1h session, debug logs
- **AI:** Claude (`claude-haiku-4-5-20251001`) via AI Gateway, fallback to direct Anthropic
- **Daily alert:** GitHub Actions cron (`.github/workflows/daily-alert.yml`) hits the worker's `/test-alert` endpoint at 02:00 UTC = 09:00 Bangkok, Mon–Fri

## Layout

```
buddyAI/
├── .github/workflows/    # deploy, preview, db-migrate
├── migrations/           # 0001_init, 0002_add_alert_subscribed, 0003_portfolios
├── src/
│   ├── index.js          # Worker entry, routes, event router, cron
│   ├── line.js           # LINE API helpers + signature verify
│   ├── claude.js         # AI Gateway / Anthropic call
│   ├── vision.js         # LINE image fetch + Claude vision portfolio extraction
│   ├── db.js             # D1 ops (chat, alerts, portfolios)
│   ├── session.js        # KV session helpers
│   └── flex/             # Flex card builders (incl. portfolio confirm/summary)
├── wrangler.toml         # bindings + vars (no secrets)
├── package.json
└── .dev.vars.example     # local secrets template
```

## First-time setup (new Cloudflare account)

```bash
npm install

# 1. Create resources and copy IDs into wrangler.toml
wrangler kv namespace create SESSION_KV
wrangler d1 create finance-db

# 2. Set up an AI Gateway in the Cloudflare dashboard, then put the URL in
#    wrangler.toml under [vars] AI_GATEWAY_URL.

# 3. Set runtime secrets (interactive)
wrangler secret put LINE_CHANNEL_SECRET
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put CRON_KEY                # any random string; same value
                                            # also goes in GitHub repo secret CRON_KEY

# 4. Apply schema to remote D1
npm run db:init:remote

# 5. Deploy
npm run deploy
```

Register the LINE webhook URL in the LINE Developer Console:

```
https://<worker-name>.<subdomain>.workers.dev/callback
```

## Local dev

```bash
cp .dev.vars.example .dev.vars   # fill secrets locally
npm run db:init                  # apply migrations to local D1
npm run dev
```

## CI / CD

`.github/workflows/deploy.yml` deploys on push to `main` using
`cloudflare/wrangler-action@v3` and applies any new migrations to remote D1
right after. Required GitHub repo secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CRON_KEY` — random string, same value as the `CRON_KEY` Cloudflare secret

Required GitHub repo **variable** (Settings → Secrets and variables → Actions → Variables):

- `WORKER_URL` — e.g. `https://buddyai.<your-subdomain>.workers.dev`

Cloudflare-side runtime secrets (`ANTHROPIC_API_KEY`,
`LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `CRON_KEY`) live in Cloudflare via
`wrangler secret put` and never touch the repo.

`db-migrate.yml` is a manual-trigger workflow that applies migrations to the
remote D1 — only needed for the "apply just one file" use case; the deploy
workflow already auto-applies all migrations after each deploy.

`daily-alert.yml` runs on a GitHub Actions cron (Mon–Fri 02:00 UTC = 09:00
Bangkok) and sends a `Bearer ${CRON_KEY}` request to the worker's
`/test-alert` endpoint. We use GitHub's scheduler instead of Cloudflare's
because CF cron triggers are quota-limited per account.

## Routes

| Path | Method | Purpose |
|---|---|---|
| `/health` | GET | Liveness probe |
| `/callback` | POST | LINE webhook (signature verified) |
| `/test-alert` | GET | Manually trigger the daily-alert cron *(CRON_KEY)* |
| `/test-subs` | GET | List current subscribers *(CRON_KEY)* |
| `/test-log` | GET | Last cron run log (from KV) *(CRON_KEY)* |
| `/journey?userId=<id>&limit=100` | GET | Full event timeline for a given LINE userId *(CRON_KEY)* |

Endpoints marked *(CRON_KEY)* require an `Authorization: Bearer ${CRON_KEY}` header.

## LINE commands

| User input | Action |
|---|---|
| *(image)* | Send a portfolio screenshot → Claude vision extracts holdings → user taps **บันทึกพอร์ต** to confirm |
| `พอร์ต` / `portfolio` | Show the saved portfolio summary card |
| `วิเคราะห์พอร์ต` | AI commentary on diversification, sector exposure, things to watch |
| `ปรับพอร์ต` | AI rebalance suggestions per holding (Trim/Add/Hold/Watch) + diversifier ideas |
| `ล้างพอร์ต` | Delete all saved portfolios |
| `ดูหุ้น` / `หุ้น` / `stock` | Open Stock Dashboard (LIFF) |
| `ราคาน้ำมัน` / `น้ำมัน` / `oil` | Open Oil Dashboard (LIFF) |
| `สมัครการแจ้งเตือน` | Subscribe to daily alert (becomes portfolio-aware once a portfolio is saved) |
| `ยกเลิกการแจ้งเตือน` | Unsubscribe |
| `/reset` | Clear chat history |
| `/help` | Show command menu |
| anything else | Free-form chat → Claude (last 12 messages of context, plus held symbols if a portfolio is saved) |

## Portfolio flow

1. User sends an image. The Worker downloads it from `api-data.line.me`, base64-encodes it, and asks Claude (Haiku 4.5 vision) to return a structured `{ source, total_value, cash, holdings[], warnings[] }`.
2. The extraction is stored in **KV** with a 30-minute TTL (`pending-portfolio:<userId>`). The image bytes are **discarded immediately**.
3. The bot replies with a Flex card showing each holding and two buttons: **บันทึกพอร์ต** (confirm) or **อ่านใหม่** (cancel).
4. On confirm, the pending blob is promoted into the D1 `portfolios` + `holdings` tables; the KV entry is deleted.
5. From then on, free-form chat passes held symbols as context, and the daily alert generates personalised picks per user.

## Trading-journey event log

Every meaningful interaction is appended to the `events` table
(`migrations/0005_events.sql`) — `(user_id, type, payload JSON, created_at)`.
This is what you query later to reconstruct a user's trajectory:
"when did they first add a portfolio, what verdicts did the AI give, which
daily picks were delivered, when did they unsubscribe."

Event types currently emitted from `src/index.js`:

| `type` | Emitted when | Payload highlights |
|---|---|---|
| `follow` | LINE follow event | `displayName` |
| `unfollow` | LINE unfollow event | — |
| `subscribe` / `unsubscribe` | Daily-alert opt-in/out (text or postback) | `via` |
| `reset_chat` | `/reset` clears chat history | — |
| `vision_failed` / `vision_rejected` / `vision_empty` | Image upload couldn't be turned into a portfolio | `error`/`reason`/`source` |
| `portfolio_extracted` | Vision returned a holdings list (pending confirmation) | `source`, `total_value`, `symbols`, `warnings` |
| `portfolio_saved` | User tapped **บันทึกพอร์ต** | `portfolio_id`, `source`, `total_value`, `symbols` |
| `portfolio_retry` | User tapped **อ่านใหม่** | — |
| `portfolio_cleared` | `ล้างพอร์ต` wipes saved portfolios | — |
| `portfolio_analysis` | `วิเคราะห์พอร์ต` produced an analysis | `portfolio_id`, `verdict`, `verdict_reason`, `top_symbol`, `top_weight_pct`, `concentration`, `sector_count` |
| `portfolio_analysis_failed` | Claude/AI Gateway error during analysis | `error` |
| `portfolio_rebalance` | `ปรับพอร์ต` produced rebalance suggestions | `portfolio_id`, `summary`, `suggestions[{symbol,action,current/target_weight_pct}]`, `diversifiers[]` |
| `portfolio_rebalance_failed` | Claude/AI Gateway error during rebalance | `error` |
| `daily_alert_sent` | Daily cron pushed the card to a subscriber | `date`, `personalised`, `summary`, `picks[]` |
| `daily_alert_failed` | Per-user push or pick-generation failed | `stage`, `error` |

Read a user's timeline:
```bash
curl -H "Authorization: Bearer $CRON_KEY" \
  "https://buddyai.<sub>.workers.dev/journey?userId=U1234abcd&limit=200"
```

## Migration notes from finance-line-bot

- `schema.sql` is split into `migrations/0001_init.sql` +
  `migrations/0002_add_alert_subscribed.sql` (the missing column the previous
  `db.js` relied on) + `migrations/0003_portfolios.sql` for the portfolio
  feature + `migrations/0004_align_legacy_schema.sql` (one-time DROP+CREATE
  to fix the inherited `users`/`messages` shape) + `migrations/0005_events.sql`
  for the trading-journey log.
- Previously hardcoded URLs (`STOCK_API`, the two LIFF URLs) are now
  `[vars]` in `wrangler.toml` so a cloned bot can repoint without code edits.
- Flex card builders are extracted to `src/flex/` (enrollment, dailyAlert,
  liffCards, portfolio) instead of living in `index.js`.
- The deploy workflow tracks applied migrations in a `_migrations` table so
  destructive ones (like 0004) only run once.
