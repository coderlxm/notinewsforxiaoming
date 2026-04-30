# NotiNewsForXiaoming (智能日常推送机器人)

## 🎯 项目目标
构建一个轻量、可扩展的每日信息推送系统，主要用于获取每日热门游戏新闻（主机/PC）与当地天气，通过 Telegram Bot 推送。并预留 DeepSeek API 接入能力，以便未来对新闻进行翻译、提炼或情感分析。

## 🛠️ 技术选型
- **运行环境/语言**: Node.js + TypeScript (提供良好的类型提示和高可维护性)
- **包管理器**: pnpm
- **核心依赖**:
  - `axios` / `ofetch`: 网络请求
  - `rss-parser`: 稳定解析各大游戏资讯站的 RSS feed
  - `telegraf` 或 `node-telegram-bot-api`: Telegram Bot 交互与推送
  - `openai`: DeepSeek 官方兼容 OpenAI SDK，直接使用以便无缝接入
  - `dotenv`: 本地环境变量管理

## 📡 数据源方案
1. **天气数据**: 
   - 推荐使用 [和风天气 (QWeather)](https://dev.qweather.com/) 或 OpenWeatherMap。提供简单易用的 API 且有充足的免费额度。
2. **游戏新闻 (主机/Steam重点)**: 
   - 方案：通过 `rss-parser` 抓取知名游戏资讯站（如 IGN, GameSpot, 游民星空等）的 RSS 源。
   - 过滤策略：对新闻标题或标签进行关键词正则过滤，匹配 `PS|PlayStation|Switch|Xbox|Steam` 等关键词。
   - 排序策略：根据发布时间或热度（如果源支持），取最新/最热的 Top 5。

## 🏗️ 架构设计
整体采用模块化设计，职责分离，方便后续随时插拔和扩展。

```text
.
├── src/
│   ├── config/          # 配置管理 (解析环境变量，统管 key)
│   ├── fetchers/        # 数据抓取层
│   │   ├── weather.ts   # 天气数据获取
│   │   └── games.ts     # 游戏新闻 RSS 抓取与关键字过滤
│   ├── ai/              # AI 增强层
│   │   └── deepseek.ts  # 将新闻文本抛给 DeepSeek 处理 (总结/翻译/格式化)
│   ├── publishers/      # 推送层
│   │   └── telegram.ts  # Telegram 消息推送逻辑
│   ├── formatters/      # 数据展示格式化 (纯文本/Markdown拼装)
│   │   └── index.ts     
│   └── index.ts         # 调度入口，串联抓取、AI、格式化和推送
├── .env.example         # 环境变量模板 (存放 TG_TOKEN, DEEPSEEK_API_KEY 等)
├── package.json
└── tsconfig.json
```

## 🚀 核心运行流程
1. **定时触发**: 
   - 方案A（推荐，零成本无服务器）：编写 GitHub Actions 工作流，利用 cron 语法每日固定时间执行该脚本。
   - 方案B（常驻服务）：在自己的 VPS 上使用 `node-cron` 或 PM2 启动，支持定时推送以及随时与 Bot 的交互。
2. **数据收集**: 并发调用 `fetchers` 获取当前天气和经过平台过滤的游戏新闻。
3. **AI 预处理 (可选环节)**: 
   - 若开启 DeepSeek，则将抓取到的 5 条新闻作为 prompt，要求 AI 进行：“请将以下游戏新闻翻译为中文（若为外语）并精炼成一行核心看点，带上适合的 emoji，整理成 Telegram 的阅读格式。”
4. **组装推送**: 将排版好的天气和新闻，通过 Telegram 模块推送至你的个人账号或指定频道。

## 🔮 扩展潜力
- **新类型消息**: 如需新增“加密货币行情”或“微博热搜”，仅需在 `fetchers` 增加一个抓取文件，主流程引入即可。
- **个人助手进化**: 后期可将 Bot 改为长连接轮询（Polling）或 Webhook 模式，让你能在 TG 里直接发消息对话，脚本将消息透传给 DeepSeek 并回复，成为专属 AI 助理。

## 📝 实施步骤计划
等你 Review 完上述方案后，我们可以开始：
1. `pnpm init` 和配置 TypeScript 基础开发环境。
2. 安装所需依赖。
3. 创建目录结构，编写配置文件与基础接口定义。
4. 逐步实现天气和游戏新闻的数据抓取。
5. 跑通 Telegram 机器人消息推送链路。
