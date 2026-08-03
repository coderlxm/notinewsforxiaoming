# Steam 游戏低价监控提醒方案

状态：已实施  
调研基线：2026-07-18  
适用范围：NotiNewsForXiaoming 单用户常驻 Telegram bot

## 1. 结论

首版应实现为“Steam 中国区目标价监控”，而不是全网比价器或 Steam 历史价格站：

1. 用户通过 Steam App 链接或 AppID 添加游戏，并明确输入愿意购买的人民币目标价。
2. bot 固定读取 Steam 中国区当前售价，保存当前价和“自添加以来最低价”。
3. 价格首次降到目标价，或已到价后继续降价时，发送 Telegram 提醒。
4. 相同价格不重复提醒；涨价不提醒。
5. 数据只来自 Steam Store 单链路，不接 SteamDB、IsThereAnyDeal 或网页抓取作为备用源。

推荐主链路：

```text
Telegram /steam 命令
  -> AppID 与目标价
  -> Steam Store appdetails（cc=CN, l=schinese）
  -> Zod 校验人民币价格结构
  -> SQLite 对比上次快照
  -> 达到提醒条件时发送 Telegram HTML 消息
```

这个方案复用项目现有的 Telegraf、`node-schedule`、Axios、Zod、`better-sqlite3` 和单进程常驻模式，不新增服务、不引入队列、不接入账号登录，也不增加新的 npm 依赖。

## 2. 需求口径

### 2.1 “低价”的定义

首版的低价定义为：

```text
Steam 中国区当前价 <= 用户设置的目标价
```

不使用“打几折”代替低价判断。折扣比例只能说明相对原价降了多少，不能代表当前售价符合个人购买预期。例如一款原价很高的游戏即使五折，也可能仍高于用户愿意支付的价格。

首版同时记录“监控期最低价”，但消息中必须明确写作“自添加以来最低”，不能称为“Steam 史低”或“历史最低”。项目没有 Steam 全量历史价格数据，不能作出超过证据范围的结论。

### 2.2 监控对象

首版支持：

- `https://store.steampowered.com/app/<appid>/...` 形式的 App 页面。
- 纯数字 AppID。
- Steam 返回带人民币价格的付费 game 或 DLC App。

首版不支持：

- `sub`、`bundle` 链接和豪华版、合集等指定购买项。
- “补齐捆绑包”等依赖 Steam 登录账号和已拥有内容的个性化价格。
- 免费游戏、尚未提供价格的未发售游戏、中国区不可售 App。
- 按中文名模糊搜索游戏。名称可能重名，也可能把 DLC、试玩版或同名作品选错；直接使用 App 链接是最短且可确认的路径。
- 自动导入 Steam 愿望单。它会引入 Steam 账号、公开性、分页和非公开接口等额外问题，不属于目标价提醒的必要主路径。

### 2.3 地区与币种

首版固定请求参数：

```text
cc=CN
l=schinese
```

服务器部署在海外，不能让价格地区随服务器 IP 推断，否则可能拿到 USD。返回结果必须满足 `currency === "CNY"`，不一致时直接报错，不换算汇率，也不继续保存该结果。

## 3. 当前数据链路判断

### 3.1 Steam 官方文档能够确认的事实

