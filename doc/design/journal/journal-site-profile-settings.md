# Journal 页面资料设置方案

## 1. 背景

当前公开页面顶部展示：

- 圆形头像；
- 固定昵称“小明同学”；
- bio“姚黄魏紫开次第，不觉成恨俱零凋”。

这些内容目前不是一份统一配置：

- `web/src/App.vue` 直接写死顶部头像、昵称和 bio；
- `JournalDetailContent.vue`、`JournalDetailPeek.vue` 分别写死详情署名头像；
- `src/journal-server/routes/feeds.ts` 独立写死 Feed 标题和描述；
- `web/public/avatar-ming.png` 是固定静态资源。

因此，只在顶部增加本地表单不能形成完整主路径：保存后其他页面仍会继续显示旧头像，Feed 描述也会与页面 bio 不一致。

## 2. 首版目标

新增一个只有管理员登录后可使用的设置页面，首版只管理“公开资料”：

- 修改顶部区域的 bio；
- 上传并替换头像；
- 保存前看到与公开页风格一致的实时预览；
- 保存成功后，当前页面顶部立即显示新资料；
- 详情页署名头像与顶部头像使用同一份数据；
- RSS 和 JSON Feed 的描述与 bio 使用同一份数据。

设置页为后续增加其他页面静态内容保留分区结构，但首版不创建通用配置中心，不引入任意键值配置或动态表单。

## 3. 首版边界

### 3.1 本次包含

- 新增 `/me/settings` 管理路由；
- 在“我的资产”页面操作区增加“设置”入口；
- 新增公开资料读取接口；
- 新增管理员资料更新接口；
- 持久化 bio 和头像；
- 将顶部、详情头像和 Feed 描述接到统一资料数据；
- 延续当前明纸色、石榴红、宋体标题、细边框和小尺寸按钮的视觉语言；
- 兼容当前深色主题和移动端布局。

### 3.2 本次不包含

- 修改昵称“小明同学”；
- 修改页脚文案；
- 修改网页 `<title>`、description、favicon 或 Apple Touch Icon；
- 头像裁剪器、缩放器和滤镜；
- 历史头像、恢复旧头像或“恢复默认”；
- 多套资料、定时切换或预览整站主题；
- Telegram bot 名称、头像或简介同步；
- 通用站点设置表、任意 JSON 设置或插件式设置项。

昵称继续保持静态，是为了让首版只解决已经明确提出的 bio 和 avatar，不把页面身份、SEO、Feed 作者名和海报署名一起扩展成更大的改名功能。

## 4. 入口与路由

### 4.1 设置入口

在 `/me` 的 `feed__private-actions` 中加入“设置”，顺序为：

1. 刷新
2. 发布内容
3. 写文章
4. 设置
5. 退出登录

入口仅在管理员认证状态为 `authenticated` 时显示，与“发布内容”和“写文章”保持一致。

不把“设置”加入顶部主导航。当前移动端顶部需要同时容纳头像、昵称和导航，再增加一个固定导航项容易挤压截图所示的资料区域；设置本身属于低频管理操作，从“我的资产”进入更符合现有操作层级。

### 4.2 路由

新增：

```text
/me/settings
```

页面顶部提供“← 返回我的资产”，返回 `/me`。服务端同时为该路径注册现有 SPA `index.html` 响应。

直接访问该地址时仍以现有管理员会话为权限依据。资料更新接口必须经过 `requireAdmin`，不另建账号或权限体系。

## 5. 页面与交互

### 5.1 页面结构

设置页沿用发布页和文章编辑页的内容宽度、上下留白及表单样式：

```text
← 返回我的资产                                      设置

公开资料
这些内容会展示在公开记录页和内容详情中

┌──────────────────────────────────────────────────────┐
│   [ 圆形头像 ]   小明同学                             │
│                  当前 bio 文案                        │
└──────────────────────────────────────────────────────┘

头像
[ 圆形头像预览 ]  [选择图片]
支持 JPEG、PNG、WebP，单张不超过 5 MB

Bio
┌──────────────────────────────────────────────────────┐
│ 姚黄魏紫开次第，不觉成恨俱零凋                       │
└──────────────────────────────────────────────────────┘
                                                 18 / 120

                                              [保存修改]
```

预览区不是重新设计一张卡片，而是复用顶部资料区的主要视觉关系：

