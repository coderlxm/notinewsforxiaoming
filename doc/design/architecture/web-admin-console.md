# Web 管理台方案

## 1. 背景

当前项目已经从“定时推送脚本”扩成一个常驻 Telegram 个人 bot，真实能力包括：

- 一次性提醒 / 循环提醒
- start.gg 选手与赛事监控
- AV 订阅跟踪
- 服务器巡检
- V2EX 节假日缓存推送
- 固定时点主动推送

目前这些能力主要通过 Telegram 聊天交互管理。这个方式在以下场景已经开始吃力：

- `startgg` 需要看“选手 x 项目 x 当前状态 x 最近比分 x 轮询状态”的整体概览
- 提醒需要高频做增删改查、筛选、排序、批量查看
- 后续如果继续扩到 AV、巡检、投递箱等，聊天流会越来越不适合做“管理台”

因此需要尽早把“查看与管理”从 Telegram 聊天流里分离出来，新增一个 Web 管理台承载这部分需求。

## 2. 目标与非目标

## 2.1 目标

第一阶段的 Web 管理台要解决两个最明确的问题：

1. 提供 `startgg` 的结构化概览，而不是继续靠多条文本消息拼状态
2. 提供提醒系统的可视化管理，包括查看、创建、编辑、取消、完成

同时，方案必须为未来扩张留出清晰边界，让后续功能可以继续挂到同一管理台上，而不是再回到 Telegram 命令爆炸。

## 2.2 非目标

第一阶段不做这些：

- 多用户系统
- 对外公开访问
- 复杂角色权限
- Web 版聊天机器人
- 彻底替代 Telegram 交互
- 独立拆成新的 Git 仓库

Web 管理台第一阶段是“个人 bot 的管理后台”，不是一个产品化 SaaS。

## 3. 当前代码事实与约束

方案必须基于当前代码事实，而不是抽象想象：

### 3.1 当前运行时是单常驻进程

主入口是 [src/resident.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/resident.ts)，启动后会同时做这些事：

- 启动 Telegraf long polling
- 恢复一次性提醒调度
- 恢复循环提醒调度
- 注册固定时点任务
- 恢复维生素提醒循环

### 3.2 运行时状态并不全在数据库里

当前有几类关键状态是“数据库 + 进程内内存”混合的：

- 一次性提醒调度 `src/reminders/scheduler.ts`
  - 进程内 `Map<number, schedule.Job>`
- start.gg 轮询状态 `src/scheduled/jobs.ts`
  - `startggPollJob`
  - `startggFastWatchTimer`
- 维生素循环 `src/services/vitaminReminder.ts`
  - `vitaminLoopTimer`

这意味着：

- 如果一个独立进程直接改 SQLite，resident 进程不会自动知道“要立刻重排提醒 / 变更轮询状态”
- 当前项目还没有事件总线、IPC 或 DB watch 机制来同步这些运行时状态

这是本次方案最关键的边界条件。

### 3.3 当前仓库已经适合做同仓分项目

根目录已经有 [pnpm-workspace.yaml](/Users/xiaomingli/Code/NotiNewsForXiaoming/pnpm-workspace.yaml)，说明在同仓内新增一个独立 Web 工程是自然的，不需要先拆多仓。

### 3.4 现有业务逻辑主要卡在 Telegram handler 里

很多核心操作目前直接写在 [src/bot/interactive.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/bot/interactive.ts) 里，例如：

- 创建提醒
- 取消提醒
- start.gg `go`
- start.gg polling on/off
- 手动拉取 start.gg / AV

如果不先抽出共享用例层，Web 管理台只能复制这些逻辑，后面会越来越乱。

## 4. 方案对比

## 4.1 方案 A：继续堆 Telegram 交互

做法：

- 继续增加 `/xxxlist`、`/xxxedit`、`/xxxstatus`、更多 inline button
- 不做 Web

优点：

- 改动最小
- 没有新技术栈

缺点：

- 不能解决“概览”和“高频管理”问题
- 表格、筛选、批量操作、状态面板都很别扭
- 会继续把 [src/bot/interactive.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/bot/interactive.ts) 推向更大的上帝文件

结论：

- 不推荐

## 4.2 方案 B：前端独立项目 + 管理 API 直接嵌入 resident 进程

做法：

