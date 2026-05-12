# AV 封面推送迭代方案（JavBus RSS）

## 1. 目标

在现有 AV 更新推送基础上，新增“作品封面”能力：

- 每条新作推送尽量带上封面图。
- 不改变当前增量去重主流程。
- 保持实现短路径，不引入额外爬虫链路。

本迭代只基于现有 `JavBus RSS` 数据，不新增新数据源。

## 2. 现状

当前 AV 推送流程已具备：

- `tracked_targets` 目标追踪（演员 + 片商）
- `push_history` 去重
- `/fetchav` 手动触发
- 定时 `av_update` 拉取
- 仅标题翻译（失败保留原文）

现有消息仅文本，不含封面图。

## 3. 数据来源与可行性

`/javbus/...` RSS 的 `item.description` 为 HTML，已实测包含封面相关字段：

- `a.bigImage href="...jpg"`：大图链接（优先）
- `img src="...jpg"`：封面图链接（备用）

因此可直接从 RSS `description` 提取封面，不需要额外访问详情页。

## 4. 设计原则

- **单路由**：继续使用 `javbus`，不扩展到 `javdb`。
- **主路径优先**：封面失败不影响文本推送。
- **无复杂兜底**：只做最小必要分支，不做多重重试。
- **最小改动**：在现有 `avTracker` 推送点扩展，不重构架构。

## 5. 实现方案

### 5.1 封面提取函数

在 `src/services/avTracker.ts` 增加：

- 输入：`item.description`（string | undefined）
- 输出：`coverUrl`（string | null）

提取顺序：

1. 正则匹配 `a.bigImage` 的 `href`
2. 若无，再匹配首个 `img` 的 `src`
3. 都没有则返回 `null`

仅接受 `http/https` 链接。

### 5.2 推送策略

维持当前文本消息格式不变，新增“图文优先”发送分支：

1. 有 `coverUrl`：
   - 调用 Telegram `sendPhoto(chatId, coverUrl, { caption, parse_mode: 'HTML' })`
   - `caption` 复用现有 `formatAvUpdateMessage` 文案（可做简短化）
2. 无 `coverUrl`：
   - 走现有 `sendTelegramMessage(message)`

发送失败策略（主路径优先）：

- 图像发送失败：立即回退文本发送一次（不重试图像）。

### 5.3 模块调整

建议新增一个专用发送器，避免污染通用 publisher：

- 新增 `src/publishers/avTelegram.ts`
  - `sendAvUpdate({ message, coverUrl }, bot?)`
  - 内部封装“图文优先，失败回退文本”

`src/services/avTracker.ts` 只负责组装数据并调用该发送器。

### 5.4 文案调整

当前 `formatAvUpdateMessage` 可保留。
如果采用 `caption`，建议控制在简洁版字段：

- 目标（演员/片商）
- 标题（原文）
- 标题翻译（可选）
- 发布时间（可选）
- 作品链接

## 6. 数据结构变化

本迭代不强制新增数据库字段。

可选增强（非本期必须）：

- `push_history` 增加 `cover_url` 归档列，便于问题追踪。

## 7. 开发步骤

1. 在 `avTracker` 实现 `extractCoverUrlFromDescription()`
2. 新增 `avTelegram` 发送器并接入 `sendPhoto`
3. 在 `runAvFetchOnce()` 推送分支中接入 `coverUrl`
4. 调整 `formatAvUpdateMessage` 作为 caption（如有必要）
5. 保持 `/fetchav`、定时任务逻辑不变

## 8. 验收标准

满足以下即视为通过：

1. 对含封面的 RSS 条目，Telegram 收到“图片 + 文案”消息
2. 对缺封面条目，仍能收到纯文本消息
3. 去重逻辑与当前一致，不重复推送
4. 标题翻译策略不变（只翻译标题，失败保留原文）
5. `/fetchav` 与定时任务都走同一实现路径

## 9. 风险与边界

- 部分历史条目可能无 `bigImage` 或 `img`，这是数据源限制。
- 远端图片链接可能失效或限流，允许回退文本，不阻断主流程。
- Telegram 对 caption 长度有限制，必要时压缩字段。

## 10. 后续扩展

后续可按优先级推进：

1. 支持“仅图片模式 / 图文模式”开关
2. 为片商与演员定制不同文案模板
3. 增加封面 URL 的可观测日志字段
