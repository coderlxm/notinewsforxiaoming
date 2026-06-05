# RSS 追踪扩展建议

> 基于 fetchav (AV 更新追踪) 的 RSS 拉取 + AI 处理 + 去重推送模式，分析可复用该流程实现的功能。

---

## fetchav 流程拆解

当前 AV 追踪的完整流水线：

```
RSS 源 (本地代理 localhost:1200)
  → rss-parser 解析 XML
  → cheerio 抓取 HTML 详情页 (封面/磁力/元数据/样品图)
  → DeepSeek AI 翻译标题 (单个/批量)
  → 规则选最优磁力 (关键字匹配 + 大小过滤)
  → SQLite 去重 (push_history / push_batch_history)
  → 格式化 Telegram HTML 消息 (封面图 + 元数据 + 磁力链接)
  → 富媒体推送 (sendMediaGroup / sendPhoto)
  → 源站健康监控 (av_source_health 表 + 告警降噪)
```

**核心模式可以抽象为 6 个阶段：**

| 阶段 | 通用描述 | AV 实现 |
|------|---------|---------|
| ① 数据源 | 周期性拉取外部数据 | RSS via localhost:1200 |
| ② 解析 | 结构化提取关键字段 | cheerio HTML 解析 |
| ③ AI 增强 | 翻译/摘要/分类/筛选 | DeepSeek 翻译标题/类别 |
| ④ 去重 | 已推送记录持久化 | push_history + batch_history |
| ⑤ 格式化 | 生成可读消息 | Telegram HTML + 内联链接 |
| ⑥ 推送 | 发送到 Telegram | 消息/图片/媒体组 |

**额外基础设施：**
- **多目标追踪**：`tracked_targets` 表 + 按 target 逐一处理
- **源站健康**：`av_source_health` 表 + 异常告警 + 冷却降噪
- **双模式**：单条追踪 (star) 和批量摘要 (label)

---

## 可参考实现的功能

### 1. 🎮 Steam 游戏折扣监控

**优先级：高** | 实现复杂度：中 | 日常使用频率：每周数次

**场景**：监控愿望单/关注列表中的游戏，价格跌破阈值时推送。

**流程设计：**
```
SteamDB RSS / Steam Store API
  → 解析游戏名称、折扣力度、历史最低、截止时间
  → AI 生成一句话评价 (是否史低、值不值得买)
  → 去重 (同游戏同折扣不重复推)
  → 格式化推送 (封面图 + 折扣 + 价格曲线链接)
```

**与 AV 的差异：**
- 数据源从 RSS 变成 Steam API/SteamDB RSS — 都是 HTTP 拉取
- 解析从 cheerio HTML 变成 JSON 解析 — 更简单
- AI 从"翻译标题"变成"评价折扣价值" — 同是单字段增强
- 去重逻辑不变：按 appid + 折扣力度去重

**关键点：**
- 需要维护愿望单游戏列表 (类似 `tracked_targets`)
- 可复用 `av_source_health` 告警模式 (Steam API 偶尔抽风)
- 适合做"史低提醒"这种高价值推送，而非每次打折都推

---

### 2. 📝 技术博客/周刊订阅

**优先级：高** | 实现复杂度：低 | 日常使用频率：每日

**场景**：关注的技术博客或独立创作者更新时，AI 摘要后推送。

**流程设计：**
```
RSS 源列表 (阮一峰、Paul Graham、Dan Abramov 等)
  → rss-parser 解析 (完全同 AV)
  → cheerio 抓取正文 (可选，如需全文)
  → AI 生成 3 句话中文摘要 + 关键标签
  → 去重 (guid 去重 — 比 AV 更简单，不需要 HTML 解析的复杂去重)
  → 格式化推送 (标题 + 摘要 + 原文链接)
```

**与 AV 的差异：**
- 数据源直接是外部 RSS — 不需要本地代理
- 解析阶段大幅简化：不需要 cheerio 抓详情页（AV 需要因为 RSS 不含磁力/封面等）
- AI 从"翻译"变成"摘要" — 同是文本到文本的转换
- 去重直接用 item.guid，不需要 batch_date 逻辑
- 不需要富媒体推送 — 纯文本消息即可

**关键点：**
- 和现有的 `fetchGameNews()` 类似但订阅源更个性化
- 可复用 `english.ts` 里的多源竞速逻辑 (`Promise.any`)
- 几乎是 AV 模式的"轻量版"，实现成本最低

---

### 3. 🏷️ RSS 通用订阅中心

