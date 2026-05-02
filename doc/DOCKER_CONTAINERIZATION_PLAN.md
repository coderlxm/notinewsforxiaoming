# NotiNews 容器化改造方案（最简一键部署版）

## 1. 目标

- 在其他机器上尽可能“一键部署”本项目。
- 部署后行为与当前线上保持一致（触发时间、模式路由、消息内容、异常兜底）。
- 迁移时不引入新的调度不确定性。

## 2. 一致性基线（当前线上）

- 调度由 **systemd timer** 驱动（不是进程内 cron）。
- 时区按 `Asia/Shanghai` 解释触发点。
- 固定触发点：
  - `00:10` 睡觉提醒
  - `08:30` 起床提醒（现已每天）
  - `09:55` 早报
  - `10:30` 英语
  - `15:00` GitHub
  - `16:00` 英语
  - `20:00` V2EX
  - `21:00` 英语
- 其余逻辑由 `src/index.ts` 路由决定。

## 3. 推荐架构（方案 A，唯一实施方案）

采用 **“容器承载业务 + 宿主机 systemd timer 触发容器一次性执行”**：

1. Docker 镜像只负责运行 `pnpm start`（一次性任务）。
2. 宿主机 `notinews.timer` 负责准点触发。
3. `notinews.service` 改为执行 `docker compose run --rm notinews`.

这样可最大程度复刻你当前稳定行为（准点、可观测、可手动触发、日志可查）。

## 4. 改造范围

### 4.1 仓库内新增/调整

1. `Dockerfile`
   - 基于 `node:20-alpine`（或你指定版本）。
   - 安装 `pnpm@10.33.2`。
   - 复制 `package.json/pnpm-lock.yaml` 安装依赖，再复制源码。
   - 默认命令：`pnpm start`。

2. `.dockerignore`
   - 排除 `node_modules/.git/doc/*.md` 等不必要内容。

3. `docker-compose.yml`
   - 服务名：`notinews`
   - `env_file: .env`
   - `environment: TZ=Asia/Shanghai`
   - 使用已构建镜像（支持 tag，如 `ghcr.io/<owner>/notinews:<sha>`）

4. `deploy/install.sh`（一键落地脚本）
   - 安装/检查 Docker 与 Compose
   - 拉取镜像
   - 写入并启用 systemd unit
   - `daemon-reload && enable --now notinews.timer`
   - 输出 `list-timers` 与最近日志

5. `deploy/systemd/notinews.service` 与 `deploy/systemd/notinews.timer`
   - service 调用 `docker compose run --rm notinews`
   - timer 使用当前线上同款 `OnCalendar`

### 4.2 CI/CD（可选但建议）

在 `deploy.yml` 基础上升级为：

1. CI 构建镜像并推送 GHCR（tag=commit sha）。
2. 服务器只做：
   - `docker compose pull`
   - `systemctl restart notinews.timer`
3. Deploy 成功通知保持现有逻辑，并继续携带“下次执行/下次模式”。

## 5. 一键部署体验（目标命令）

新机器上最终只需：

```bash
bash deploy/install.sh
```

前提仅三项：
- 已准备 `.env`
- 机器可访问镜像仓库
- 具备 sudo/systemd 权限

## 6. 与当前行为保持一致的关键点

1. **调度仍用 systemd timer**：避免容器内 cron 引入漂移/生命周期问题。
2. **TZ 固定 `Asia/Shanghai`**：确保日期与文案一致。
3. **一次触发一次容器**：等价当前 oneshot service。
4. **日志链路不变**：
   - `journalctl -u notinews.service`
   - `docker compose logs`（补充）

## 7. 验收清单

1. `systemctl list-timers notinews.timer` 显示 8 个触发点正确。
2. 手动触发成功：
   ```bash
   systemctl start notinews.service
   ```
3. Telegram 收到对应模式消息（按当前时间落到正确分支）。
4. Deploy 通知含“下次执行/下次模式”。
5. 周末 08:30 消息中不出现出门提醒文案（雨/阴提示隐藏规则生效）。

## 8. 风险与边界（仅保留必要项）

1. 若目标机器无 systemd（极简容器系统），此方案不适用。
2. `.env` 未配置或配置错误会导致发送失败，但服务仍会执行。
3. 首次镜像拉取慢属于正常现象，后续增量更新较快。

## 9. 下一步实施建议

按以下顺序落地，避免回滚成本：

1. 先提交容器与 systemd 模板文件（不切流量）。
2. 在一台新机器试运行并完成验收清单。
3. 验收通过后再切主机到容器化执行路径。

