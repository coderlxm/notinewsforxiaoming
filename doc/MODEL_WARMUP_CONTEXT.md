# NotiNews 项目上下文预热（给后续模型）

最后更新：2026-05-03（Asia/Shanghai）

## 1) 项目目标与运行方式

- 项目是一个按北京时间多时点推送 Telegram 消息的任务系统。
- 执行入口：`src/index.ts`（一次执行只推送一个 mode）。
- 调度方式：**服务器 systemd timer** 触发 `notinews.service`（非 GitHub Actions 定时）。
- 服务端部署目录：`/root/NotiNewsForXiaoming`。

## 2) 线上触发规则（真实 Source of Truth）

以服务器 `/etc/systemd/system/notinews.timer` 为准：

```ini
OnCalendar=*-*-* 08:30:00 Asia/Shanghai
OnCalendar=*-*-* 09:55:00 Asia/Shanghai
OnCalendar=*-*-* 10:30:00 Asia/Shanghai
OnCalendar=Sat *-*-* 14:00:00 Asia/Shanghai
OnCalendar=*-*-* 15:00:00 Asia/Shanghai
OnCalendar=*-*-* 16:00:00 Asia/Shanghai
OnCalendar=*-*-* 20:00:00 Asia/Shanghai
OnCalendar=Mon,Wed *-*-* 20:30:00 Asia/Shanghai
OnCalendar=*-*-* 21:00:00 Asia/Shanghai
OnCalendar=*-*-* 00:10:00 Asia/Shanghai
```

## 3) 业务模式映射（`src/index.ts`）

- `00:10` -> `Midnight Sleep Reminder`
- `08:30` -> `Morning Wake-up`
- `09:55` -> `Morning News`
- `14:00`（仅周六）-> `Fitness Coach`
- `15:00` -> `Afternoon Github Trending`
- `20:00` -> `Evening V2EX Hot Topics`
- `20:30`（仅周一、周三）-> `Fitness Coach`
- 其他触发点（如 `10:30/16:00/21:00`）-> `Daily English Teacher`

重要：周几判定必须按北京时间，不可直接用服务器本地 `getDay()`。

## 4) 已修复的关键坑（高频回归点）

1. **时区日期错误（消息显示前一天）**
- 症状：北京时间已到新一天，消息标题还显示昨天。
- 根因：`toLocaleDateString('zh-CN')` 使用服务器本地时区。
- 修复：`src/formatters/index.ts` 统一 `chinaDateLabel()`（`Asia/Shanghai`）。

2. **周几误判导致功能错过触发**
- 症状：周几规则（如健身）不按预期触发。
- 根因：服务器在 PDT，`new Date().getDay()` 是本地周几。
- 修复：`src/index.ts` 使用“北京时间推导周几”。

3. **Telegram 解析失败（can't parse entities）**
- 症状：日志报 400，消息没到达。
- 根因：动态文本混入不安全 Markdown 实体。
- 修复：
  - 发送改为 `parse_mode: HTML`；
  - 动态内容统一转义；
  - 发送失败自动降级纯文本重发（`src/publishers/telegram.ts`）。

4. **Type-only import 导致运行时崩溃**
- 症状：`does not provide an export named ...`
- 根因：TS 类型被当成运行时导入。
- 修复：`import type`（如 `EnglishContent/GameNews/V2exTopic`）。

5. **倒计时假期识别错误（显示“节假日”或不显示“享受假期中”）**
- 根因：仅按 `holiday_overrides` 连续性，未覆盖假期中间周末。
- 修复：`src/calendar/countdown.ts` 基于日历构造“非工作日假期段”，正确覆盖完整假期。

## 5) 关键业务细节（避免误改）

- 周末/非工作日 `Morning Wake-up`：隐藏“出门相关提示”（雨天带伞、阴天可能有雨）。
- 08:30 现在是**每天触发**（不是工作日限定）。
- V2EX 总结 prompt 已加入推广/引流内容过滤要求。
- 健身计划：
  - 标题包含“日期 + 星期”；
  - 居家方案判定仅依据“雨”，不再把“阴”视作恶劣天气。

## 6) 与部署相关的文件

- 业务入口：`src/index.ts`
- AI 生成：`src/ai/deepseek.ts`
- 格式化：`src/formatters/index.ts`
- 发送：`src/publishers/telegram.ts`
- 日历：`src/calendar/chinaWorkday.ts`、`src/calendar/countdown.ts`
- 节假日数据：`data/china-holiday-2026.json`
- Deploy Workflow：`.github/workflows/deploy.yml`
- 线上规则文档：`doc/SERVER_SCHEDULE_RULES.md`

## 7) 排查命令（服务器）

```bash
ssh bwgdc01 'systemctl cat notinews.timer --no-pager'
ssh bwgdc01 'systemctl list-timers notinews.timer --no-pager'
ssh bwgdc01 'systemctl status notinews.service --no-pager -l'
ssh bwgdc01 'journalctl -u notinews.service -n 120 --no-pager'
```

## 8) 修改调度后的标准动作

1. 编辑 `/etc/systemd/system/notinews.timer`
2. 执行：
```bash
ssh bwgdc01 'systemctl daemon-reload && systemctl restart notinews.timer'
```
3. 回读确认：
```bash
ssh bwgdc01 'systemctl cat notinews.timer --no-pager'
```
4. 同步更新：
- `doc/SERVER_SCHEDULE_RULES.md`
- `.github/workflows/deploy.yml` 的“下次模式”映射（避免提示错乱）。
