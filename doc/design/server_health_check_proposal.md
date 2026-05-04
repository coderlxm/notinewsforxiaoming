# 服务器在线状态巡检设计说明

## 1. 当前目标

每天北京时间 `09:10` 检查固定 4 台服务器的在线状态，并将结果推送到 Telegram。

该功能只服务一个明确业务目标：

- 知道 4 台机器是否能从主部署机 SSH 连通
- 如果异常，消息里明确标出是哪台机器异常
- 如果正常，消息里列出 alias、用途、hostname、uptime

不做完整监控系统，不扩展磁盘、内存、Docker、systemd 等指标。

## 2. 固定巡检对象

配置文件：

```text
data/server-health-targets.json
```

当前 4 台机器：

```json
[
  {
    "alias": "bwgdc01",
    "name": "主机",
    "role": "NotiNews 当前主部署机"
  },
  {
    "alias": "bwgdc6",
    "name": "备机",
    "role": "备用服务器"
  },
  {
    "alias": "rndc02",
    "name": "rndc02",
    "role": "服务器"
  },
  {
    "alias": "jp888",
    "name": "jp888",
    "role": "服务器"
  }
]
```

配置里只保存业务展示信息和 SSH alias，不保存密码、私钥或完整连接串。

## 3. 线上 SSH 前提

线上执行环境是主部署机 `bwgdc01`。

主部署机已配置：

- `/root/.ssh/config`
- `/root/.ssh/notinews_health_ed25519`
- 4 台目标机器的 `authorized_keys`

巡检使用主部署机上的专用 SSH key，不复制本地 Mac 私钥。

主部署机需要能直接执行：

```bash
ssh bwgdc01 'hostname && uptime -p'
ssh bwgdc6 'hostname && uptime -p'
ssh rndc02 'hostname && uptime -p'
ssh jp888 'hostname && uptime -p'
```

## 4. 代码实现

### 4.1 Service

实现文件：

```text
src/services/serverHealth.ts
```

职责：

- 读取 `data/server-health-targets.json`
- 对每个 alias 执行 SSH 探测
- 收集 `hostname`、`uptime`、异常原因
- 返回结构化结果

SSH 命令通过 Node `spawnSync` 执行：

```bash
ssh \
  -o BatchMode=yes \
  -o PreferredAuthentications=publickey \
  -o GSSAPIAuthentication=no \
  -o ConnectionAttempts=1 \
  -o ConnectTimeout=8 \
  -o ServerAliveInterval=3 \
  -o ServerAliveCountMax=1 \
  -o LogLevel=ERROR \
  <alias> 'hostname && uptime -p'
```

当前实现是同步探测，避免异步子进程在服务器 `tsx + ssh` 环境下出现进程不收口的问题。

### 4.2 Formatter

实现文件：

```text
src/formatters/index.ts
```

函数：

```ts
formatServerHealthMessage(results)
```

消息格式使用 Telegram HTML：

- 全部正常：`🟢 服务器巡检正常`
- 存在异常：`🔴 服务器巡检发现异常`
- 每台机器展示 alias、名称、用途、状态、hostname、uptime 或异常原因

### 4.3 入口模式

实现文件：

```text
src/index.ts
```

新增模式：

```ts
server_health
```

固定业务时间：

```ts
SPECIAL_SCHEDULE.server_health = 9 * 60 + 10
```

本地/线上测试直达：

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=server_health pnpm start
```

## 5. Telegram 发送路径

实现文件：

```text
src/publishers/telegram.ts
```

Telegram 发送必须保持使用 `Telegraf`。

服务器上曾出现 Node/Telegraf 默认网络路径不稳定的问题。最终有效修复是给 Telegraf 配置 IPv4 agent：

```ts
const telegramAgent = new https.Agent({
  family: 4,
  keepAlive: false
});
```

然后初始化：

```ts
const bot = new Telegraf(config.tgToken, {
  telegram: {
    agent: telegramAgent
  }
});
```

不要把 Telegram 发送改成 `curl`、Node `fetch`、重试、多通道发送或其他兜底方案。

## 6. 线上调度

线上真实调度由 `systemd timer` 执行。

规则文件：

```text
/etc/systemd/system/notinews.timer
```

已增加：

```ini
OnCalendar=*-*-* 09:10:00 Asia/Shanghai
```

仓库记录同步在：

```text
doc/SERVER_SCHEDULE_RULES.md
```

部署成功通知里的“下次模式”映射同步在：

```text
.github/workflows/deploy.yml
```

## 7. 验证记录

已验证：

- 主部署机可 SSH 连接 4 台目标机器
- 主部署机单独调用 `checkServerHealth()` 可返回 4 台在线
- 本地 `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=server_health pnpm start` 可发送成功
- 主机线上 `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=server_health pnpm start` 可发送成功

线上成功日志：

```text
Mode: Server Health Check
Successfully sent message to Telegram.
Task finished.
```

## 8. 排查顺序

如果后续 `server_health` 没有按预期推送，按以下顺序排查：

1. 在主部署机上单独执行 4 条 SSH 命令，确认 alias 和 key 正常
2. 在主部署机项目目录单独调用 `checkServerHealth()`，确认巡检 service 正常
3. 执行 `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=server_health pnpm start`，确认完整链路正常
4. 检查 `notinews.timer` 是否包含 `09:10 Asia/Shanghai`

不要在没有拆分验证前直接添加兜底、重试或替代实现。
