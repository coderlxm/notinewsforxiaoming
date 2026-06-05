# AV 女优新作追踪方案设计 (基于 Self-hosted RSSHub, JavBus 单路由)

## 1. 背景与挑战
- **挑战**：公共 RSSHub 实例（如 rsshub.app）对相关站点路由经常不可用（403/503）。
- **优势**：用户的服务器位于美国，IP 干净且无网络审查。
- **策略**：只保留已在目标机器实测通过的 `javbus` 路由，放弃 `javdb` 路由，优先稳定落地。

## 2. 核心架构
采用 **“本地代理 + 增量轮询”** 模式：
1. **基建层**：Docker 部署私有 RSSHub，作为稳定数据源。
2. **逻辑层**：Bot 定时任务请求本地 RSS 接口，并支持 `/fetchav` 手动触发一次拉取。
3. **存储层**：SQLite 记录已推送的作品 ID，防止重复。

## 3. 基础设施部署 (Docker)
在服务器执行以下配置 (`docker-compose.yml`):
```yaml
version: '3'
services:
  rsshub:
    image: diygod/rsshub:latest
    restart: always
    ports:
      - "1200:1200"
    environment:
      - NODE_ENV=production
      - CACHE_TYPE=redis
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
  redis:
    image: redis:alpine
    restart: always
```

## 4. 关键数据路由
- **演员路由**: `http://localhost:1200/javbus/star/:id`
  - 木下凛凛子 ID: `vwq`
- **片商路由**: `http://localhost:1200/javbus/label/:id`
  - Madonna URL: `https://www.javbus.com/label/7l`
  - Madonna RSS 路由: `http://localhost:1200/javbus/label/7l`

## 5. 代码实现路径

### 5.1 数据表设计（支持扩展）
```sql
CREATE TABLE IF NOT EXISTS tracked_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'javbus',    -- 当前固定 javbus
  target_type TEXT NOT NULL,                -- 'star' | 'label'
  target_id TEXT NOT NULL,                  -- 对应 javbus 的演员ID或片商(label)ID
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracked_targets_unique
ON tracked_targets(source, target_type, target_id);
```

### 5.2 Fetcher 逻辑 (`src/fetchers/javFetcher.ts`)

```ts
async function checkTargetUpdate(target) {
  // 单源策略：只用 JavBus；按目标类型组装路由
  const route = target.target_type === 'label'
    ? `javbus/label/${target.target_id}`
    : `javbus/star/${target.target_id}`;
  const feed = await parser.parseURL(`http://localhost:1200/${route}`);
  
  // 检查最近 5 条记录（防止 RSS 抖动或顺序调整导致的重复）
  for (const item of feed.items.slice(0, 5)) {
    const isPushed = await checkAlreadyPushed(target.id, item.guid);
    if (!isPushed) {
      await notifyUser(target, item);
      await recordPushHistory(target.id, item.guid);
    }
  }
}
```

### 5.4 手动拉取命令 (`/fetchav`)

新增 Bot 指令：`/fetchav`

- 行为：立即执行一次 `tracked_targets` 全量检查（与定时任务复用同一 `checkTargetUpdate` 主逻辑）。
- 权限：仅允许授权 chat 使用（沿用现有 `isAuthorized`）。
- 返回：
  - 开始时：`开始手动检查 AV 更新...`
  - 完成时：`检查完成：新增 X 条，已跳过 Y 条。`
  - 失败时：直接返回错误信息，不做兜底重试。

建议实现位置：
- `src/bot/interactive.ts`：注册 `/fetchav` 命令
- `src/scheduled/runMode.ts` 或 `src/fetchers/javFetcher.ts`：暴露可复用的 `runAvFetchOnce()`

### 5.5 标题翻译策略（仅标题）

为便于阅读，可选接入 DS API 做标题翻译，但严格限制为“只翻译标题”：

- 仅发送 `item.title` 到翻译接口。
- 明确禁止发送 `description`、演员详情、标签、长文本内容。
- 翻译成功：展示“原文标题 + 中文标题”或直接展示中文标题（按最终产品风格二选一）。
- 翻译失败：保留原文标题，继续推送，不重试。

推荐实现：
- `src/services/titleTranslator.ts`：`translateTitle(title: string): Promise<string | null>`
- `src/fetchers/javFetcher.ts`：在 `notifyUser` 前调用翻译；若返回 `null` 则使用原始标题。

### 5.3 存储增强 (去重表)
不再使用单字段 `last_work_id`，而是建立推送历史表：
```sql
CREATE TABLE IF NOT EXISTS push_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id INTEGER,
  item_guid TEXT,
  pushed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_history_target_guid
ON push_history(target_id, item_guid);
```

初始化示例：
```sql
INSERT INTO tracked_targets (name, source, target_type, target_id)
VALUES
  ('木下凛凛子', 'javbus', 'star', 'vwq'),
  ('Madonna', 'javbus', 'label', '7l');
```

### 5.3 视觉美化 (`src/formatters/javFormatter.ts`)

#### 场景 A：女优新作推送
```text
🌟 <b>关注女优新作更新</b>
──────────────────
👩 <b>演员</b>：木下凛凛子
🎬 <b>标题</b>：${item.title}
📅 <b>发布日期</b>：${item.pubDate}
──────────────────
#新作推送 #木下凛凛子
```

#### 场景 B：片商 (Madonna) 新作推送
```text
🏢 <b>关注片商新作上架</b>
──────────────────
🏷️ <b>片商</b>：Madonna (マドンナ)
🎬 <b>标题</b>：${item.title}
📅 <b>发布日期</b>：${item.pubDate}
──────────────────
#片商更新 #Madonna
```

## 6. 验证计划
1. **Step 1**: 在服务器部署 Docker 版 RSSHub。
2. **Step 2**: 运行 `curl http://localhost:1200/javbus/star/vwq` 验证返回 `200` 且为 RSS XML。
3. **Step 3**: 核对字段：频道标题、作品标题、发布时间、作品链接。
4. **Step 4**: 实现 `/fetchav` 手动命令，手动触发一次并确认有结果回执。
5. **Step 5**: 编写定时任务脚本并集成到 `src/scheduled/runMode.ts`。

## 7. 风险规避
- **频率控制**：每天请求 `1-2` 次（推荐每 12 小时 1 次），避免触发网站对单 IP 的极限风控。
- **失败策略**：单次拉取失败（`429/5xx/超时`）直接结束本轮，不做立即重试，等待下一轮定时任务。
- **缓存清理**：配置 Redis 缓存，减少对原站的直接请求。
- **扩展策略**：首版固定 `javbus` 单源，后续新增演员或片商只需新增 `tracked_targets` 记录，无需改抓取主逻辑。
- **翻译策略**：只翻译标题字段，翻译失败保留原文标题，不影响推送主流程。
