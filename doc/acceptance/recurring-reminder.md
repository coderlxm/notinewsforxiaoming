# 循环提醒功能验收清单

## Phase 1：数据层与调度层

- [ ] `recurring_reminder_rules` 表结构正确，包含 `rrule_text`、`next_trigger_at`、`status` 及必要索引
- [ ] `recurring_reminder_runs` 表结构正确，包含 `rule_id`、`trigger_at`、`action` 及必要索引
- [ ] `buildRRuleText()` 能正确生成 RFC 字符串：DAILY / WEEKLY / MONTHLY
- [ ] `getNextTrigger()` 能基于 rrule_text 正确计算下一次触发时间
- [ ] 创建循环规则后，`scheduleRecurringRule()` 注册单次 job
- [ ] 触发后自动计算并持久化 `next_trigger_at`，重新注册下一次 job（不注册无限循环）
- [ ] `schedulePendingRecurringRules()` 启动恢复：重新计算 next_trigger_at，若与库中不一致则更新，重新注册 job
- [ ] `cancelRecurringJob()` 正确移除 job
- [ ] `findRecurringRuleById` / `findActiveRecurringRules` / `findActiveRecurringByChatId` CRUD 正确

## Phase 2：固定输入（命令格式）

- [ ] `/remind every day 22:00 做俯卧撑` → 创建 DAILY 规则，返回 `[固定]` 标签、规则描述、下次触发时间
- [ ] `/remind every week mon,wed,fri 20:30 训练` → 创建 WEEKLY 规则，byweekday = [MO, WE, FR]
- [ ] `/remind every month 1 09:00 交房租` → 创建 MONTHLY 规则，bymonthday = [1]
- [ ] 无参数 `/remind` 仍正常显示一次性提醒列表
- [ ] 非法循环输入返回明确错误（如日期超出范围、星期拼写错误）
- [ ] 创建成功回执带 `暂停循环` / `取消循环` 按钮
- [ ] 点击 `暂停循环` → 规则状态变为 paused，job 取消，按钮清除
- [ ] 点击 `取消循环` → 规则状态变为 cancelled，job 取消，按钮清除

## Phase 3：AI 自然语言解析

- [ ] `每天晚上10点提醒我做俯卧撑` → AI 返回 DAILY 规则，zod 校验通过，入库 `[AI]` 标签
- [ ] `每周一三五晚上八点半提醒我训练` → AI 返回 WEEKLY 规则
- [ ] 非法 AI JSON（缺少必填字段、freq 非法等）→ zod 校验失败，返回 `没有识别到有效的循环提醒格式。`，不入库
- [ ] AI 解析循环提醒时不影响现有一次性自然语言提醒

## 交互行为

- [ ] 循环提醒到点触发 → 发送 `循环提醒时间到` + 内容，带 `已完成` / `跳过本次` / `停止循环` 按钮
- [ ] 点击 `已完成` → 更新 run 记录为 done，编辑消息为 `已完成本次循环提醒。`
- [ ] 点击 `跳过本次` → 更新 run 记录为 skip，编辑消息为 `已跳过本次循环提醒。`
- [ ] 点击 `停止循环` → 规则状态变为 cancelled，job 取消
- [ ] 暂停/取消后，创建回执消息上的按钮被清除

## 兼容性

- [ ] 一次性提醒 `/remind 10m 收衣服` 功能不受影响
- [ ] 一次性自然语言 `10分钟后提醒我收衣服` 功能不受影响
- [ ] 提醒列表 `/remind`（无参数）功能不受影响
- [ ] 一次性提醒的按钮（已完成/取消/推迟5分钟）功能不受影响

## 时间与时区

- [ ] 所有循环提醒统一使用 `Asia/Shanghai` 时区
- [ ] `next_trigger_at` 正确推进（不早于当前时间）
- [ ] “提醒我每个工作日的下午3点吃药”创建 `calendar_filter=china_workday` 的每日 15:00 规则
- [ ] 中国法定节假日不触发工作日循环提醒
- [ ] 周末调休补班正常触发工作日循环提醒
- [ ] 缺少对应年份中国工作日日历时直接报错，不按周一至周五降级
- [ ] 普通“每周一至周五”规则不使用中国工作日日历过滤
- [ ] `src/reminders/recurring.ts` 的 `rrule` 导入及加载方式保持不变

## 启动恢复

- [ ] 进程重启后，`schedulePendingRecurringRules()` 正确恢复所有 active 规则
- [ ] `next_trigger_at` 过期或偏差时自动修正
