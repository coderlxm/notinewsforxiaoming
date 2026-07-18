# NotiNewsForXiaoming

这是我自己的常驻 Telegram 个人 bot 仓库。当前主形态不是早期的“每日新闻脚本”，而是一个长期运行的单体 bot：

- 常驻接收 Telegram 消息
- 管理一次性提醒和循环提醒
- 按固定时点主动推送内容
- 跟踪 start.gg 选手状态
- 跟踪 AV 更新
- 做服务器巡检、维生素提醒、V2EX 节假日缓冲推送等日常任务

README 以“我自己后续部署维护”为目标，只记录当前代码事实和维护时真正需要知道的东西。

## 当前能力

当前代码里已经落地的主功能有：

- Telegram 交互 bot：`/start`、`/help`、`/remind`、`/watch`、`/watchlist`、`/startgg`、`/startggpoll`、`/fetchav`、`/fetchstartgg`、`/steam`
- 一次性提醒：支持明确格式和自然语言创建，状态持久化到 SQLite
- 循环提醒：支持 `every day / week / month` 和自然语言循环提醒
- 固定时点推送：睡觉提醒、早安、咖啡、新闻、GitHub、V2EX、英语、维生素、服务器巡检、AV 更新、start.gg 监控、Steam 价格监控
- start.gg 监控：固定选手自动同步、自动发现当前赛事项目、轮询推送状态变化
- AV 订阅：按 `star` / `label` 跟踪，去重后推送图文
- 节假日逻辑：中国工作日判断、V2EX 节假日缓存、假期倒计时

说明：

- `fitness` 相关代码仍在仓库里，但固定推送当前处于关闭状态。
- Telegram 交互默认只接受 `.env` 里的 `TG_CHAT_ID`。

## 运行形态

代码当前有两个入口：

- [src/resident.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/resident.ts)
  当前主入口。负责启动 Telegraf long polling、恢复提醒、注册固定任务。
- [src/index.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/index.ts)
  一次性入口。保留了按北京时间匹配时段并执行单个模式的能力，适合手动触发或 GitHub Actions 的一次性运行场景。

对应的 `package.json` 入口脚本是：

- `start` -> `src/index.ts`
- `start:bot` -> `src/resident.ts`

当前代码要求：

- Node.js 24.x
- `type: module`
- `pnpm@11.9.0`

Node 版本硬约束写在 [scripts/ensure-node-lts.mjs](/Users/xiaomingli/Code/NotiNewsForXiaoming/scripts/ensure-node-lts.mjs)。

## 环境变量

环境变量模板在 [.env.example](/Users/xiaomingli/Code/NotiNewsForXiaoming/.env.example)。

当前代码实际会读取这些值：

- `TG_TOKEN`
- `TG_CHAT_ID`
- `QWEATHER_API_KEY`
- `QWEATHER_CITY_ID`
- `DEEPSEEK_API_KEY`
- `STARTGG_API_TOKEN`

其中：

- Telegram 是所有主动推送和交互的唯一通道
- DeepSeek 同时用于内容总结和自然语言提醒解析
- start.gg 相关功能离不开 `STARTGG_API_TOKEN`

## Telegram 常用命令

日常维护最常用的是这些：

- `/help`
  查看当前 bot 暴露出来的命令入口
- `/remind`
  查看待处理提醒清单
- `/remind <时间> <内容>`
  创建一次性或循环提醒
- 直接发送自然语言
  例如“10 分钟后提醒我收衣服”“每天 22:00 做俯卧撑”
- `/fetchav`
  手动触发一次 AV 检查
- `/fetchav force`
  强制重发 AV 更新
- `/startgg`
  查看 start.gg 引导和当前配置
- `/startgg go`
  自动发现固定选手当前参加的赛事、立即检查并开启轮询
- `/startgg go <关键词>`
  按赛事关键词筛选自动发现的项目、立即检查并开启轮询
- `/startgg status`
  查看 start.gg 运行状态
- `/startgg deleteall`
  删除已记录的 start.gg 推送消息，并清空本地赛事、快照和去重状态
- `/startggpoll on`
  开启 start.gg 固定轮询
- `/startggpoll off`
  关闭 start.gg 固定轮询
- `/watch <选手名 | user_url | event_url>`
  添加 start.gg 监控对象
- `/watchlist`
  查看当前监控对象和最近状态
- `/fetchstartgg`
  立即执行一次 start.gg 检查
- `/steam`
  查看 Steam 价格监控引导
- `/steam add <App URL | AppID> <目标价>`
  添加 Steam 价格监控
