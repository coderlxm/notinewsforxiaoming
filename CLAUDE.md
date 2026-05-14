# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm start` — Run the one-shot daily push (news, weather, AI summaries, etc.)
- `pnpm start:bot` — Run the long-lived interactive/resident Telegram bot
- Node.js >= 24 required; `scripts/ensure-node-lts.mjs` is a prestart check

## Architecture

Two entry points serving different execution environments:

**`src/index.ts`** — One-shot daily push for GitHub Actions. Uses a time-slot matching system: checks whether the current Beijing time falls within ±10 minutes of a fixed schedule slot (sleep, wakeup, news, github, v2ex, etc.), then dispatches to `runMode()`. Has a `TEST_MODE_ENABLED` / `TEST_FORCE_MODE` env override for manual testing.

**`src/resident.ts`** — Long-lived interactive Telegram bot deployed on a server via systemd. Starts a Telegraf bot, registers fixed `node-schedule` jobs (same push modes at exact Beijing times), schedules pending one-shot/reminders and recurring rules from SQLite, and listens for user messages/commands.

### Push modes (`src/scheduled/runMode.ts`)

All push modes share a common signature — `runMode(mode, dayOfWeek, bot?)`. Each mode fetches data → runs through AI if needed → formats → sends to Telegram. Modes: `sleep`, `wakeup`, `server_health`, `news`, `github`, `v2ex`, `fitness`, `vitamin`, `english`, `av_update`.

### Reminder system

- **One-shot reminders**: `/remind` command or natural-language text → parsed via `src/reminders/parser.ts` (deterministic regex + AI fallback via DeepSeek) → persisted in SQLite → scheduled with `node-schedule`
- **Recurring reminders**: `/remind every day/week/month ...` or natural language → stored as rrule strings → next trigger computed via `rrule` package → re-scheduled after each fire
- **Database**: `better-sqlite3` at `data/notinews.sqlite` (WAL mode). Tables: `reminders`, `recurring_reminder_rules`, `recurring_reminder_runs`, `tracked_targets`, `push_history`
- **Interaction flow**: `src/bot/interactive.ts` handles `/start`, `/help`, `/remind`, `/fetchav` commands + `text` message listener + `callback_query` handler for inline buttons (done/snooze/cancel)

### Module organization

| Directory | Purpose |
|---|---|
| `src/ai/` | DeepSeek API wrappers for summarization, translation, teaching |
| `src/bot/` | Telegraf bot setup, auth, interactive handlers, callback parsing |
| `src/calendar/` | China workday detection (holiday-calendar JSON), countdown logic |
| `src/config/` | Env config loading (dotenv) |
| `src/fetchers/` | External data sources: RSS feeds, weather API, GitHub trending, V2EX |
| `src/formatters/` | Telegram HTML message formatting for each push mode |
| `src/publishers/` | Telegram message senders (text + photo) |
| `src/reminders/` | One-shot and recurring reminder parsing, persistence, scheduling, formatting |
| `src/scheduled/` | Push mode dispatch logic and fixed cron job registration |
| `src/services/` | AV tracker (RSS + AI translation), fitness state machine, server health (SSH probe) |
| `src/utils/time.ts` | Timezone helpers — always Beijing time (`Asia/Shanghai`); use `bj()` and `bjFormat()` from here |

### Key dependencies

- **AI**: DeepSeek via OpenAI SDK (compatible API, model: `deepseek-v4-flash`)
- **Bot**: `telegraf` for Telegram Bot API
- **Scheduling**: `node-schedule` for one-shot/fixed jobs, `rrule` for recurrence
- **Data**: `better-sqlite3` (local file DB), `rss-parser`, `axios`
- **Validation**: `zod` for AI response parsing
- **Time**: `dayjs` with `utc` and `timezone` plugins via `src/utils/time.ts` — never hand-write time formatting

## Existing documentation

- `AGENTS.md` — Project collaboration principles (no fallbacks, use mature npm libraries, fix root causes not symptoms, code style). Treat it as authoritative.
- `README.md` — Feature overview and zero-cost deployment guide (GitHub Actions + Secrets)
- `api.md` — DeepSeek JSON Output API usage notes

## Deployment

- **GitHub Actions** (`daily-push.yml`): Manual trigger only (`workflow_dispatch`), runs `pnpm start` on Ubuntu with secrets from GitHub
- **Server deploy** (`deploy.yml`): Auto-deploys on push to `main` via SSH — syncs code, installs deps, updates systemd service, restarts bot
- **Systemd**: `deploy/notinews-bot.service` runs `pnpm start:bot` as a persistent service
