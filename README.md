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
- **AI:** Claude via AI Gateway (fallback: direct Anthropic). **Tiered model selection** per task:
  - **Haiku 4.5** — chat, vision, holdings status, daily picks/news (latency- and cost-sensitive)
  - **Sonnet 4.6** — portfolio analysis + comparison (quality matters, on-demand)
  - **Opus 4.7** — rebalance only, with adaptive thinking + `effort: "high"` (recommendation-heavy, used rarely)
  - Each tier overridable via `CLAUDE_MODEL_FAST` / `CLAUDE_MODEL_BALANCED` / `CLAUDE_MODEL_DEEP`
- **Daily alert:** GitHub Actions cron (`.github/workflows/daily-alert.yml`) hits the worker's `/test-alert` endpoint at 02:00 UTC = 09:00 Bangkok, Mon–Fri
- **Daily portfolio news:** GitHub Actions cron (`.github/workflows/daily-news.yml`) hits the worker's `/test-news` endpoint at 01:00 UTC = 08:00 Bangkok, Mon–Fri — per-user per-symbol thematic news + recommended action

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
wrangler secret put ADMIN_USER              # username for /admin Basic auth
wrangler secret put ADMIN_PASS              # password for /admin Basic auth (12+ chars)
wrangler secret put FINNHUB_KEY             # sign up at https://finnhub.io
                                            # free tier: 60 req/min, US real-time

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

`daily-news.yml` runs at 01:00 UTC = 08:00 Bangkok, Mon–Fri, and hits
`/test-news`. For every news subscriber (`news_subscribed = 1`) that also has
an active portfolio, the worker:
1. Fetches up to 3 real headlines per held symbol from Yahoo Finance's
   unofficial JSON search endpoint (`src/news.js`). Symbols are tried as-is,
   then `.BK` (SET), then `.HK` (HKEX with leading-zero variant).
2. Passes those headlines into Claude as "บริบท" and asks for 3–5
   per-portfolio items, each tagged `from_real_headline: true|false` so we
   know which were grounded vs. thematic.
3. Pushes the digest as a Flex card with coloured action labels (Positive /
   Watch / Hold / Alert) and a tinted recommendation block.

If Yahoo returns nothing for any symbol, Claude falls back to its previous
sector/macro themes — graceful degradation, no failures surface to the user.

The 08:00 news opt-in (`news_subscribed`) is **separate** from the 09:00
alert opt-in (`alert_subscribed`). Existing alert subscribers were
auto-opted into news at migration time so behaviour didn't regress.

## Routes

| Path | Method | Purpose |
|---|---|---|
| `/health` | GET | Liveness probe |
| `/callback` | POST | LINE webhook (signature verified) |
| `/test-alert` | GET | Manually trigger the daily-alert cron *(CRON_KEY)* |
| `/test-news` | GET | Manually trigger the daily portfolio-news cron *(CRON_KEY)* |
| `/test-subs` | GET | List current subscribers *(CRON_KEY)* |
| `/test-log` | GET | Last cron run logs — both `alert` and `news` *(CRON_KEY)* |
| `/journey?userId=<id>&limit=100` | GET | Full event timeline for a given LINE userId *(CRON_KEY)* |
| `/admin` | GET | Admin portal HTML (page itself is unauth — JS prompts for the key) |
| `/admin/api/overview` | GET | Row counts per table *(CRON_KEY)* |
| `/admin/api/users` | GET | All users with subscription flags + portfolio/event counts *(CRON_KEY)* |
| `/admin/api/portfolios` | GET | All saved portfolios across users with symbols *(CRON_KEY)* |
| `/admin/api/journey?userId=<id>` | GET | Same as `/journey`, mounted under admin *(CRON_KEY)* |
| `/admin/api/cron-logs` | GET | Same as `/test-log` *(CRON_KEY)* |

Endpoints marked *(CRON_KEY)* require an `Authorization: Bearer ${CRON_KEY}` header.

## Admin portal

A single-page admin UI lives at `/admin` (e.g.
`https://buddyai.<your-subdomain>.workers.dev/admin`). Open it in a browser:

