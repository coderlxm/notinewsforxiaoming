# 访客留言板（Guestbook）需求与技术设计方案

## 1. 需求概述与定位

### 1.1 业务定位
本项目为个人空间，为了建立来访读者与博主之间直接、友好的交流渠道，新增全站独立的**访客留言板（Guestbook）**功能：
- **主要目的**：供所有来访访客直接向博主留言、打招呼、交流心得或提出问题。
- **导航入口**：在左侧主导航栏中，排在“游戏墙”导航项下方，点击直接路由至独立的留言板页面（`/guestbook`）。
- **视觉风格**：严格遵循主站既有的雅致、克制设计风格（纸张质感底色、精致卡片、现代衬线/无衬线排版与流畅微交互），与全站视觉体验完全统一。

### 1.2 核心功能需求
1. **访客留言（免登录）**：
   - 访客输入昵称（必填，上限 24 字）与留言正文（必填，上限 1000 字）。
   - 正文支持基础 Markdown 语法（粗体、斜体、代码、引用、链接等）。
   - 防垃圾留言机制：内置前端 Honeypot 蜜罐字段与后端轻量频率限制。
2. **留言展示与互动**：
   - 留言列表按时间倒序展示，包含访客专属生成头像、昵称、留言时间与渲染后的富文本内容。
   - 提交成功后本地即时追加渲染，提供即时操作反馈。
3. **博主管理与回复**：
   - 博主在登录态下，可在每条留言下方直接进行公开回复（嵌套展示博主认证徽章）。
   - 博主具备置顶、隐藏（违规/垃圾留言）或彻底删除留言的管理权限。
4. **Telegram 即时通知**：
   - 访客提交新留言后，服务端第一时间通过 Telegram Bot 向博主发送通知消息，并附带管理快捷按钮。

---

## 2. 界面与交互设计（UI / UX）

### 2.1 导航入口布局
在主导航组件 `PublicChannelNavigation.vue` 中配置独立导航项：
- **桌面端侧边栏**：位于“游戏墙”导航按钮正下方，拥有专属的留言板图标与“留言板”文本。
- **移动端“更多”菜单**：在弹出的更多频道卡片网格中，排列在“游戏墙”卡片之后，标题为“留言板”，描述为“与博主打个招呼”。

### 2.2 独立页面布局（`/guestbook`）
页面采用项目标准阅读流宽度（`--reading-width: 820px`）居中布局：

```text
GuestbookView (留言板独立页面)
├── GuestbookHeader (顶部区域：页面主标题“留言板”、博主寄语招呼文案、留言总数)
├── GuestbookForm (留言输入区域：紧凑单行占位，点击平滑展开完整输入面板)
└── GuestbookList (留言展示流)
    ├── GuestbookItem (访客留言卡片)
    │   └── OwnerReply (博主嵌套回复卡片，带“博主”专属认证徽章)
    └── GuestbookEmpty (空状态占位引导)
```

### 2.3 视觉与细节规范
- **色彩与主题**：遵循系统 CSS 变量（`--surface-page`, `--surface-card`, `--text-primary`, `--text-muted`, `--border-subtle`, `--accent`），自动适配浅色/深色主题。
- **表单交互**：
  - 默认态：紧凑的胶囊/卡片式输入框（占位文案：“写下你想对小明说的话……”）。
  - 聚焦展开态：平滑过渡展示昵称输入框、Markdown 格式提示、提交按钮与快捷键（`Ctrl/Cmd + Enter` 提交）。
- **留言卡片**：
  - 左侧：基于访客昵称哈希生成的专属彩色渐变圆标头像。
  - 主体：首行展示访客昵称与格式化时间；正文为经过安全过滤的 Markdown 渲染 HTML。
  - 博主回复区：在卡片内部缩进展示，背景使用浅色背景微调（`--surface-muted`），标有高对比度的“博主”徽章。

---

## 3. 技术架构与数据设计

### 3.1 数据库设计（SQLite Migration）
在 SQLite 中创建独立的 `journal_guestbook` 数据表：

