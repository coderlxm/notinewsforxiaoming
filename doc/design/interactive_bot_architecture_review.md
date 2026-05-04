# Interactive Bot 架构方案 Review

Review 对象：`doc/design/interactive_bot_architecture.md`  
Review 时间：2026-05-03（Asia/Shanghai）

## 总体结论

这个方向是成立的：如果目标是“自然语言提醒、按钮交互、临时任务管理”，当前一次性任务模型确实不够用，最终需要一个常驻 bot 进程和持久化存储。

但原方案里“把现有固定推送也全部迁入 Node 内部定时器”风险偏高。当前项目最稳定的部分正是 systemd timer 准点触发，一次性执行、容易观察、容易恢复。建议不要在第一阶段直接替换它，而是采用“双进程/双入口过渡架构”：固定推送继续由 systemd timer 驱动，交互式提醒由常驻 bot 独立负责。

## 主要不足与风险

### 1. 一次性推送和常驻交互职责混在一起

当前设计计划让 `pnpm start` 变成常驻进程，并把固定推送迁入 `node-schedule`。这会把两类性质不同的工作耦合：

- 固定推送：准点、短生命周期、失败后下次可恢复。
- 交互 bot：长生命周期、需要状态、需要处理 Telegram update。

如果放进一个进程，任何一类问题都会影响另一类。例如 bot polling 卡死、内存泄漏、AI 请求阻塞，都可能影响固定推送。

建议：
- 保留当前 `src/index.ts` 作为一次性任务入口。
- 新增 `src/bot.ts` 作为常驻交互入口。
- `pnpm start` 继续代表一次性推送。
- 新增 `pnpm bot` 启动常驻 bot。

### 2. 不建议第一阶段把 systemd timer 替换成 node-schedule

现有 systemd timer 已经解决了 GitHub Actions 延迟问题，并且有真实线上验证。迁到 `node-schedule` 后会引入新问题：

- Node 进程挂掉时所有固定推送停止。
- 部署重启窗口可能错过触发。
- 进程时区、宿主机时区、容器时区需要额外治理。
- 调试要从 `journalctl + list-timers` 变成应用内日志追踪。

建议：
- 固定推送继续沿用 systemd timer。
- 动态提醒才由常驻 bot + DB + 内部调度处理。
- 等交互功能稳定后，再评估是否有必要统一调度中枢。

### 3. 动态提醒不能只依赖内存调度器

原文提到“入库 + 加入内存调度器”，方向对，但需要强调恢复机制，否则重启后虽然 DB 有记录，内存任务不会自动恢复。

建议设计中明确：
- bot 启动时扫描 DB 中 `pending` 且 `trigger_time > now` 的提醒，重新注册调度。
- 对 `trigger_time <= now` 的 pending 提醒做补偿处理（立即提醒或标记 missed，并告知用户）。
- 每次触发前重新读取 DB 状态，避免已取消任务仍被触发。

### 4. 自然语言时间解析需要可靠兜底

DeepSeek 解析“明天下午三点”“下周一早上”“十分钟后”可行，但不能完全信任模型输出。

建议设计中增加：
- 当前时间必须注入北京时间和 ISO 时间。
- 模型只输出 JSON，不允许自然语言。
- 使用 schema 校验结果。
- 解析出的时间必须是未来时间。
- 低置信或模糊表达要二次确认，例如：“你是指明天 15:00 吗？”

### 5. Telegram 交互需要补充 update 与按钮处理设计

文档提到了 inline button，但缺少 callback data 的约束设计。

建议：
- callback data 使用稳定格式，例如：
  - `reminder:done:<id>`
  - `reminder:snooze:<id>:5m`
  - `reminder:cancel:<id>`
- 所有 callback 都要校验 `chat_id`。
- 点击按钮后需要更新原消息或追加确认，避免重复点击造成状态混乱。

### 6. SQLite 选型合理，但缺少部署与备份策略

SQLite 适合个人 bot，但需要明确文件位置和备份方式。

建议：
- DB 文件放到 `data/notinews.sqlite` 或服务器持久化目录。
- `.gitignore` 忽略 SQLite 文件。
- deploy 同步不能删除 DB。
- 容器化后 DB 必须挂 volume。

### 7. 需要保留测试直达能力

当前项目已有 `TEST_MODE_ENABLED + TEST_FORCE_MODE`，对新增功能验证很有用。常驻 bot 改造时不要破坏它。

建议：
- 一次性推送入口继续支持测试直达。
- bot 入口可以增加 `/test fitness` 或仅本地 CLI 测试命令，但不要把测试能力混进普通用户对话流。

## 推荐改造路线

### Phase 1：拆入口，不改现有固定推送

目标：零影响上线交互进程。

- 保留 `src/index.ts` 和 systemd timer。
- 新增 `src/bot.ts`，只负责 Telegram long polling。
- 新增 `pnpm bot`。
- 新增 `notinews-bot.service`，作为常驻服务。
- 先实现 `/ping`、权限校验、启动/停止验证。

### Phase 2：提醒数据库与命令式提醒

目标：先不用 AI，保证提醒链路可靠。

- 引入 SQLite。
- 实现命令：
  - `/remind 10m 收衣服`
  - `/remind 2026-05-04 15:00 开会`
  - `/reminders`
  - `/cancel <id>`
- 实现启动恢复 pending 任务。
- 实现按钮：完成、稍后 5 分钟、取消。

### Phase 3：接入自然语言解析

目标：把“提醒我 10 分钟后收衣服”接到稳定提醒链路。

- DeepSeek 只负责把自然语言解析为结构化 JSON。
- 解析后先生成确认消息。
- 确认后入库并调度。

### Phase 4：评估是否统一调度

只有当交互进程长期稳定后，再评估是否迁移固定推送到应用内调度。当前不建议作为早期目标。

## 建议补入原设计文档的内容

- 明确保留 systemd timer 作为固定推送调度，至少在前期不迁移。
- 增加 `src/index.ts` 与 `src/bot.ts` 双入口设计。
- 增加 `notinews.service` 与 `notinews-bot.service` 的分工。
- 增加 SQLite 启动恢复、补偿触发、取消状态检查。
- 增加自然语言解析的 schema 校验与二次确认。
- 增加 callback data 规范。
- 增加 DB 文件持久化和备份策略。

## 不建议现在合并的点

- 不建议立即把所有固定推送迁入 `node-schedule`。
- 不建议让 `pnpm start` 同时承担一次性任务和常驻 bot。
- 不建议一开始就做闲聊、记账、快捷查询等扩展能力。先把提醒链路做稳定。