- 新增 `apps/web` 作为独立前端工程
- 在当前 resident 进程内新增 HTTP 管理接口
- resident 同时承载：
  - Telegram bot
  - 调度器
  - admin API
  - 静态 Web 资源服务

优点：

- 运行时状态和 Web 操作在同一个进程里，提醒与轮询变更能立即生效
- 不需要额外设计 IPC / command bus / DB 轮询同步
- 目录上完成“分离 web 项目”，但运行时复杂度仍然可控
- 最适合当前这个单用户、低并发、状态混合在 resident 进程里的项目

缺点：

- Web API 和 bot 同进程，隔离性不如双进程
- 后续如果 Web 访问量变大，需要再做一次运行时拆分

结论：

- 第一阶段推荐

## 4.3 方案 C：前端独立项目 + 独立 admin 后端进程

做法：

- `apps/web` 独立
- 新增单独 `admin` API 服务
- bot 进程与 admin 进程各自独立运行

优点：

- 进程隔离更好
- 后续扩容更清晰

缺点：

- 当前 resident 进程里的提醒调度、start.gg fast polling、vitamin loop 都是内存状态
- 独立 admin 进程如果直接改库，resident 进程不能立即同步
- 想做对就必须再引入：
  - IPC
  - command queue
  - DB 变更订阅
  - 或统一调度中心

结论：

- 不是现在这一步该上的复杂度
- 可以作为“未来 runtime 真正拆分”的第二阶段方向

## 5. 推荐方案

推荐采用 **方案 B：同仓分离 `apps/web`，但管理 API 第一阶段仍嵌入 resident 进程**。

一句话概括：

- **项目结构分离**
- **前端工程独立**
- **运行时先不拆进程**

这样既能尽快得到一个可用的 Web 管理台，又不会因为当前调度状态分散在 resident 内存里而把架构复杂度抬得过高。

## 6. 推荐架构

## 6.1 目录结构

建议演进为：

```text
.
├── apps/
│   └── web/                     # 新增：Web 管理台前端
├── src/
│   ├── admin/                   # 新增：HTTP 管理接口
│   │   ├── server.ts
│   │   ├── routes/
│   │   └── dto/
│   ├── application/             # 新增：共享用例层
│   │   ├── reminders/
│   │   └── startgg/
│   ├── bot/
│   ├── reminders/
│   ├── scheduled/
│   ├── services/
│   └── resident.ts
└── doc/design/architecture/web-admin-console.md
```

几个边界说明：

- `apps/web`
  - 只做前端视图、路由、表单、列表、筛选、操作面板
- `src/admin`
  - 只做 HTTP API、参数校验、把请求转成 application 调用
- `src/application`
  - 提供 Telegram 与 Web 都能复用的共享业务入口
- `src/bot`
  - 保留 Telegram 交互壳，不再承担完整业务编排

## 6.2 运行模型

第一阶段仍然只保留一个常驻后端进程：

```text
resident process
├── telegraf bot
├── reminder scheduler
├── fixed jobs
├── start.gg polling runtime
├── admin http api
└── static web assets
```

部署上：

- resident 进程监听本地端口，例如 `127.0.0.1:3080`
- 由反向代理负责：
  - TLS
  - 外部域名
  - 基础访问保护

## 6.3 技术栈建议

版本约束：

- Web 管理台相关 npm 依赖必须使用实施当下最新的 stable 版本，不允许按模型记忆、旧模板或历史示例固定到过期主版本
- 如果最新 stable 版本与项目当前约束冲突，应直接暴露冲突并调整主路径方案，不做降级、fallback 或静默替换

### 前端

推荐：

- Vue 3
- Vite
- TypeScript
- Vue Router
- Element Plus

原因：

- 管理台以表格、筛选、表单、状态卡片为主，组件库收益很高
- Vite + Vue 3 对这种中小型后台足够直接
- 仓库当前没有既有前端，没必要上 Next.js 这类更重的全栈框架
- 后续如果真的要拆 runtime，Vue SPA 迁移成本也低

前端实现原则：

- 默认 `Composition API`
- 默认 `<script setup lang="ts">`
- 页面组件只做拼装，不承载大段业务逻辑

### 后端 HTTP 层

推荐：

- Fastify
- Zod

原因：