1. The browser shows a native HTTP-Basic prompt for username + password.
   Set those values via `wrangler secret put ADMIN_USER` and
   `wrangler secret put ADMIN_PASS`. The page won't load until both are
   set on the worker.
2. Five tabs:
   - **Overview** — row counts per table.
   - **Users** — every user with display name, alert/news subscription badges,
     portfolio/message/event counts, and a "journey →" link.
   - **Portfolios** — every saved portfolio across users with symbols, total
     value, source, taken_at, and the owning userId.
   - **Journey** — paste any userId (or click from the Users tab) → full event
     timeline with payload JSON. Same data as `/journey`.
   - **Cron logs** — last-run blobs for the daily-alert and daily-news jobs.

Implementation: vanilla JS + Tailwind via CDN, no build step. The HTML lives
in `src/admin/page.js`; the read-only API in `src/admin/handlers.js`. Auth
accepts **either**:

- `Authorization: Bearer ${CRON_KEY}` — cron workflows + curl scripts
- `Authorization: Basic base64(${ADMIN_USER}:${ADMIN_PASS})` — browser

so the daily-alert / daily-news GitHub workflows keep working unchanged
while the admin portal gets a proper user/pass prompt. Constant-time
compare on each path; missing-secret cases fail closed.

Read-only for now — write actions (manual trigger, subscription toggle, push
test message) are tracked as a follow-up.

## LINE commands

| User input | Action |
|---|---|
| *(image)* | Send a portfolio screenshot. Confirm card offers **บันทึกเป็นพอร์ตใหม่** or **อัพเดต `<activeName>`** (latter archives the current state into the snapshot history). |
| `พอร์ต` / `portfolio` | Show the **active** portfolio summary card |
| `พอร์ตทั้งหมด` / `portfolios` / `list` | List all saved portfolios (Flex card) — tap **เลือก** to switch active, **ลบ** to delete one |
| `เปลี่ยนชื่อ <ชื่อใหม่>` / `rename <name>` | Rename the active portfolio |
| `สถานะหุ้น` / `status` | Live price + day change + P&L per held symbol, with a per-symbol AI action label (Hold / Watch / Trim / Add / Alert). Quotes route per market: **US → Finnhub**, **HK → Sina Finance (real-time)**, **SET → set.or.th (~15-min delayed)**, with **Stooq EOD** as a fallback for any symbol the primaries miss. |
| `ซื้อ <SYMBOL> <จำนวน> @ <ราคา>` / `buy …` | Append a BUY transaction to the active portfolio. Updates the holding's quantity + weighted-average cost and replies with a Flex confirm card. Example: `ซื้อ PTT 100 @ 35.50`. |
| `ขาย <SYMBOL> <จำนวน> @ <ราคา>` / `sell …` | Append a SELL transaction. Computes realized P/L against the existing avg cost, decrements (or removes) the holding, and replies with a Flex confirm card. |
| `รายการซื้อขาย` / `transactions` | Show the active portfolio's transaction history as a Flex card |
| `วิเคราะห์พอร์ต` | AI commentary on the active portfolio |
| `ปรับพอร์ต` | AI rebalance suggestions on the active portfolio |
| `เปรียบเทียบพอร์ต` / `compare` | Diff between active portfolio and the most recent non-active one |
| `ประวัติพอร์ต` / `history` | Timeline of past snapshots of the active portfolio |
| `ล้างพอร์ต` | Delete **all** saved portfolios |
| `สมัครข่าว` / `ยกเลิกข่าว` | Independently opt in/out of the 08:00 portfolio-news job |
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

## Quote sources for `สถานะหุ้น`

`src/marketdata.js` orchestrates per-market routing for `สถานะหุ้น`. Each
adapter returns the same standardized shape so the rest of the worker
doesn't care which feed served a given symbol.

