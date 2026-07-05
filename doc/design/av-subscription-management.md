# AV 订阅管理命令设计

## 1. 目标

让 AV 订阅不再依赖改代码或手写 SQL。

用户应当能直接在 Telegram 里完成：

- 添加 JavBus 女优订阅
- 添加 JavBus 系列订阅
- 添加 JavBus 製作商订阅
- 添加 JavBus 發行商订阅
- 查看当前 AV 订阅列表
- 删除不再需要的订阅

同时保持两个约束：

- 不改现有 AV 抓取主路径
- 不在定时 `av_update` 上引入明显额外性能损耗

## 2. 当前问题

现有 AV 抓取主链路本身已经支持从 `tracked_targets` 表读取多条记录：

- `src/services/avTracker.ts` 会遍历 `findTrackedTargets()`
- `tracked_targets` 已经是独立表，不是硬编码数组

真正不方便的点是“入口缺失”：

- 没有 Telegram 命令来增删 `tracked_targets`
- `tracked_targets.target_type` 当前只允许 `star` / `label`
- 现有实现里 `target_type` 同时承担“RSS 路由类型”和“发送策略分支”两个角色

结果就是：

- 新增别的女优要改数据库或代码
- 新增系列或製作商订阅还需要先改表约束和路由逻辑

## 3. 方案选择

本次采用 **Telegram 命令管理**，不做配置文件方案，也不做一次性导入方案。

选择原因：

- 最符合这个 bot 现有使用方式，和 `/watch`、`/fetchav` 风格一致
- 日常增删订阅时不需要登录服务器
- 对运行时性能影响最小，因为命令管理只在“配置变化时”触发，不进入每次定时抓取

## 4. 设计结论

### 4.1 命令入口

新增一组统一命令：

- `/avsub`
- `/avsub add <javbus_url>`
- `/avsub list`
- `/avsub remove <id>`

首版只支持完整 JavBus URL，不支持自然语言搜索，不支持名称模糊匹配。

支持的 URL 形态：

- `https://www.javbus.com/star/<id>`
- `https://www.javbus.com/series/<id>`
- `https://www.javbus.com/studio/<id>`
- `https://www.javbus.com/label/<id>`

这样做的原因很直接：

- 用户添加时最容易从浏览器直接复制链接
- 解析逻辑简单，不需要额外搜索接口
- 不会把“订阅管理”变成一个重交互系统

### 4.2 命令行为

#### `/avsub`

无参数时返回简短帮助：

- 支持的 URL 类型
- 添加示例
- 列表和删除示例

#### `/avsub add <javbus_url>`

行为：

1. 解析 URL，提取 `target_type` 和 `target_id`
2. 校验只允许 `star` / `series` / `studio` / `label`
3. 组装 RSS 路由并请求本地 RSSHub
4. 用 RSS 返回结果确定订阅名称
5. 写入 `tracked_targets`

成功返回示例：

- `已添加 AV 订阅：木下凛々子 [star]`
- `已添加 AV 订阅：学級委員の僕だけが知る生徒指導・○○先生の裏の顔。 [series]`
- `已添加 AV 订阅：S1 NO.1 STYLE [studio]`
- `已添加 AV 订阅：Madonna [label]`

重复添加时直接报错，不做静默忽略。

URL 无效、RSS 路由无效、RSS 读不到名称时直接报错，不做兜底。

#### `/avsub list`

返回当前所有 AV 订阅，按 `id ASC` 排序，并展示：

- 数据库 id
- 名称
- 类型
- 对应 JavBus URL

示例：

```text
AV 订阅列表
1. 木下凛々子 [star]
   https://www.javbus.com/star/vwq
2. 学級委員の僕だけが知る生徒指導・○○先生の裏の顔。 [series]
   https://www.javbus.com/series/12f9
3. S1 NO.1 STYLE [studio]
   https://www.javbus.com/studio/ne
4. Madonna [label]
   https://www.javbus.com/label/7l
```

删除命令直接使用这里展示的 id。

#### `/avsub remove <id>`

按数据库 id 删除订阅。

成功时直接返回被删除的名称和类型。

如果 id 不存在，直接报错。

首版删除只移除 `tracked_targets` 记录，不回收历史 `push_history` / `push_batch_history` 数据。

这样可以保持数据库改动最小，也避免误删历史去重信息。

## 5. 数据模型调整

### 5.1 `tracked_targets` 支持 `series` 和 `studio`

