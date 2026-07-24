# NotiNewsForXiaoming

<p align="right">
  <a href="README.md">English</a> · <strong>简体中文</strong>
</p>

> 小明的个人 Telegram 提醒 Bot 与 Journal ✨

这是一个给自己用的日常信息与记录工具，不打算做成通用 SaaS。提醒、定时推送、订阅追踪和生活记录都汇集在同一条个人工作流里：在 Telegram 收通知、发指令、随手存内容；Journal 再把这些记录整理成可回看的私有资产和公开动态。

```text
Telegram
   │
   ├── 常驻 Bot ── 提醒 / 定时推送 / 订阅与状态追踪
   │       └── SQLite：data/notinews.sqlite
   │
   └── Journal 采集 ── 私有笔记 / 公开动态 / 媒体相册
           │
           └── Journal 服务 + Vue Web ── SQLite 与附件目录：JOURNAL_DATA_DIR
```

## 现在能做什么 🧰

### Telegram 日常助手 💬

- **提醒管理**：一次性提醒、循环提醒、自然语言解析、按时间范围取消，以及完成、稍后提醒、暂停等操作都能在聊天里完成。
- **日常推送**：按 `Asia/Shanghai` 时区送上天气与游戏新闻、英语内容、GitHub Trending、V2EX 热帖，还有睡眠/起床/咖啡、维生素和服务器状态提醒。
- **中国日历逻辑**：依照 `data/china-holiday-2026.json` 判断工作日；节假日的 V2EX 内容会先存起来，等下一个工作日再见。
- **生活状态**：维生素服用状态和个人状态记录都可通过 Telegram 按钮与命令维护；健身计划模块仍在，固定推送暂时休息中。
- **X 点赞视频**：可以手动同步 X 点赞视频，早安消息也会带上最新状态。

### 订阅与追踪 👀

- **start.gg 赛事监控**：同步预置选手、自动发现其正在参加的赛事，也可手动添加选手或赛事；推送对局与状态变化，支持 Top 16 / Top 32 种子关注。普通轮询为 15 分钟，存在进行中对局时切换为 2 分钟快速轮询，赛事结束后自动关闭。
- **内容订阅**：按预设目标跟踪内容更新，记录已推送项目并以 Telegram 图文消息通知；支持手动检查与强制重发。
- **Steam 价格监控**：按 App URL 或 AppID 设置目标价，固定时段检查价格，在达到或跨过目标价时通知。
- **服务器巡检**：读取 `data/server-health-targets.json` 进行 HTTP、端口或 TLS 证书检查，并将结果推送到 Telegram。

### Journal：从 Telegram 到个人网站 📓

Journal 是仓库里的另一位主角：由 Telegram 采集、Fastify 服务和 Vue 前端一起组成。

- 在 Telegram 用 `/note` 保存私有笔记、用 `/post` 保存公开动态；支持文字、图片、视频、语音、文件、位置、相册等消息内容，也支持回复一条已有消息后保存。
- 采集结果可在消息内切换公开/私有、打开网站或删除记录；`/cancel` 可退出等待输入的采集状态。
- Web 端提供公开瀑布流、详情页与标签浏览；公开内容同时生成 RSS 和 JSON Feed。
- 登录后的“我的资产”支持私有/公开内容筛选、全文搜索、日期和类型筛选、置顶、编辑、删除与“那年今日”。
- 文章编辑器基于 Tiptap，支持富文本、封面和内嵌图片；Telegram 附件与文章媒体存入 Journal 的数据目录。

## Telegram 交互入口 🎛️

| 范畴 | 主要入口 |
| --- | --- |
| 基础 | `/start`、`/help` |
| 提醒 | `/remind`，或直接发送自然语言，如“10 分钟后提醒我收衣服”“每天 22:00 做俯卧撑” |
| Journal | `/note`、`/post`、`/cancel` |
| start.gg | `/startgg`、`/startgg go [关键词]`、`/startgg status`、`/startgg seeds`、`/startggpoll on \| off`、`/watch`、`/watchlist`、`/fetchstartgg` |
| Steam | `/steam add \| list \| set \| remove \| check` |
| 其他 | `/syncx` |

