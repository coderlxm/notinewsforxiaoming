# P0-02 私人「往年今日」开发设计

> 对应需求：`doc/requirements/p0-02-on-this-day.md`  
> 设计原则：接通现有主路径、局部加载、状态复用，不新增路由或数据表。

## 1. 当前实现证据

### 服务端

`src/journal-server/routes/privateEntries.ts` 已注册：

```text
GET /api/me/on-this-day
preHandler: auth.requireAdmin
```

路由使用 `Intl.DateTimeFormat` 按 `Asia/Shanghai` 取得当前月日和年份，并调用 `JournalRepository.listOnThisDay(monthDay, year)`。

`src/journal-server/repository.ts` 中的查询已经限定：

- `source_created_at` 转为东八区后月日相同。
- 年份早于当前年。
- `publication_status = 'published'`。
- 只选择媒体组代表记录。
- 按来源时间、ID 倒序。

返回值经过现有 `toEntry()`，因此包含统一的 `JournalEntry` 和媒体资产。

### 前端

- `web/src/api.ts` 已有 `fetchOnThisDay()`。
- `web/src/types.ts` 已有 `OnThisDayResponse`。
- `web/src/composables/useJournalApi.ts` 已有 `onThisDayEntries`、`refreshOnThisDay()`，更新和删除记录时也会处理该数组。
- `web/src/components/journal/OnThisDay.vue` 已有横向卡片布局，并转发短记录和文章的管理事件。

未接通点位于 `FeedView.vue`：

- 当前私有瀑布流通过 `refreshPrivateFeed()` 加载。
- 当前表格使用 `usePrivateAssetTable()` 独立加载。
- `OnThisDay.vue` 没有导入或渲染。
- 同时加载回顾的旧 `loadPrivate()` 当前没有进入页面主路径。

## 2. 最小方案

保留现有服务端路由和仓储查询，只补齐前端独立状态、调用时机、组件状态和事件接线：

```text
站主鉴权成功
   ├─ 当前瀑布流或表格加载
   └─ loadOnThisDay() → 独立 loading/error/data
                         ↓
                 OnThisDay.vue
                         ↓
                 现有详情覆盖层
```

两个请求属于同一页面的两个局部数据源，不组成一个必须同时成功的请求组。

## 3. 服务端设计

### 3.1 API

沿用：

```http
GET /api/me/on-this-day
```

响应沿用：

```ts
interface OnThisDayResponse {
  entries: JournalEntry[];
}
```

不增加日期参数。P0 只表示“今天”，避免接口提前演变为任意日期归档。

### 3.2 权限

- 保持 `auth.requireAdmin`。
- 不建立公开版本。
- 返回三种可见性的已发布记录，因为调用者是站主本人。
- 登录失效继续由统一 401 行为暴露。

### 3.3 查询

现有查询已经满足 P0 数据口径，不调整 `listOnThisDay()`：

- 上海时间通过当前路由与 SQLite `+8 hours` 形成一致口径。
- 媒体组代表条件避免同一 Telegram 媒体组重复出现。
- 草稿被排除。

本功能不得借机修改记录表、时间字段或全局时区实现。

## 4. 前端状态设计

### 4.1 `useJournalApi.ts`

在现有 `onThisDayEntries` 之外增加三个专用状态：

```ts
onThisDayLoading: boolean
onThisDayError: string | null
onThisDayLoaded: boolean
```

把 `refreshOnThisDay()` 收敛为一个明确的 `loadOnThisDay()` 行为：

1. 设置 `onThisDayLoading = true`。
2. 清空 `onThisDayError`。
3. 请求成功后整体替换 `onThisDayEntries`，并设置 `onThisDayLoaded = true`。
4. 请求失败时保留真实错误到 `onThisDayError`。
5. 401 同时把 `authenticationState` 设为 `anonymous`。
6. 最终结束该模块自己的加载状态。

回顾请求不能写入当前资料库通用的 `loading` 和 `error`，否则回顾失败会让正常资料库被识别为终止错误，也会让两个局部区域互相覆盖反馈。

注销时同时清空回顾数据、错误与 loaded 状态，避免下一次身份会话看到上一次的私人数据。