- 圆形头像；
- 宋体昵称；
- 宋体、弱化颜色的单行 bio；
- `var(--surface-page)` 背景；
- `var(--border-subtle)` 边框；
- 不添加阴影、插画、图标库或额外主题色。

### 5.2 Bio

- 使用多行输入框，允许换行输入，但公开顶部仍按现有单行省略样式展示；
- 保存时去掉首尾空白，保留正文内部字符；
- 长度上限 120 个字符；
- 允许清空；bio 为空时，公开顶部不渲染空的 `<p>`，Feed 描述使用空字符串；
- 输入区显示当前字符数；
- 超过上限时不允许提交，并显示明确错误。

### 5.3 头像

- 点击“选择图片”打开单文件选择器；
- 支持 JPEG、PNG、WebP；
- 单张最大 5 MB；
- 选择后立即在页面预览区和头像字段中显示本地预览；
- 重新选择会替换尚未保存的文件；
- 保存前不修改页面顶部正在使用的头像；
- 不提供删除头像或恢复默认头像；
- 服务端使用项目已有的 `sharp` 读取并处理图片，不手写图片解析；
- 服务端根据 EXIF 方向旋转，并以居中 `cover` 方式生成 `512 × 512` WebP 头像；
- 页面继续通过圆形容器展示，数据库不保存圆形蒙版。

首版不加入裁剪器。实时圆形预览直接呈现最终居中裁切效果，用户不满意时重新选择图片即可。

### 5.4 保存

“保存修改”一次提交当前 bio 和可选的新头像：

- 没有选择新头像时，只更新 bio；
- 提交期间禁用输入、图片选择和保存按钮；
- 保存按钮显示“保存中…”；
- 服务端返回真实错误时，在表单顶部显示，不重试、不跳过头像或只保存部分字段；
- bio 与头像数据在同一个数据库事务中更新；
- 保存成功后，用响应结果更新前端资料 store，顶部资料和详情头像无需刷新页面即可使用新值；
- 保存成功后继续停留在设置页，不新增成功消息。

## 6. 数据模型

新增单行表 `journal_site_profile`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | INTEGER | 固定为 `1` |
| `bio` | TEXT | 公开 bio，最长 120 个字符 |
| `avatar_webp` | BLOB | 处理后的 512 × 512 WebP |
| `avatar_revision` | INTEGER | 头像每次变化时递增，用于浏览器缓存版本 |
| `updated_at` | TEXT | 最近一次资料更新时间 |

约束保持直接：

```sql
id = 1
length(bio) <= 120
avatar_revision > 0
```

头像保存为单个小尺寸 WebP BLOB，而不是挂到 `journal_assets`：

- 它不属于任何 Journal entry；
- 不需要公开/私有、附件角色、排序、预览图和删除联动；
- 头像替换与 bio 可以在同一个 SQLite 事务中原子更新；
- 不需要额外处理新文件落盘、旧文件删除和数据库状态之间的一致性。

Migration 只创建表。服务启动注册路由前，如果单行资料尚未初始化，则读取当前 `web/public/avatar-ming.png`，通过同一头像处理函数生成 WebP，并以当前 bio 写入初始行。初始化完成后，公开读取始终来自该行，不在请求路径中加入默认头像或默认 bio 分支。

## 7. API

### 7.1 读取公开资料

```http
GET /api/site-profile
```

无需登录，响应：

```json
{
  "bio": "姚黄魏紫开次第，不觉成恨俱零凋",
  "avatarUrl": "/api/site-profile/avatar?v=1",
  "updatedAt": "2026-07-26T08:00:00.000Z"
}
```

接口只返回公开展示所需字段，不返回头像 BLOB。

### 7.2 读取头像

```http
GET /api/site-profile/avatar?v=1
```

响应类型固定为 `image/webp`。`avatarUrl` 中的 revision 只在头像变化时递增；响应可以使用长期公开缓存，新头像通过新 URL 立即生效。

### 7.3 更新公开资料

```http
PATCH /api/me/site-profile
Content-Type: multipart/form-data
```

字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `bio` | 是 | 当前完整 bio，可为空，最长 120 个字符 |
| `avatar` | 否 | 新头像；未提供时保留当前头像 |