所有 Telegram 交互均以 `TG_CHAT_ID` 限定为单一授权会话。

## 它是怎么跑起来的 ⚙️

| 组成 | 源码入口 | 角色 | 持久化 |
| --- | --- | --- | --- |
| 常驻 Bot | `src/resident.ts` | Telegraf long polling、提醒恢复、固定任务、交互命令与 Journal Telegram 采集 | `data/notinews.sqlite` 及 `data/` 下状态文件 |
| 一次性分发器 | `src/index.ts` | 按当前北京时间选择一项推送模式；保留给手动或 GitHub Actions 场景 | 共用 Bot 数据 |
| Journal 服务 | `src/journal-server/index.ts` | Fastify API、附件存储、公开 Feed、静态 Web 托管 | `JOURNAL_DATA_DIR/journal.sqlite` 与 `assets/` |
| Journal 前端 | `web/` | Vue 3 单页应用，提供公开记录、管理后台和文章编辑器 | 构建产物由 Journal 服务托管 |

常驻 Bot 启动后会接回未完成提醒、循环规则、已持久化的 start.gg 轮询和维生素提醒循环，然后把固定任务安排好；以下时间均为北京时间：

| 时间或规则 | 任务 |
| --- | --- |
| 00:10 / 08:30 / 08:58（工作日） | 睡眠、起床、咖啡提醒 |
| 07:30 / 15:30 / 23:30 | 内容订阅检查 |
| 08:15 / 14:15 / 20:15 / 02:15 | Steam 价格检查 |
| 08:41（工作日）/ 20:00 | 节假日缓存的 V2EX 推送 / V2EX 热帖 |
| 09:10 / 09:55 | 服务器巡检 / 天气与游戏新闻 |
| 10:30 / 13:30 | 英语内容 |
| 15:00（每两天） | GitHub Trending |
| 18:30（非工作日）或 20:45–21:00（工作日） | 维生素提醒 |

## 环境与数据 🗂️

项目使用 Node.js 24（`>=24 <25`）、TypeScript 与 pnpm 11。根目录的 [.env.example](.env.example) 是常驻 Bot 的配置模板；Journal 部署使用 [deploy/journal/.env.example](deploy/journal/.env.example) 作为服务端模板。

| 变量 | 使用模块 | 用途 |
| --- | --- | --- |
| `TG_TOKEN`、`TG_CHAT_ID` | Bot 与 Journal | Bot 鉴权、Telegram 收发与 Journal 消息附件下载 |
| `QWEATHER_API_KEY`、`QWEATHER_CITY_ID` | 日常推送 | 和风天气 |
| `DEEPSEEK_API_KEY` | AI 内容与提醒 | 新闻、GitHub、V2EX、英语、生活建议与自然语言提醒解析 |
| `STARTGG_API_TOKEN` | start.gg | 赛事、选手与对局状态查询 |
| `JOURNAL_API_BASE_URL`、`JOURNAL_INGEST_TOKEN`、`JOURNAL_PUBLIC_BASE_URL` | 常驻 Bot | 将 Telegram Journal 内容写入 Journal 服务，并生成网页链接 |
| `JOURNAL_ADMIN_PASSWORD`、`JOURNAL_COOKIE_SECRET` | Journal 服务 | 管理端登录与 Cookie 签名 |
| `JOURNAL_WEB_HOST`、`JOURNAL_WEB_PORT`、`JOURNAL_DATA_DIR`、`JOURNAL_WEB_ROOT` | Journal 服务 | HTTP 监听、数据目录和静态前端目录；均有服务端默认值 |

这些数据各有各的家：