不再从页面调用同时串行加载 feed 与回顾的 `loadPrivate()`。该旧函数是否保留只按当前引用情况做最小整理，不扩展成额外重构任务。

### 4.2 状态复用

`FeedView` 在 App 的当前页面缓存与覆盖层机制中持续存在，回顾状态也保存在同一个 composable 实例中。页面只在以下时机主动读取：

- 首次确认站主已登录。
- 当前页面完成登录。
- 站主触发现有资料库刷新。
- 修改发布时间后需要重新判断成员关系。
- 从短记录或文章编辑器返回，且编辑器明确报告记录已经发生变化。

瀑布流/表格切换、翻页、筛选和详情开关不触发回顾请求。

## 5. `FeedView.vue` 接入设计

### 5.1 组件位置

导入 `OnThisDay.vue`，在 `AssetManagementToolbar` 之后、私有结果容器之前渲染。条件为：

```text
mode === 'private'
且 session authentication 已确认
且 ownerAuthenticated
```

这一位置不属于瀑布流或表格的条件分支，因此切换 `assetView` 时模块不会被销毁。

### 5.2 首次加载

当前 `onMounted` 私有路径在确认会话后：

- 启动当前视图的 `loadPrivateResults()`。
- 独立启动 `journal.loadOnThisDay()`。
- 两个区域分别结束自己的初次状态。

页面的 `initialLoadPending` 只代表资料库主结果，不等待往年今日。回顾区通过自身状态显示进度。

### 5.3 登录后加载

当前 `authenticate()` 成功后必须沿相同主路径加载：

- 当前资料库视图。
- 往年今日。
- 如果 URL 带私有详情参数，再读取对应详情。

不能依赖组件重新挂载来偶然触发这些请求。

### 5.4 刷新

现有刷新动作分别启动：

- 当前资料库结果刷新。
- 往年今日刷新。

资料库的 `refreshing` 仍控制现有按钮和下拉刷新；回顾组件显示自己的加载状态。任意一个请求的失败只在对应区域暴露，不把另一个请求改写为成功或空数据。

### 5.5 事件转发

`OnThisDay` 已定义以下事件，接入时全部转给 `FeedView` 已有处理函数：

- `openEntry`
- `editArticle`
- `selectTag`
- `saveContent`
- `setPublishedTime`
- `saveAccessSettings`
- `setChannel`
- `setPinned`
- `deleteEntry`

这样回顾卡片继续沿用现有权限修改、确认删除、成功消息和详情导航。

## 6. `OnThisDay.vue` 调整

### 6.1 Props

在当前 `entries` 与 `mutationEntryId` 基础上增加：

```ts
loading: boolean
loaded: boolean
error: string | null
```

### 6.2 渲染状态

模块根节点在已登录后始终存在，不再用 `v-if="entries.length"` 隐藏整个区域：

- `loading`：模块内部显示局部阅读进度。
- `error`：显示服务端真实错误文本。
- `loaded && entries.length === 0`：显示“今天没有往年记录”。
- 有数据：显示现有横向卡片轨道。

错误不是空结果；加载过的旧数据也不能在新请求失败后被包装成新的成功结果。

### 6.3 年份信息

在组件中使用 `Intl.DateTimeFormat` 按 `Asia/Shanghai` 提取记录年份，并基于当前上海年份计算“距今年数”。该显示只依赖服务端已返回的 `sourceCreatedAt`，不改变查询结果。

卡片现有 `showYear` 保留，年份差作为模块级辅助信息显示，避免改动全站卡片日期结构。

### 6.4 横向位置

组件实例不会在视图切换时重建，因此浏览器保留其横向滚动位置。不得使用 `watch`、`requestAnimationFrame` 或 RAF 别名人工恢复位置。

## 7. 数据变更后的同步

### 7.1 可直接替换的操作

正文、标题、标签、频道、可见性和置顶操作成功后，继续使用 `replaceEntry(updated)` 同时替换资料库和回顾数组中的同 ID 项。

### 7.2 删除

当前删除成功后已经从 `onThisDayEntries` 过滤对应 ID，保持该行为。

