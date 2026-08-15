# “撸了吗”独立 Web 看板设计方案

## 1. 产品定位

“撸了吗”是一个独立的私密个人数据产品。它拥有自己的访问入口、视觉语言、前后端代码、鉴权和部署单元，并与现有 Telegram 功能共享同一份“撸了吗”记录。

第一版目标是：打开页面后，在几秒内直观看清近期频率、长期变化、时间规律和原始记录，不做价值判断，也不把简单的个人工具扩展成健康管理系统。

## 2. 已确认事实与设计判断

### 2.1 当前事实

- 唯一业务数据位于 `data/notinews.sqlite` 的 `masturbation_records` 表。
- 表内只有 `id`、`occurred_at` 和 `created_at`，足以还原发生日期、时刻、每日次数和相邻记录间隔。
- Telegram Bot 当前直接写入这张表，并支持记一次、撤销指定记录、撤销最新记录及查看摘要。
- 数据库存储 UTC ISO 时间，现有业务展示统一换算为北京时间。
- 生产环境中 Bot 作为 bwgdc01 上的 systemd 服务运行，数据库实际路径为 `/root/NotiNewsForXiaoming/data/notinews.sqlite`。
- 生产数据库当前使用 WAL，主文件、`-wal` 和 `-shm` 文件均存在且可读。
- bwgdc01 的 80/443 由容器化 Nginx 提供，Nginx 位于 `web_default` Docker 网络。
- 当前仓库依赖中已有 Vue、Vite、`better-sqlite3`、Day.js 和 Zod，没有 Hono 与图表库。

### 2.2 设计判断

- `notinews.sqlite` 继续是唯一数据源，Bot 继续是唯一写入者。
- 看板服务只读连接同一数据库，不迁移、不复制、不双写。
- 看板不可用时，Telegram 记录、撤销和 22:00 提醒不受影响。
- 看板是独立产品，但不需要拆成另一个 Git 仓库；在当前仓库中以独立应用包和独立部署边界存在即可。

## 3. 产品范围

### 3.1 第一版包含

- 独立登录页。
- 单页数据看板。
- 距上次时长和关键摘要。
- 最近一年日历热力图。
- 30 / 90 / 365 天趋势图。
- 星期与时段分布图。
- 相邻记录间隔摘要。
- 最近 20 条原始记录。
- 手动刷新。
- 明暗主题与移动端布局。

### 3.2 第一版不包含

- Web 端新增、撤销、修改或补录。
- 多用户、注册、找回密码、角色权限。
- 健康建议、目标、评分、预警或预测。
- 自动轮询、WebSocket、推送或后台刷新。
- 导出、分享、公开访问。

Telegram 负责记录，看板负责理解数据，两条主路径职责明确。

## 4. 信息架构

看板不是多页面管理后台，第一版只有登录和看板两个界面，不引入 Vue Router 或全局状态库。

### 4.1 全局时间范围

看板右上角提供 `30 天 / 90 天 / 365 天` 三档范围，默认 90 天。

该范围只影响“趋势”和“时间规律”两个分析区；以下内容不跟随切换：

- 距上次时长：永远基于最新记录。
- 今日、近 7 天、近 30 天和历史总计：固定统计口径。
- 年度日历：固定最近 365 天。
- 最近记录：固定最近 20 条。

这样避免用户切换范围后，页面上所有数字同时改变而失去参照。

### 4.2 首屏状态

首屏核心是“当前间隔”，而不是一排同权重的数字：

```text
距上次
2 天 7 小时
上次：08 月 12 日 23:18
```

下方四个摘要卡片：

- 今天：次数。
- 近 7 天：次数。
- 近 30 天：次数 / 活跃天数。
- 历史：总次数。

没有记录时直接显示“还没有记录”，其余统计为真实的 0。

### 4.3 最近一年日历

日历热力图是第一核心图形：

- 一格代表一个北京时间自然日。
- 0 次使用背景色，1、2、3、4 次及以上使用逐级加深色阶。
- 今天用描边标记，不改变次数色阶。
- 桌面端按月份横向排列；移动端图表区域可横向滚动，保持单元格可辨认。
- 悬停或点按显示 `2026-08-15 · 2 次`。

