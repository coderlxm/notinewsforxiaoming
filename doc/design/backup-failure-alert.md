# NotiNews 备份异常告警实现方案

## 目标

每天检查 `bwgdc01` 和 `rndc02` 上一次计划执行的备份结果。如果任一备份没有在当天的备份窗口内成功完成，就通过现有 Telegram Bot 发送一条告警；正常时、恢复时以及同一故障持续存在时都保持安静，避免重复打扰。

## 当前实现依据

- 常驻 Bot 运行在 `bwgdc01`，入口是 `src/resident.ts`。
- Telegram 发送已经集中在 `src/publishers/telegram.ts`，使用现有的 `TG_TOKEN` 和 `TG_CHAT_ID`。
- 固定任务集中注册在 `src/scheduled/jobs.ts`，使用 `Asia/Shanghai` 时区。
- `src/services/serverHealth.ts` 已经提供从 `bwgdc01` 通过 SSH 探测服务器的模式，并使用 `/root/.ssh/notinews_health_ed25519`。
- `bwgdc01` 的备份服务是 `notinews-backup.service`，备份目录是 `NotiNewsBackups/bot`。
- `rndc02` 的备份服务是 `journal-backup.service`，备份目录是 `NotiNewsBackups/journal`。
- 两个备份定时器都在每天北京时间 04:50 触发，备份脚本成功时 systemd 的 oneshot 服务会返回 `Result=success` 和退出状态 `0`。

## 推荐方案

让 `bwgdc01` 上运行的常驻 Bot 作为唯一监控端，在每天北京时间 05:10 执行一次备份状态检查。这个时间点留出备份完成和容器恢复的时间，同时不需要在 `rndc02` 上安装 Telegram 凭据或新增通知服务。

### 监控目标配置

新增 `data/backup-health-targets.json`，只记录这两个目标：

- `bwgdc01`：主机地址、显示名、`notinews-backup.service`、`notinews-backup.timer`。
- `rndc02`：主机地址、显示名、`journal-backup.service`、`journal-backup.timer`。

把服务名和定时器名称放在配置中，避免把两台机器的差异散落在检查逻辑里。主机连接继续复用现有的健康检查 SSH 密钥和 SSH 连接参数。

### 检查逻辑

新增一个小型备份状态服务，例如 `src/services/backupHealth.ts`。每个目标只执行一次只读 SSH 查询，读取对应定时器和服务的 systemd 状态：

1. 定时器仍处于启用并等待下一次触发的状态。
2. 服务最近一次结果是 `success`。
3. 服务最近一次退出状态是 `0`。
4. 最近一次退出时间换算到北京时间后属于当天，并且发生在 04:50 之后。

第 4 条用于识别“定时器没有触发”或“沿用了昨天的成功状态”。不能只判断 `ActiveState`，因为成功的 oneshot 服务执行完后本来就是 `inactive/dead`。

SSH 超时、连接失败、systemd 查询失败、服务结果异常、退出状态非零或执行日期不符，都视为该目标异常。检查只读状态，不检查或修改备份文件，也不自动重跑备份。

### Telegram 告警

新增备份告警格式化函数，并继续调用现有的 `sendTelegramMessage`：

```text
⚠️ 备份异常告警

❌ rndc02 Journal 备份
状态：执行失败
最近执行：2026-09-06 04:50
原因：systemd 结果或 SSH 错误
```

同一轮检查只发送一条消息，消息中只列出异常目标，不列出正常目标。全部正常时不发送消息，也不发送恢复消息。异常原因来自 SSH 或 systemd 的实际返回值，并通过现有的 Telegram HTML 转义处理。

### 告警去重

在 Bot 的 `data/` 目录保存两个目标最近一次的告警状态。检查发现新的异常时，先发送一条汇总告警，再记录该异常已经通知；后续检查如果仍是同一故障则不再发送。目标恢复正常时静默清除对应状态，之后再次失败时重新发送一条告警。

告警状态只记录目标和异常是否已经通知，不保存 SSH 输出、令牌或备份内容。它是一个很小的运行时状态文件，不引入数据库或复杂状态机。

### 调度接入

在 `registerFixedJobs` 中增加一个北京时间 05:10 的任务。该任务调用备份检查服务；发现异常时格式化并发送告警。现有 09:10 服务器巡检保持原行为，不把备份状态混入每日服务器巡检正文，避免改变已有消息的主路径。

## 预计代码范围

- 新增 `src/services/backupHealth.ts`：目标读取、SSH 查询和结果归一化。
- 新增 `data/backup-health-targets.json`：两台机器及服务映射。
- 修改 `src/scheduled/jobs.ts`：增加一次每日备份检查调度。
- 修改 `src/formatters/index.ts`：增加备份异常告警消息格式。

不修改两个备份脚本、systemd 备份服务、systemd 定时器、Telegram 配置或 Google Drive 授权。现有 `src/services/serverHealth.ts` 保持不变，除非实现时发现必须抽取公共 SSH 查询代码；当前方案不预设这一步。

## 触发结果

- 两台备份都在当天成功：不发消息，并静默清除此前的异常状态。
- 一台首次失败或没有当天执行记录：发一条消息，只指出具体机器和原因。
- 两台都首次失败：仍只发一条汇总消息。
- 同一故障连续多天未修复：不重复发送。
- 故障恢复：不发送恢复消息；之后再次失败时重新告警。
- 备份服务执行成功但定时器或最近执行时间异常：发消息，避免只依赖服务退出码。
- Bot 自身停止：沿用现有 `notinews-failure-notify@.service` 的服务失败通知；备份告警功能不新增另一条发送通道。

## 有意保持的边界

本方案只做定时状态告警，不加入重试、自动修复、备用通知通道或 Google Drive 二次扫描。告警去重只保留每个目标的一项本地状态，让同一故障只提醒一次，并让失败原因直接回到对应机器的 systemd 和备份日志中。
