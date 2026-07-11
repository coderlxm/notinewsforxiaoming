# 中国工作日循环提醒方案

状态：已实施

## 目标

稳定支持：

```text
提醒我每个工作日的下午3点吃药
```

这里的“工作日”明确指中国法定工作日：

- 普通周一至周五触发。
- 法定节假日不触发。
- 周末调休补班触发。
- 时区固定为 `Asia/Shanghai`。

不把“工作日”简化为周一至周五，也不依赖 AI 自由判断该词的含义。

## 总体设计

保留 RRULE 作为成熟的日期、时区和每日候选时间计算工具，在循环规则上增加业务日历过滤器：

```text
RRULE 每天 15:00 生成候选时间
→ china_workday 日历过滤
→ 取第一个中国工作日
→ 注册单次 node-schedule job
```

普通每日、每周、每月循环不带过滤器，继续走现有 RRULE 主路径。

`src/reminders/recurring.ts` 现有 `rrule` 导入及加载方式不修改。

## 数据模型

在 `recurring_reminder_rules` 增加：

```sql
calendar_filter TEXT
CHECK (calendar_filter IS NULL OR calendar_filter = 'china_workday')
```

语义：

- `NULL`：普通 RRULE。
- `china_workday`：RRULE 生成候选时间后，只接受中国工作日。

工作日提醒仍保存正常的每日 RRULE，例如每天 15:00；不创造私有 cron 或伪 RRULE 格式。

## 稳定解析

### 确定性中文解析

在调用 AI 前增加明确解析规则，覆盖：

```text
提醒我每个工作日的下午3点吃药
每个工作日下午15:00提醒我吃药
每工作日早上9点提醒我打卡
工作日晚上8点提醒我运动
```

解析结果统一为：

```json
{
  "freq": "DAILY",
  "time": "15:00",
  "timezone": "Asia/Shanghai",
  "calendar_filter": "china_workday",
  "text": "吃药"
}
```

中文时间使用成熟日期解析库处理；不手写覆盖任意自然语言的时间解析器。确定性入口只负责识别“工作日”业务意图和抽取提醒正文。

### AI 解析约束

AI schema 增加：

```text
calendar_filter: null | china_workday
```

prompt 明确规定：用户说“工作日”“上班日”时必须输出 `china_workday`，不得输出 `MO..FR` 代替。

Zod 对该字段做严格枚举校验。AI 输出不合法时直接报错，不转换成普通周一至周五规则。

## 下一次触发计算

扩展下一次触发计算接口：

```text
getNextTrigger(rruleText, timezone, after, inclusive, calendarFilter)
```

逻辑：

1. 使用现有 `rrulestr().after()` 获取下一个候选时间。
2. `calendar_filter` 为空时直接返回。
3. `calendar_filter=china_workday` 时调用严格中国工作日判断。
4. 非工作日则从该候选时间之后继续取下一个 RRULE 候选。
5. 返回第一个中国工作日候选。

创建规则、到点后计算下一次、进程重启恢复、按范围展开循环实例，必须全部调用同一套过滤后的计算函数。

## 中国工作日日历硬约束

当前仓库只有：

```text
data/china-holiday-2026.json
```

现有 `isChinaWorkday()` 在缺少年份文件时会退回普通周一至周五，这不满足该功能的稳定语义，也不符合本项目禁止兜底的原则。

为工作日循环提醒增加严格入口：

```text
isChinaWorkdayStrict(date)
```

严格入口要求对应年份的 `data/china-holiday-YYYY.json` 必须存在且结构合法；缺失或非法时直接抛错，不按周一至周五继续计算。

创建工作日提醒时同时确认当前下一次触发涉及年份的日历存在。跨年计算下一次提醒时，如果下一年度日历尚未维护，错误直接暴露，规则不写入错误的下一次时间。

## 调度行为

调度仍采用现有模式：数据库只保存一个 `next_trigger_at`，进程内只注册下一次 job。

触发后：

```text
发送本次提醒
→ 从本次时间之后计算下一个 RRULE 候选
→ 严格过滤中国工作日
→ 更新 next_trigger_at
→ 注册下一次 job
```

不注册无限 cron，不增加重试、fallback 或静默跳过。

## 用户回执

创建成功时展示：

```text
循环：每个中国工作日 15:00
下次：2026-07-13 15:00
内容：吃药
```

循环列表、时间范围查询和取消候选同样显示“每个中国工作日”，避免展示成“每天”。

## 边界

- “每周一到周五”仍是普通 WEEKLY RRULE，不套用法定节假日日历。
- “工作日”固定解释为中国法定工作日，不根据用户位置猜测其他国家。
- 暂不支持“每月第 N 个工作日”“工作日提前一天”等复合规则。
- 不自动下载或推测未来年份法定节假日；年份数据必须明确维护在项目中。

## 修改范围

1. 数据库迁移增加 `calendar_filter`。
2. repository 类型和创建接口保存过滤器。
3. `chinaWorkday.ts` 增加严格日历判断入口。
4. parser 增加确定性工作日语义和严格 AI schema。
5. recurring 下一次时间计算支持日历过滤，但不修改 `rrule` 导入。
6. scheduler、创建入口、范围展开统一传递过滤器。
7. formatter 显示“中国工作日”。
8. 更新循环提醒当前实现与验收文档。