| Market | Primary | Fallback | Notes |
|---|---|---|---|
| **US** | [Finnhub](https://finnhub.io) (`src/finnhub.js`) | Stooq | Free key, 60 req/min, real-time. Skipped if `FINNHUB_KEY` is unset. |
| **HK** | [Sina Finance](https://hq.sinajs.cn) (`src/sina.js`) | Stooq | No key. Real-time. Response is GB2312-encoded JS; we decode and parse. **Requires `Referer: https://finance.sina.com.cn`** or 403. |
| **SET (Thai)** | [set.or.th internal JSON](https://www.set.or.th) (`src/setor.js`) | Stooq | No key. ~15-min delayed. Cached in KV for 60s to be a polite citizen. Endpoint is unofficial and may change shape. |
| **EOD any market** | [Stooq](https://stooq.com) (`src/stooq.js`) | — | No key. EOD only — `day_change_pct` computed intra-day from open/close. |

Yahoo Finance was retired from the hot path because it aggressively blocks
Cloudflare-Worker IPs. `src/quotes.js` (the Yahoo adapter) and `src/news.js`
remain in the repo — `news.js` is still used by the daily-news job.

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
| `portfolio_saved` | User tapped **บันทึกพอร์ต** | `portfolio_id`, `name`, `source`, `total_value`, `symbols` |
| `portfolio_retry` | User tapped **อ่านใหม่** | — |
| `portfolio_switched` | User tapped **เลือก** on the list card | `portfolio_id` |
| `portfolio_renamed` | User typed `เปลี่ยนชื่อ …` | `portfolio_id`, `from`, `to` |
| `portfolio_deleted` | User tapped **ลบ** on the list card | `portfolio_id` |
| `portfolio_cleared` | `ล้างพอร์ต` wipes ALL saved portfolios | — |
| `portfolio_analysis` | `วิเคราะห์พอร์ต` produced an analysis | `portfolio_id`, `verdict`, `verdict_reason`, `top_symbol`, `top_weight_pct`, `concentration`, `sector_count` |
| `portfolio_analysis_failed` | Claude/AI Gateway error during analysis | `error` |
| `portfolio_rebalance` | `ปรับพอร์ต` produced rebalance suggestions | `portfolio_id`, `summary`, `suggestions[{symbol,action,current/target_weight_pct}]`, `diversifiers[]` |
| `portfolio_rebalance_failed` | Claude/AI Gateway error during rebalance | `error` |
| `daily_alert_sent` | Daily cron pushed the card to a subscriber | `date`, `personalised`, `summary`, `picks[]` |
| `daily_alert_failed` | Per-user push or pick-generation failed | `stage`, `error` |
| `daily_news_sent` | Daily news cron pushed the per-portfolio digest | `date`, `portfolio_id`, `summary`, `real_headline_count`, `items[{symbol,action,headline,from_real_headline}]` |
| `daily_news_empty` | Subscriber has a portfolio but Claude returned no news items | `portfolio_id` |
| `daily_news_failed` | Per-user news generate/push failed | `stage`, `error` |
| `subscribe_news` / `unsubscribe_news` | User opted in/out of the 08:00 news (independent of the 09:00 alert) | `via` |
| `portfolio_compared` | `เปรียบเทียบพอร์ต` produced a diff | `a_id`, `a_name`, `b_id`, `b_name`, `summary`, `only_in_a`, `only_in_b` |
| `portfolio_compare_failed` | Comparison errored | `error` |
| `holdings_status_requested` | `สถานะหุ้น` returned a per-holding status card | `portfolio_id`, `real_quote_count`, `quote_sources: { yahoo, stooq, none }`, `items[{symbol, action, day_change_pct, pl_pct, source}]` |
| `holdings_status_failed` | Status command errored | `error` |
| `portfolio_updated` | User tapped **อัพเดต `<active>`** on the confirm card | `portfolio_id`, `snapshot_id`, `name`, `total_value`, `symbols` |
| `transaction_buy` | User logged a BUY (`ซื้อ …`) | `portfolio_id`, `tx_id`, `symbol`, `quantity`, `price`, `fees`, `new_quantity`, `new_avg_cost` |
| `transaction_sell` | User logged a SELL (`ขาย …`) | `portfolio_id`, `tx_id`, `symbol`, `quantity`, `price`, `fees`, `realized_pl`, `new_quantity`, `new_avg_cost` |
| `transaction_failed` | Buy/sell rejected (no position, insufficient qty, bad input) | `portfolio_id`, `side`, `symbol`, `quantity`, `price`, `error` |

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
