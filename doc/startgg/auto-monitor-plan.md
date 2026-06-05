# start.gg 固定选手清单 + 赛事期自动监控方案

## 1. 目标

你提供一份长期关注选手清单，直接固化在项目中。  
之后在赛事期间自动进入监控，无需手动 `/watch` 添加。

## 2. 方案边界

1. 只做 start.gg 官方 API 方案。  
2. 不做网页抓取。  
3. 不引入兜底分支，配置错误直接报错暴露。  
4. 现有手动命令继续可用，但“固定清单”是主路径。

## 3. 设计总览

新增两个配置文件作为唯一数据源：

1. `data/startgg_preset_players.json`  
用于固定你关注的选手清单。

2. `data/startgg_tournament_windows.json`  
用于定义“什么时候算赛事期”以及“赛事期监控哪些 event”。

运行时新增一个同步步骤：

1. 读取固定选手清单并解析为 `player_id`。  
2. 写入 `startgg_watch_players`（已存在则更新名称）。  
3. 根据当前时间判断是否在赛事窗口内。  
4. 在赛事窗口内时同步窗口指定的 event 到 `startgg_watch_events` 并执行监控。  
5. 不在赛事窗口内时跳过 start.gg 监控执行。

同时新增一个“自然语言录入窗口”入口：

1. 你发送一句话描述赛事窗口。  
2. 使用当前已有 DeepSeek API 做结构化解析。  
3. 解析成功后直接写入 `data/startgg_tournament_windows.json`。  
4. 下一次调度自动生效。

## 4. 配置格式

### 4.1 固定选手清单

文件：`data/startgg_preset_players.json`

```json
{
  "players": [
    {
      "alias": "Tokido",
      "user_url": "https://www.start.gg/user/tokido"
    },
    {
      "alias": "MenaRD",
      "user_url": "https://www.start.gg/user/menard"
    }
  ]
}
```

说明：

1. `alias` 仅用于你本地识别和文档可读性。  
2. `user_url` 作为主键输入，运行时调用 API 解析 `player_id`。  
3. 若你已有明确 `player_id`，可扩展为直接填写 `player_id`，跳过解析。

### 4.2 赛事窗口配置

文件：`data/startgg_tournament_windows.json`

```json
{
  "windows": [
    {
      "name": "Combo Breaker 2026",
      "start_at": "2026-05-22T00:00:00+08:00",
      "end_at": "2026-05-26T00:00:00+08:00",
      "events": [
        {
          "event_slug": "tournament/combo-breaker-2026/event/street-fighter-6",
          "event_name": "Combo Breaker 2026 / Street Fighter 6"
        }
      ]
    }
  ]
}
```

说明：

1. 时间使用带时区的 ISO 字符串，按 `Asia/Shanghai` 维护。  
2. 监控范围由 `events` 明确指定，不做自动猜测。  
3. 若多个窗口重叠，合并所有 event 一起监控。

## 5. 代码改造点

### 5.1 新增模块

1. `src/services/startggPresetConfig.ts`  
负责读取并校验两个 JSON 配置。

2. `src/services/startggPresetSync.ts`  
负责把固定清单同步到 `startgg_watch_players`，把窗口 event 同步到 `startgg_watch_events`。

3. `src/services/startggWindowParser.ts`  
负责调用 DeepSeek，将自然语言解析为窗口结构（JSON）。

4. `src/services/startggWindowRepository.ts`  
负责把解析结果落盘到 `data/startgg_tournament_windows.json`（新增/覆盖策略可配置）。

### 5.2 复用现有能力

1. 继续复用 `resolveUserToPlayer` 解析 `user_url -> player_id`。  
2. 继续复用 `runStartggWatchOnce` 的状态抓取和推送主逻辑。  
3. 继续复用现有表 `startgg_watch_players` / `startgg_watch_events` / `startgg_watch_snapshots`。
4. 继续复用现有 DeepSeek 调用方式（`OpenAI` SDK + `baseURL=https://api.deepseek.com` + `response_format=json_object`）。

### 5.3 调度改造

