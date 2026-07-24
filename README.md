# NotiNewsForXiaoming

<p align="right">
  <strong>English</strong> · <a href="README.zh-CN.md">🇨🇳 简体中文</a>
</p>

> A personal Telegram helper and Journal for Xiaoming ✨

This is a daily information and personal-recording tool for one Telegram chat—not a general-purpose SaaS. Reminders, scheduled updates, subscriptions, and lightweight life tracking live in one personal workflow: receive notifications, send instructions, and save things from Telegram; Journal turns those moments into private records and public posts worth revisiting.

## What it can do 🧰

### Everyday Telegram helper 💬

- **Reminders**: one-off and recurring reminders, natural-language parsing, date-range cancellation, and in-chat done, snooze, and pause actions.
- **Scheduled updates**: weather and game news, English content, GitHub Trending, V2EX topics, sleep/wake/coffee nudges, vitamin reminders, and server health reports—all in the Asia/Shanghai time zone.
- **China calendar awareness**: workdays come from data/china-holiday-2026.json; V2EX topics collected on holidays are held until the next workday.
- **Personal status**: vitamin intake and personal-status records can be managed through Telegram buttons and commands. The fitness-planning module remains available, while its scheduled pushes are currently taking a break.
- **X liked videos**: liked videos can be synced on demand, with the latest sync status included in the morning message.

### Subscriptions and tracking 👀

- **start.gg event tracking**: syncs preset players and discovers the events they are currently playing in; players and events can also be added manually. It reports match and status changes, with optional Top 16 / Top 32 seed tracking. The normal interval is 15 minutes; active matches switch to a 2-minute fast poll, and polling stops after events end.
- **Content subscriptions**: tracks updates from configured targets, remembers delivered items, and sends Telegram media messages. Manual checks and forced re-delivery are available.
- **Steam price watches**: set a target price by App URL or AppID; prices are checked at fixed times and a notification is sent when the target is reached or crossed.
- **Server health checks**: reads data/server-health-targets.json to check HTTP endpoints, ports, or TLS certificates and reports the results in Telegram.

### Journal: from Telegram to a personal site 📓

Journal is the repository’s other leading role: Telegram capture, a Fastify service, and a Vue frontend working together.

- Save a private note with /note or a public post with /post. Text, photos, videos, voice messages, files, locations, albums, and replies to an existing message can all be captured.
- Each saved item can be switched between private and public, opened on the site, or deleted directly from Telegram. /cancel leaves a waiting capture session.
- The web app offers a public waterfall feed, entry pages, and tag browsing; public entries also produce RSS and JSON Feed output.
- The signed-in “My Archive” area provides private/public filtering, full-text search, date and type filters, pinning, editing, deletion, and an “On This Day” view.
- The Tiptap-based article editor supports rich text, cover images, and inline images. Telegram attachments and article media are stored in Journal’s data directory.

## Telegram shortcuts 🎛️

| Area | Main shortcuts |
| --- | --- |
| Basics | /start, /help |
| Reminders | /remind, or plain language such as “remind me to collect the laundry in 10 minutes” |
| Journal | /note, /post, /cancel |
| start.gg | /startgg, /startgg go [keyword], /startgg status, /startgg seeds, /startggpoll on or off, /watch, /watchlist, /fetchstartgg |
| Steam | /steam add, list, set, remove, or check |
| Other | /syncx |

Every Telegram interaction is limited to the single chat identified by TG_CHAT_ID.

## How it runs ⚙️

| Part | Source entry point | Role | Persistence |
| --- | --- | --- | --- |
| Resident bot | src/resident.ts | Telegraf long polling, reminder recovery, scheduled jobs, interactive commands, and Telegram Journal capture | data/notinews.sqlite and state files under data/ |
| One-shot dispatcher | src/index.ts | Chooses one push mode from the current Beijing time; retained for manual and GitHub Actions use cases | Shared bot data |
| Journal service | src/journal-server/index.ts | Fastify API, asset storage, public feeds, and static web hosting | JOURNAL_DATA_DIR/journal.sqlite and assets/ |
| Journal frontend | web/ | Vue 3 single-page app for the public journal, private archive, and article editor | Built assets are served by the Journal service |

On startup, the resident bot restores incomplete reminders, recurring rules, persisted start.gg polling, and vitamin reminder loops, then registers its scheduled jobs. Times below are Beijing time:

| Time or rule | Job |
| --- | --- |
| 00:10 / 08:30 / 08:58 on workdays | Sleep, wake-up, and coffee reminders |
| 07:30 / 15:30 / 23:30 | Content-subscription checks |
| 02:15 / 08:15 / 14:15 / 20:15 | Steam price checks |
| 08:41 on workdays / 20:00 | Buffered V2EX delivery / V2EX topics |
| 09:10 / 09:55 | Server health / weather and game news |
| 10:30 / 13:30 | English content |
| 15:00 every other day | GitHub Trending |
| 18:30 on non-workdays or 20:45–21:00 on workdays | Vitamin reminder |

## Environment and data 🗂️

