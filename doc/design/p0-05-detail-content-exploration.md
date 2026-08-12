# P0-05 详情页「继续探索」开发设计

> 对应需求：`doc/requirements/p0-05-detail-content-exploration.md`  
> 设计原则：使用时间与共同标签的确定关系，复用当前详情导航，不建立推荐系统。

## 1. 当前实现证据

### 1.1 公开读取

`src/journal-server/routes/publicFeed.ts` 当前提供：

- `GET /api/feed`
- `GET /api/entries/:publicId`
- `POST /api/entries/:publicId/unlock`

`JournalRepository.getPublishedAccessByPublicId()` 返回代表记录、可见性、口令 hash 与 access revision。路由已经形成统一规则：

- 不存在和私有内容返回 404。
- 普通公开内容直接返回完整 `JournalEntry`。
- 口令内容在站主或当前 access cookie 已授权后返回完整内容，否则返回不含正文的 `ProtectedJournalEntryPreview`。

新接口应复用同一套当前内容授权判断，不能另建近似判断。

### 1.2 当前详情路径

`FeedView.vue` 与 `App.vue` 已支持两种阅读上下文：

1. 从 feed 打开短记录时，底层 feed 保留，`JournalDetailOverlay` 展示详情。
2. 直接进入 `/p/:publicId` 或阅读文章时，`FeedView` 使用完整阅读页面。

App 已保存 feed 路由、加载状态与滚动位置；解锁后的记录也保存在当前会话的 revealed map 中。

详情内容主要经过：

- `EntryCard.vue`：直接打开的普通短记录。
- `ArticleCardContent.vue`：完整文章。
- `JournalDetailOverlay.vue` → `JournalDetailLayout.vue` → `JournalDetailContent.vue`：feed 内短记录覆盖层和私有详情。

开发必须覆盖这些路径，不能只在当前截图对应的一个组件里追加区域。

## 2. 接口设计

### 2.1 新接口

```http
GET /api/entries/:publicId/exploration
```

该接口只读取确定关系，不接受排序、数量、频道或标签参数，防止 P0 演变成通用推荐查询。

### 2.2 响应类型

在 `src/shared/journalProtocol.ts` 和 `web/src/types.ts` 建立一致类型：

```ts
interface JournalRelatedEntry {
  entry: JournalEntry;
  sharedTags: string[];
}

interface JournalEntryExploration {
  newer: JournalEntry | null;
  older: JournalEntry | null;
  related: JournalRelatedEntry[];
}
```

继续使用完整 `JournalEntry` 的理由：

- 现有 `toEntry()` 已统一媒体组、文章、资产 URL 和类型解析。
- 总量上限为五条，不需要为 P0 再维护一个容易漂移的摘要 DTO。
- 前端可以用同一字段生成紧凑展示，也能沿现有 `openEntry` 接口导航。

响应候选全部是普通公开内容，不需要 `ProtectedJournalEntryPreview` 联合类型。

### 2.3 当前内容授权

路由先调用 `getPublishedAccessByPublicId(publicId)`：

- 不存在或 `private`：404。
- `public`：允许查询。
- `protected`：只有 `auth.isAdmin(request)` 或 `auth.hasProtectedAccess(...)` 为真时允许；否则返回 404，不返回关系结构。

这里不调用 unlock，也不接收口令。用户必须先沿现有解锁接口取得授权。

### 2.4 缓存头

接口会读取 cookie 决定当前受保护内容是否可访问，因此沿公开 feed 的当前策略设置：

```text
Vary: Cookie
Cache-Control: private, no-store
```

不为候选结果建立第二层应用缓存。

## 3. 仓储查询设计

### 3.1 方法边界

在 `JournalRepository` 增加一个聚合入口：

```ts
getEntryExploration(entry: JournalEntry): JournalEntryExploration
```

路由完成当前内容权限判断后，将代表 `JournalEntry` 交给仓储。仓储只负责确定候选，不再判断当前请求身份。

内部可拆成三个短查询，但不建立通用 recommendation service：

- `findNewerPublicEntry()`
- `findOlderPublicEntry()`
- `listRelatedPublicEntries()`

### 3.2 候选共同条件

所有查询使用：

```sql
e.publication_status = 'published'
AND e.visibility = 'public'
AND <group representative condition>
AND e.id <> :currentId
```

`groupRepresentativeCondition('e')` 必须复用当前 feed 的媒体组代表逻辑。

### 3.3 时间相邻查询

时间键定义为二元组：

```text
(source_created_at, id)
```

较新一条：

- 条件为时间键大于当前内容。
- 按 `source_created_at ASC, id ASC`。
- `LIMIT 1`。

