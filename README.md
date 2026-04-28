<div align="center">
  <h1>📰 NotiNewsForXiaoming</h1>
  <p>一个轻量、零成本的每日智能信息推送机器人</p>
</div>

---

## ✨ 简介

基于 Node.js 构建的自动化定时推送脚本。它每天早上会准时抓取国内外主机游戏新闻、所在城市天气，并通过 **DeepSeek AI** 进行生动的翻译与提取，最终排版成优雅的 Markdown 发送到你的 **Telegram**。配合 **GitHub Actions**，实现了完全免维护、零服务器成本的全自动化运行。

## 🚀 核心功能

- 🎮 **智能游戏简报**：订阅各大知名媒体（IGN、Polygon、机核网等），精准过滤主机与 Steam 新闻。
- 🤖 **DeepSeek AI 翻译官**：自动将冗长或英文的新闻精炼成一句话，并加上“有内味儿”的幽默吐槽和 Emoji。
- 🌤️ **每日天气播报**：对接和风天气，出门前气温与风向一目了然。
- 🚨 **打工人专属提醒**：工作日自动追加“多喝水”与“别忘打卡”提醒，周末自动静音。
- ☁️ **Serverless 零成本**：完美契合 GitHub Actions，每天指定时间自动执行。

## 🛠️ 技术栈

- **Runtime**: Node.js, TypeScript, pnpm
- **Data & APIs**: `rss-parser` (新闻源解析), 和风天气 API
- **AI Core**: DeepSeek (OpenAI SDK 兼容模式)
- **Message Carrier**: `telegraf` (Telegram Bot SDK)
- **CI/CD**: GitHub Actions

## 📦 部署指南 (零成本方案)

只需 Fork 或拷贝本仓库，配置好 GitHub Secrets 即可每天享受智能推送。

### 1. 获取密钥材料
- `TG_TOKEN`: 在 Telegram 向 [@BotFather](https://t.me/BotFather) 申请一个 Bot Token。
- `TG_CHAT_ID`: 在 Telegram 向 [@userinfobot](https://t.me/userinfobot) 查询你的个人 ID。
- `QWEATHER_API_KEY`: 前往 [和风天气控制台](https://console.qweather.com/) 创建一个 **Web API** 凭据（不限制域名/IP）。
- `QWEATHER_CITY_ID`: 你的城市专属 ID，例如深圳是 `101280601`。
- `DEEPSEEK_API_KEY`: 前往 [DeepSeek 开放平台](https://platform.deepseek.com/) 申请。

### 2. 本地测试 (可选)
复制环境变量文件模板并填入对应的值：
```bash
cp .env.example .env
pnpm install
pnpm start
```

### 3. 配置 GitHub Actions
在你的 GitHub 仓库中，进入 **Settings** -> **Secrets and variables** -> **Actions**，新建以上 5 个变量。
配置完成后，每天早晨 **9:55**，GitHub Actions 就会自动唤醒并为你发送新鲜出炉的简报！

---

*Designed and Built for a better daily routine.*
