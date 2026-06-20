# Docker 容器化部署指南

## 前置要求

- Docker >= 20.10
- Docker Compose >= 2.0（或 docker-compose V2）
- 至少 512MB 可用内存

## 快速部署

### 1. 克隆项目

```bash
git clone <仓库地址> && cd NotiNewsForXiaoming
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入实际值：

| 变量 | 必填 | 说明 |
|------|------|------|
| `TG_TOKEN` | 是 | Telegram Bot Token |
| `TG_CHAT_ID` | 是 | 接收通知的 Chat ID |
| `QWEATHER_API_KEY` | 是 | 和风天气 API Key |
| `QWEATHER_CITY_ID` | 否 | 城市 ID，默认北京 `101010100` |
| `DEEPSEEK_API_KEY` | 否 | DeepSeek API Key |
| `STARTGG_API_TOKEN` | 否 | start.gg API Token |

### 3. 启动服务

```bash
docker compose up -d --build
```

### 4. 查看日志

```bash
docker compose logs -f bot
```

## 日常操作

| 操作 | 命令 |
|------|------|
| 停止服务 | `docker compose down` |
| 重启服务 | `docker compose restart` |
| 重建并启动 | `docker compose up -d --build` |
| 查看状态 | `docker compose ps` |
| 进入容器 | `docker compose exec bot sh` |

## 数据持久化

SQLite 数据库和运行状态文件存储在 Docker volume `noti-news-data` 中，容器重建后数据不会丢失。

查看 volume 位置：

```bash
docker volume inspect noti-news-data
```

如需备份：

```bash
docker compose exec bot sh -c 'cp /app/data/notinews.sqlite /app/data/notinews.sqlite.bak'
```

## 更新部署

```bash
git pull
docker compose up -d --build
```

## 架构说明

项目包含两个入口：

- **resident.ts**（默认）：长驻 Bot 服务，通过 node-schedule 定时推送 + 交互式命令处理，对应 `docker compose up` 启动的服务。
- **index.ts**：一次性定时脚本，按当前时间匹配推送模式后退出。通常仅在手动测试时使用。

若需手动运行一次性脚本：

```bash
docker compose exec bot npx tsx src/index.ts
```