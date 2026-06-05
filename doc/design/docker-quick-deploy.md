# NotiNews Docker 快速部署设计（服务器迁移版）

## 1. 目标

在任意新服务器上，用最少步骤把当前项目跑起来，并保持与现有线上行为一致：

- 机器人常驻（`start:bot`）
- 进程内定时任务继续生效（包括 AV 三次静默拉取）
- SQLite 数据可持久化
- 重启后自动恢复

## 2. 与当前实现对齐

当前线上核心路径是：

- 启动命令：`pnpm start:bot`（`tsx src/resident.ts`）
- 定时：由 `src/scheduled/jobs.ts` 在进程内注册
- 数据库：`data/notinews.sqlite`

因此容器化不改调度模型，不引入额外 cron / systemd timer，直接容器常驻运行 bot。

## 3. 目标架构

采用 **单服务容器 + 宿主机持久卷 + Docker restart 策略**：

1. 容器启动后执行 `pnpm start:bot`
2. 将宿主机目录挂载到容器 `/app/data`
3. 设置 `restart: unless-stopped`
4. 时区固定 `Asia/Shanghai`

这条路径最简单，也最贴近当前线上行为。

## 4. 交付物

### 4.1 Dockerfile

建议要点：

- 基础镜像：`node:24-bookworm-slim`（与当前 Node 版本策略一致）
- 启用 `corepack` + `pnpm@10.33.2`
- 先复制 `package.json`/`pnpm-lock.yaml` 安装依赖，再复制源码
- 默认 `CMD ["pnpm", "start:bot"]`

### 4.2 docker-compose.yml

建议要点：

- 服务名：`notinews-bot`
- `env_file: .env`
- `environment: TZ=Asia/Shanghai`
- `volumes: ./data:/app/data`
- `restart: unless-stopped`

### 4.3 .dockerignore

排除：

- `node_modules`
- `.git`
- `doc`
- 本地临时文件

### 4.4 deploy 脚本（可选）

增加 `deploy/docker-up.sh`，行为：

1. 检查 `.env` 是否存在
2. `docker compose up -d --build`
3. 打印 `docker compose ps`
4. 打印最近日志 `docker compose logs --tail=100 notinews-bot`

## 5. 环境变量与配置

保持与当前一致，容器内通过 `.env` 注入：

- `TG_TOKEN`
- `TG_CHAT_ID`
- `DEEPSEEK_API_KEY`
- 其他现有变量（天气等）

注意：

- 不把 `.env` 写入镜像
- 仅在服务器本地保存 `.env`

## 6. 数据持久化策略

必须持久化 `./data`，否则容器重建会丢失：

- 提醒数据
- 循环规则
- AV 推送去重记录
- AV 源站健康状态

建议新增备份脚本（宿主机）：

- 每日打包 `data/notinews.sqlite`
- 保留最近 7-14 天

## 7. 部署流程（新服务器）

1. 安装 Docker + Compose
2. 拉取项目代码
3. 写入 `.env`
4. 执行：
   ```bash
   docker compose up -d --build
   ```
5. 验证：
   ```bash
   docker compose ps
   docker compose logs --tail=100 notinews-bot
   ```

## 8. 升级流程

1. `git pull`
2. `docker compose up -d --build`
3. 观察日志是否恢复到：
   - `Fixed jobs registered.`
   - `Bot started. Long polling for updates...`

## 9. 最小验收清单

1. 容器状态为 `Up`
2. Telegram 可响应 `/help`
3. 手动命令 `/fetchav` 可返回结果
4. 重启 Docker 后服务自动恢复
5. `data/notinews.sqlite` 在宿主机可见且持续增长

## 10. 风险与规避

1. **风险：容器时区错误导致调度偏移**  
   规避：`TZ=Asia/Shanghai` 必须设置

2. **风险：数据目录未挂载导致丢库**  
   规避：强制 `./data:/app/data`

3. **风险：镜像更新后依赖变化**  
   规避：锁定 `pnpm-lock.yaml`，按 lockfile 构建

4. **风险：源站偶发 503**  
   规避：沿用现有 AV 健康告警机制（已实现）

## 11. 后续可扩展项

1. 接入 GHCR 自动构建镜像，服务器仅 pull+up
2. 加入 `healthcheck`（检测进程与 Telegram 拉取状态）
3. 增加一条 `/ops` 指令返回运行状态摘要（可选）

