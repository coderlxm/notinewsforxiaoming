# P0-03 公开搜索与年月归档开发文档

> 对应需求：`doc/requirements/p0-03-public-search-and-archive.md`  
> 当前阶段：待开发  
> 文档日期：2026-08-12

## 1. 实现结论

本功能采用“独立公开查询 + 两个独立公开页面 + 复用现有永久详情”的最小方案：

```text
/search?q=关键词
        ↓
GET /api/search
        ↓
只查询 public 与当前请求已获授权的 protected
        ↓
轻量搜索摘要列表 ──点击──> /p/:publicId

/archive 或 /archive/:year/:month
        ↓
GET /api/archive
GET /api/archive/:year/:month
        ↓
公开端年月聚合 / 月份游标列表 ──点击──> /p/:publicId
```

关键决定：

1. 不复用 `/api/me/entries`，公开搜索在 SQL 条件和响应结构上独立建立权限边界。
2. P0 使用 SQLite 内置的字面子串查询，明确支持连续中文子串与空格分隔的多关键词，不引入未确认可用的全文扩展或第三方分词库。
3. 搜索结果使用轻量摘要，不返回媒体数组、富文本 JSON 和完整正文。
4. 月份归档复用当前公开 feed 的 `JournalEntry | ProtectedJournalEntryPreview` 权限呈现规则，但按真实时间排序，不应用置顶排序。
5. 搜索栏进入现有全站 Header，宽屏居中、窄屏独占第二行；搜索结果页不再维护第二套输入框。
6. 搜索、归档点击后统一进入既有 `/p/:publicId` 直接详情；不扩展当前仅面向 feed 的覆盖层上下文。
7. 每个规范化搜索 URL、归档总览和年月 URL 使用独立组件 key，并由有上限的 `KeepAlive` 保留；滚动继续使用 `App.vue` 的已有位置表，不新建全局页面状态系统。
8. 实现中不引入 `watch`、RAF、自动重试、替代查询、静默降级或运行时全文搜索 fallback。

## 2. 当前源码事实

### 2.1 前端路由和页面框架

- `web/src/router.ts` 当前只有公开 feed `/`、关于页、私有页面和 `/p/:publicId`，没有搜索与归档路由。
- `web/src/App.vue` 将路由解析为内部 `AppRoute`，使用 `feedScrollPositions` 保存列表滚动位置。
- 当前 Header 是 `profile-bar > .profile`：头像、名称/简介和站主管理导航处于同一网格；公开匿名访问时右侧导航不出现。搜索栏需要在公开路由下成为新的中间列，而不能塞进 `FeedView` 的局部标题。
- 公开 feed 的缓存键是 `public:${channel}:${tag}`，最多保留 30 个 `FeedView` 实例。
- `App.vue` 的 `overlayContext` 只允许公开 feed 或私有资料库作为来源；它依赖当前路由和详情路由都使用 `FeedView` 的事实。
- `FeedView.vue` 直接打开文章详情时会写入 `journalDetailFromFeed` history state；详情返回逻辑遇到这个标识会调用浏览器后退。
- 直接访问 `/p/:publicId` 时，当前详情会在内容加载后根据频道决定返回地址。
- `PublicChannelNavigation.vue` 在移动端固定为四列，当前正好容纳三个频道与“关于我”。

由此得出的方案判断：搜索栏放入公开 Header，归档入口留在公开 feed 标题区，不扩充移动端频道数；新页面进入详情时沿用直接详情和 history 返回，避免扩大覆盖层状态模型。

### 2.2 当前 API 和权限

- `GET /api/feed` 固定每页 20 条，接受 `channel`、`tag` 和 `cursor`。
- 公开 feed 查询已发布的 `public`、`protected` 代表记录；标签筛选当前只返回 `public`。
- `GET /api/entries/:publicId` 对私有或不存在的内容返回 404；未授权口令内容只返回脱敏预览。
- `JournalAuth.hasProtectedAccess()` 使用每条内容独立的签名 Cookie，并以 `accessRevision` 使旧授权失效。
- 站主 Cookie 使公开 feed 和公开详情可以直接读取口令内容。
- 公开 feed 响应设置 `Vary: Cookie` 和 `Cache-Control: private, no-store`。

