# AV 功能扩展：磁力直达、元数据增强与样品图集设计

## 1. 核心目标
将 AV 推送从简单的“标题告知”升级为“决策参考”，让用户在 Telegram 内完成：
- **查看详情**：通过元数据（类别、导演）判断口味。
- **视觉预览**：通过样品图九宫格判断颜值。
- **获取资源**：一键复制经过筛选的最优磁力链接。

## 2. 数据解析细节 (基于 JavBus RSS Raw 数据)

### 2.1 磁力筛选逻辑 (Magnet Picker)
- **解析对象**：`item.content` 中 `<h4>磁力連結投稿</h4>` 后的 `<table>`。
- **解析字段**：`<a>` 的 `href` (磁力), `<a>` 的文本 (名称), 第三个 `<td>` (大小)。
- **筛选策略**：
  1. **关键词命中**：标题中含有 `字幕`、`中字`、`-C`、`CN` 的磁力优先级最高。
  2. **容量优先**：在关键词命中的基础上，优先选择 4GB - 10GB 之间的资源（平衡清晰度与下载速度）。
  3. **保底逻辑**：若无中字资源，则选择体积最大的资源。

### 2.2 元数据聚合 (Metadata Aggregation)
- **识别码 (Code)**：从 `span.header: 識別碼` 提取。
- **标签 (Genres)**：提取所有 `span.genre`。在 Telegram 中以 `#标签` 形式展现，方便点击搜索。
- **系列/制作商**：提取对应的 `a` 标签文本。

### 2.3 样品图处理 (Samples Gallery)
- **抓取**：提取 `<h4>樣品圖像</h4>` 之后的所有 `img[src]`。
- **发送方式**：使用 Telegram `sendMediaGroup` 接口。
- **限制**：Telegram 单词发送上限为 10 张图。建议：1张封面 + 9张样品图。

## 3. 技术实现路径

### 3.1 增强型解析器 (`src/services/avContentParser.ts`)
```typescript
import * as cheerio from 'cheerio';

export function parseAvContent(html: string) {
  const $ = cheerio.load(html);
  
  // 1. 提取磁力列表并排序
  const magnets = $('table tr').map((i, el) => {
    const a = $(el).find('td:nth-child(1) a');
    const size = $(el).find('td:nth-child(2)').text();
    return {
      name: a.text().trim(),
      link: a.attr('href'),
      size: size.trim()
    };
  }).get();
  
  // 2. 提取样品图
  const samples = $('h4:contains("樣品圖像")').nextAll('img').map((i, el) => $(el).attr('src')).get();

  return { magnets, samples, ... };
}
```

### 3.2 推送器扩展 (`src/publishers/avTelegram.ts`)
```typescript
export async function sendAvUpdateWithGallery(input: AvExtendedInput, bot: Telegraf) {
  // 1. 构造 MediaGroup
  const media: InputMediaPhoto[] = [
    { type: 'photo', media: input.coverUrl, caption: input.message, parse_mode: 'HTML' },
    ...input.samples.slice(0, 9).map(url => ({ type: 'photo', media: url }))
  ];
  
  // 2. 发送
  await bot.telegram.sendMediaGroup(config.tgChatId, media);
}
```

## 4. 视觉方案演进 (Premium Look)
```text
🌟 <b>关注女优新作更新</b>
──────────────────
👩 <b>演员</b>：木下凛凛子
🔢 <b>识别码</b>：JUR-704
🎬 <b>标题</b>：${translatedTitle}
🏢 <b>制作商</b>：Madonna (マドンナ)
🏷️ <b>类别</b>：#女教师 #羞耻 #巨尻 #巨乳
──────────────────
🧲 <b>最优磁力 (含中字)</b>
<code>${bestMagnet.link}</code>
📦 <b>大小</b>：7.72GB | 📅 <b>分享日期</b>：2026-05-04
──────────────────
#新作推送 #磁力直达 #木下凛凛子
```

### 5.6 AI 增强扩展策略

为进一步提升“Premium”体验，可在解析完成后接入 DeepSeek 进行二次加工：

1. **智能磁力鉴别 (Smart Picker)**：
   - **输入**：所有磁力链接的名称列表。
   - **Prompt**：`“在以下磁力文件名中，哪一个是 1080P 或 4K 且明确带有中文字幕（如 -C, CN, SUB）的版本？请直接返回该名称，不要解释内容。”`
   - **效果**：比硬编码正则更准确，能识别非标命名。

2. **标签语义化与 Emoji 自动匹配**：
   - **输入**：原始标签数组（如 `['女教師', '巨乳', '羞耻']`）。
   - **AI 加工**：将标签翻译为自然中文并按类型分组，同时自动匹配对应的 Emoji。
   - **输出示例**：`🎭 场景：#女教师 | 🍑 身材：#巨乳 | 🔥 玩法：#反差 #羞耻`

3. **作品“一句话看点”**：
   - **AI 逻辑**：根据标题、标签和演员，生成一段 20 字以内的“销售语”，增加点击欲望。

## 6. 开发建议与避坑指南
- **不要手写正则**：由于 `content` 是复杂的嵌套 HTML，强烈建议引入 `cheerio` 进行结构化解析，避免之前“字段对不上”的低级错误。
- **MediaGroup 失败降级**：如果 `sendMediaGroup` 因为某个样品图 404 而失败，**直接降级为仅发送封面图**（主路径优先原则）。
- **磁力链接安全**：磁力链接必须使用 `<code>` 标签包裹，防止 Telegram 渲染出乱七八糟的预览，且方便用户一键复制。
- **API 限制**：注意 `sendMediaGroup` 的频率，短时间内大量发送可能触发 Telegram 的 Flood Wait 限制。