- `data/notinews.sqlite`：提醒、循环规则、订阅推送历史、V2EX 缓冲、维生素、Steam、start.gg、Journal 采集会话和个人状态等 Bot 侧数据。
- `data/startgg_preset_players.json`：start.gg 预置选手配置。
- `data/server-health-targets.json`：服务器巡检目标。
- `data/fitness_status.json`：健身模块状态。
- `JOURNAL_DATA_DIR/journal.sqlite` 与 `JOURNAL_DATA_DIR/assets/`：Journal 条目、附件和图片预览。

数据库初始化和迁移分别由 `src/reminders/db.ts`、`src/reminders/migrations.ts` 与 `src/journal-server/migrations.ts` 管理。

## 代码地图 🗺️

```text
src/
├── bot/                 Telegram Bot 创建、鉴权、命令与回调
├── reminders/           一次性/循环提醒、解析、SQLite 和调度
├── scheduled/           固定任务与一次性推送模式分发
├── services/            start.gg、内容订阅、Steam、X、健康检查及生活状态服务
├── fetchers/            天气、游戏新闻、英语、GitHub、V2EX 数据源
├── ai/                  DeepSeek 调用
├── calendar/            中国工作日和倒计时逻辑
├── publishers/          Telegram 消息发送
├── formatters/          Telegram HTML 消息格式化
├── journal-bot/         Telegram Journal 采集和 API 客户端
├── journal-server/      Fastify、Journal 数据库、媒体和 Feed
└── shared/              Bot、服务端与前端共用的 Journal 协议
web/                     Vue 3 + Vite + Pinia + Vue Router Journal 前端
deploy/                  systemd、Bot 备份与 Journal Docker 部署资产
data/                    受版本控制的日历、监控目标与预置选手数据
```

## 部署现状 🚀

生产环境目前有两条各司其职的部署链路：

- **Bot**：`systemd` 运行常驻 Bot，进程内由 `node-schedule` 管理固定任务；主数据位于服务器项目目录的 `data/`。仓库中同时保留单容器 Bot 的 `Dockerfile` 与 `docker-compose.yml`。
- **Journal**：独立 Docker 镜像运行 Fastify 服务和已构建的 Vue 前端，数据挂载到 `/opt/journal/data`，仅将服务端口绑定在本机回环地址，由外部 Web 服务代理访问。
- **自动发布**：`.github/workflows/deploy.yml` 根据变更范围分别发布 Journal 和 Bot；文档改动不会触发自动发布。`daily-push.yml` 仍保留为手动触发的一次性推送工作流，不是常驻 Bot 的主路径。
- **Bot 备份**：仓库包含每天 04:50（北京时间）执行的 `notinews-backup.timer` 与相应 systemd service，备份期间会停止并在结束后重新启动 Bot。

部署实现和运维细节位于 [deploy/](deploy/)；Journal 的发布顺序说明位于 [doc/deploy/journal-progressive-loading-release-order.md](doc/deploy/journal-progressive-loading-release-order.md)。

## 技术栈

- **Bot 与服务端**：TypeScript、Telegraf、Fastify、better-sqlite3、node-schedule、rrule、Zod
- **外部数据与 AI**：Axios、RSS Parser、GraphQL Request、OpenAI SDK（DeepSeek 兼容接口）
- **Journal Web**：Vue 3、Vite、Vue Router、Pinia、VueUse、Vant、Tiptap、`@egjs/grid`
- **内容与媒体**：Feed、Sharp、Cheerio、sanitize-html

## 延伸阅读 📚

- [Journal 富文本博客设计](doc/design/telegram-journal-rich-blog.md)
- [start.gg 使用说明](doc/startgg/mvp-usage.md)
- [Steam 价格监控说明](doc/steam/price-watch-usage.md)
- [循环提醒验收记录](doc/acceptance/recurring-reminder.md)
- [服务器定时表](doc/reference/server-schedule.md)

---

个人工具，保持主路径直接、看得见、好维护就够了。🌿