### 2.3 当前数据库查询

- `repository.listPublicFeed()` 使用 `publication_status = 'published'`、`visibility IN ('public', 'protected')`、频道和媒体组代表记录条件。
- `repository.listFilterConditions()` 中的私有关键词查询是：标题或正文 `LIKE '%query%'`。
- 私有关键词查询不搜索标签；标签是单独的 `json_each(tags_json)` 精确条件。
- `groupRepresentativeCondition()` 保证 Telegram 媒体组只取最早消息作为一条列表记录。
- `source_created_at` 以 ISO 时间字符串保存；当前“往年今日”已经通过 SQLite `strftime(..., '+8 hours')` 按上海日期查询。
- 当前迁移版本为 14。已有相关索引包括：
  - `idx_journal_entries_timeline(visibility, pinned, source_created_at)`
  - `idx_journal_entries_source_created_at(source_created_at)`
  - `idx_journal_entries_channel_timeline(visibility, publication_status, channel, pinned, source_created_at, id)`
- 当前迁移没有 FTS 虚拟表、全文索引或搜索同步触发器。
- 当前依赖声明包含 `better-sqlite3 ^12.11.1`，没有中文分词或搜索引擎依赖。

### 2.4 SQLite 能力边界

SQLite 官方文档明确说明：

- [`instr(X, Y)`](https://www.sqlite.org/lang_corefunc.html#instr) 按字符串查找首次出现位置，适合把 `%`、`_` 等输入当作字面字符。
- 内置 [`lower(X)`](https://www.sqlite.org/lang_corefunc.html#lower) 只处理 ASCII 大小写，不能据此承诺所有 Unicode 字母的大小写归一。
- [FTS5](https://www.sqlite.org/fts5.html) 的 `unicode61` 和 `trigram` tokenizer 有不同的匹配边界；trigram 的全文查询对少于三个 Unicode 字符的子串有限制。
- 普通多列 B-tree 索引主要帮助可索引的约束和排序，不能把 `instr(lower(column), term)` 变成全文索引查询。

源码没有给出部署环境实际 SQLite 编译选项，也没有证明 FTS5 及特定 tokenizer 已启用。因此 P0 不以 FTS5 为前提，也不增加运行时探测后切换查询的双路径。

## 3. 公开数据契约

### 3.1 新增共享摘要类型

在 `src/shared/journalProtocol.ts` 定义服务端响应 schema，并在 `web/src/types.ts` 保持对应前端类型：

```ts
interface PublicEntrySearchSummary {
  publicId: string;
  title: string | null;
  excerpt: string;
  channel: JournalChannel;
  contentType: string;
  entryType: 'record' | 'article';
  visibility: 'public' | 'protected';
  tags: string[];
  sourceCreatedAt: string;
}

interface PublicSearchResponse {
  entries: PublicEntrySearchSummary[];
  nextCursor: string | null;
}

interface PublicArchiveMonth {
  month: string; // 01-12
  count: number;
}

interface PublicArchiveYear {
  year: string; // 四位年份
  count: number;
  months: PublicArchiveMonth[];
}

interface PublicArchiveResponse {
  years: PublicArchiveYear[];
}
```

月份列表响应直接复用现有 `JournalFeed`：

```ts
interface JournalFeed {
  entries: Array<JournalEntry | JournalProtectedEntryPreview>;
  nextCursor: string | null;
}
```

这样做的原因：

- 搜索只需要文字摘要，返回完整 `JournalEntry` 会带上媒体、结构化内容和富文本正文，数据范围过大。
- 月份列表需要与公开 feed 完全一致的口令预览与解锁后呈现，复用已有 union 能减少第二套权限 DTO。

### 3.2 搜索摘要生成

- `excerpt` 从 `content_text` 生成，不从 `rich_body_json` 现场解析。
- 若正文包含任一查询词，从首个命中位置附近截取约 120 个可见字符，并根据前后截断情况加省略号。
- 若正文没有命中但标题或标签命中，从正文开头截取。
- 摘要是纯文本；服务端不输出带标签的高亮 HTML。
- 文章/记录由 `body_format === 'rich'` 判断，与现有口令预览规则一致。
- 映射搜索摘要时不调用 `assetsFor()`，避免每条结果产生媒体查询。

## 4. API 设计

### 4.1 `GET /api/search`

查询参数：

| 参数 | 必需 | 规则 |
| --- | --- | --- |
| `q` | 是 | trim 后 1 至 80 个字符 |
| `cursor` | 否 | 非空字符串，由服务端生成 |

响应：`PublicSearchResponse`。服务端固定取 20 条，并多取一条判断 `nextCursor`。

路由 schema 使用 Zod。无效参数沿现有全局错误处理直接返回 400，不替换为默认查询。

响应必须设置：

- `Vary: Cookie`
- `Cache-Control: private, no-store`

原因是同一 `q` 会因站主 Cookie 或已解锁口令 Cookie 得到不同结果。

### 4.2 `GET /api/archive`

无查询参数。返回 `PublicArchiveResponse`：

- 年份倒序。
- 年内月份倒序。
- `year.count` 为该年所有月份数量之和。
- 只包含存在公开端可到达内容的年月。

数量集合固定为已发布的 `public` 与 `protected` 代表记录，不受当前 Cookie 影响。

### 4.3 `GET /api/archive/:year/:month`

路径参数：

- `year`：四位数字。
- `month`：`01` 至 `12`。

查询参数：

- `cursor`：可选非空字符串。

响应复用 `JournalFeed`，每页 20 条。口令项根据当前请求返回完整 `JournalEntry` 或 `JournalProtectedEntryPreview`，因此响应设置 `Vary: Cookie` 和 `Cache-Control: private, no-store`。

### 4.4 错误语义

- 查询或年月格式不合法：400，并返回现有 `{ error }` 结构。
- 合法月份没有内容：200，`entries: []`、`nextCursor: null`。
- API 不把空月份改写成最近有内容的月份。
- 数据库或摘要生成错误沿现有 Fastify 错误处理暴露，不返回部分成功结果。

## 5. 搜索权限实现

### 5.1 为什么不能先命中再脱敏

如果 SQL 先用口令标题或正文命中，然后把结果替换成“加密记录”，未授权访问者仍可从“有没有结果”推断秘密文本是否存在。因此搜索候选集合必须先完成授权过滤。

### 5.2 当前请求的可搜索集合

为 `JournalAuth` 增加一个读取当前有效口令授权的方法，返回已经通过签名校验的：

```ts
interface JournalProtectedAccessGrant {
  publicId: string;
  accessRevision: number;
}
```

该方法沿用当前 Cookie 命名和值格式，并确保 Cookie 中的 `publicId` 与 Cookie 名对应。站主不需要枚举 Cookie，直接使用“全部已发布口令内容可读”的分支。

仓储查询接收以下明确权限之一：

```ts
type PublicSearchAccess =
  | { protected: 'all' }
  | { protected: JournalProtectedAccessGrant[] };
```

SQL 可读条件为：

```text
站主：
  visibility IN ('public', 'protected')

普通请求且没有有效口令授权：
  visibility = 'public'

普通请求且有有效口令授权：
  visibility = 'public'
  OR (
    visibility = 'protected'
    AND (public_id, access_revision) 属于当前有效授权集合
  )
```

所有分支还必须同时包含：

- `publication_status = 'published'`
- `groupRepresentativeCondition('e')`

`private` 和 `draft` 不因站主身份而加入公开搜索；站主需要搜索它们时继续使用 `/me`。

## 6. SQLite 搜索方案

### 6.1 查询规范化

服务端对 `q` 做与前端相同的规范化，服务端结果才是最终事实：

1. 去除首尾空白。
2. 连续空白折叠为一个空格。
3. 按空格拆为 `terms`。
4. 每个 term 都作为 SQL 参数，不拼接用户输入。

### 6.2 字段命中表达式

每个 term 对以下三处做 OR，多个 term 之间做 AND：

```sql
instr(lower(COALESCE(e.title, '')), lower(?)) > 0
OR instr(lower(e.content_text), lower(?)) > 0
OR EXISTS (
  SELECT 1
  FROM json_each(e.tags_json) tag
  WHERE instr(lower(CAST(tag.value AS TEXT)), lower(?)) > 0
)
```

选择 `instr` 而不是拼接 `%term%` 的理由：

- 中文连续字符按字面子串匹配。
- `%` 和 `_` 不会意外变为通配符。
- 不需要手写转义器。
- `lower` 的能力边界可以准确表述为 ASCII 不区分大小写，中文字符保持原样匹配。

### 6.3 排序与游标

使用 CTE 先计算 `match_rank`：

| `match_rank` | 条件 |
| --- | --- |
| 0 | 完整规范化查询出现在标题中 |
| 1 | 完整规范化查询与某个标签相等 |
| 2 | 完整规范化查询出现在正文中 |
| 3 | 只满足拆分 term 的组合命中 |

最终顺序：

```sql
ORDER BY match_rank ASC, source_created_at DESC, id DESC
```

搜索游标包含：

```ts
interface PublicSearchCursor {
  rank: 0 | 1 | 2 | 3;
  sourceCreatedAt: string;
  id: number;
}
```

游标沿用当前 base64url JSON + Zod 解析方式。续页条件使用 rank、时间和 ID 的三段比较，不使用 OFFSET，避免前页新增内容导致明显漂移。

### 6.4 索引决定

P0 不新增全文表或文本索引：

- 当前没有 FTS schema、同步触发器或分词依赖。
- `instr(lower(...))` 子串条件不能由现有普通文本 B-tree 索引直接加速。
- FTS5 `unicode61` 不能直接等同于本需求的中文任意子串语义；trigram 又会引入短于三个字符的查询边界和额外同步结构。
- 在没有当前真实内容量和部署 SQLite 编译事实时，加入 FTS 双路径会扩大迁移和一致性风险。

当前个人站规模先保证查询正确、权限正确和中文行为明确。若真实内容量以后证明线性扫描已经成为问题，FTS 应作为一次独立的数据迁移与查询替换，不在运行时把 FTS 失败静默切回 `instr`。

## 7. 年月归档查询方案

### 7.1 总览聚合

仓储新增 `listPublicArchive()`，查询条件固定为：

```text
publication_status = 'published'
visibility IN ('public', 'protected')
媒体组代表记录
```

聚合字段沿用现有上海日期口径：

```sql
strftime('%Y', e.source_created_at, '+8 hours') AS year
strftime('%m', e.source_created_at, '+8 hours') AS month
COUNT(*) AS count
```

SQL 按 year、month 倒序返回扁平行，仓储层组装为 `PublicArchiveYear[]` 并计算年度合计。数据库返回无效年月时直接暴露数据问题，不跳过该行。

### 7.2 月份列表

路由层根据 `year`、`month` 生成上海时区的月初和下月月初，并转换成 ISO UTC 边界：

```text
source_created_at >= monthStart
source_created_at < nextMonthStart
```

使用半开区间可以正确覆盖月末毫秒并自然处理 12 月到次年 1 月。排序为：

```sql
ORDER BY source_created_at DESC, id DESC
```

归档游标只包含 `sourceCreatedAt` 和 `id`。查询继续使用当前 `idx_journal_entries_source_created_at` 的时间序能力；置顶字段不进入条件和排序。

仓储映射规则与 `listPublicFeed()` 相同：

- `public` 返回完整 `JournalEntry`。
- `protected` 且站主或当前 Cookie 有效，返回完整 `JournalEntry`。
- 其他 `protected` 返回 `toProtectedPreview()`。

### 7.3 索引决定

归档 P0 不增加迁移：

- 月份详情使用可比较的时间范围，而不是在 WHERE 中对每行 `strftime` 后再比较，可以继续利用现有时间索引。
- 总览聚合需要读取全部公开端已发布代表记录，但它只返回年月计数，个人站规模下没有足够证据支持再增加一个与现有时间索引高度重叠的索引。
- 搜索所需的子串扫描也不会从新增普通复合索引中获得核心改善。

因此 `src/journal-server/migrations.ts` 不属于本次预计修改文件。后续只有在真实查询形态证明现有索引不足时，再单独决定索引迁移。

## 8. 服务端组织

新增 `src/journal-server/routes/publicDiscovery.ts`，集中注册：

- `GET /api/search`
- `GET /api/archive`
- `GET /api/archive/:year/:month`

选择独立路由文件而不是继续扩大 `publicFeed.ts`，是因为三者共享“公开发现”领域，但查询和响应并非频道 feed 的附加参数。

`src/journal-server/server.ts`：

- 注册 `registerPublicDiscoveryRoutes()`。
- 为 `/search`、`/archive`、`/archive/:year/:month` 注册 SPA 页面地址，保证直接打开仍返回应用 shell。
- 按推荐顺序，P0-01 已先建立 `JournalPageDocumentService` 时，这三个页面必须由该服务输出初始 head：搜索页统一 `noindex, follow` 且 Canonical 为 `/search`；归档总览和月份页输出各自 Canonical、`index, follow` 与 `CollectionPage`。不得重新使用旧的静态 `sendApplication` 绕过统一元信息所有者。
- 扩展 P0-01 的 sitemap 查询：增加 `/archive` 与当前有内容的年月路径；不加入 `/search` 或任意 `q`。

`src/journal-server/repository.ts` 新增：

- `searchPublicEntries(...)`
- `listPublicArchive()`
- `listPublicArchiveMonth(...)`
- 搜索摘要和独立游标的内部映射函数。

不得让公开发现路由调用 `repository.list()` 后在路由层筛掉私有结果；权限必须进入仓储查询条件。

## 9. 前端路由与状态模型

### 9.1 Vue Router

`web/src/router.ts` 新增：

```text
/search                         name: public-search
/archive                        name: public-archive
/archive/:year/:month           name: public-archive-month
```

年月路由使用与需求一致的参数约束。搜索 query 由页面和 API schema共同约束；无效数组值不进入正常搜索状态。

两个页面组件使用懒加载，避免公开 feed 初次进入时加载发现页面代码。

### 9.2 `App.vue` 路由解析

扩展内部 `AppRoute`：

```ts
| { name: 'public-search'; key: string; query: string }
| { name: 'public-archive'; key: 'public-archive:overview' }
| {
    name: 'public-archive-month';
    key: string;
    year: string;
    month: string;
  }
```

key 由规范 URL 状态确定：

```text
public-search:{公开搜索授权版本}:{规范化查询词或 empty}
public-archive:overview
public-archive:{year}-{month}
```

搜索结果成员会在用户新解锁一条口令内容后变化，因此 App 保存一个从 0 开始的 `publicSearchAccessRevision`，只在现有 `handlePublicDetailUnlocked()` 明确事件中递增。它只进入搜索组件 key，不进入 URL 或滚动 key。归档成员不因解锁改变，已有 `revealedPublicEntries` 负责把受限预览替换成完整条目。

`App.vue` 把已经解析的 `query`、`year`、`month` 作为只读 props 传给页面组件。每个实例只负责一个固定 URL 与授权状态，不通过 `watch` 或路由更新钩子把 A 查询的数据改写成 B 查询的数据。

`publicShellActive` 纳入三个新路由，使头像、简介和公开频道导航保持常驻。频道导航传入 `channel: null`，不把搜索或归档错误标记成某一频道。

另设 `publicHeaderSearchVisible`，明确包含 `public`、`about`、`detail`、`public-search`、`public-archive` 和 `public-archive-month`。它不能直接等同于当前 `publicShellActive`：直接打开的长文章详情当前可能没有背景 feed，不能为了显示搜索栏而意外给页面增加公开侧栏。

### 9.3 页面实例缓存

在 `RouterView` 中为搜索和归档加入单独的 `KeepAlive` 分支，按上述 route key 最多保存最近 30 个发现页实例。像当前公开 feed 一样，站主已登录与普通访客使用彼此独立的条件分支；退出站主会话时不能继续呈现站主权限下缓存的口令搜索摘要。这个上限覆盖不同查询、归档总览和不同月份，同时避免无界保存长列表。

详情路由仍走现有 `FeedView` 分支。进入详情时发现页面实例被停用而不是销毁；返回后直接恢复当前 entries、游标、归档总览和局部状态。

最终通用的 `<component>` 分支必须排除 discovery 路由，避免同一组件被渲染两次。

### 9.4 滚动位置

将 `persistentFeedKey()` 的职责扩展为公开列表键解析，增加：

```text
search:${规范化 q}
archive:overview
archive:${year}-${month}
```

保留当前处理流程：

1. 离开列表前记录 `contentScroll.scrollTop`。
2. 返回列表时设置待恢复位置。
3. 页面完成列表布局后发出 `layoutReady`。
4. `App.vue` 使用已有无动画 `scrollTo({ behavior: 'auto' })` 恢复位置。

切换到新查询或新月份时对应键不存在，位置自然从 0 开始。不要用 RAF等待布局。

## 10. 前端页面实现

### 10.1 `PublicSearchView.vue`

局部状态：

- `entries`、`nextCursor`。
- `loading`、`loadingMore`、`error`。

生命周期：

- `query` 由 `App.vue` 作为固定 prop 传入；为空时不请求。
- 实例首次挂载时加载自己的查询结果。
- 组件重新激活且已有结果时直接发出 `layoutReady`，不重复请求。

高亮组件只拆分纯文本并输出普通文本节点与 `<mark>`，禁止 `v-html`。

### 10.2 `PublicArchiveView.vue`

组件根据固定 props 只进入一种模式：

- 总览实例：持有 `years`、总览 loading/error。
- 月份实例：持有固定 year/month、entries、cursor、月份 loading/loadingMore/error。

归档总览和每个月份使用各自的 keyed 实例。从总览进入月份时，总览实例进入缓存；返回总览时复用其 `years`。每个月份实例只加载自己的游标列表，不用 `watch` 或路由更新钩子切换内部月份。

月份普通条目从 `JournalEntry` 中选取需求字段形成紧凑行；受限条目使用专门的紧凑口令行，不直接复用大尺寸瀑布卡片。

组件接收 `App.vue` 现有的 `revealedPublicEntries`，在已解锁完整条目存在时替换同 `publicId` 的受限预览，使详情解锁后返回不会继续显示旧口令卡片。

### 10.3 `PublicHeaderSearch.vue`

新增专用 Header 搜索组件，职责只包括输入视觉、提交和可访问焦点：

```ts
const model = defineModel<string>({ required: true });

const emit = defineEmits<{
  submit: [query: string];
}>();

const searchInput = useTemplateRef<HTMLInputElement>('searchInput');

function focusAndSelect(): void {
  searchInput.value?.focus();
  searchInput.value?.select();
}

defineExpose({ focusAndSelect });
```

- 使用 `<form role="search">`、`type="search"` 输入框和末端提交按钮。
- 组件不读取 route、不发 API，也不自行保存上一查询；数据通过 `v-model` 向上交给 App。
- `focusAndSelect()` 是 `Cmd/Ctrl + K` 所需的最小命令式接口，内部通过 Vue 3.5 `useTemplateRef()` 定位输入框。
- 输入法尚在组合时不提交；规范化和 80 字限制的最终判断由 App 与服务端共同执行。

### 10.4 Header 状态与提交

`App.vue` 持有一个 `shallowRef` 搜索草稿，并在现有明确事件中更新：

1. 初始创建时，若当前是 `/search`，从已解析 route 取得规范化 `q`；其他页面为空。
2. 用户输入时由 `v-model` 更新草稿。
3. 用户提交时规范化；空值进入 `/search`，非空值 `router.push('/search?q=...')`。
4. 现有 `router.afterEach` 在导航完成后同步一次：搜索页使用目标 URL 的 `q`，其他页面清空。浏览器前进和后退因此以 URL 为事实来源。
5. `handlePublicDetailUnlocked()` 在保留当前 revealed entry 的同时递增 `publicSearchAccessRevision`；下次返回任意已缓存查询时建立该授权版本的新搜索实例，使刚获得权限的内容可以参与命中。

不新增 `watch`。搜索快捷键继续使用 App 已有的 `useEventListener`：

- 仅在公开路由集合生效。
- 当前存在打开的 `<dialog>`、事件来自可编辑控件或发生输入法组合时不处理。
- 其余情况调用通过 `useTemplateRef()` 取得的 `PublicHeaderSearch` 暴露方法；只有实际聚焦时才阻止默认行为。

### 10.5 Header 布局

调整 `App.vue` 的 Header 组合边界：

- 将头像与名称/简介包进单一 `profile__identity`，让它成为左侧网格项。
- `publicHeaderSearchVisible` 为真时使用 `profile--with-search` 布局：左侧身份、中间 `PublicHeaderSearch`、右侧站主管理导航。
- 匿名公开访问没有右侧导航时仍保留等价右侧轨道，使搜索栏保持视觉居中，而不是向右漂移。
- 私有路由不渲染搜索栏，继续使用身份 + 管理导航的原布局。
- 宽屏搜索栏设置舒适最大宽度；当左右内容不能与其共存时切换为两行布局，搜索栏在第二行横跨全部列。
- 移动端沿用两行布局、紧凑头像和现有 Header 收起机制，不新增固定定位搜索层。
- 颜色、边界、焦点和圆角全部使用现有设计 token；仅借鉴用户截图的居中长条比例，不复制外部品牌样式。

`FeedView.vue` 的公开标题操作区只从“刷新”扩展为“归档 + 刷新”。搜索结果区域提供归档文字入口；归档页无需再放一个搜索按钮，因为 Header 搜索栏始终可用。

## 11. 详情进入与返回

搜索、归档普通条目统一执行：

```ts
router.push({
  name: 'detail',
  params: { publicId },
  state: { journalDetailFromFeed: true },
});
```

P0 复用现有 history state 名称，不为同一种“从列表进入详情”再创建并行标识。详情返回继续执行当前 `router.back()`。

归档中的受限预览同时写入现有 `journalProtectedPreview` state，复用 `FeedView.prepareProtectedDetail()`，避免为了展示解锁页先请求并读取内容。

这里不扩展 `OverlayContext`：

- 当前覆盖层依赖 feed 和 detail 都是 `FeedView`。
- 搜索、归档是不同页面组件，强行扩展会要求 App 保存和重建异构背景组件。
- 直接详情已有短记录、文章和口令内容的完整主路径，配合 KeepAlive 与滚动表即可满足连续返回。

从分享地址直接进入详情时没有 `journalDetailFromFeed`，仍执行当前按内容频道返回的逻辑。

## 12. 加载、空状态和错误

两个页面不使用全屏 loading：

- 标题、搜索框、年月导航常驻。
- 首次请求只在结果区域显示现有 `JournalLoading`。
- 分页加载只出现在列表尾部。
- 空查询、搜索无结果、归档总览为空和月份为空分别使用需求文档中的明确文案。

错误状态规则：

- 捕获 `requestJson` 抛出的真实错误并在当前局部区域展示。
- 首次错误不保留上一个查询的数据。
- 分页错误保留已经成功加载的内容，同时停止继续触发无限加载。
- 不提供自动重试、不自动更换查询、不跳到相邻月份，也不把错误改成“全部加载完成”。

## 13. 预计修改文件

### 13.1 服务端与共享契约

- `src/shared/journalProtocol.ts`
- `src/journal-server/auth.ts`
- `src/journal-server/repository.ts`
- `src/journal-server/routes/publicDiscovery.ts`（新增）
- `src/journal-server/server.ts`
- `src/shared/journalPageMetadata.ts`（P0-01 已落地时扩展）
- `src/journal-server/pageDocumentService.ts`（P0-01 已落地时扩展）
- `src/journal-server/routes/siteDiscovery.ts`（P0-01 已落地时扩展 sitemap）

### 13.2 前端

- `web/src/types.ts`
- `web/src/api.ts`
- `web/src/router.ts`
- `web/src/App.vue`
- `web/src/utils/pageHead.ts`（P0-01 已落地时扩展）
- `web/src/components/journal/FeedView.vue`
- `web/src/components/discovery/PublicHeaderSearch.vue`（新增）
- `web/src/components/discovery/PublicSearchView.vue`（新增）
- `web/src/components/discovery/PublicArchiveView.vue`（新增）
- `web/src/components/discovery/PublicSearchResultRow.vue`（新增）
- `web/src/components/discovery/PublicArchiveEntryRow.vue`（新增）

本方案不修改 `package.json`、`pnpm-lock.yaml` 和 `src/journal-server/migrations.ts`。

## 14. 实施顺序

1. 在共享协议和前端类型中确定搜索摘要、归档总览及响应结构。
2. 扩展 `JournalAuth`，取得当前请求已经签名且 revision 明确的口令授权集合。
3. 在 repository 完成权限先行的搜索、搜索游标与摘要映射。
4. 在 repository 完成年月聚合、上海月份范围和归档游标。
5. 新增公开发现路由并注册 API 与三个 SPA 地址。
6. 补充前端 API 请求函数。
7. 新增 Vue Router 路由，以及 `App.vue` 按规范 URL 的 discovery key、KeepAlive 和滚动键。
8. 完成 Header 搜索组件、三栏/两行响应式布局、快捷键和 URL 提交路径。
9. 完成只负责结果的搜索页面与结果行。
10. 完成归档总览、月份页面、受限预览和详情返回路径。
11. 在公开 feed 标题区接入次级归档入口，并收拢公开 Header 与发现页面样式。

该顺序先固定权限和返回结构，再接 UI，避免前端先依赖一个可能泄露口令内容的临时接口。

## 15. 主要风险与约束

### 15.1 中文“全文搜索”的预期偏差

P0 是字面子串搜索，不是自然语言分词。界面文案使用“搜索”，不宣传“智能搜索”或“语义搜索”。连续中文、空格多关键词和 ASCII 大小写行为必须与需求一致。

### 15.2 口令结果泄露

搜索必须在 SQL 候选集合阶段排除未授权口令记录。不得复用公开 feed 的“先查出 protected、再转脱敏预览”做法，因为 feed 的时间展示与内容关键词命中有不同泄露边界。

### 15.3 授权 revision

只按 `publicId` 放行会让修改过密码的旧 Cookie 继续参与搜索。可搜索授权条件必须同时匹配当前 `access_revision`。

### 15.4 上海月份边界

归档总览和月份详情必须使用同一 `Asia/Shanghai` 口径。月份详情使用上海月初到下月月初的半开区间，不用服务器本地时区推导。

### 15.5 媒体组重复

聚合、搜索和月份列表都必须带 `groupRepresentativeCondition()`；否则同一 Telegram 媒体组会重复计数和展示。

### 15.6 页面缓存与路由状态

搜索 query、搜索授权版本、归档总览和归档 month 必须使用各自的明确 key；不能让一个固定组件实例用新查询覆盖旧结果，也不能依赖同路由参数变化重新触发 `onMounted`。有上限的 KeepAlive 缓存最近 30 个 keyed 实例，进入详情时不清空实例，返回后恢复对应列表键的内容与滚动位置。站主和普通访客缓存必须分开，防止退出后继续显示站主权限摘要。

### 15.7 P0-01 元信息所有权

若在 P0-01 之后重新为三个发现路由注册静态 `sendApplication`，会使直接访问丢失统一的 head。P0-03 必须扩展现有页面文档服务、客户端 head 规则和 sitemap 数据源；搜索结果页保持 noindex，归档页才进入索引与 sitemap。

### 15.7 搜索扫描成本

`instr` 是线性子串扫描，这是 P0 的明确技术边界，不伪装成已建立全文索引。当前方案不增加未经事实支持的索引或运行时双实现；后续性能演进必须保持单一、明确的数据同步与查询路径。

## 16. 实施完成判定

- 三个页面 URL、三个公开 API 与直接打开 SPA 地址形成完整调用链。
- 搜索 SQL 先应用发布状态、代表记录和当前请求授权，再应用标题、正文、标签命中。
- 搜索响应不包含完整正文、富文本 JSON 或媒体数组，摘要与排序游标稳定。
- 归档总览和月份详情使用同一上海年月，媒体组只出现一次。
- 未授权口令搜索完全不可见，归档只显示既有脱敏字段；私有和草稿在所有公开接口中均不可见。
- 搜索与归档页面局部加载，详情返回复用列表状态和滚动位置。
- 搜索栏位于公开 Header；搜索页面不渲染重复输入框，桌面居中与窄屏第二行布局均复用当前 Header 生命周期。
- 实现没有新增依赖、数据库迁移、`watch`、RAF、自动重试或 fallback 分支。