- 需要一个成熟、稳定、直白的 HTTP 层来承接 CRUD 和只读概览
- 要能方便做静态资源服务、JSON API、请求校验
- 当前项目风格更适合“轻但不玩具”的 HTTP 服务

### 数据层

继续使用现有：

- `better-sqlite3`
- `data/notinews.sqlite`

不新增新数据库。

## 6.4 访问控制

第一阶段推荐把认证放在反向代理层，而不是先做应用内用户系统。

理由：

- 当前是单用户个人后台
- 需求是“我自己管理自己的 bot”，不是开放给第三方
- 做应用内账号体系收益太低

建议：

- resident 只监听 `127.0.0.1`
- 由 Caddy / Nginx / Cloudflare Access 之一做外层保护
- 第一阶段不做应用内注册、找回密码、角色权限

## 7. 必要的后端整理

Web 管理台第一阶段真正的前置工作，不是页面，而是把当前 Telegram handler 里的核心操作抽出来。

## 7.1 提醒用例层

建议新增共享用例：

- `createOnceReminder`
- `updateOnceReminder`
- `cancelOnceReminder`
- `markOnceReminderDone`
- `listOnceReminders`
- `createRecurringReminder`
- `pauseRecurringReminder`
- `cancelRecurringReminder`
- `listRecurringReminders`

这些用例必须同时负责：

- 数据库写入
- 调度器变更
- 运行时状态同步

这样 Telegram 和 Web 只是在“调用入口”上不同，主逻辑不会复制两份。

## 7.2 start.gg 用例层

建议新增共享用例：

- `getStartggOverview`
- `runStartggGo`
- `runStartggFetchNow`
- `enableStartggPolling`
- `disableStartggPolling`
- `listWatchPlayers`
- `listWatchEvents`
- `addWatchPlayer`
- `switchActiveEvent`

第一阶段里，`startgg` 的核心目标是“概览 + 操作入口”，不是重做一整套赛事运营平台。

## 7.3 DB 入口语义归位

当前 [src/reminders/db.ts](/Users/xiaomingli/Code/NotiNewsForXiaoming/src/reminders/db.ts) 实际上已经是全局基础设施。

为了给 Web 和 admin API 更清晰的边界，建议在 Web 方案启动前先把它提升为中性位置，例如：

- `src/db.ts`
  或
- `src/infrastructure/db.ts`

这不是为了“重构而重构”，而是为了避免 admin 层也去 `import ../reminders/db.js` 这种语义错误继续扩散。

## 8. 第一阶段页面范围

第一阶段建议只做 3 个页面：

## 8.1 Dashboard

目标：

- 给出“系统当前是否正常”的入口级概览

内容：

- 待处理提醒数
- 活跃循环提醒数
- start.gg 当前监控选手数
- start.gg 当前激活项目数
- start.gg 轮询状态
- 最近一次 start.gg 状态变化时间
- 快捷入口卡片

## 8.2 Reminders

目标：

- 解决一次性提醒和循环提醒的增删改查问题

建议先做成同页双 tab：

- 一次性提醒
- 循环提醒

一次性提醒第一阶段支持：

- 列表
- 搜索
- 按状态筛选
- 新建
- 编辑时间 / 内容
- 取消
- 标记完成

循环提醒第一阶段支持：

- 列表
- 新建
- 查看规则说明
- 暂停
- 取消

说明：

- 循环提醒“编辑既有规则”可以放到第二小阶段
- 第一版先保证“创建新规则 + 管理现有规则状态”跑通

## 8.3 StartGG

目标：

- 提供聊天界面无法高效表达的结构化概览

页面内容建议包括：

- 轮询状态卡
  - 固定轮询开/关
  - 下一次固定轮询时间
  - 加速轮询开/关
  - 下一次加速轮询时间
- 当前激活赛事列表
- 当前监控选手列表
- 最近状态快照表
  - 选手
  - 赛事 / 项目
  - 当前状态
  - 名次
  - 最近轮次
  - 最近比分
  - 快照时间
- 操作区
  - 立即检查
  - polling on/off
  - `go <keyword>`

第一阶段暂不要求在 Web 里完整替代 `/watch` 的所有添加逻辑，但至少要先把“概览 + 核心操作”做出来。

## 9. API 草图

第一阶段 API 建议控制在少量明确端点内：

### Dashboard

