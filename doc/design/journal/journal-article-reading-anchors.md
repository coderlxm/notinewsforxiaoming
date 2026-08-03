# Journal 文章阅读锚点设计

## 1. 目标与边界

为富文本文章的 H2、H3 提供稳定锚点，让公开文章和私有文章详情具备：

- 可点击的文章目录；
- 当前章节提示；
- 刷新后仍可定位的 URL hash；
- 标题文字修改后仍然有效的章节链接。

公开链接格式为：

```text
/p/:publicId#section-<uuid>
```

私有链接格式为：

```text
/me?entry=:id#section-<uuid>
```

私有链接仍遵循现有登录要求。编辑器内文章预览不显示目录，不新增目录数据表、独立 API、自动重试或兼容兜底。

## 2. 锚点数据

富文本 JSON 继续是唯一正文源数据。每个 heading 节点增加 `anchorId`：

```json
{
  "type": "heading",
  "attrs": {
    "level": 2,
    "anchorId": "section-7bf22d10-fb51-4e5d-87d6-345da1f23148"
  },
  "content": [
    {
      "type": "text",
      "text": "章节标题"
    }
  ]
}
```

采用 `@tiptap/extension-unique-id`，只管理 heading 节点。新 ID 使用
`section-${crypto.randomUUID()}`。编辑器负责节点拆分、粘贴、撤销和重复 ID
处理；服务端创建或更新文章时补齐缺失 ID，并拒绝格式错误或重复 ID。

数据库版本 8 在现有 migration transaction 内遍历富文本文章，为历史 heading
补齐 ID，原位更新 `rich_body_json`，不修改 `updated_at`。迁移遇到非法 JSON 或
不符合共享协议的正文时直接失败。

## 3. 阅读交互

目录从 `richBody` 即时派生，只读取 H2、H3 的 `anchorId`、层级和纯文本内容，
不存储第二份目录。

- 桌面端在正文右侧显示粘性目录，H3 相对 H2 缩进。
- 小于 `960px` 时显示固定“目录”按钮，点击打开底部原生 dialog。
- 没有有效标题时不显示目录；一个标题仍显示。
- 点击目录项使用 `router.replace` 更新 hash，避免污染浏览器返回历史。
- 点击跳转使用平滑滚动；减少动态效果偏好下改为即时定位。
- 普通滚动只更新 `aria-current="location"`，不持续改写地址栏。
- 有效 hash 在正文渲染后定位；未知 hash 不生成替代目标。

阅读容器寻找最近的实际纵向滚动祖先，因此公开页使用现有 `.app-scroll`，私有
桌面详情使用 `.detail-content`，私有移动详情使用 `.detail-layout`。实现不使用
`requestAnimationFrame` 或其别名。

## 4. 组件职责

- `RichArticleRenderer`：只读渲染 Tiptap JSON，不修改 heading ID。
- `ArticleRichBody`：派生目录、连接路由 hash、定位正文、跟踪当前章节。
- `ArticleTableOfContents`：展示桌面目录与移动抽屉，通过事件请求章节跳转。
- `ArticleCardContent`：公开完整文章按 `anchored` 显式启用阅读锚点，编辑器预览保持原渲染。
- `JournalDetailContent`：私有富文本详情复用 `ArticleRichBody`。

应用级路由滚动逻辑忽略 pathname 和 query 均未变化的 hash-only 导航，避免章节
跳转触发详情回顶、信息流位置保存或弹层切换。

## 5. 验收结果

- 新文章保存后每个 H2、H3 都有唯一且持久的 `anchorId`。
- 历史文章升级后无需逐篇重存即可展示目录。
- 修改标题文字、调整顺序或在前方插入章节不会改变已有链接。
- 公开和私有文章从有效 hash 进入或刷新时均定位对应章节。
- 目录跳转不增加逐章节返回历史，也不改变信息流原滚动位置。
- 桌面目录和移动抽屉共享相同条目与当前章节状态。
- 无标题文章不出现空目录，未知 hash 不跳向其他章节。