- Valve 的 Web API 确实包含公开和受保护方法，公开接口通过 `api.steampowered.com` 使用；受保护方法需要相应 key。[Steamworks Web API Overview](https://partner.steamgames.com/doc/webapi_overview)
- 官方 `IStoreService/GetAppList` 可以返回 `last_modified` 和 `price_change_number`，后者变化只表示价格“可能发生变化”，但该接口返回全商店 App 列表，不直接返回本功能需要的当前购买价。为少量个人订阅遍历全量目录不是合适主路径。[IStoreService](https://partner.steamgames.com/doc/webapi/IStoreService)
- 官方 `ISteamUser/GetAppPriceInfo` 能返回 `initial_price`、`final_price` 和 `discount_percent`，但明确要求 Steamworks publisher API key，不是普通个人 Steam Web API key 能用于监控任意商店游戏的接口。[ISteamUser/GetAppPriceInfo](https://partner.steamgames.com/doc/webapi/isteamuser)
- Steam 官方说明商店页实际购买价格主要落在 package 购买项上，因此 App 当前价不能被扩张解释为所有版本、合集和个性化 bundle 的价格。[Steamworks Pricing](https://partner.steamgames.com/doc/store/pricing)

### 3.2 当前可用但未被 Valve 正式承诺的接口

社区长期使用的 Steam Store 接口为：

```text
GET https://store.steampowered.com/api/appdetails
  ?appids=<appid>
  &cc=CN
  &l=schinese
```

其 `price_overview` 通常包含：

```text
currency
initial
final
discount_percent
initial_formatted
final_formatted
```

其中 `initial` 和 `final` 是最小货币单位整数，应直接按整数存储和比较，避免浮点金额误差。社区资料明确把 `appdetails` 标为 unofficial API，并记录了 `country_code` 和 `price_overview` 等结构。[steamr appdetails reference](https://jslth.github.io/steamr/reference/appdetails.html)

证据边界：这是 Steam Store 域名上的非公开接口，当前实践中适合少量 App 的低频个人查询，但 Valve 没有给出兼容性承诺。首版仍选择它，是因为它不需要 publisher key，且所提供的名称、当前价、原价和折扣已经完整覆盖本需求。实现中用 Zod 严格校验响应；结构变化时直接暴露错误，不解析网页，也不切换其他源。

### 3.3 不采用的候选链路

#### `IStoreBrowseService/GetItems`

这是较新的 Store item 查询方式，能够表达 app、package、bundle 和购买项，但当前公开社区文档仍将其标为 `UNDOCUMENTED`，并要求 access key。对首版只监控 App 目标价而言，它增加了请求结构、key 和购买项选择复杂度，没有带来必要收益。[xPaw IStoreBrowseService reference](https://steamapi.xpaw.me/IStoreBrowseService)

#### SteamDB

SteamDB 明确说明没有 API，并禁止自动抓取或爬取。因此不能把 SteamDB 页面或图表作为史低数据源。[SteamDB FAQ](https://steamdb.info/faq/)

#### IsThereAnyDeal

IsThereAnyDeal API 能通过 Steam AppID 查找游戏，并提供当前价格和 history low；其 API 文档也支持 country 参数。[IsThereAnyDeal API](https://docs.isthereanydeal.com/)

但其服务条款明确写明，私有应用需要先联系对方。当前项目是个人私有 bot，在未取得明确许可前不应把该 API 纳入实现。[IsThereAnyDeal API Terms of Service](https://github.com/IsThereAnyDeal/API/blob/master/TERMS_OF_SERVICE.md)

#### Steam 商店 HTML 页面

页面会受到地区、Cookie、年龄门槛和前端结构变化影响。已有结构化 Store 接口足够覆盖当前价时，不应再引入 Cheerio 网页解析。

## 4. Telegram 用户路径

统一使用一个 `/steam` 命令组：

```text
/steam
/steam add <Steam App URL | AppID> <目标价>
/steam list
/steam set <订阅ID> <新目标价>
/steam remove <订阅ID>
/steam check
```

示例：

```text
/steam add https://store.steampowered.com/app/1245620/ELDEN_RING/ 180
/steam add 413150 30
/steam set 2 25.50
/steam remove 2
```

### 4.1 添加

`/steam add` 按以下顺序执行：

1. 从纯数字或 Steam App URL 解析 AppID。
2. 将目标价转换为人民币分整数。
3. 立即请求该 App 的中国区数据并校验名称和 CNY 价格。
4. 确认不存在相同 AppID 的订阅。
5. 保存订阅、当前快照和监控期最低价。
6. 回复添加结果。

如果添加时当前价已经不高于目标价，添加结果直接标记“当前已到价”。这次添加回执就是当前价格结果，不再额外发送一条重复低价提醒。

重复 AppID 不自动覆盖目标价，而是明确返回已有订阅 ID，引导使用 `/steam set`。这样不会因一次误操作重置监控期最低价。

### 4.2 列表

`/steam list` 每个游戏展示：

```text
#1 ELDEN RING
目标：¥180.00｜当前：¥298.00｜折扣：0%
自添加以来最低：¥178.80｜最近读取：2026-07-18 14:15
```

列表读取本地最后快照，不临时请求 Steam。需要立即刷新时使用 `/steam check`，避免一个查询命令同时承担读取和外部写入两种行为。

### 4.3 手动检查

`/steam check` 复用定时任务的同一个业务入口。它会按正常规则发送到价消息，并在结束后回复：

```text
Steam 价格检查完成：检查 6 款，触发提醒 1 款。
```

不提供 `force` 重发模式。价格提醒的价值在于状态变化，强制重发只会增加噪音和去重分支。

## 5. 提醒规则

设：

```text
target = 用户目标价
previous = 上次当前价
current = 本次当前价
```

发送提醒仅有两种情况：

```text
previous > target 且 current <= target
```

或：

```text
previous <= target 且 current < previous
```

因此：

- 首次降到目标价：提醒。
- 已经到价后进一步降价：再次提醒。
- 相同价格保持多轮：不提醒。
- 到价后涨价但仍低于目标价：不提醒。
- 涨回目标价之上：只更新快照；以后再次跌到目标价时可以重新提醒。
- 原价或折扣比例变化但最终售价不变：不提醒。

该规则只依赖上次价格快照，不需要额外推送历史表或复杂状态机。

## 6. Telegram 消息设计

提醒使用现有 HTML 消息风格并关闭链接预览：

```text
🎮 Steam 到价提醒
──────────────────
ELDEN RING

现价：¥178.80（-40%）
原价：¥298.00
目标价：¥180.00
自添加以来最低：¥178.80

在 Steam 查看
```

标题和链接必须经过现有 HTML 转义工具处理。商店链接统一由已确认的 AppID 生成：

```text
https://store.steampowered.com/app/<appid>/?cc=CN&l=schinese
```

不展示“距离促销结束还有多久”，因为 `appdetails.price_overview` 没有提供可靠的折扣结束时间。

## 7. 数据设计

新增一张表即可：

```sql
CREATE TABLE steam_price_watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency = 'CNY'),
  target_price_minor INTEGER NOT NULL CHECK (target_price_minor > 0),
  initial_price_minor INTEGER NOT NULL CHECK (initial_price_minor >= 0),
  final_price_minor INTEGER NOT NULL CHECK (final_price_minor >= 0),
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 0 AND 100),
  lowest_price_minor INTEGER NOT NULL CHECK (lowest_price_minor >= 0),
  last_checked_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

设计说明：

- 金额全部保存为最小货币单位整数。
- `app_id` 唯一，符合单用户对同一 App 只维护一个购买目标的使用方式。
- 不增加 `chat_id`，项目本身由 `TG_CHAT_ID` 限定为单用户主动推送。
- 不增加 `active` 状态；删除订阅就是删除记录。
- 不建价格历史表；首版只需要上次快照和监控期最低值。
- 删除再添加会重新开始计算监控期最低价。

数据库初始化继续放在 `src/reminders/db.ts`，版本演进放在 `src/reminders/migrations.ts`，沿用当前全项目共享 SQLite 的实际结构。

## 8. 代码落点

### 8.1 Steam Store 客户端

新增 `src/services/steamPriceClient.ts`：

- 使用现有 Axios 请求单个 AppID。
- 固定 `cc=CN`、`l=schinese`。
- 使用 Zod 定义和解析实际用到的最小响应结构。
- 输出统一的 `SteamPrice`，包含 AppID、名称、币种、原价、现价和折扣。
- 不重试、不抓网页、不切换数据源。

每个订阅单独请求，按订阅顺序串行执行。个人 watchlist 规模很小，串行主路径更容易定位具体失败 App，也无需并发控制和限流组件。

### 8.2 Repository

新增 `src/services/steamPriceRepository.ts`：

- `listSteamPriceWatches()`
- `findSteamPriceWatchByAppId()`
- `findSteamPriceWatchById()`
- `createSteamPriceWatch()`
- `updateSteamPriceTarget()`
- `updateSteamPriceSnapshot()`
- `deleteSteamPriceWatch()`

Repository 只负责 SQL，不包含提醒判断和 Telegram 文案。

### 8.3 Tracker

新增 `src/services/steamPriceTracker.ts`：

- `resolveSteamAppReference()`：解析 App URL 或 AppID。
- `createSteamPriceWatch()`：即时读取并创建订阅。
- `runSteamPriceWatchOnce(bot)`：串行读取全部订阅、判断是否提醒、发送消息、更新快照并返回汇总。

若本轮需要提醒，先成功发送 Telegram 消息，再写入新的价格快照；发送失败直接抛错，避免本地先标记已处理而永久丢掉到价提醒。无需提醒的价格变化可直接更新快照。

任一 Steam 请求、响应结构、币种或 Telegram 发送错误都会终止本轮并向上抛出，不吞错、不跳过当前 App 后继续、不重试。

### 8.4 Formatter

新增 `src/formatters/steamPriceFormatter.ts`：

- 添加成功消息。
- 订阅列表。
- 到价提醒。
- 金额格式化。

### 8.5 Telegram 交互

在 `src/bot/interactive.ts` 注册 `/steam` 命令组，并沿用现有 `isAuthorized(ctx)` 权限判断。

同时更新 `/help` 和 README 的当前能力、常用命令说明。首版不增加 callback handler；命令已经是个人 bot 最短、最清楚的管理路径。

### 8.6 调度

只修改当前线上主入口使用的 `src/scheduled/jobs.ts`，在北京时间每天执行四次：

```text
02:15
08:15
14:15
20:15
```

Steam 官方说明周间、周末、每日等多类促销在太平洋时间 10:00 开始或轮换；`02:15` 能在北京时间凌晨覆盖标准时或夏令时的主要切换窗口。[Steamworks Discounting](https://partner.steamgames.com/doc/marketing/discounts) 其余三次让价格提醒在一天内保持合理时效。对个人少量订阅而言，无需分钟级轮询。

不修改一次性入口 `src/index.ts` 和 `src/scheduled/runMode.ts`。当前线上实际主形态是 `src/resident.ts` 注册进程内固定任务，且 `/steam check` 已提供手动入口；把该能力再接入旧的一次性时段分发会扩大无必要范围。

## 9. 主流程

### 9.1 添加订阅

```text
收到 /steam add
  -> 鉴权
  -> 解析 AppID 和目标价
  -> 请求 Steam CN 当前价
  -> 校验 success、AppID、名称、price_overview、CNY
  -> 检查 AppID 唯一性
  -> 写入订阅和初始快照
  -> 回复当前价格与是否已经到价
```

### 9.2 定时或手动检查

```text
读取全部订阅
  -> 逐个请求 Steam CN 当前价
  -> 对比 previous / current / target
  -> 命中提醒规则时发送 Telegram
  -> 更新当前价、折扣、监控期最低价和检查时间
  -> 返回 checked / notified 汇总
```

## 10. 明确不做的内容

- 不接多个价格源，也不做数据源 fallback。
- 不重试 Steam 请求。
- 不吞掉单个游戏错误后继续跑剩余订阅。
- 不抓 SteamDB、GG.deals、Steam 商店 HTML。
- 不宣称真正 Steam 史低。
- 不做全区服比价、汇率换算或跨区购买建议。
- 不登录 Steam，不保存 Steam Cookie、账号密码或愿望单会话。
- 不监控 key 店、灰色市场或非 Steam 商店。
- 不监控动态 bundle、package edition 和拥有内容后的个性化价格。
- 不增加管理后台、队列、缓存、健康状态机或多用户模型。
- 不让 AI 参与金额、折扣或是否到价的判断。

## 11. 实施顺序与最小改动清单

1. 在共享 SQLite 初始化和迁移中增加 `steam_price_watches`。
2. 增加 Steam Store client 与 Zod 响应结构。
3. 增加 repository 和 tracker，完成目标价判断与快照更新。
4. 增加 Telegram formatter 和 `/steam` 命令组。
5. 在常驻 fixed jobs 注册四个检查时点。
6. 更新 `/help`、README 和当前调度说明。

预期新增文件：

```text
src/services/steamPriceClient.ts
src/services/steamPriceRepository.ts
src/services/steamPriceTracker.ts
src/formatters/steamPriceFormatter.ts
```

预期修改文件：

```text
src/reminders/db.ts
src/reminders/migrations.ts
src/bot/interactive.ts
src/reminders/formatter.ts
src/scheduled/jobs.ts
README.md
doc/reference/server-schedule.md
```

## 12. 验收口径

- App 链接和纯数字 AppID 都能创建人民币目标价订阅。
- 添加时返回 Steam 中文名称、当前价、原价、折扣和目标价。
- 相同 AppID 不会生成两条订阅。
- 相同价格经过多轮读取不会重复推送。
- 首次跌到目标价时只推送一次。
- 到价后继续降价会再次推送。
- 涨价不推送；涨回目标价以上后再次跌破可以重新推送。
- `/steam list` 展示目标价、最后当前价、折扣和自添加以来最低价。
- `/steam set` 修改目标价时不重置价格快照和监控期最低价。
- `/steam remove` 删除后不再参与定时读取。
- Steam 返回非 CNY、缺少价格或结构不匹配时直接报错，不写入伪造价格，也不切换其他来源。