它直接回答“哪些时期频繁、哪些时期平稳、是否存在连续模式”。

### 4.4 变化趋势

趋势区使用柱线组合图：

- 柱形：每天的实际次数。
- 折线：7 日移动平均。
- 横轴：日期。
- 纵轴：次数，从 0 开始且只使用整数刻度。
- 数据范围由全局 30 / 90 / 365 天切换控制。

柱形负责呈现事实，移动平均负责降低单日噪声。第一版不加入同比、预测线或“改善/恶化”结论。

### 4.5 时间规律

使用 `星期 × 时段` 的矩阵热力图：

- 横向：周一至周日。
- 纵向：凌晨 `00–06`、上午 `06–12`、下午 `12–18`、晚上 `18–24`。
- 单元格颜色表示所选时间范围内的记录数。
- 点按或悬停显示星期、时段和次数。

四个时段足够发现生活规律，也比 24 个小时格更容易阅读。该图只描述时间分布，不推断原因。

### 4.6 间隔摘要

间隔区显示三个数字：

- 当前间隔：最新记录到现在。
- 中位间隔：所选范围内相邻记录间隔的中位数。
- 最长间隔：所选范围内相邻记录的最大间隔。

不使用“连续坚持”“破戒”等带有行为评价的语言。范围内少于两条记录时，中位和最长间隔显示“数据不足”，而不是返回 0。

### 4.7 最近记录

底部按发生时间倒序列出最近 20 条：

- 今天、昨天或完整月日。
- 精确到分钟的北京时间。
- 同一天多次分别显示。

该区域让用户可以回到原始事实确认图表。第一版没有行内按钮。

## 5. 页面结构与视觉方向

### 5.1 桌面布局

```text
┌─────────────────────────────────────────────────┐
│ 撸了吗                  30天  90天  365天  主题 │
│ 只看记录，不下结论                              │
├─────────────────────────────────────────────────┤
│ ┌──────────── 当前间隔 ────────────┐ ┌────────┐ │
│ │          2 天 7 小时             │ │摘要卡片│ │
│ └──────────────────────────────────┘ └────────┘ │
│                                                 │
│ 最近一年                                        │
│ ┌──────────── 日历热力图 ─────────────────────┐ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 变化趋势                       时间规律          │
│ ┌──────── 柱线图 ─────────┐ ┌── 7×4 热力图 ──┐ │
│ └─────────────────────────┘ └─────────────────┘ │
│                                                 │
│ 间隔摘要                       最近记录          │
└─────────────────────────────────────────────────┘
```

### 5.2 移动端

- 顶部标题、范围切换和主题按钮保持常驻。
- 所有区块改为单列。
- 摘要卡片使用两列。
- 年度热力图保留可读尺寸并允许图表内部横向滚动。
- 趋势图与时间规律图不并排。

### 5.3 独立视觉语言

产品采用“夜间数据日志”视觉：

- 默认深色：墨黑背景、深灰面板、暖珊瑚主色。
- 浅色：暖白背景、炭黑文字、同一珊瑚色阶。
- 大数字使用紧凑等宽字体，正文使用系统无衬线字体。
- 图表 0 次为低对比中性色，有记录才进入主色阶。
- 卡片边界使用细线，不加入玻璃拟态、3D 图形或装饰性插画。
- 所有重要值同时使用文字或数值表达，不只依赖颜色。

整体气质应私密、克制、直接，避免色情图像、医疗化图标和游戏化奖惩。

## 6. 完整交互模型

### 6.1 登录

1. 首次打开只出现产品名、密码框和登录按钮。
2. 不显示示例数据或看板轮廓，避免在未登录状态暴露数据类型细节。
3. 登录成功后原位进入看板，不发生跨站跳转。
4. 之后访问通过产品自己的签名 Cookie 恢复会话。
5. 退出后立即清除页面内存数据并回到登录页。

### 6.2 首次加载

- 页面框架先稳定呈现，数据区域显示与最终布局一致的局部骨架。
- 一个请求取得看板所需全部记录，响应后一次性替换数据区。
- 不让各图表分别请求，不出现四个区块先后跳动。

