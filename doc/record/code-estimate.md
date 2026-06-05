# NotiNewsForXiaoming 代码量估算报告

> 统计日期：2026-05-23 | 分支：main | 排除 `node_modules/`、`.git/`、`dist/`、`data/`

## 总览

| 类别 | 文件数 | 行数 |
|---|---|---|
| TypeScript 源码 | 39 | 5,410 |
| CI/CD 配置 (YAML) | 2 | 145 |
| 配置文件 (JSON) | 4 | 136 |
| 构建脚本 (JS/MJS) | 1 | 12 |
| lock 文件 (pnpm-lock.yaml) | 1 | 1,278 |
| 文档 (Markdown) | 44 | 5,865 |
| **合计 (不含 lock 文件)** | **90** | **11,568** |
| **纯代码合计 (TS+JS+YAML+JSON)** | **46** | **5,703** |

## TypeScript 源码分布

### 按模块

| 模块 | 行数 | 说明 |
|---|---|---|
| `src/services/` | 1,433 | AV 追踪、健身、服务器健康、v2ex 缓冲推送、维生素提醒 |
| `src/reminders/` | 1,398 | 提醒解析、持久化、调度、格式化 |
| `src/bot/` | 650 | Telegram 机器人交互、认证、回调 |
| `src/ai/` | 392 | DeepSeek API 封装 |
| `src/formatters/` | 371 | Telegram 消息格式化 |
| `src/fetchers/` | 310 | 外部数据源 (天气、RSS、GitHub、V2EX) |
| `src/scheduled/` | 281 | 定时任务调度与模式分发 |
| `src/calendar/` | 222 | 中国工作日、倒计时 |
| `src/publishers/` | 126 | Telegram 消息发送 |
| `src/utils/` | 29 | 时区工具 |
| `src/config/` | 10 | 环境配置 |
| 根入口 | 188 | `index.ts`、`resident.ts`、`test_v2ex.ts`、`test_rss.ts` |
| **合计** | **5,410** | |

### 文件 Top 10

| 文件 | 行数 |
|---|---|
| `src/bot/interactive.ts` | 551 |
| `src/services/avTracker.ts` | 451 |
| `src/ai/deepseek.ts` | 392 |
| `src/reminders/parser.ts` | 373 |
| `src/reminders/repository.ts` | 294 |
| `src/reminders/formatter.ts` | 278 |
| `src/formatters/index.ts` | 229 |
| `src/services/avContentParser.ts` | 221 |
| `src/scheduled/runMode.ts` | 173 |
| `src/calendar/countdown.ts` | 169 |

## 文档分布

| 类别 | 文件数 | 行数 |
|---|---|---|
| 设计文档 (`doc/design/`) | 14 | 2,935 |
| Bug 记录 (`doc/bug/`) | 5 | 298 |
| 流程/验收 (`doc/`) | 12 | 1,082 |
| 部署文档 | 5 | 845 |
| 项目级 (`README`/`CLAUDE`/`AGENTS`/`api.md`) | 4 | 252 |
| 记录 (`doc/record/`) | 1 | 81 |
| 其他 | 3 | 372 |
| **合计** | **44** | **5,865** |

## 备注

- 不含二进制文件 (`src/reminders/image.png`)
- 不含 SQLite 数据库文件 (`data/`)
- 不含 IDE/工具配置 (`.claude/` 中的 settings)
- pnpm-lock.yaml 属于依赖锁定文件，不计入代码行数