```sql
CREATE TABLE journal_guestbook (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER,
  author_role TEXT NOT NULL CHECK (author_role IN ('visitor', 'owner')),
  author_name TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  client_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES journal_guestbook(id) ON DELETE CASCADE,
  CHECK (
    (author_role = 'visitor' AND parent_id IS NULL AND client_hash IS NOT NULL)
    OR
    (author_role = 'owner' AND parent_id IS NOT NULL AND client_hash IS NULL)
  )
);

CREATE INDEX idx_journal_guestbook_public
ON journal_guestbook(status, created_at DESC, id DESC);

CREATE INDEX idx_journal_guestbook_parent
ON journal_guestbook(parent_id, created_at ASC)
WHERE parent_id IS NOT NULL;
```

### 3.2 后端 API 接口设计

| 方法 | 路径 | 权限 | 说明 |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/public/guestbook` | 公开 | 获取已发布的留言列表（含关联的公开博主回复） |
| `POST` | `/api/public/guestbook` | 公开 | 访客发布新留言（校验 Honeypot、昵称、正文，生成 ClientHash） |
| `GET` | `/api/private/guestbook` | 博主鉴权 | 获取完整留言列表（包含隐藏留言与管理数据） |
| `POST` | `/api/private/guestbook/:id/reply` | 博主鉴权 | 博主回复指定访客留言 |
| `PATCH` | `/api/private/guestbook/:id/status`| 博主鉴权 | 切换留言状态（published / hidden） |
| `DELETE`| `/api/private/guestbook/:id` | 博主鉴权 | 彻底删除指定留言 |

### 3.3 Telegram Bot 实时通知
访客发布留言成功后，后端通知服务向博主 Telegram 发送推送：
```text
📬 收到新的访客留言
访客：[访客昵称]
内容：[留言正文截断预览]
时间：2026-09-04 21:30
```
Inline 按钮提供：`[打开留言板]`、`[隐藏此留言]`。

---

## 4. 前端架构与模块组织

### 4.1 组件与状态划分
- **页面与组件 (`web/src/components/guestbook/`)**：
  - `GuestbookView.vue`：独立留言板主视图（负责页面骨架、加载状态与数据装载）。
  - `GuestbookHeader.vue`：留言板顶部头部展示。
  - `GuestbookForm.vue`：留言与回复输入表单（封装 Markdown 预览与快捷提交）。
  - `GuestbookItem.vue`：单条留言卡片及博主回复嵌套展示。
  - `GuestbookNavigationIcon.vue`：导航栏专属 SVG 矢量图标。
- **状态管理 (`web/src/stores/guestbook.ts`)**：
  - 封装 `messages` 列表、加载状态与提交状态。
  - 提供 `loadMessages()`、`postVisitorMessage()`、`postOwnerReply()`、`toggleStatus()`、`deleteMessage()` 操作。
- **路由配置 (`web/src/router.ts`)**：
  - 注册 `/guestbook` 路由，指向 `GuestbookView.vue`。
  - 设置页面标题为 `留言板 · 小明同学`。

---

## 5. 实施与开发路径

1. **第一阶段：后端存储与 API 服务**
   - 编写 SQLite Migration（新增 `journal_guestbook` 表与索引）。
   - 实现 `GuestbookRepository` 与 `GuestbookService`（处理 Markdown 渲染清洗与防刷校验）。
   - 接入 Telegram 消息推送与 Inline 回调处理。
   - 注册公共与私有 HTTP 路由端点。
2. **第二阶段：前端页面与组件实现**
   - 新增 `GuestbookNavigationIcon` 并配置在 `PublicChannelNavigation.vue`（排在游戏墙之后）。
   - 注册 `/guestbook` 路由。
   - 开发 `useGuestbookStore` 及 `GuestbookView` / `GuestbookForm` / `GuestbookItem` 组件。
3. **第三阶段：博主管理与端到端联调**
   - 联调博主登录态下的直接回复、隐藏与删除操作。
   - 验证 Telegram Bot 消息推送与快捷处理链路。