- `/steam list`
  列出所有 Steam 价格监控
- `/steam set <订阅ID> <新目标价>`
  修改目标价
- `/steam remove <订阅ID>`
  删除监控
- `/steam check`
  立即执行一次 Steam 价格检查

## 部署现状

当前仓库里的主部署路径是：

- GitHub push 到 `main`
- [deploy.yml](/Users/xiaomingli/Code/NotiNewsForXiaoming/.github/workflows/deploy.yml) 通过 SSH 同步服务器代码
- 服务器安装依赖
- 安装并重启 [deploy/notinews-bot.service](/Users/xiaomingli/Code/NotiNewsForXiaoming/deploy/notinews-bot.service)
- 由 systemd 常驻拉起 `start:bot`

也就是说，当前真实主形态是：

- `systemd` 常驻 bot
- 进程内 `node-schedule`
- SQLite 本地状态

补充：

- [.github/workflows/daily-push.yml](/Users/xiaomingli/Code/NotiNewsForXiaoming/.github/workflows/daily-push.yml) 还在仓库里，但现在是手动触发的一次性 workflow，不是主部署形态。
- [Dockerfile](/Users/xiaomingli/Code/NotiNewsForXiaoming/Dockerfile) 和 [docker-compose.yml](/Users/xiaomingli/Code/NotiNewsForXiaoming/docker-compose.yml) 也在仓库里，但当前代码和部署脚本更偏向 systemd 常驻模式。

## 数据与状态文件

维护时最需要关注的本地数据文件：

- `data/notinews.sqlite`
  主数据库。提醒、循环提醒、AV 推送历史、V2EX 缓冲、维生素状态、start.gg 监控状态都在里面。
- `data/fitness_status.json`
  健身状态快照。
- `data/startgg_preset_players.json`
  start.gg 固定选手配置。
- `data/server-health-targets.json`
  服务器巡检目标。
- `data/china-holiday-2026.json`
  中国节假日和调休数据。

SQLite 初始化逻辑在 [src/reminders/db.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/reminders/db.ts)。虽然文件路径在 `reminders/` 下，但它实际上已经是全项目共享数据库入口。

## 代码结构速览

按维护视角看，关键目录是这些：

- [src/bot](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/bot)
  Telegraf bot 创建、鉴权、交互命令、按钮回调
- [src/reminders](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/reminders)
  提醒系统本体：解析、持久化、调度、格式化
- [src/scheduled](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/scheduled)
  固定任务注册和模式分发
- [src/services](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/services)
  业务子系统：AV、start.gg、服务器巡检、维生素、V2EX 缓冲、健身
- [src/fetchers](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/fetchers)
  外部数据抓取
- [src/ai](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/ai)
  DeepSeek 调用
- [src/formatters](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/formatters)
  Telegram HTML 文案拼装
- [src/publishers](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/publishers)
  Telegram 发送

几个关键文件：

- [src/scheduled/runMode.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/scheduled/runMode.ts)
  主动推送模式总分发
- [src/scheduled/jobs.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/scheduled/jobs.ts)
  常驻 bot 的固定时点任务注册
- [src/bot/interactive.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/bot/interactive.ts)
  所有主要交互命令入口
- [src/reminders/parser.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/reminders/parser.ts)
  提醒解析主入口
- [src/services/avTracker.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/services/avTracker.ts)
  AV 更新主链路
- [src/services/startggPresetSync.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/services/startggPresetSync.ts)
  start.gg 自动同步与一键启动入口
- [src/services/startgg/tracker.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/services/startgg/tracker.ts)
  start.gg 状态计算和变更推送核心

## 调度与时区

这个项目默认以 `Asia/Shanghai` 为准：

- `dayjs` 的时区辅助在 [src/utils/time.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/utils/time.ts)
- 固定任务时区写在 [src/scheduled/jobs.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/scheduled/jobs.ts)
- 一次性入口的北京时间匹配逻辑在 [src/index.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/index.ts)

如果后面要改固定推送时点，优先看：

- [src/scheduled/jobs.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/scheduled/jobs.ts)
- [doc/reference/server-schedule.md](/Users/xiaomingli/Code/NotiNewsForXiaoming/doc/reference/server-schedule.md)

## 技术栈

当前关键依赖：

- `telegraf`
- `better-sqlite3`
- `node-schedule`
- `rrule`
- `axios`
- `rss-parser`
- `graphql-request`
- `openai`
- `dayjs`
- `zod`

核心特点很简单：

- 单进程
- 本地 SQLite
- Telegram 单通道
- 没有多用户系统
- 代码优先服务个人日常使用效果
