# 成熟库 / 最新实现替代整改验收报告

## 范围

本次只覆盖复查报告里的前两项整改：

- 日期 / 时区处理统一收敛到 `src/utils/time.ts`
- SQLite schema 迁移从分散探测改为显式迁移入口

## 必须覆盖的功能点

### 1. 日期 / 时区统一

- [ ] `src/utils/time.ts` 提供统一的北京时间工具：`bjDate`、`shiftBjDate`、`diffBjDays`、`isBjWeekend`、`getChinaDayOfWeek(input?)`
- [ ] `src/calendar/chinaWorkday.ts` 不再手写 `Intl.DateTimeFormat(...).formatToParts(...)` 拼 `YYYY-MM-DD`
- [ ] `src/calendar/chinaWorkday.ts` 的工作日判断改为复用 `bjDate(date)` 和 `getChinaDayOfWeek(date)`
- [ ] `src/calendar/countdown.ts` 不再手写 `Date.UTC` 做日期差值和日期加减
- [ ] `src/calendar/countdown.ts` 的 `today`、节假日倒计时、GTA6 倒计时、周末判断全部走共享时间工具
- [ ] `src/services/vitaminReminder.ts` 的当天 `date_key` 改为统一使用 `bjDate()`
- [ ] `src/services/fitness.ts` 的 `last_workout_date` 改为统一使用 `bjDate()`
- [ ] `src/services/v2exBufferedPush.ts` 的节假日缓冲批次日期改为统一使用 `bjDate(date)`

### 2. SQLite 显式迁移机制

- [ ] `src/reminders/db.ts` 启动数据库时只保留建表和统一迁移入口，不再内联分散的 schema 探测 SQL
- [ ] `src/reminders/migrations.ts` 作为唯一迁移入口，按版本顺序维护迁移列表
- [ ] 数据库版本使用 `PRAGMA user_version` 记录，而不是靠业务层重复探测当前列是否存在
- [ ] 新建库时，`vitamin_reminders` 基础表结构直接包含 `count`、`eaten`、`loop_active`、`next_trigger_at`
- [ ] 老库启动时，`push_history` 缺少 `cover_sent` 列会通过迁移补齐
- [ ] 老库启动时，`vitamin_reminders` 缺少 `eaten`、`loop_active`、`next_trigger_at` 会通过迁移补齐
- [ ] 老库启动时，旧版 `tracked_targets` 表结构会通过单独迁移重建为当前结构
- [ ] `src/services/vitaminReminder.ts` 不再承担运行时补列职责，业务逻辑和 schema 演进解耦

## 本次代码落点

- [ ] [src/utils/time.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/utils/time.ts)
- [ ] [src/calendar/chinaWorkday.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/calendar/chinaWorkday.ts)
- [ ] [src/calendar/countdown.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/calendar/countdown.ts)
- [ ] [src/services/vitaminReminder.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/services/vitaminReminder.ts)
- [ ] [src/services/fitness.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/services/fitness.ts)
- [ ] [src/services/v2exBufferedPush.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/services/v2exBufferedPush.ts)
- [ ] [src/reminders/db.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/reminders/db.ts)
- [ ] [src/reminders/migrations.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/reminders/migrations.ts)
