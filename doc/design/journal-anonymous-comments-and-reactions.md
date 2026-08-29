# Journal 匿名访客评论与点赞功能设计方案

## 1. 背景与设计目标

### 1.1 业务背景
Journal 目前为个人记录与长文发布平台，支持 Plain 碎片记录与 Rich 富文本长文。为了在保持单用户极简、独立与纯粹调性的同时，增强与外部访客的轻量互动体验，需要设计一套**匿名访客点赞与评论系统**。

### 1.2 核心设计原则
1. **轻量极简、零摩擦**：访客无需注册或第三方 OAuth 授权即可完成点赞与发表评论；默认使用浏览器持久化指纹/昵称记忆，最大化降低互动门槛。
2. **视觉与质感完全统一**：严格沿用 Journal 现有的设计系统（CSS 变量、卡片阶梯、毛玻璃质感、微动效与字体规范），拒绝突兀的第三方嵌入式组件（如 Gitalk、Disqus 或 Waline 的默认沉重外观）。
3. **框架常驻与即时反馈（Optimistic UI）**：点赞即点即亮并伴随微反馈，评论提交后前端先行乐观插入，后台异步落库并处理通知。
4. **单用户管理主路径**：博主通过 Telegram 实时接收互动通知，在 Web 端私有管理模式下可一键审核、置顶、删除或快速回复。
5. **反垃圾与轻量风控**：通过蜜罐字段（Honeypot）、客户端指纹与频控限制基础刷量，无需复杂的验证码阻断正常用户体验。

---

## 2. 视觉与交互体验设计 (UI / UX)

### 2.1 整体布局与呈现位置

#### (1) 信息流 / 瀑布流卡片 (Feed & Waterfall)
- **位置**：`EntryCard` 与 `ArticleCardContent` 的底部操作栏（与时间、标签、外链等元信息并列）。
- **展示形态**：
  - **点赞按钮**：心形/点赞图标 + 计数（如 `♡ 12` 或已点赞时 `♥ 13`）。
  - **评论入口**：气泡图标 + 计数（如 `💬 3`），点击平滑展开浮层或直接唤起评论弹窗/锚点跳转。
- **状态流转**：悬停微亮，未产生互动时不喧宾夺主（低对比度 muted 文本，产生互动后微调亮色）。

#### (2) 详情展示页与弹窗 (Detail View & Overlay)
- **位置**：在正文/媒体区域下方，作为单独的交互章节（`JournalInteractions`）。
- **结构划分**：
  1. **态度反馈区 (Reaction Bar)**：居中或靠左的主动赞赏组件，包含放大版点赞按钮与动态飘心/光晕微动效。
  2. **评论输入区 (Comment Box)**：极简卡片式自适应文本框，光标聚焦时自然展开昵称、邮箱（选填，用于Gravatar或回复提醒）与提交按钮。
  3. **评论列表区 (Comment Stream)**：时间倒序或按发布顺序排列，包含作者头像（动态色彩算法）、昵称、博主徽标（Master Badge）、时间及内容。

---

### 2.2 视觉规范与微动效

```
┌─────────────────────────────────────────────────────────────┐
│                       [ 正文内容区域 ]                      │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  ❤️ 赞赏支持 (12)                                            │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 💬 讨论 (3)                                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 留下你的想法... (支持 Markdown 简写)                     │ │
│ │                                                         │ │
│ │ 昵称 [ 访客2048 ]    邮箱 (选填) [         ]  [ 发 送 ]  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 👤 喵星探险家 · 2小时前                                  │ │
│ │ 这篇关于自动化架构的思考很启发人！                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 👑 博主 · 1小时前                                [作者]  │ │
│ │ 感谢支持，近期还会更新续篇。                              │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

- **设计 Token 映射**：
  - 背景：`var(--bg-card)` / `var(--bg-input)`
  - 边框：`1px solid var(--border-subtle)`，聚焦时切换为 `var(--border-focus)` / `var(--accent-primary)`
  - 头像生成：基于昵称字符串的哈希值自动计算 HSL 柔和渐变底色，搭配首字母或精选极简 SVG 头像。
  - 点赞动效：CSS `transform: scale(1.25)` 配合 `var(--ease-card)` 弹性回弹，禁止引入额外笨重动画库。

---

## 3. 数据库与数据模型设计

在 SQLite 中新增评论与点赞关联表，保持与现有 `journal_entries` 表的外键引用。

### 3.1 迁移脚本规划 (Schema Migration)

```sql
-- 1. 点赞互动表 (Reactions)
CREATE TABLE journal_entry_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'like' CHECK (reaction_type IN ('like', 'heart', 'clap')),
  client_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  UNIQUE(entry_id, reaction_type, client_hash)
);

CREATE INDEX idx_journal_entry_reactions_entry 
ON journal_entry_reactions(entry_id, reaction_type);

-- 2. 访客评论表 (Comments)
CREATE TABLE journal_entry_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  parent_id INTEGER,
  author_name TEXT NOT NULL,
  author_email TEXT,
  author_url TEXT,
  content TEXT NOT NULL,
  is_author INTEGER NOT NULL DEFAULT 0 CHECK (is_author IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'pending', 'hidden', 'deleted')),
  client_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES journal_entry_comments(id) ON DELETE SET NULL
);

