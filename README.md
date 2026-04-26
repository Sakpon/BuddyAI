# buddyAI — FinBot

Thai personal-finance LINE bot on Cloudflare Workers, powered by Claude Haiku 4.5
via Cloudflare AI Gateway. Single Worker handles the LINE webhook plus a daily
cron that pushes a stock-pick alert to subscribers.

## Stack

- **Runtime:** Cloudflare Workers (Wrangler ^3)
- **DB:** Cloudflare D1 (`finance-db`) — `users`, `messages`
- **Cache:** Cloudflare KV (`SESSION_KV`) — 1h session, debug logs
- **AI:** Claude (`claude-haiku-4-5-20251001`) via AI Gateway, fallback to direct Anthropic
- **Cron:** `0 2 * * 1-5` (UTC) → 09:00 Bangkok, Mon–Fri

## Layout

```
buddyAI/
├── .github/workflows/    # deploy, preview, db-migrate
├── migrations/           # 0001_init.sql, 0002_add_alert_subscribed.sql
├── src/
│   ├── index.js          # Worker entry, routes, event router, cron
│   ├── line.js           # LINE API helpers + signature verify
│   ├── claude.js         # AI Gateway / Anthropic call
│   ├── db.js             # D1 ops
│   ├── session.js        # KV session helpers
│   └── flex/             # Flex card builders
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
`cloudflare/wrangler-action@v3`. Required GitHub repo secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Cloudflare-side runtime secrets (`ANTHROPIC_API_KEY`,
`LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`) live in Cloudflare via
`wrangler secret put` and never touch the repo.

`db-migrate.yml` is a manual-trigger workflow that applies migrations to the
remote D1 — run it once after the first deploy, then again whenever a new
migration is added.

## Routes

| Path | Method | Purpose |
|---|---|---|
| `/health` | GET | Liveness probe |
| `/callback` | POST | LINE webhook (signature verified) |
| `/test-alert` | GET | Manually trigger the daily-alert cron |
| `/test-subs` | GET | List current subscribers |
| `/test-log` | GET | Last cron run log (from KV) |

## LINE commands

| User input | Action |
|---|---|
| `ดูหุ้น` / `หุ้น` / `stock` | Open Stock Dashboard (LIFF) |
| `ราคาน้ำมัน` / `น้ำมัน` / `oil` | Open Oil Dashboard (LIFF) |
| `สมัครการแจ้งเตือน` | Subscribe to daily alert |
| `ยกเลิกการแจ้งเตือน` | Unsubscribe |
| `/reset` | Clear chat history |
| `/help` | Show command menu |
| anything else | Free-form chat → Claude (last 12 messages of context) |

## Migration notes from finance-line-bot

- `schema.sql` is split into `migrations/0001_init.sql` +
  `migrations/0002_add_alert_subscribed.sql` (the missing column the previous
  `db.js` relied on).
- Previously hardcoded URLs (`STOCK_API`, the two LIFF URLs) are now
  `[vars]` in `wrangler.toml` so a cloned bot can repoint without code edits.
- Flex card builders are extracted to `src/flex/` (enrollment, dailyAlert,
  liffCards) instead of living in `index.js`.
