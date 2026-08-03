# Journal 公开页实时天气方案

## 1. 背景

项目已经通过和风天气提供 Telegram 日常推送：

- `src/fetchers/weather.ts` 从 `QWEATHER_API_KEY`、`QWEATHER_CITY_ID` 读取配置；
- 请求和风天气 `/v7/weather/now`；
- 当前只保留天气文本、温度、体感温度和风向；
- `wakeup`、`news` 和健身计划路径会消费这些数据。

Journal Web 是独立服务和独立镜像：

- `src/journal-server/config.ts` 尚未读取和风天气配置；
- `deploy/journal/.env.example` 尚未包含和风天气变量；
- `deploy/journal/Dockerfile` 只复制 `src/journal-server` 和 `src/shared`，不能直接引用当前 bot fetcher；
- Web 端没有天气接口、类型或展示组件。

因此，本功能不能让浏览器直接请求和风天气，也不能假定 Journal 容器天然拥有 bot 的运行环境。需要在保留现有凭据语义的前提下，为 Journal 增加一条服务端天气主路径。

## 2. 外部接口事实

和风天气实时天气接口为 `GET /v7/weather/now`，当前返回的 `now` 中包含 `obsTime`、`temp`、`feelsLike`、`text`、`windDir` 等字段。官方说明实况数据相对真实世界可能延迟 5–20 分钟，应依据 `obsTime` 表达数据时间。[和风天气实时天气文档](https://dev.qweather.com/docs/api/weather/weather-now/)

和风天气允许缓存天气数据，但 GeoAPI 数据除外。本方案只使用实时天气接口，不调用 GeoAPI。[和风天气 FAQ](https://dev.qweather.com/en/help/)

公开网站使用和风天气数据时，需要清晰展示 QWeather 名称并链接到 `https://www.qweather.com`。[和风天气 Attribution](https://dev.qweather.com/en/docs/terms/attribution/)

以上为官方文档声明；当前项目实际请求域名和 API Key 查询参数写法以 `src/fetchers/weather.ts` 为准。

## 3. 首版目标

- 在公开信息流展示当前天气；
- 复用项目现有 `QWEATHER_API_KEY` 和 `QWEATHER_CITY_ID`；
- API Key 只存在于服务端，不进入浏览器请求或构建产物；
- 显示温度、天气文本、体感温度、风向和观测时间；
- 天气加载不造成标题或信息流位移；
- 与现有刷新动作形成直观的一次页面刷新；
- 对外部接口失败直接展示天气错误，不显示过期数据假装成功；
- 遵守 QWeather attribution 要求；
- 不改变 Telegram 天气消息的业务表现。

## 4. 首版边界

### 4.1 本次包含

- 实时天气，不含预报；
- 当前 `QWEATHER_CITY_ID` 对应地点；
- 公开信息流默认页和标签筛选页；
- 服务端 10 分钟内存缓存；
- 页面初次进入和手动刷新；
- 桌面与移动端响应式展示；
- 天气数据来源链接。

### 4.2 本次不包含

- 逐小时、未来 3 日或空气质量；
- 天气预警、降水提醒和生活指数；
- 浏览器定位；
- 城市切换和城市名称展示；
- 在设置页修改城市；
- 在历史详情、我的资产或编辑页面展示天气；
- 自动轮询、后台定时器和推送；
- 自制天气图标映射或新图标依赖；
- 天气主题背景、动画、粒子效果；
- 外部接口失败后返回旧缓存、默认天气或静默隐藏。

首版不显示城市名。现有证据只有 LocationID，没有已核实的展示名称；为此调用 GeoAPI或新增一份手工城市文案都会扩大数据来源。页面以“当前天气”语义呈现即可。

## 5. 展示位置

### 5.1 推荐位置

天气放在公开信息流标题下方、第一张记录之前，作为一条无卡片边框的轻量信息带。

不放在顶部个人资料区，原因是：

- 头像、昵称和 bio 表达页面身份；
- 天气表达访问当下的环境；
- 把天气塞进资料区会让固定身份信息和实时外部数据产生两种加载节奏；
- 移动端资料区空间有限，天气会挤压昵称和导航；
- 天气与“最近记录”处于同一个滚动内容层更自然。

不放在记录卡片之间，也不生成一条 Journal entry。天气不是个人历史内容，不应参与瀑布流、详情、RSS、标签或归档。

### 5.2 桌面布局

```text
PUBLIC NOTES                                             刷新

26°   多云   体感 28° · 东南风                    14:20 实况

┌──────────┐  ┌──────────┐  ┌──────────┐
│ 记录卡片  │  │ 记录卡片  │  │ 记录卡片  │
```

视觉规则：

- 温度使用现有宋体 `var(--font-serif)`，字号约 `1.35rem`；
- 天气文本使用正文色；
- 体感、风向和观测时间使用 `var(--text-muted)`；
- 整行沿用 Feed 的左右边界和 `0.15rem` 内缩；
- 不使用卡片背景、阴影或额外边框；
- 与标题之间保持约 `0.55rem` 间距，与信息流保持约 `0.35rem` 间距。

### 5.3 移动端布局

```text
PUBLIC NOTES                                刷新

26°   多云                            14:20 实况

┌──────────────────────────────────────────┐
│                  记录                    │
```

宽度小于 600px 时：

- 保留温度、天气文本和观测时间；
- 隐藏体感温度和风向；
- 单行显示，不换行；
- 天气文本过长时省略；
- 不压缩刷新按钮。

### 5.4 标签筛选页

标签筛选仍属于公开信息流，天气保持显示。天气与标签内容无关，但它占据固定的页面上下文位置；切换标签时不需要让天气消失再出现。

公开详情页不显示天气。详情代表某条历史记录，嵌入当前天气会引入与内容时间无关的信息。

## 6. 加载、错误与刷新

### 6.1 加载骨架

天气数据请求期间预留与真实内容完全相同的整行高度。

桌面骨架包含四段：

- 温度：约 `2.4rem × 1.35rem`；
- 天气文本：约 `2.5rem × 0.78rem`；
- 体感与风向：约 `8rem × 0.72rem`；
- 观测时间：约 `4.5rem × 0.72rem`。

移动端隐藏第三段，其他段的占位尺寸保持不变。

骨架只使用 `var(--surface-muted)` 和轻微 CSS opacity pulse，不显示“加载中”文字，不使用 JavaScript 动画或 RAF。真实数据到达后只替换同一网格单元内容，信息流不会上下移动。

### 6.2 错误

天气读取失败时，在天气行原位置显示：

```text
天气读取失败：<服务端真实错误>
```

错误使用 `var(--danger)`，并限制为单行省略。错误不影响公开记录继续展示，因为天气和记录是两个独立数据源；但天气错误必须可见，不静默隐藏，也不返回默认天气或已过期缓存。

### 6.3 刷新

公开页现有“刷新”按钮同时请求：

- 当前公开 Feed；
- 当前天气。

两项并行执行，各自展示自己的真实错误。服务端天气缓存未过期时，天气请求返回当前缓存；缓存过期时请求和风天气。

不增加天气专用刷新按钮，也不加入自动轮询。

## 7. Web API

新增公开接口：

```http
GET /api/weather
```

成功响应：

```json
{
  "text": "多云",
  "temperature": 26,
  "feelsLike": 28,
  "windDirection": "东南风",
  "observedAt": "2026-07-26T14:20:00+08:00"
}
```

字段说明：

| 字段 | 来源 | 页面用途 |
| --- | --- | --- |
| `text` | `now.text` | 天气文本 |
| `temperature` | `now.temp` 转 number | 主温度 |
| `feelsLike` | `now.feelsLike` 转 number | 桌面补充信息 |
| `windDirection` | `now.windDir` | 桌面补充信息 |
| `observedAt` | `now.obsTime` | 实况时间 |

响应不包含：

- API Key；
- LocationID；
- 和风天气原始完整响应；
- `fxLink`；
- 图标代码；
- 缓存内部时间。

接口返回 `Cache-Control: no-cache`，让浏览器刷新动作始终到达 Journal 服务；是否请求上游由服务端 10 分钟缓存决定。

## 8. 服务端数据流

```text
浏览器 GET /api/weather
          │
          ▼
JournalWeatherService
          │
          ├── 缓存未过期 ── 返回当前缓存
          │
          └── 缓存已过期 ── 严格请求 QWeather
                                  │
                                  ├── code = 200 且 schema 合法
                                  │      └── 写入 10 分钟缓存并返回
                                  │
                                  └── 失败
                                         └── 直接抛错
```

### 8.1 严格天气客户端

将和风天气实际请求和响应解析抽到新的严格客户端，例如：

```text
src/fetchers/qweatherCurrent.ts
```

职责：

- 使用当前项目已经配置的专属 API Host；
- 使用 Axios 发起请求；
- 使用 Zod 校验 `code` 和所需 `now` 字段；
- 将字符串温度转换为 number；
- 非 `code=200`、字段缺失、类型异常或请求失败时直接抛错；
- 不读取全局 config，不捕获后返回 `null`。

现有 `fetchWeather()` 改为调用严格客户端，但保留它当前的 `WeatherData | null` 对外契约和 Telegram 行为。这样：

- 实际请求和响应解析只有一份；
- Journal Web 使用严格客户端；
- 本次不改变 Telegram formatter 和调度函数签名；
- 现有 bot 失败处理不被本功能扩大修改。

这是必要的共享抽取，不把 Journal 服务直接依赖到 bot 的全局 config。

### 8.2 JournalWeatherService

新增一个短而直接的服务：

- 接收 `qweatherApiKey` 和 `qweatherCityId`；
- 调用严格天气客户端；
- 保存一份内存缓存和过期时间；
- TTL 固定为 10 分钟；
- 缓存过期后只发起一次正常请求；
- 请求失败时直接抛错，不读取过期缓存；
- 不重试、不落 SQLite、不写文件。

10 分钟 TTL 是本项目的产品决策，不是官方强制值。依据是官方说明实时数据本身可能有 5–20 分钟延迟；更短的频繁请求不会显著改善页面信息质量。

### 8.3 路由

新增 `src/journal-server/routes/weather.ts`：

- 注册 `GET /api/weather`；
- 无需管理员认证；
- 调用 `JournalWeatherService.getCurrent()`；
- 返回精简后的 Web DTO；
- 错误交给现有 Fastify error handler。

不在路由中捕获错误，也不返回 `null`、空对象或 200 错误文案。

## 9. 配置与部署

### 9.1 Journal 配置

在 `src/journal-server/config.ts` 中增加必填项：

```text
QWEATHER_API_KEY
QWEATHER_CITY_ID
```

Journal 开启天气功能后，这两项属于服务正常启动所需配置。缺失时配置解析直接失败，不启动一个永远没有天气的半成品页面。

不新增另一套 Key 或 City ID，也不把凭据写入数据库或设置页。

### 9.2 Journal 环境文件

在 `deploy/journal/.env.example` 增加相同变量。正式部署前，需要把当前 bot 使用的值同步到 `/opt/journal/.env`。

`deploy/journal/compose.yaml` 已通过 `env_file: /opt/journal/.env` 注入变量，不需要增加单独的 compose mapping。

### 9.3 Journal 镜像

`deploy/journal/Dockerfile` 需要把严格天气客户端复制到 runtime 镜像。只复制直接需要的文件，不把整个 bot、调度模块或其他 fetcher 带入 Journal 镜像。

## 10. 前端组件边界

### 10.1 `useCurrentWeather.ts`

负责：

- 调用 `/api/weather`；
- 保存 `weather`、`loading` 和 `error`；
- 每次 load 前清空旧 weather，避免请求失败后继续显示旧值；
- 只暴露一个 `load()` 动作；
- 不重试、不计时、不自动轮询。

### 10.2 `CurrentWeather.vue`

纯展示组件，接收：

```ts
defineProps<{
  weather: CurrentWeather | null;
  loading: boolean;
  error: string | null;
}>();
```

负责：

- 真实天气布局；
- 桌面/移动端字段裁剪；
- 同尺寸骨架；
- 观测时间格式化；
- 错误展示；
- 可访问文本。

不自行请求数据，不持有缓存，不感知 Feed。

### 10.3 `FeedView.vue`

负责：

- 仅在公开列表模式初始化天气；
- 把天气状态传给 `CurrentWeather`；
- 公开页刷新时并行刷新 Feed 和天气；
- 标签公开页继续显示天气；
- 详情模式不创建天气展示。

这三个边界避免把请求状态、展示 CSS 和 Feed 主逻辑全部堆入 `FeedView.vue`。

## 11. Attribution

在现有站点 footer 增加独立链接：

```text
天气服务：QWeather
```

链接到：

```text
https://www.qweather.com
```

该链接与 RSS、JSON Feed 并列但保持独立，不混入天气数值文案。footer 允许换行，避免移动端新增链接后溢出。

首版不直接使用 QWeather 图标，因此不需要图标资源的额外署名。

## 12. 预计文件改动

新增：

- `src/fetchers/qweatherCurrent.ts`
- `src/journal-server/weatherService.ts`
- `src/journal-server/routes/weather.ts`
- `web/src/composables/useCurrentWeather.ts`
- `web/src/components/journal/CurrentWeather.vue`

修改：

- `src/fetchers/weather.ts`
- `src/journal-server/config.ts`
- `src/journal-server/server.ts`
- `src/journal-server/types.ts`
- `src/shared/journalProtocol.ts`
- `deploy/journal/.env.example`
- `deploy/journal/Dockerfile`
- `web/src/api.ts`
- `web/src/types.ts`
- `web/src/components/journal/FeedView.vue`
- `web/src/App.vue`

不修改：

- Telegram formatter 文案；
- Telegram 调度时间；
- Journal entry、asset 和 profile 数据表；
- 公开 Feed、RSS 和 JSON Feed 数据结构；
- 设置页；
- `src/reminders/recurring.ts` 的 `rrule` 导入。

## 13. 完成标准

- 公开信息流标题下方显示当前天气；
- 桌面显示温度、天气、体感、风向和观测时间；
- 移动端显示温度、天气和观测时间；
- 默认公开页与标签页显示，详情页和管理页不显示；
- 骨架与真实天气行尺寸一致，加载完成后信息流不位移；
- 页面刷新同时刷新 Feed 和天气；
- 10 分钟内重复访问不重复请求上游；
- 缓存过期且上游失败时明确显示错误，不返回旧天气；
- API Key 和 LocationID 不进入浏览器响应；
- footer 清晰展示 QWeather attribution；
- Telegram 现有天气消息和调用入口保持原有对外行为。

## 14. 建议实施顺序

1. 抽取严格和风天气客户端，并让现有 bot fetcher委托它；
2. 增加 Journal 配置、天气 service 与公开路由；
3. 更新 Journal 镜像和环境变量示例；
4. 增加 Web 类型、API 和 `useCurrentWeather`；
5. 增加天气展示组件和骨架；
6. 接入公开 Feed 初始化与刷新；
7. 增加 footer attribution。