### 6.3 已加载状态

- 时间范围切换只使用内存中的记录重新派生图表，不请求服务端。
- 主题切换只改变当前产品主题。
- 用户点击刷新时保留现有图表，刷新按钮显示进行中；成功后整体替换记录。
- 请求失败直接展示错误。已有成功数据时仍保留其可见性，但明确标注刷新失败；首次加载失败时不呈现空数据假装成功。
- 不自动重试、不轮询、不静默吞错。

## 7. 独立技术架构

```text
浏览器
  │ HTTPS（独立域名）
  ▼
bwgdc01 容器化 Nginx
  │ 独立 upstream
  ▼
lu-dashboard 独立容器
  ├── Hono：登录、会话、数据 API、静态前端
  └── better-sqlite3 readonly connection
                │
                ▼
      /data/notinews.sqlite
                ▲
                │ 唯一写入
      Telegram Bot systemd 服务
```

关键隔离关系：

- 浏览器不直接访问数据库。
- 看板服务没有写接口，数据库连接以 `readonly: true` 打开。
- Bot 不调用看板 API，也不知道看板是否存在。
- Nginx 为看板配置独立站点，不把它挂到 `feeds.xmcloud.buzz` 的路径下。

服务端明确使用 Hono 作为本产品的学习与实践技术栈：

- `hono` 负责路由、请求上下文、响应和 Cookie helper。
- `@hono/node-server` 负责在现有 Node.js 24 环境中运行 Hono。
- 静态前端由 `@hono/node-server/serve-static` 提供，并以基于 `import.meta.url` 的绝对路径定位产物，不依赖进程工作目录。
- 登录会话直接使用 `hono/cookie` 的 `setSignedCookie`、`getSignedCookie` 和 `deleteCookie`，不增加通用会话框架。

## 8. SQLite 读取边界

部署时把 Bot 的数据目录挂载到看板容器中的 `/data`，服务通过环境变量 `LU_DATABASE_PATH=/data/notinews.sqlite` 定位数据库。

当前 `better-sqlite3` 公开 API 支持 `readonly: true`。SQLite 官方说明，WAL 数据库在只读打开时需要 `-wal` 与 `-shm` 已存在、可被创建，或数据库以 immutable 方式打开。当前生产环境已经确认两个伴随文件存在且可读，因此首版采用普通 readonly 连接，不使用会忽略活动 WAL 的 immutable 模式。

为使这个条件成为明确主路径：

- 看板服务启动顺序位于 `notinews-bot.service` 之后，确保 Bot 已打开数据库。
- 数据目录对容器只读挂载，连接自身也声明 readonly。
- 服务启动时如果数据库或 WAL 条件不成立，直接失败并暴露原因，不切换到快照、不复制数据库、不返回旧缓存。
- 看板请求只执行 `SELECT`，不执行 migration、PRAGMA 写入或 checkpoint。

## 9. 数据接口

### 9.1 会话接口

- `GET /api/session`：返回是否已登录。
- `POST /api/session`：提交单一管理密码并设置签名 Cookie。
- `DELETE /api/session`：退出并清除 Cookie。

看板使用 `LU_DASHBOARD_PASSWORD` 和 `LU_COOKIE_SECRET`。

Cookie 属性：`HttpOnly`、`Secure`、`SameSite=Strict`，仅作用于该独立域名。

### 9.2 数据接口

`GET /api/dashboard`

仅登录后可访问，一次返回完整原始记录：

```ts
interface DashboardResponse {
  generatedAt: string;
  timezone: 'Asia/Shanghai';
  records: Array<{
    id: number;
    occurredAt: string;
  }>;
}
```

返回全部记录的依据：

- 个人数据规模小，单次响应可控。
- 所有图表可以在浏览器内即时切换范围。
- API 不需要为每种图表维护一套聚合参数。
- 最近记录、相邻间隔和未来新增视图都以同一份事实数据派生。

服务端只负责鉴权、读取和稳定的数据契约；所有视觉分析由前端纯函数完成。

## 10. 统计口径