接口使用 `requireAdmin`。头像格式、文件大小、图片可解析性和 bio 长度任一不合法时，直接返回错误，不写入任何修改。

更新成功返回与 `GET /api/site-profile` 相同的数据结构，前端直接用它替换当前 store 状态。

## 8. 前端数据流

新增 `useSiteProfileStore`，只承担共享公开资料：

```text
App 启动
   │
   └── GET /api/site-profile
             │
             └── useSiteProfileStore
                    ├── App.vue 顶部资料
                    ├── JournalDetailContent.vue
                    ├── JournalDetailPeek.vue
                    └── SiteProfileSettingsView.vue

设置页保存
   │
   └── PATCH /api/me/site-profile
             │
             └── 用响应更新同一个 store
                    └── 当前页面顶部立即更新
```

资料请求失败时，store 保留明确错误状态，顶部显示错误信息；不继续显示代码中写死的旧头像或旧 bio。这样线上问题会直接暴露，不形成两份可能长期不一致的数据来源。

设置页维护独立草稿值：

- `draftBio`；
- `draftAvatarFile`；
- `draftAvatarPreviewUrl`。

只有保存成功后才更新共享 store。离开设置页时释放本地预览 URL，不保存浏览器草稿。

## 9. 展示范围

### 9.1 Bio 消费位置

首版统一到以下位置：

- `App.vue` 顶部 `.profile__bio`；
- RSS Feed 的 `description`；
- JSON Feed 的 `description`。

### 9.2 Avatar 消费位置

首版统一到以下位置：

- `App.vue` 顶部 `.profile__avatar`；
- `JournalDetailContent.vue` 详情署名；
- `JournalDetailPeek.vue` 移动端详情预览署名。

`JournalTextPoster.vue` 只展示固定昵称，没有头像，不需要修改。网页 favicon、Apple Touch Icon 仍保留当前静态资源，属于首版边界之外。

## 10. 后端职责

新增一个短而直接的 `JournalSiteProfileService`：

- 初始化单行资料；
- 读取资料；
- 使用 `sharp` 处理头像；
- 在事务中更新 bio、头像 revision 和时间；
- 返回公开响应结构。

`JournalRepository` 只负责对应单行的读取、初始化和更新 SQL。Feed 路由在生成 Feed 时读取同一行的 bio，不缓存副本。

不为单行资料引入事件系统、配置注册器、版本历史、文件清理任务或通用 CMS 抽象。

## 11. 预计文件改动

新增：

- `web/src/components/settings/SiteProfileSettingsView.vue`
- `web/src/stores/siteProfile.ts`
- `src/journal-server/siteProfileService.ts`
- `src/journal-server/routes/siteProfile.ts`

修改：

- `web/src/App.vue`
- `web/src/router.ts`
- `web/src/api.ts`
- `web/src/types.ts`
- `web/src/components/journal/FeedView.vue`
- `web/src/components/journal/JournalDetailContent.vue`
- `web/src/components/journal/JournalDetailPeek.vue`
- `src/journal-server/migrations.ts`
- `src/journal-server/repository.ts`
- `src/journal-server/server.ts`
- `src/journal-server/routes/feeds.ts`

不修改：

- Telegram bot 业务；
- Journal entry 与 asset 数据结构；
- 发布、文章编辑、媒体展示和认证机制；
- `src/reminders/recurring.ts` 的 `rrule` 导入。

## 12. 完成标准

- 管理员可以从“我的资产”进入设置页；
- 设置页在桌面和移动端延续现有页面风格；
- 可以只修改 bio，也可以同时替换头像；
- 非法图片或超长 bio 会显示真实错误，且不产生部分保存；
- 保存后当前顶部、公开首页和详情使用新头像；
- 保存后顶部与 RSS、JSON Feed 使用新 bio；
- 刷新页面和服务重启后设置仍然存在；
- 未登录用户可以读取公开资料，但不能修改；
- 现有固定昵称、页脚、favicon 和 Telegram bot 不受影响。

## 13. 建议实施顺序

1. 增加单行资料表、初始化和 repository 方法；
2. 增加资料 service、公开读取及管理员更新路由；
3. 让 Feed 描述读取统一 bio；
4. 增加前端类型、API 和共享 store；
5. 替换顶部及详情头像的硬编码数据；
6. 增加设置路由、入口和设置页面。