### 7.3 修改发布时间

发布时间决定成员关系，不能只替换原数组中的对象。`setPublishedTime()` 成功后调用一次 `loadOnThisDay()`，以服务端查询结果重新确定：

- 原记录是否仍属于今天。
- 是否有其他记录因本次修改进入今天。
- 顺序是否发生变化。

该请求是发布时间变更主路径的一部分，不增加重试或本地猜测规则。

### 7.4 从编辑器返回

当前源码并没有统一的“内容已改变”返回标记：`EntryPublisherView.vue` 只返回 `journalAssetChanged`，`ArticleEditorView.vue` 返回时没有变化标记。因此不能把现状误判成已由 App 完整区分。

本功能增加一个两类编辑器共用的 history state：

```ts
interface JournalEditorReturnState {
  journalEntryChanged?: boolean;
}
```

- 短记录或文章的任一保存请求成功并真实改变服务端记录后，编辑器把内部 `entryChanged` 设为 `true`。
- 返回 `journalReturnPath` 时把 `journalEntryChanged` 写入目标 history state；短记录现有 `journalAssetChanged` 如仍被其他路径使用则并列保留，不复用其含义。
- `FeedView` 的现有 `router.afterEach` 在从 `entry-edit` 或 `article-edit` 返回 `/me` 时读取该标记。
- 标记为真时，重新读取当前资料库视图和往年今日；标记不存在或为假时复用现有状态。
- 重新读取失败沿各自局部错误状态暴露，不把旧卡片改写成新保存结果。

该显式标记同时覆盖文章标题、正文、标签、封面、发布时间和公开状态变化，避免仅凭“是否有媒体变化”判断回顾是否过期。

## 8. 预计修改文件

| 文件 | 最小变化 |
| --- | --- |
| `web/src/composables/useJournalApi.ts` | 拆出回顾专用 loading/error/loaded，调整加载、注销和发布时间同步 |
| `web/src/components/journal/FeedView.vue` | 导入并挂载模块，接通首次进入、登录、刷新和事件 |
| `web/src/components/journal/OnThisDay.vue` | 支持加载、错误、空状态和年份差信息 |
| `web/src/components/publisher/EntryPublisherView.vue` | 返回资料库时写入统一的内容变化标记 |
| `web/src/components/article/ArticleEditorView.vue` | 返回资料库时写入统一的内容变化标记 |

以下文件原则上不需要变化：

- `src/journal-server/routes/privateEntries.ts`
- `src/journal-server/repository.ts`
- `web/src/api.ts`
- `web/src/types.ts`

只有当前实现事实与本文不一致时才重新评估，不为实现本功能主动改动它们。

## 9. 实施拆分

1. 在 composable 中建立回顾独立状态与明确加载函数。
2. 扩展 `OnThisDay.vue` 的状态展示和年份信息。
3. 在 `FeedView.vue` 的常驻私有框架中挂载组件并转发事件。
4. 为两类编辑器接通统一变化标记，并在返回资料库时按标记刷新当前结果与回顾。
5. 接通首次会话、首次登录、刷新与发布时间变更路径。
6. 收敛旧 `loadPrivate()` 与新主路径之间的重复职责，只保留实际被调用的短路径。

## 10. 风险与约束

### 共用错误状态

若继续复用 `journal.error`，回顾失败会触发 `FeedView` 当前的终止消息判断。这是本功能必须拆开的根因，不应通过吞错或隐藏模块处理。

### 成员关系变化

只在数组中替换发布时间后的记录，会留下不再属于今天的卡片。发布时间成功后以接口结果重新确定成员关系。

### 两种资料库视图

如果组件放入 waterfall/table 分支内部，切换视图会销毁并重新创建模块。它必须位于两者的共同父层。

### 禁止实现方式

- 不增加自动重试、缓存过期计时器或默认结果。
- 不增加 `watch`。
- 不使用 `requestAnimationFrame`、`cancelAnimationFrame` 或别名。
- 不把回顾请求并入必须与资料库同时成功的串行事务。
- 不顺带开发月历、通知和随机推荐。