**优先级：高** | 实现复杂度：中 | 日常使用频率：每日

**场景**：将 AV 订阅逻辑抽象为通用订阅层，任何 RSS 源都可以配置追踪规则。

**流程设计：**
```
通用 RSS 订阅配置 (source_url, parser_type, ai_mode, dedupe_key_field)
  → 插件式解析器 (rss-parser / cheerio / JSON API / GraphQL)
  → 插件式 AI 处理 (翻译 / 摘要 / 分类 / 不处理)
  → 统一去重层 (按 source + key 去重)
  → 统一格式化 + 推送
```

**与 AV 的差异：**
- 不新增功能类型，而是**抽象 AV 的架构**让新订阅源零代码接入
- `tracked_targets` 表扩展为通用 `subscriptions` 表 (增加 source_type, parser_config, ai_config 等字段)
- 类似于 startgg 是"独立实现"而这个是"框架层抽象"

**关键点：**
- 这是架构演进方向，不是用户可见功能
- 做完后，第 1、2、4、5、8 项都可以基于此快速实现
- 建议先做 1-2 个具体订阅类型，再抽象 — 避免过早抽象

---

### 4. 📚 arXiv 论文追踪

**优先级：中** | 实现复杂度：中 | 日常使用频率：每周数次

**场景**：按关键词/作者/分类追踪 arXiv 上新论文，AI 翻译摘要并推荐。

**流程设计：**
```
arXiv API (search query by keyword/author/category)
  → 解析论文标题、作者、摘要、PDF 链接
  → AI 翻译摘要为中文 + 标注"为什么值得读"
  → 去重 (按 arxiv_id)
  → 格式化推送 (标题 + 中文摘要 + 领域标签 + PDF 链接)
```

**与 AV 的差异：**
- arXiv 有标准 API (Atom XML)，比 HTML 抓取稳定得多
- 解析不需要 cheerio，rss-parser 即可
- AI 处理量较大 (摘要通常几百词)，需要控制 token
- 可以作为"批量摘要"模式 (类似 AV label)，每周推送一次而非实时

**关键点：**
- 配置关键词/作者列表 → 类似 `tracked_targets`
- 适合做每周摘要而非逐篇推送 (论文信息密度高，逐篇太吵)
- 可设置过滤规则 (只看 cs.AI / stat.ML 等分类)

---

### 5. 🎬 电影/剧集上新提醒

**优先级：中** | 实现复杂度：中 | 日常使用频率：每周数次

**场景**：追踪豆瓣/IMDb 上关注的导演/演员/系列新作，或流媒体平台新上线内容。

**流程设计：**
```
豆瓣 RSS / TMDB API / Netflix RSS
  → 解析影片名、上映日期、评分、简介
  → AI 翻译 + 一句话看点 + 匹配你的口味偏好
  → 去重 (按影片 ID + 平台)
  → 格式化推送 (海报图 + 简介 + 评分 + 观看链接)
```

**与 AV 的差异：**
- 目标类型更多样 (导演/演员/系列/类型)
- 海报图推送 → 直接复用 `avTelegram.ts` 的 `sendAvUpdateWithGallery`
- AI 从纯翻译变成"个性化推荐理由"
- 部分源可能需要反爬 (User-Agent + headers 已有机刷方案)

**关键点：**
- 与 AV tracker 架构最接近 — 都是"关注实体 → 新内容推送"
- 可直接复用封面图 + 媒体组推送逻辑
- 建议先用豆瓣 RSS 验证，再扩展到其他源

---

### 6. 🎵 播客/视频更新提醒

**优先级：中** | 实现复杂度：低 | 日常使用频率：每周数次

**场景**：关注的播客或 YouTube 频道更新时推送，附带 AI 生成的内容摘要。

**流程设计：**
```
播客 RSS / YouTube Channel RSS
  → 解析标题、发布时间、时长、简介
  → AI 生成内容要点 + 值得听/看的理由
  → 去重 (按 guid)
  → 格式化推送 (标题 + 时长 + 要点 + 链接)
```

**与 AV 的差异：**
- 纯 RSS 解析，最简单的模式
- 不需要 HTML 抓取、不需要富媒体推送
- AI 从翻译变成内容摘要
- 去重完全同 AV star 模式

**关键点：**
- 和博客订阅 (第 2 项) 几乎一致，只是源不同
- 如果先做了通用订阅中心 (第 3 项)，这个就是配置一条订阅规则
- YouTube 频道 RSS 格式稳定，可靠性高