- `GET /api/dashboard`

### Once Reminders

- `GET /api/reminders`
- `POST /api/reminders`
- `PATCH /api/reminders/:id`
- `POST /api/reminders/:id/cancel`
- `POST /api/reminders/:id/done`

### Recurring Reminders

- `GET /api/recurring-reminders`
- `POST /api/recurring-reminders`
- `POST /api/recurring-reminders/:id/pause`
- `POST /api/recurring-reminders/:id/cancel`

### StartGG

- `GET /api/startgg/overview`
- `POST /api/startgg/fetch-now`
- `POST /api/startgg/go`
- `POST /api/startgg/polling/on`
- `POST /api/startgg/polling/off`

原则：

- API 只暴露 Web 当前确实要用到的能力
- 不先造“大而全”的通用平台 API
- 所有变更型接口都必须调用共享用例层，不允许 controller 里直接散写 SQL + runtime 操作

## 10. 分阶段实施建议

## Phase 0：后端归位

目标：

- 不做页面
- 先把 Web 所需的共享逻辑抽出来

内容：

- DB 入口语义归位
- 抽出 reminders application 层
- 抽出 start.gg application 层
- 在 resident 中引入 admin HTTP server 壳

完成标准：

- Telegram 现有命令仍然通过 application 层工作
- Web 还没做，但后端已经具备可复用边界

## Phase 1：Web 骨架 + Reminders + StartGG 概览

目标：

- 交付第一个真正可用的 Web 管理台

内容：

- `apps/web` 初始化
- Layout / Router / Navigation
- Dashboard
- Reminders 页面
- StartGG 页面
- 基础 API 与同源部署

完成标准：

- 能在浏览器里查看和管理一次性提醒
- 能查看循环提醒并做暂停/取消
- 能查看 start.gg 概览并触发核心操作

## Phase 2：补齐 StartGG / Recurring 编辑能力

目标：

- 把 Web 从“能看能管一部分”补到“能承担主要管理入口”

内容：

- 编辑循环提醒规则
- Web 内添加 / 切换 start.gg watch 对象
- 更细的筛选、搜索、排序

## Phase 3：接入更多后台模块

候选：

- AV 订阅管理
- 服务器巡检面板
- 投递箱 / Snippet Inbox
- 配置页

## 11. 为什么现在不建议直接拆独立 admin 进程

一句话原因：

- **当前项目的“可变运行时状态”并不全在 DB，而是在 resident 进程里。**

如果现在就把 admin API 单独拉成独立后端进程，就必须同时解决：

- 提醒调度即时同步
- start.gg polling 状态同步
- vitamin loop 状态同步

否则 Web 上点了“修改提醒时间”，数据库改了，但 resident 进程里的 `schedule.Job` 还是旧的，这会造成典型的“后台看起来成功了，真实行为没变”的错位。

这不是一个 UI 问题，而是运行时边界问题。

所以正确顺序应该是：

1. **先把 Web 项目分出来**
2. **先把 admin API 接到 resident 进程里**
3. **等未来需要真正拆进程时，再先抽离 runtime state 管理模型**

## 12. 风险与控制

### 风险 1：继续把业务逻辑散写进 UI 层

控制：

- Telegram 和 Web 都只能调 application 层

### 风险 2：第一阶段范围过大

控制：

- 第一阶段只做 Dashboard / Reminders / StartGG
- AV、巡检、设置页全部延后

### 风险 3：为了 Web 提前引入过度复杂的 auth

控制：

- 第一阶段只做单用户后台
- 认证放反代层

### 风险 4：前后端分离过头，反而把当前单体 bot 搞碎

控制：

- 分离的是前端项目和代码边界
- 不是第一天就拆成多后端进程

## 13. 最终建议

如果现在就开始做，这件事的最小正确落地方式是：

1. 在同仓新增 `apps/web`
2. 在 `src/admin` 新增 HTTP 管理接口
3. 在 `src/application` 把 reminders / startgg 的共享用例先抽出来
4. 让 resident 进程同时承载 bot + scheduler + admin API
5. 第一阶段只交付：
   - Dashboard
   - Reminders 管理
   - StartGG 概览与核心操作

这个方案最符合当前项目的代码事实，也最能避免“为了 Web 提前把 runtime 拆碎”的过度设计。
