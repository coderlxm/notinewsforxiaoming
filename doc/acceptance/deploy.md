# 部署验收清单

## 1. 部署架构

| 项目 | 值 |
|------|-----|
| 服务器 | bwgdc01 (Debian 12) |
| Node.js | 18.20.4 |
| pnpm | 10.33.2 |
| 项目路径 | `/root/NotiNewsForXiaoming` |
| 进程管理 | systemd (`notinews-bot.service`) |
| CI/CD | GitHub Actions (`deploy.yml`), push main 触发 |

## 2. 部署流程

1. 合并到 `main` 分支并推送
2. GitHub Actions 自动执行：
   - SSH 连接服务器
   - 同步仓库文件（保留 `.env`、`.npmrc`、`data/`）
   - `pnpm install --frozen-lockfile`
   - 安装 systemd service 并 restart
   - 通过 Telegram Bot 发送部署成功通知

## 3. systemd 服务

- **服务文件**: `deploy/notinews-bot.service`
- **类型**: `Type=simple`（常驻进程）
- **启动命令**: `pnpm start:bot`
- **环境变量**: 从 `/root/NotiNewsForXiaoming/.env` 加载
- **重启策略**: `Restart=on-failure`，间隔 5 秒
- **旧定时器**: `notinews.timer` 已停止并禁用

## 4. 环境变量 (.env)

需在服务器 `/root/NotiNewsForXiaoming/.env` 配置：

| 变量 | 说明 |
|------|------|
| `TG_TOKEN` | Telegram Bot Token |
| `TG_CHAT_ID` | 授权用户 Chat ID |
| `WEATHER_API_KEY` | 天气 API Key |
| `DEEPSEEK_API_KEY` | DeepSeek AI API Key |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址 |

## 5. npm 镜像

- `.npmrc` 配置 `registry=https://registry.npmmirror.com`
- `package.json` 中 `pnpm.onlyBuiltDependencies` 包含 `better-sqlite3`
- `deploy.yml` 安装步骤中设置 `npm_config_disturl=https://npmmirror.com/mirrors/node`

## 6. 验收步骤

### 6.1 服务状态验证

```bash
ssh bwgdc01 systemctl status notinews-bot.service --no-pager -l
```

**预期**: `Active: active (running)`，日志中可见 `Fixed jobs registered.` 和 `Bot started. Long polling for updates...`

### 6.2 交互命令测试

在 Telegram 中向 Bot 发送：

| 测试项 | 输入 | 预期输出 |
|--------|------|----------|
| /start | `/start` | 欢迎消息 |
| /help | `/help` | 帮助信息 |
| 确定性解析 | `/remind 每天 09:00 站会` | 确认创建提醒 |
| 自然语言解析 | `5分钟后提醒我喝水` | 确认创建提醒，5分钟后触发 |
| 查看提醒 | `/remind` | 列出待处理提醒及操作按钮 |
| 取消提醒 | 点击「取消」按钮 | 确认已取消 |
| 完成提醒 | 点击「完成」按钮 | 确认已完成 |
| 延后提醒 | 点击「+5分钟」按钮 | 确认已延后 |

### 6.3 定时任务验证

观察对应时间点的消息推送（北京时间）：

| 时间 | 模式 | 内容 |
|------|------|------|
| 00:10 | sleep | 睡眠提醒 + AI 生活建议 |
| 08:30 | wakeup | 天气 + 早安语录 |
| 09:10 | server_health | 服务器健康检查 |
| 09:55 | news | 天气 + 游戏新闻 AI 摘要 |
| 12:30 | vitamin | 维生素提醒 |
| 15:00 | github | GitHub Trending AI 摘要 |
| 18:30 | vitamin | 维生素提醒 |
| 20:00 | v2ex | V2EX 热门 AI 摘要 |
| 周一/周三 20:30 | fitness | 健身计划 |
| 周六 14:00 | fitness | 健身计划 |
| 每日固定时间 | english | 英语学习内容 |

### 6.4 自动部署验证

1. 向 `main` 分支推送任意 commit
2. GitHub Actions workflow 自动执行
3. 部署完成后 Telegram 收到通知：`✅ NotiNews Bot 已更新`
4. 通知包含发布时间、Commit SHA、Bot 状态

### 6.5 崩溃恢复验证

```bash
ssh bwgdc01 "pkill -f 'pnpm start:bot' && sleep 10 && systemctl status notinews-bot.service --no-pager -l | head -5"
```

**预期**: 进程被杀后 5 秒自动重启，服务恢复 `active (running)`。

## 7. 故障排查

| 问题 | 排查命令 |
|------|----------|
| 服务状态异常 | `systemctl status notinews-bot.service -l` |
| 查看完整日志 | `journalctl -u notinews-bot.service -n 50 --no-pager` |
| 查看实时日志 | `journalctl -u notinews-bot.service -f` |
| 依赖问题 | `cd /root/NotiNewsForXiaoming && pnpm install` |
| 手动启动调试 | `cd /root/NotiNewsForXiaoming && pnpm start:bot` |

## 8. 数据持久化

- SQLite 数据库: `data/notinews.sqlite`（WAL 模式）
- 不会被部署覆盖（deploy.yml rsync 排除 `data/`）
- fitness 训练状态持久化在 SQLite 中