较早一条：

- 条件为时间键小于当前内容。
- 按 `source_created_at DESC, id DESC`。
- `LIMIT 1`。

查询不读取 `pinned`，也不限制 `channel` 或 `body_format`。

### 3.4 相关内容查询

当前记录无标签时直接返回空数组；这是一条确定业务规则，不执行替代查询。

有标签时使用 SQLite JSON1 的 `json_each(tags_json)`，与当前标签筛选实现保持一致。查询需要同时得到：

- 候选记录。
- 完全匹配的共同标签集合。
- 共同标签数量。

排除：

- 当前 ID。
- 已选为 `newer` 和 `older` 的 ID。

排序：

```text
共同标签数量 DESC
abs(候选 source_created_at 与当前 source_created_at 的时间差) ASC
候选 source_created_at DESC
候选 id DESC
```

只取三条。共同标签顺序按当前内容标签顺序输出，使用户看到的关系与当前详情标签一致。

具体 SQL 应保持为参数化查询，不拼接标签值。

### 3.5 实体转换

候选行继续通过 `toEntry()` 转换，相关结果额外组合 `sharedTags`。如果某个关联资产无法按现有 `toEntry()` 读取，请求直接失败；不跳过坏记录或返回部分列表。

## 4. 服务端路由

在 `registerPublicFeedRoutes()` 中增加 exploration 路由，与详情读取放在同一文件，复用：

- publicId 参数解析。
- `getPublishedAccessByPublicId()`。
- 站主判断。
- protected access cookie 判断。

路由顺序应确保 `/:publicId/exploration` 不被 `/:publicId` 误处理；Fastify 使用明确静态后缀可以区分，但注册时保持接口相邻以便审阅。

错误沿 Fastify/Zod 当前处理链直接暴露，不捕获后返回空关系。

## 5. 前端数据层

### 5.1 API

在 `web/src/api.ts` 增加：

```ts
fetchEntryExploration(publicId: string): Promise<JournalEntryExploration>
```

沿用 `requestJson()` 和 `credentials: same-origin`，使 protected access cookie 与站主 cookie 生效。

### 5.2 局部状态

创建 `web/src/composables/useEntryExploration.ts`，每个详情实例持有：

```text
data: JournalEntryExploration | null
loading: boolean
error: string | null
```

只提供一次明确的 `load(publicId)`，不提供自动重试、分页或缓存过期逻辑。

该状态不进入 `useJournalApi()`：探索请求失败不能覆盖 feed、当前详情、解锁或资料库的通用错误状态。

## 6. 展示组件

### 6.1 新组件

新增 `web/src/components/journal/JournalDetailExploration.vue`。

Props：

```ts
entry: JournalEntry
```

Emits：

```ts
openEntry: [entry: JournalEntry]
```

组件在 `onMounted` 调用局部 composable。为当前详情组件使用 `:key="entry.publicId"`；详情切换通过销毁旧实例、创建新实例触发请求，不新增 `watch`。

### 6.2 渲染

- 加载中：局部 `JournalLoading`。
- 错误：在该区域显示真实错误。
- 有时间相邻项：渲染“较新一条/较早一条”紧凑卡片。
- 有相关项：渲染最多三条，并展示 `sharedTags`。
- 响应全部为空：组件不占用最终布局空间。

紧凑卡片可以提取一个仅服务该模块的内部子组件，不复用瀑布流完整卡片，避免完整操作菜单、媒体画廊和详情正文嵌套在详情中。

图片只使用返回资产中的现有 `previewUrl`；没有预览图时按文字布局展示，不创建替代图片。

### 6.3 可访问性

- 模块使用 `<section aria-labelledby>`。
- 每个候选是语义按钮或站内链接，名称包含关系、标题/摘要与日期。
- 共同标签是可见文本，不作为新的筛选按钮，避免一个卡片内出现嵌套交互。
- 焦点顺序在当前标签之后、页面结束之前。

## 7. 接入三条详情路径

### 7.1 直接短记录与文章详情

在 `FeedView.vue` 的 `isDetail` reading stage 中，为当前完整 `JournalEntry` 建立一个单根阅读容器：

```text
现有 EntryCard 或 ArticleCardContent
PublicEntryShareActions（P0-01，仅普通公开内容）
JournalDetailExploration
```

protected preview 阶段不渲染探索组件；解锁后 `journal.detail` 出现，带 `publicId` key 的组件才创建。

文章编辑器中的 `ArticleCardContent display="full"` 不受影响，因为探索组件由 `FeedView` 组合，而不是内置进通用文章组件。

