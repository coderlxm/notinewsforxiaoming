# AI 生成文章标记开发方案

## 目标

在文章编辑器中允许作者明确标记“这篇文章的主要正文由 AI 生成”，并在文章信息流卡片上显示清晰、克制的 `AI 生成` 标记，使其与本人撰写的文章直接区分。

本功能只处理富文本文章，不扩展到生活记录、兴趣记录或朋友投稿。标记由作者主动选择，不根据文风、标签或正文内容自动判断。

## 当前实现事实

- 文章创建和编辑入口是 `web/src/components/article/ArticleEditorView.vue`，文章设置集中在 `ArticleEditorSidebar.vue`。
- 前端通过 `useArticleEditor.ts` 和 `web/src/api.ts` 调用文章创建、更新接口。
- 服务端由 `JournalArticleService` 校验文章输入，再通过 `JournalRepository` 写入 `journal_entries`。
- 公开信息流、私有资产流和往年今日中的文章卡片都复用 `ArticleCardContent.vue`。
- 当前 `JournalEntry` 没有记录文章创作来源，普通标签无法可靠承担这一语义。

## 产品规则

### 标记含义

- 开启：AI 完成了文章主要正文的撰写，即使作者之后进行过编辑，也标记为 AI 生成。
- 关闭：正文主要由作者本人撰写；仅让 AI 润色、纠错或生成标签时不需要开启。
- 系统不自动识别，不记录具体模型、提示词或 AI 占比。

### 编辑器交互

在“文章设置”中增加一个布尔开关：

- 标题：`AI 生成内容`
- 辅助说明：`AI 完成主要正文撰写时开启`
- 新文章默认关闭，作者可以在第一次保存前开启。
- 编辑已有文章时回显保存值，切换后与标题、正文、标签一起通过“保存文章/保存修改”提交。
- 历史文章默认视为本人撰写，但可以进入编辑页补充标记。

### 信息流呈现

- 仅在 `ArticleCardContent` 的摘要卡片模式中显示 `AI 生成`，不显示在普通记录卡片上。
- 标记放在卡片顶部日期信息旁，与日期共同构成元信息区；不占用封面右上角，以免和置顶、加密状态冲突。
- 使用紧凑胶囊样式，背景采用 `var(--accent-soft)`，文字采用 `var(--accent-strong)`，同时适配现有明暗主题。
- 标记使用明确文本而非只有图标，避免用户猜测含义；它也不加入文章标签列表，防止被误认为可筛选的主题标签。
- 口令文章未解锁时继续使用现有保护卡片，不提前暴露该标记；解锁并取得完整文章数据后按普通文章卡片呈现。

## 数据设计

### 数据库

新增第 16 版迁移，在 `journal_entries` 增加：

```sql
ai_generated INTEGER NOT NULL DEFAULT 0
  CHECK (ai_generated IN (0, 1))
```

选择布尔字段而不是创作来源枚举，是因为当前需求只有“AI 生成/本人撰写”这一项判断。所有既有行随迁移得到 `0`；Telegram 记录和普通网页记录继续依赖数据库默认值，不需要改动各自创建流程。

### 共享协议

- `journalEntrySchema` 增加必填布尔字段 `aiGenerated`。
- `journalArticleCreateRequestSchema` 和 `journalArticleUpdateRequestSchema` 增加必填布尔字段 `aiGenerated`。
- `JournalEntry` 的服务端推导类型及前端接口同步增加 `aiGenerated: boolean`。
- 公开搜索和归档使用的摘要协议本期不增加该字段，因为它们不是文章信息流卡片的输入。

## 服务端改动

### `src/journal-server/migrations.ts`

增加数据库迁移，将历史内容统一初始化为非 AI 生成。

### `src/shared/journalProtocol.ts`

在文章写入请求和完整条目响应中声明 `aiGenerated`，让接口层拒绝缺少明确取值的文章写入。

### `src/journal-server/articleService.ts`

创建和更新文章时，将解析后的 `input.aiGenerated` 原样传给仓储层。该字段不参与正文、标签、权限和媒体校验。

### `src/journal-server/repository.ts`

- `EntryRow` 增加 `ai_generated`。
- `CreateArticleInput`、`UpdateArticleInput` 增加 `aiGenerated`。
- 创建文章的 `INSERT` 显式写入 `ai_generated`。
- 更新文章的 `UPDATE` 同步更新 `ai_generated`。
- `toEntry()` 将 SQLite 的 `0/1` 转换为 `aiGenerated: boolean`。

现有列表和详情查询都使用 `SELECT e.*` 或 `SELECT *` 并统一经过 `toEntry()`，因此不需要为每个信息流接口单独增加查询逻辑。

## 前端改动

### 组件职责

- `ArticleEditorView.vue`：持有 `aiGenerated` 表单状态，负责新建默认值、编辑回显、预览数据和保存入参。
- `ArticleEditorSidebar.vue`：只负责呈现开关，通过 `v-model:ai-generated` 与父组件交换布尔值。
- `useArticleEditor.ts`：保持现有请求编排职责，在创建和保存参数中传递字段。
- `ArticleCardContent.vue`：根据 `entry.aiGenerated` 和 `display === 'summary'` 渲染标记。

标记目前只在一个共享卡片组件中使用，不额外创建独立组件；若以后详情页、搜索页和 RSS 也需要统一署名，再抽取专用展示组件。

### 状态流

```text
编辑器开关
  → ArticleEditorView 表单状态
  → createArticle/updateArticle 请求
  → 共享 Zod 协议
  → JournalArticleService
  → JournalRepository.ai_generated
  → JournalEntry.aiGenerated
  → ArticleCardContent 的 AI 生成标记
```

编辑已有文章时，在现有文章初始化逻辑中一并设置 `aiGenerated`，不增加新的监听链。预览条目也带上当前开关值，保证编辑器内卡片预览与保存后的信息一致。

## 涉及文件

- `src/journal-server/migrations.ts`
- `src/shared/journalProtocol.ts`
- `src/journal-server/articleService.ts`
- `src/journal-server/repository.ts`
- `web/src/types.ts`
- `web/src/api.ts`
- `web/src/composables/useArticleEditor.ts`
- `web/src/components/article/ArticleEditorView.vue`
- `web/src/components/article/ArticleEditorSidebar.vue`
- `web/src/components/article/ArticleCardContent.vue`

文章接口路由、信息流查询、权限接口和普通记录发布器不需要调整。

## 完成标准

- 新建文章未开启标记时，保存后信息流卡片不显示 AI 标记。
- 新建文章开启标记时，公开或私有文章摘要卡片显示 `AI 生成`。
- 编辑既有文章可以开启或关闭标记，保存后卡片随数据变化。
- 历史文章迁移后保持原有呈现，不会被批量标记为 AI 生成。
- 标记在明暗主题和窄屏卡片中保持可读，不遮挡日期、置顶、加密或管理操作。
- 普通记录、保护内容占位卡和标签筛选行为保持不变。

## 本期不做

- AI 自动检测或根据正文推断创作来源。
- 记录模型名称、提示词、生成时间或 AI 使用比例。
- 按 AI 生成状态筛选、搜索或统计。
- 在搜索归档、RSS、JSON Feed 或文章正文详情中增加额外说明。
- 对历史文章进行自动回溯分类。