当前表结构里 `target_type` 有 SQLite `CHECK (target_type IN ('star', 'label'))`。

要支持系列和製作商订阅，必须调整这部分约束。

建议这次顺手把 `target_type` 的数据库级 `CHECK` 去掉，保留为普通 `TEXT NOT NULL`。

原因：

- 这个表只由 bot 命令写入
- 真正的输入约束在命令解析层
- 如果后面再支持别的 JavBus 路由，不需要反复重建表

### 5.2 迁移方式

由于 SQLite 不能直接改已有 `CHECK`，需要重建 `tracked_targets` 表。

迁移原则：

- 保留现有 `id`
- 保留现有数据
- 保留唯一索引 `idx_tracked_targets_unique`

迁移后结构保持简单：

```sql
CREATE TABLE tracked_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'javbus',
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

`push_history.target_id` 继续关联 `tracked_targets.id`，不需要改字段设计。

## 6. 抓取主链路如何兼容

### 6.1 路由构造

`buildTargetRoute()` 从当前的“手写分支”改成支持四种类型：

- `star -> javbus/star/:id`
- `series -> javbus/series/:id`
- `studio -> javbus/studio/:id`
- `label -> javbus/label/:id`

不引入更通用的“任意字符串路由”机制。

原因：

- 本次目标是让女优 / 系列 / 製作商 / 發行商可配置
- 没必要为了理论扩展性把运行时做成开放路由系统

### 6.2 推送策略

保持现有分流原则：

- `label` 和 `studio` 继续走“批量摘要”模式
- `star` 和 `series` 走“单条详情推送”模式

这样可以直接复用当前 AV 发送体验，而且性能边界清晰：

- `star` / `series` 只看最新 1 条
- `label` / `studio` 仍然是较重分支，但用户通常不会配置很多

## 7. 性能影响评估

### 7.1 对定时任务的影响

命令管理本身不会增加定时任务额外开销。

`av_update` 每轮新增的只有“订阅条目数量”带来的线性成本，这本来就是订阅功能的自然代价，不是命令管理造成的额外损耗。

### 7.2 为什么不会明显变重

本方案刻意避免了几件会把主链路做重的事：

- 不在每轮抓取时做订阅元数据刷新
- 不在每轮抓取时回查 JavBus 页面来更新名称
- 不加搜索、推荐、自动发现
- 不把 `label`、`studio`、`series`、`star` 统一拉成同一种重处理模式

订阅名称解析只发生在 `/avsub add` 当下，一次写入，后续复用。

### 7.3 性能边界提醒

真正会拉长 AV 检查时间的，不是“命令管理”，而是“订阅数量增加”本身。

因此首版保留两个简单边界：

- `label` / `studio` 订阅继续视为重目标
- `star` / `series` 默认只抓最新 1 条

这已经足够把成本控制在现有模型内。

## 8. 代码落点

建议只改这几处：

- `src/bot/interactive.ts`
  - 注册 `/avsub`
  - 解析 `add/list/remove`
- `src/services/avRepository.ts`
  - 新增增删查订阅的仓储函数
- `src/services/avTracker.ts`
  - 扩展 `buildTargetRoute()`
  - 扩展目标类型分流
- `src/reminders/db.ts`
  - 增加 `tracked_targets` 表迁移逻辑
- `src/reminders/formatter.ts`
  - 更新 `/help` 文案

如果想保持 `interactive.ts` 不继续变胖，可以顺手抽一个轻量模块：

- `src/services/avSubscriptionService.ts`

职责只做三件事：

- 解析 JavBus URL
- 校验并读取 RSS 名称
- 调用 repository 写库

不要在这里塞抓取主流程或推送逻辑。

## 9. 非目标

这次不做：

- Web 管理台
- 批量导入
- 订阅编辑
- JavBus 页面搜索
- 自动识别用户发来的任意文本并转成订阅
- 删除订阅时清理历史推送记录

这些都不影响这次的核心目标，先不引入。

## 10. 最终建议

第一步只把 AV 订阅管理做成一组窄命令：

- `/avsub add <url>`
- `/avsub list`
- `/avsub remove <id>`

并把支持类型扩到：

- `star`
- `series`
- `studio`
- `label`

这样你之后新增女优、系列、製作商、發行商都不需要再改代码，日常操作也和 bot 的其他配置方式一致。

更重要的是，这个方案只改“配置入口”，不改 AV 抓取主路径，因此不会凭空把定时检查做重。