P0-01 已在同一 reading stage 接入分享动作时，保留二者为并列、职责独立的组件：分享在前，继续探索在后；不把探索请求放进分享组件，也不重复创建阅读容器。

### 7.2 feed 内短记录覆盖层

探索模块需要处于详情内容的滚动区域末尾，因此接入 `JournalDetailContent.vue`，条件为：

```text
mode === 'public'
AND publicationStatus === 'published'
AND visibility !== 'private'
```

把 `openEntry` 事件依次沿以下组件转发：

```text
JournalDetailExploration
→ JournalDetailContent
→ JournalDetailLayout
→ JournalDetailOverlay
→ FeedView
```

私有覆盖层继续使用相同组件，但因 `mode === 'private'` 不创建探索模块。

P0-01 已在 `JournalDetailContent.vue` 接入 `PublicEntryShareActions` 时，探索模块紧随其后。二者都通过 props down、events up 与父层通信，不彼此读取状态。

### 7.3 导航处理

在 `FeedView.vue` 增加专用 `openExplorationEntry(entry)`：

- 当前 `isDetail` 为真：直接 `router.push({ name: 'detail', params: { publicId } })`，适用于没有底层 feed 的永久链接页面。
- 当前是 feed 覆盖层：调用现有 `openEntry(entry)`，更新 overlay context 并复用底层 feed。

这样不会把直接详情错误交给 `App.openEntry()` 的“必须有可见 feed origin”前置条件。

每次目的详情使用新的 URL 历史项。浏览器返回负责恢复上一详情；关闭 overlay 继续沿 App 当前逻辑回到原 feed。

当前 App 对直接详情使用 `detail:${publicId}` 作为组件 key，因此 `/p/A` 到 `/p/B` 会创建对应详情实例；overlay 内部则必须显式给探索组件使用 `entry.publicId` key。两条路径都不依赖同一路由参数变化重新触发 `onMounted`，也不新增 `watch`。

## 8. 样式与滚动

- 完整详情页中，探索模块跟随正文自然向下。
- overlay 中放在 `JournalDetailContent` 的现有滚动内容末尾，不改变 dialog 尺寸计算和媒体 stage。
- 桌面端相邻项双列，相关项可以单列；移动端全部单列。
- 不读取元素高度来驱动业务状态。
- 不使用 `watch`、`requestAnimationFrame`、`cancelAnimationFrame` 或任何别名。

## 9. 预计修改文件

| 文件 | 变化 |
| --- | --- |
| `src/shared/journalProtocol.ts` | exploration 响应 schema/type |
| `src/journal-server/repository.ts` | 时间相邻与共同标签查询 |
| `src/journal-server/routes/publicFeed.ts` | 新公开 exploration 路由与当前内容权限判断 |
| `web/src/types.ts` | 前端响应类型 |
| `web/src/api.ts` | `fetchEntryExploration()` |
| `web/src/composables/useEntryExploration.ts` | 详情局部请求状态 |
| `web/src/components/journal/JournalDetailExploration.vue` | 紧凑关系展示 |
| `web/src/components/journal/FeedView.vue` | 直接详情接入与两种导航分流 |
| `web/src/components/journal/JournalDetailContent.vue` | overlay 内容底部接入 |
| `web/src/components/journal/JournalDetailLayout.vue` | 转发 openEntry |
| `web/src/components/journal/JournalDetailOverlay.vue` | 转发 openEntry |

不需要新数据表、迁移、后台设置或第三方推荐库。

## 10. 实施拆分

1. 定义共享响应类型和公开接口权限边界。
2. 在仓储实现时间相邻与共同标签查询。
3. 增加前端 API 与独立局部状态。
4. 完成紧凑探索组件。
5. 接通直接记录、长文章和 feed overlay 三条详情路径。
6. 接通连续导航、protected 解锁后加载与浏览器返回路径。

## 11. 风险与决策

### 11.1 受保护标签泄露

不能把口令候选放入相关池，否则“共同标签”本身会泄露被保护内容的主题。P0 候选统一限定 `visibility = public`。

### 11.2 置顶与时间语义冲突

置顶是 feed 排版属性，不是发生时间。相邻查询只看来源时间与 ID。

### 11.3 直接详情没有 feed origin

直接详情点击候选时必须走路由导航，不能无条件调用 App 当前的 overlay 打开函数。

### 11.4 多个详情组件路径

只在 `EntryCard` 或文章组件中修改会漏掉 overlay 或编辑预览。探索组件由具体阅读表面组合，并明确覆盖三条已发生的详情路径。

### 11.5 错误处理

探索失败在局部区域显示错误，不返回空数组假装没有关系，不重试，不改用随机、同频道或热门内容。