---

### 7. 💰 商品价格监控 (京东/亚马逊)

**优先级：低** | 实现复杂度：高 | 日常使用频率：偶尔

**场景**：监控特定商品的价格变化，跌破心理价位时推送提醒。

**流程设计：**
```
商品页面抓取 / 第三方价格 API
  → 解析当前价格、历史最低、促销信息
  → AI 判断是否值得入手 (结合历史数据)
  → 去重 (同商品同价位不重复推)
  → 格式化推送 (商品图 + 当前价 + 历史曲线 + 购买链接)
```

**与 AV 的差异：**
- 数据源不可靠：电商反爬严重，RSS 支持差
- 需要维护价格历史 (现有去重表不够，需要时序数据)
- 推送触发条件是"价格跌破阈值"而非"有新内容" — 模式不同

**关键点：**
- **投入产出比不高**。电商价格监控有大量成熟工具 (什么值得买、慢慢买等)
- 如果要做，建议只做 Steam 游戏 (第 1 项)，因为 Steam 有公开 API 且反爬弱
- 不推荐在个人 bot 里自建通用价格监控

---

### 8. 📊 GitHub Release/Star 监控

**优先级：中** | 实现复杂度：低 | 日常使用频率：每周数次

**场景**：监控指定仓库的新 Release，推送 Release Notes 的 AI 摘要。

**流程设计：**
```
GitHub API (Releases endpoint) / GitHub Release RSS
  → 解析版本号、发布时间、Release Notes
  → AI 摘取关键变更 (功能/修复/Breaking Change)
  → 去重 (按 repo + tag_name)
  → 格式化推送 (版本号 + 变更摘要 + Release 链接)
```

**与 AV 的差异：**
- GitHub 有标准 API + RSS，数据源稳定
- 不需要 cheerio 抓取
- AI 从翻译变成"Release Notes 摘要"
- 去重键是 `repo:tag_name`

**关键点：**
- 与现有 `fetchGithubTrending()` 是互补关系 — 前者是全局趋势，这个是个人关注
- 可实现为"Star Release"和"Watch Repo"两种模式
- API 有 rate limit (无认证 60次/小时，认证后 5000次/小时)，对个人使用足够

---

### 9. 🔄 V2EX 节点订阅

**优先级：中** | 实现复杂度：低 | 日常使用频率：每日

**场景**：订阅特定 V2EX 节点 (如程序员、分享发现、宽带症候群等)，有新帖时推送。与现有全局热帖模式互补。

**流程设计：**
```
V2EX API (api/v2/nodes/{name}/topics)
  → 解析帖子标题、内容、回复数
  → AI 一句话摘要 + 判断是否值得点开
  → 去重 (按 topic_id)
  → 格式化推送 (节点标签 + 标题 + 摘要 + 链接)
```

**与 AV 的差异：**
- 已有 V2EX API 调用经验 (`v2ex.ts`)
- 从"全局热帖 AI 脱水"变成"节点新帖逐条推送"
- 不需要 HTML 抓取
- 去重简单 (topic_id)

**关键点：**
- 几乎是第 2 项 (博客订阅) 的 V2EX 特化版
- 可与现有 `v2ex_buffered_push` 节假日缓存机制联动
- 适合关注低流量但高质量的节点 (如分享创造)

---

### 10. 🏥 网站/服务可用性监控

**优先级：低** | 实现复杂度：中 | 日常使用频率：偶尔 (仅故障时)

**场景**：监控个人常用网站/API 服务的可用性，不可用时推送告警。与现有 `server_health` (SSH 探活) 互补。

**流程设计：**
```
HTTP HEAD/GET 周期性探测
  → 检查状态码 + 响应时间
  → 异常时记录 + 判断是否达到告警阈值
  → 去重 (告警冷却 — 直接复用 av_source_health 模式)
  → 格式化推送 (站点名 + 状态码 + 错误信息)
  → 恢复时推送恢复通知
```

**与 AV 的差异：**
- 不是 RSS 拉取，而是 HTTP 探测 — 但轮询 + 告警降噪逻辑完全一致
- 不需要 AI 处理
- 不需要内容去重，但需要**告警去重** (直接复用 AV 源站健康逻辑)
- `av_source_health` 表的设计可以直接抽象复用

**关键点：**
- 与 `server_health.ts` (SSH 探活) 互补 — 那个是服务器内部健康，这个是外部站点可达性
- 告警降噪逻辑 AV 已完整实现 (冷却窗口 + 全局故障告警)
- 适合做轻量级"个人服务看板"

