# Snippet Inbox (灵感与碎片知识库) 设计文档

## 1. 核心目标
打造一个**超低摩擦**的碎片信息收集系统，通过 Telegram 随时随地记录灵感、网页和多媒体，并利用 AI 实现自动分类、摘要和标签化，解决“收集易、整理难”的问题。

## 2. 核心场景 (Use Cases)
- **文字灵感**：突然想到的一句话、一个点子或一段代码。
- **网页归档**：转发一个感兴趣的文章链接，自动获取标题和 AI 简报。
- **视觉记录**：拍摄一张图片（书页、海报、白板），提取关键信息。
- **语音备忘**：发送语音消息，自动转录并总结要点。

## 3. 技术实现方案

### 3.1 数据库方案 (Schema)
在 `notinews.sqlite` 中新增 `snippets` 表：

```sql
CREATE TABLE IF NOT EXISTS snippets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'link', 'image', 'voice')),
  raw_content TEXT NOT NULL,      -- 原始文本、URL 或本地文件路径
  title TEXT,                     -- 提取的标题或 AI 生成的标题
  ai_summary TEXT,                -- AI 生成的内容摘要
  tags TEXT,                      -- JSON 字符串数组，如 '["#技术", "#灵感"]'
  metadata TEXT,                  -- JSON 存储额外信息（如链接的 Meta、OCR 结果）
  source_message_id INTEGER,      -- 关联的 Telegram 消息 ID
  created_at TEXT NOT NULL
);
```

### 3.2 核心逻辑流程
1.  **输入识别**：Bot 监听非命令类消息。
    - 含有 URL -> `link`
    - 仅有文本 -> `text`
    - 图片消息 -> `image`
    - 语音消息 -> `voice`
2.  **异步处理 (Worker)**：
    - **Link**：使用 `cheerio` 抓取页面 Meta 信息，调用 DeepSeek 生成 3 点摘要。
    - **Text**：调用 DeepSeek 分析语义，自动打上 2-3 个标签（如 #想法 #待办）。
    - **Image**：记录路径，（可选）通过 AI 视觉接口描述内容或 OCR。
    - **Voice**：转录为文字，再进行摘要。
3.  **确认反馈**：Bot 回复一条简洁的确认消息，包含自动生成的标签和摘要。

### 3.3 DeepSeek Prompt 设计
```text
你是一个私人知识库助手。请分析以下内容，并按 JSON 格式输出：
1. title: 10字以内的核心标题
2. summary: 20字以内的极简摘要
3. tags: 2-3个以 # 开头的分类标签

内容：${input_content}
```

## 4. 交互指令设计
- **自动保存**：直接发送任何内容给 Bot 即可保存，无需指令。
- **检索**：`/find <关键词>` - 模糊搜索标题、内容或标签。
- **回顾**：`/random` - 随机推送一条历史 Snippet，触发意外的联想（Serendipity）。
- **标签库**：`/tags` - 查看当前所有的标签云。

## 5. 视觉方案 (Telegram UI)
```text
📥 <b>Snippet 已存入收件箱</b>
──────────────────
📝 <b>标题</b>：Next.js 15 性能优化点
🏷️ <b>标签</b>：#前端 #技术笔记
💡 <b>AI 简报</b>：重点介绍了新的缓存策略和更快的服务端编译速度。
──────────────────
[ 🗑️ 删除 ] [ 📂 查看全文 ] [ ➕ 添加备注 ]
```

## 6. 开发计划
1.  **Phase 1**: 数据库迁移及基础文本保存逻辑。
2.  **Phase 2**: 接入链接抓取与 AI 摘要功能。
3.  **Phase 3**: 实现多媒体（图片/语音）的持久化存储。
4.  **Phase 4**: 搜索与随机回顾指令开发。

## 7. 避坑指南
- **防抖处理**：防止短时间内发送多条消息（如长文分段）导致创建多个 Snippet。
- **链接失效**：抓取失败时应降级为仅保存 URL。
- **本地存储**：图片和语音文件需定期清理或同步至云端，避免服务器磁盘爆满。