- 所有自然日和时段按 `Asia/Shanghai` 计算。
- 今天：北京时间当天 00:00 至次日 00:00。
- 近 7 天：今天及之前 6 个自然日。
- 近 30 天：今天及之前 29 个自然日。
- 最近一年：今天及之前 364 个自然日。
- 7 日移动平均：当前日及之前最多 6 日的日次数平均值。
- 时间范围采用自然日边界，不使用“当前时刻向前 N×24 小时”。
- 相邻间隔按 `occurredAt` 升序后的真实时间差计算。
- 同一天多条记录全部保留，不去重。

## 11. 独立代码结构

新增独立 workspace 应用包：

```text
apps/lu-dashboard/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── server/
│   ├── index.ts                 服务入口
│   ├── server.ts                Hono 应用、API 与静态资源
│   ├── auth.ts                  本产品会话
│   ├── database.ts              readonly SQLite 连接
│   ├── repository.ts            masturbation_records 查询
│   └── schema.ts                API Zod 契约
└── web/
    ├── index.html
    └── src/
        ├── App.vue              登录/看板界面切换
        ├── api.ts
        ├── types.ts
        ├── assets/main.css      独立设计令牌与全局样式
        ├── composables/
        │   └── useDashboard.ts  会话、读取、刷新、范围状态
        ├── analytics/
        │   └── masturbation.ts  纯统计函数
        └── components/
            ├── LoginView.vue
            ├── DashboardView.vue
            ├── DashboardHeader.vue
            ├── CurrentInterval.vue
            ├── SummaryCards.vue
            ├── YearCalendarChart.vue
            ├── TrendChart.vue
            ├── RhythmHeatmap.vue
            ├── IntervalSummary.vue
            └── RecentRecords.vue

deploy/lu-dashboard/
├── Dockerfile
├── compose.yaml
├── lu.xmcloud.buzz.conf
└── notinews-lu-dashboard.service
```

隔离规则：

- `apps/lu-dashboard` 的前端、服务端、样式、Cookie 和类型都保留在产品目录内。
- 不修改现有 `masturbation_records` 表结构。
- 不修改 Telegram 的 repository、tracker、formatter 或交互主路径。
- 根 `pnpm-workspace.yaml` 只负责把该目录识别为独立包；依赖声明位于产品自己的 `package.json`。

## 12. Vue 组件与状态边界

- 使用 Vue 3 Composition API 和 `<script setup lang="ts">`。
- `App.vue` 只负责会话级界面切换。
- `DashboardView.vue` 只负责编排看板区块。
- 请求和刷新状态集中在 `useDashboard`，对组件暴露只读状态与明确动作。
- 统计全部由纯函数和 `computed` 派生，不在模板中重复计算。
- 图表组件只接收数据 props，不读取 API、不共享 ECharts 实例。
- 组件之间使用 props 向下、事件向上，不引入 Pinia、provide/inject 或隐式全局状态。
- 不使用 `watch`、`requestAnimationFrame`、`cancelAnimationFrame` 或 RAF 别名。
- 图表尺寸变化由 `ResizeObserver` 直接调用 ECharts `resize()`。

## 13. 图表依赖

产品包新增 `echarts@^6.1.0`，直接使用 Apache ECharts，不增加 Vue 包装层。

选择依据：

- 原生包含 Calendar、Heatmap、Bar 和 Line，完整覆盖本方案。
- 官方支持 `echarts/core` 按需注册，避免把整个图表库装入首屏。
- 包内置 TypeScript 类型。

只注册：

- `BarChart`
- `LineChart`
- `HeatmapChart`
- `CalendarComponent`
- `GridComponent`
- `TooltipComponent`
- `VisualMapComponent`
- `AriaComponent`
- `SVGRenderer`

年度日历最多 365 个单元格，节律图固定 28 个单元格，SVG 渲染足够且便于保持文字清晰。

## 14. 产品依赖版本

独立应用包明确声明自己的直接依赖，不依赖根项目的间接解析结果。版本以 2026-08-15 npm registry 的 `latest` 标签为依据：