CREATE INDEX idx_journal_comments_entry_status 
ON journal_entry_comments(entry_id, status, created_at);

-- 3. 主表统计冗余字段 (可选优化，避免每次全量聚合)
ALTER TABLE journal_entries ADD COLUMN reaction_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE journal_entries ADD COLUMN comment_count INTEGER NOT NULL DEFAULT 0;
```

---

## 4. 后端 API 接口契约设计

### 4.1 公开端接口 (Public Endpoints)

#### (1) 获取条目互动摘要与评论列表
- **Endpoint**: `GET /api/public/entries/:publicId/interactions`
- **Response**:
```json
{
  "publicId": "e7b9a2c1",
  "reactionCount": 12,
  "userHasReacted": true,
  "commentCount": 2,
  "comments": [
    {
      "id": 101,
      "parentId": null,
      "authorName": "Alice",
      "authorUrl": "https://alice.dev",
      "content": "写的太棒了！请问下一期什么时候发？",
      "isAuthor": false,
      "createdAt": "2026-08-29T18:00:00.000Z"
    }
  ]
}
```

#### (2) 点赞 / 取消点赞 (Toggle Reaction)
- **Endpoint**: `POST /api/public/entries/:publicId/reactions`
- **Headers / Body**:
  - `clientIdentifier`: 前端生成的 UUIDv4 存在 LocalStorage 中
  - `reactionType`: `'like'`
- **Response**:
```json
{
  "success": true,
  "reacted": true,
  "reactionCount": 13
}
```

#### (3) 提交匿名评论 (Post Comment)
- **Endpoint**: `POST /api/public/entries/:publicId/comments`
- **Request Body**:
```json
{
  "authorName": "Alice",
  "authorEmail": "alice@example.com",
  "authorUrl": "https://alice.dev",
  "content": "这篇总结很有启发！",
  "parentId": null,
  "clientIdentifier": "550e8400-e29b-41d4-a716-446655440000",
  "honeypot": ""
}
```
- **Response**:
```json
{
  "id": 102,
  "authorName": "Alice",
  "content": "这篇总结很有启发！",
  "isAuthor": false,
  "createdAt": "2026-08-29T18:35:00.000Z",
  "status": "published"
}
```

---

### 4.2 私有管理端接口 (Private Endpoints)

- **`DELETE /api/private/comments/:id`**：删除或软删除指定评论。
- **`PATCH /api/private/comments/:id/status`**：调整评论可见性（`published` / `hidden`）。
- **`POST /api/private/entries/:publicId/comments`**：博主以官方身份直接回复评论（标记 `is_author = 1`）。

---

## 5. Telegram 实时提醒与联动

当有新的点赞或评论产生时，复用 `src/journal-bot` 与 Telegram 推送通道，即时向博主推送通知：

```
💬 [Journal] 收到一条新评论！

📝 文章: 《构建自愈型微服务架构》
👤 访客: Alice (alice@example.com)
💬 内容: "这篇总结很有启发！请问关于分布式事务那部分有Demo吗？"
🕒 时间: 2026-08-29 18:35:10

[打开条目]  [快速通过/删除 (Bot 内联按钮)]
```

---

## 6. 前端架构与组件拆分清单

在 `web/src/components/interaction/` 或 `web/src/components/journal/interaction/` 下组织组件：

1. **`EntryReactionButton.vue`**：
   - 适配 Feed 流卡片与详情页两种尺寸模式；
   - 本地状态即时切换 + 防抖发送请求。
2. **`EntryCommentSection.vue`**：
   - 评论列表外层容器，集成加载态与空状态；
   - 自动拉取或通过 prop 接收初始化互动数据。
3. **`EntryCommentForm.vue`**：
   - 极简自适应输入框，支持记住访客昵称/邮箱；
   - 提交快捷键监听（Cmd/Ctrl + Enter）；
   - 提交成功后的微动画提示。
4. **`EntryCommentItem.vue`**：
   - 单条评论卡片、Avatar 色块渲染、博主身份高亮标识、管理模式下的快捷删除按钮。

---

## 7. 实施计划与分期

- **第一阶段（数据与后端核心主路径）**：
  - 新增数据库 Migration（表结构与索引）；
  - 实现 `ReactionService` 与 `CommentService`；
  - 编写 Public 与 Private 路由接口，连通 Telegram 异步推送。
- **第二阶段（前端视觉组件与状态接入）**：
  - 实现通用 `EntryReactionButton` 与 `EntryCommentSection` 组件；
  - 在 `PublicEntryDetailView` 与 `JournalDetailContent` 中接入互动区；
  - 在 `EntryCard` / `ArticleCardContent` 卡片底部透出点赞数与评论数徽标。
- **第三阶段（管理交互与体验打磨）**：
  - 私有模式（已登录状态）下的评论删除与官方身份回复；
  - 优化移动端软键盘弹出时的交互体验与点赞动效回弹。