在 `startgg_watch` 模式执行前，先跑一次“窗口判定 + 配置同步”：

1. 若当前不在任何窗口内：直接返回，不抓取。  
2. 若在窗口内：同步 players/events 后执行原有抓取。

## 6. 交互与使用方式

你日常有两种方式：

1. 文件方式：直接维护 `data/startgg_tournament_windows.json`。  
2. 对话方式：发送命令录入窗口，例如：  
`/startggwindow 下个月 6 月 15 日到 6 月 18 日监控 CEO 2026 的 SF6 和 KOF15，时区上海`

对话方式执行链路：

1. LLM 仅输出结构化 JSON。  
2. 本地用 zod 严格校验字段。  
3. 校验通过才写入窗口配置文件。  
4. 校验失败直接报错，不写入任何内容。

机器人侧行为：

1. 到赛事窗口后自动开始监控并推送。  
2. 窗口结束后自动停止监控执行。  
3. `/watchlist` 仍可查看当前落库对象与最近状态。

建议新增命令：

1. `/startggwindow <自然语言>`：新增一个赛事窗口。  
2. `/startggwindows`：查看当前已配置窗口。  
3. `/startggwindowdel <window_name>`：删除指定窗口。

## 7. 数据一致性约束

1. `player_id` 唯一，名称变化时更新 `player_name`。  
2. `event_slug` 唯一，名称变化时更新 `event_name`。  
3. 配置文件语法或字段错误时直接抛错，不静默跳过。
4. 自然语言解析结果不通过 schema 校验时直接报错，不写入。

## 8. 自然语言解析协议（DeepSeek）

输入示例：

`下个月 6 月 15 日到 6 月 18 日关注 CEO 2026，项目是 street fighter 6 和 tekken 8`

输出目标（模型只允许输出 JSON）：

```json
{
  "name": "CEO 2026",
  "start_at": "2026-06-15T00:00:00+08:00",
  "end_at": "2026-06-19T00:00:00+08:00",
  "timezone": "Asia/Shanghai",
  "events": [
    {
      "event_slug": "tournament/ceo-2026/event/street-fighter-6",
      "event_name": "CEO 2026 / Street Fighter 6"
    },
    {
      "event_slug": "tournament/ceo-2026/event/tekken-8",
      "event_name": "CEO 2026 / Tekken 8"
    }
  ]
}
```

约束：

1. 时间必须是 ISO 8601 且带时区偏移。  
2. `start_at < end_at`。  
3. `events` 至少 1 个。  
4. `event_slug` 必须是 `tournament/.../event/...` 格式。  
5. 解析成功后仍需用 start.gg API 校验每个 `event_slug` 是否存在。

## 9. 实施顺序

1. 增加两份配置文件与读取校验模块。  
2. 增加 preset 同步服务。  
3. 增加 `startggwindow` 解析与落盘服务（DeepSeek + zod）。  
4. 增加窗口管理命令：`/startggwindow`、`/startggwindows`、`/startggwindowdel`。  
5. 接入 `startgg_watch` 执行链路前置。  
6. 增加最小管理命令：`/startgg` 展示“当前是否在赛事窗口内 + 当前窗口名”。  
7. 更新 `doc/startgg/mvp_usage.md` 的“固定清单模式”章节。

## 10. 验收口径

1. 固定清单里的选手在不手动添加的情况下可出现在监控列表。  
2. 非赛事窗口时，`startgg_watch` 不执行抓取。  
3. 赛事窗口内，自动抓取并在状态变化时推送。  
4. 清单变更后，下一个调度周期自动生效。  
5. 配置错误能直接暴露具体错误信息。
6. 一条自然语言命令可以新增窗口并在配置文件中落盘。  
7. 自然语言解析失败时不会写脏数据。

## 11. 你需要提供给我的输入

1. 选手列表：建议直接给 start.gg 用户页链接清单。  
2. 每个赛事的开始时间、结束时间、要监控的 event 链接。  
3. 默认时区是否固定为 `Asia/Shanghai`（建议固定）。