### 运行时依赖

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| `hono` | `^4.13.2` | 路由、请求响应和 Cookie helper |
| `@hono/node-server` | `^2.1.1` | Node.js adapter 与静态文件服务 |
| `vue` | `^3.5.41` | 前端界面 |
| `echarts` | `^6.1.0` | 日历、趋势和热力图 |
| `better-sqlite3` | `^13.0.3` | SQLite readonly connection |
| `dayjs` | `^1.11.21` | 北京时间与时间范围计算 |
| `zod` | `^4.4.3` | 环境变量和 API 数据边界 |

### 开发依赖

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| `vite` | `^8.2.1` | 前端开发与产物生成 |
| `@vitejs/plugin-vue` | `^6.0.8` | Vue SFC 支持 |
| `typescript` | `^7.0.2` | TypeScript 编译与类型 |
| `@types/node` | `^24.13.3` | 与项目 Node.js 24 运行时匹配的最新 24.x 类型 |
| `@types/better-sqlite3` | `^9.6.0` | SQLite TypeScript 类型 |

兼容关系已经明确：

- `@hono/node-server@2.1.1` 要求 Hono 4，`hono@4.13.2` 满足。
- Vite 8.2.1 要求 Node.js `^20.19.0 || >=22.12.0`，项目的 Node.js 24 满足。
- `@vitejs/plugin-vue@6.0.8` 支持 Vue 3.2.25 以上和 Vite 5–8。
- `better-sqlite3@13.0.3` 要求 Node.js 22 以上，项目的 Node.js 24 满足。
- `@types/node` 不采用全局 `latest` 的 26.x，避免类型环境超前于实际 Node.js 24 运行时。

Hono 应用只注册本产品需要的会话和数据路由。Node.js adapter 负责监听与静态文件响应；Hono 内置 Cookie helper 负责签名 Cookie。Zod 用于环境变量、登录请求和数据响应边界，不引入 ORM、session store 或额外服务端框架。

## 15. 独立鉴权与隐私呈现

- 单用户密码登录，不设计账号表。
- 服务端进行密码比较，前端不持久化密码。
- 页面设置 `noindex, nofollow`，Nginx 同时返回 `X-Robots-Tag: noindex, nofollow`。
- 未登录时不返回任何记录或统计。
- 页面标题和站点图标可以保持中性；登录后的产品内部才明确显示“撸了吗”。
- API 和页面只允许同源访问，不开放跨域。

这些措施直接服务于敏感个人数据，不扩展为通用权限或安全平台。

## 16. 独立部署边界

访问地址使用 `lu.xmcloud.buzz`。

部署形态：

- 独立 Docker image 与容器名 `notinews-lu-dashboard`。
- 加入现有外部 Docker 网络 `web_default`，供 Nginx 通过容器名访问。
- 不暴露宿主机公网端口。
- 独立 Nginx server 配置与 TLS 域名。
- 独立环境文件，只包含本产品密码、Cookie secret、数据库路径和监听配置。
- 独立 systemd 单元负责容器生命周期，并声明在 Bot 服务之后启动。
- GitHub Actions 只在 `apps/lu-dashboard/**`、`deploy/lu-dashboard/**` 或相关锁文件变化时发布该产品。
- 看板发布失败不阻止 Bot 发布，Bot 发布也不重启看板。

这使它在同一仓库和同一服务器中仍保持产品级、运行时和发布级隔离。

## 17. 实施范围

直接需要的变更：

- 新增 `apps/lu-dashboard` 独立应用包。
- 将该包加入 pnpm workspace。
- 新增 Hono、Node.js adapter、ECharts 及产品自己的直接依赖声明。
- 新增独立部署目录、Nginx 站点和发布 job。
- 新增产品环境变量示例。

现有 Telegram “撸了吗”的数据写入、按钮、提醒和统计文案保持不变，其他 Bot 功能和现有数据库表结构也不在本次范围内。

## 18. 已确认决定

1. 采用 `apps/lu-dashboard`、独立容器和独立域名的产品边界。
2. 第一版严格只读，写操作继续只在 Telegram。
3. 首版采用“当前间隔、摘要、年度日历、趋势、时间规律、间隔、最近记录”的完整看板结构。
4. 采用克制的深色数据日志风格，域名使用 `lu.xmcloud.buzz`。

以上四项作为后续实现约束，不再保留为待确认问题。