---

## 优先级矩阵

```
                    实现成本
                低        中        高
           ┌─────────┬─────────┬─────────┐
使用  高   │ 2.博客  │ 1.Steam │         │
频率      │ 8.GitHub │ 3.通用  │         │
           │         │  订阅中心│         │
           ├─────────┼─────────┼─────────┤
       中   │ 6.播客  │ 4.arXiv │ 7.价格  │
           │ 9.V2EX  │ 5.影视  │  监控   │
           │         │ 10.站点 │         │
           ├─────────┼─────────┼─────────┤
       低   │         │         │         │
           └─────────┴─────────┴─────────┘
```

---

## 推荐实施路径

### 第一阶段：验证通用模式 (1-2 周)

1. **技术博客订阅** (第 2 项) — 作为最简验证案例
   - 纯 RSS + AI 摘要 + 简单去重，无富媒体、无 cheerio
   - 验证"RSS → AI → 去重 → 推送"核心链路可抽象

2. **GitHub Release 监控** (第 8 项) — 验证 API 模式
   - API 分页拉取 (参考 startgg 的分页模式) + Release Notes 摘要
   - 验证"API → AI → 去重 → 推送"链路

### 第二阶段：抽象通用层 (1-2 周)

3. **RSS 通用订阅中心** (第 3 项)
   - 基于前两个案例，抽象出通用订阅框架
   - `subscriptions` 表 + 插件式 parser/ai/dedupe
   - 将 AV tracker 也迁移到通用框架下

### 第三阶段：扩展订阅类型 (按需)

4. **Steam 游戏折扣** (第 1 项) — 高价值，有富媒体推送
5. **arXiv 论文追踪** (第 4 项) — 批量摘要模式
6. **播客/视频更新** (第 6 项) — 轻量接入
7. **V2EX 节点订阅** (第 9 项) — 与现有 V2EX 功能联动

### 不建议现在做

- **商品价格监控** (第 7 项) — 反爬成本高、已有成熟替代品
- **网站可用性监控** (第 10 项) — 有专门工具 (Uptime Kuma 等)，不必自建
- **影视上新提醒** (第 5 项) — 数据源不稳定，先等通用框架成熟

---

## 架构建议

### 通用订阅框架核心表设计

```sql
-- 订阅源配置
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,              -- 订阅名称 (展示用)
  source_type TEXT NOT NULL,       -- 'rss' | 'api_json' | 'api_graphql' | 'html_scrape'
  source_config TEXT NOT NULL,     -- JSON: { url, method, headers, parser_type, ... }
  ai_mode TEXT NOT NULL DEFAULT 'none',  -- 'none' | 'translate' | 'summarize' | 'classify'
  ai_config TEXT,                  -- JSON: { prompt_template, model, ... }
  dedupe_key_field TEXT NOT NULL,  -- 去重字段名 (如 'guid', 'id', 'link')
  push_mode TEXT NOT NULL DEFAULT 'single', -- 'single' | 'batch'
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 推送历史 (通用)
CREATE TABLE subscription_push_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  dedupe_key TEXT NOT NULL,
  pushed_at TEXT NOT NULL,
  UNIQUE(subscription_id, dedupe_key)
);
```

### 处理器注册模式

参考 `runMode.ts` 的 dispatch 模式，每种订阅类型实现统一接口：

```typescript
interface SubscriptionHandler {
  fetch(sourceConfig: SourceConfig): Promise<RawItem[]>;
  parse(raw: RawItem, parserConfig: ParserConfig): Promise<ParsedItem>;
  enhance(parsed: ParsedItem, aiConfig: AiConfig): Promise<EnhancedItem>;
  format(enhanced: EnhancedItem, subscription: Subscription): string;
  publish(message: string, media?: MediaInput): Promise<boolean>;
}
```

这样可以渐进式地新增订阅类型，每种类型只需实现自己的 parser 和 AI enhancer，去重、推送、健康监控等由框架统一处理。

---

## 总结

AV tracker 的 RSS → 解析 → AI → 去重 → 推送流水线是一个高度可复用的模式。**最值得优先做的是技术博客订阅和 GitHub Release 监控** — 它们覆盖了 RSS 和 API 两种数据源类型，实现简单，日常使用频率高。在这两个跑通后，抽象出通用订阅框架，后续的 Steam 折扣、arXiv 论文、播客更新等都可以低成本接入。