The project uses Node.js 24 (>=24 <25), TypeScript, and pnpm 11. The root [.env.example](.env.example) is the template for the resident bot; Journal deployments use [deploy/journal/.env.example](deploy/journal/.env.example).

| Variable | Used by | Purpose |
| --- | --- | --- |
| TG_TOKEN, TG_CHAT_ID | Bot and Journal | Bot authorization, Telegram messaging, and Journal attachment downloads |
| QWEATHER_API_KEY, QWEATHER_CITY_ID | Scheduled updates | QWeather |
| DEEPSEEK_API_KEY | AI content and reminders | News, GitHub, V2EX, English, life tips, and natural-language reminder parsing |
| STARTGG_API_TOKEN | start.gg | Event, player, and match-state queries |
| JOURNAL_API_BASE_URL, JOURNAL_INGEST_TOKEN, JOURNAL_PUBLIC_BASE_URL | Resident bot | Sends Telegram Journal content to the Journal service and creates site links |
| JOURNAL_ADMIN_PASSWORD, JOURNAL_COOKIE_SECRET | Journal service | Archive login and cookie signing |
| JOURNAL_WEB_HOST, JOURNAL_WEB_PORT, JOURNAL_DATA_DIR, JOURNAL_WEB_ROOT | Journal service | HTTP listener, data directory, and static frontend directory; each has a server-side default |

The data lives in clear, separate homes:

- data/notinews.sqlite: bot-side reminders, recurring rules, subscription delivery history, V2EX buffers, vitamins, Steam, start.gg, Journal capture sessions, and personal-status data.
- data/startgg_preset_players.json: preset start.gg player configuration.
- data/server-health-targets.json: server-health targets.
- data/fitness_status.json: fitness-module state.
- JOURNAL_DATA_DIR/journal.sqlite and JOURNAL_DATA_DIR/assets/: Journal entries, attachments, and image previews.

Database initialization and migrations are handled by src/reminders/db.ts, src/reminders/migrations.ts, and src/journal-server/migrations.ts.

## Code map 🗺️

    src/
    ├── bot/                 Telegram bot creation, authorization, commands, and callbacks
    ├── reminders/           One-off/recurring reminders, parsing, SQLite, and scheduling
    ├── scheduled/           Fixed jobs and one-shot push-mode dispatching
    ├── services/            start.gg, content subscriptions, Steam, X, health checks, and life-status services
    ├── fetchers/            Weather, game-news, English, GitHub, and V2EX sources
    ├── ai/                  DeepSeek integration
    ├── calendar/            China workday and countdown logic
    ├── publishers/          Telegram delivery
    ├── formatters/          Telegram HTML message formatting
    ├── journal-bot/         Telegram Journal capture and API client
    ├── journal-server/      Fastify, Journal database, media, and feeds
    └── shared/              Journal protocol shared by bot, server, and frontend
    web/                     Vue 3 + Vite + Pinia + Vue Router Journal frontend
    deploy/                  systemd, bot backup, and Journal Docker deployment assets
    data/                    Versioned calendar, monitoring-target, and preset-player data

## Deployment today 🚀

Production uses two independent deployment paths, each with a clear job:

- **Bot**: a systemd service runs the resident bot, with fixed jobs managed in-process by node-schedule. Its primary data is stored in the server project’s data/ directory. The repository also keeps a single-container bot Dockerfile and docker-compose.yml.
- **Journal**: a separate Docker image runs the Fastify service and built Vue frontend. Data is mounted at /opt/journal/data; the application port is bound only to the local loopback interface and exposed through an external web proxy.
- **Automatic release**: .github/workflows/deploy.yml deploys Journal and Bot independently based on the changed files. Documentation-only changes do not trigger deployment. daily-push.yml remains a manually triggered, one-shot push workflow rather than the resident bot’s main path.
- **Bot backups**: notinews-backup.timer and its matching systemd service run daily at 04:50 Beijing time. The bot is stopped for the backup and started again afterward.

Deployment assets and operational details live in [deploy/](deploy/). The Journal release-order notes are in [doc/deploy/journal-progressive-loading-release-order.md](doc/deploy/journal-progressive-loading-release-order.md).

## Stack

- **Bot and server**: TypeScript, Telegraf, Fastify, better-sqlite3, node-schedule, rrule, Zod
- **External data and AI**: Axios, RSS Parser, GraphQL Request, OpenAI SDK (DeepSeek-compatible API)
- **Journal web**: Vue 3, Vite, Vue Router, Pinia, VueUse, Vant, Tiptap, @egjs/grid
- **Content and media**: Feed, Sharp, Cheerio, sanitize-html

## Further reading 📚

- [Journal rich-blog design](doc/design/telegram-journal-rich-blog.md)
- [start.gg usage notes](doc/startgg/mvp-usage.md)
- [Steam price-watch guide](doc/steam/price-watch-usage.md)
- [Recurring-reminder acceptance record](doc/acceptance/recurring-reminder.md)
- [Server schedule](doc/reference/server-schedule.md)

---

A personal tool: direct, visible, and easy to maintain is plenty. 🌿

