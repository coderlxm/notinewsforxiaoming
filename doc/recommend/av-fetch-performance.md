# `/fetchav` 耗时分析与优化建议

## 线上观测

已在服务器 `bwgdc01` 的 `/root/NotiNewsForXiaoming` 采集两次样本。

### 样本一：普通 `av_update`

执行 test mode：

```sh
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=av_update pnpm start
```

关键日志：

```text
[av_update] [javbus/star/vwq] rss=624ms
[av_update] [javbus/star/vwq] done total=624ms pushed=0 skipped=1
[av_update] delay before label targets: 9618ms
[av_update] [javbus/label/7l] rss=304ms
[av_update] [javbus/label/7l] done total=483ms pushed=0 skipped=30
TOTAL_MS=12919 STATUS=0
```

拆解：

| 阶段 | 耗时 |
|---|---:|
| `star` RSS + 去重 | 624ms |
| `label` 前随机等待 | 9618ms |
| `label` RSS + 30 条解析 + 去重 | 483ms |
| pnpm/tsx 启动与其它开销 | 约 2.2s |
| 总耗时 | 12.9s |

这个样本说明：无更新时，最大瓶颈是 `label` 前 5-10 秒人为等待。

### 样本二：等价 `/fetchav force` 主流程

通过线上直接调用：

```ts
runAvFetchOnce(undefined, { forceResend: true, healthNotify: false })
```

这和 `/fetchav force` 的核心业务路径一致，区别只是没有 Telegram 里的“开始检查/检查完成”两条命令回执。

关键日志：

```text
[av_update] [javbus/star/vwq] rss=376ms
[av_update] [javbus/star/vwq] parse=21ms
[av_update] [javbus/star/vwq] translate=3131ms
[av_update] [javbus/star/vwq] send=3659ms
[av_update] [javbus/star/vwq] done total=7189ms pushed=1 skipped=0
[av_update] delay before label targets: 8307ms
[av_update] [javbus/label/7l] rss=132ms
[av_update] [javbus/label/7l] translate=12351ms
[av_update] [javbus/label/7l] send=636ms
[av_update] [javbus/label/7l] done total=13475ms pushed=18 skipped=0
FORCE_SUMMARY pushed=19 skipped=0 checked=2
TOTAL_MS=31041 STATUS=0
```

拆解：

| 阶段 | 耗时 | 占总耗时 |
|---|---:|---:|
| `label` 批量标题翻译 | 12.35s | 约 40% |
| `label` 前随机等待 | 8.31s | 约 27% |
| `star` 图集发送 | 3.66s | 约 12% |
| `star` 标题翻译 | 3.13s | 约 10% |
| `star` RSS + 解析 | 0.40s | 约 1% |
| `label` RSS + 解析 + 发送 | 约 1.12s | 约 4% |
| pnpm/tsx 启动与其它开销 | 约 2.1s | 约 7% |
| 总耗时 | 31.0s | 100% |

这个样本说明：有 force resend 或新 label 批次时，最大瓶颈是 `label` 批量翻译，其次仍然是 `label` 前人为等待。

## 结论

当前 `/fetchav` 慢的主因不在 RSSHub/JavBus，也不在 Cheerio HTML 解析。

已确认的主要瓶颈是：

1. **`label` 分支前固定 5-10 秒等待**
   - 无更新样本里占主要耗时。
   - 有更新样本里仍占 8.31 秒。

2. **`label` 摘要批量翻译一次翻译 10 个标题**
   - force 样本里耗时 12.35 秒，是最大单项耗时。
   - 当前 `AV_LABEL_SUMMARY_TOPK = 10`，实际本次 label 新批次 18 条，只展示并翻译前 10 条。

3. **`star` 新内容的图集发送和标题翻译**
   - force 样本里 star 总耗时 7.19 秒。
   - 其中 DeepSeek 翻译 3.13 秒，Telegram 图集发送 3.66 秒。
   - 这是有新内容时的真实业务成本，不是无更新慢的原因。

之前提到的“目标级并发”不是当前最该先做的优化。当前线上只有 2 个目标，且最大耗时来自 label 分支内部的等待和翻译，并发不能直接解决这两个主因。

## 当前代码对应位置

入口：

- `src/bot/interactive.ts:120` `/fetchav`
- `src/services/avTracker.ts:190` `runAvFetchOnce`

人为等待：

- `src/services/avTracker.ts:431-434`

```ts
const delay = LABEL_DELAY_MIN_MS + Math.floor(Math.random() * (LABEL_DELAY_MAX_MS - LABEL_DELAY_MIN_MS + 1));
console.log(`[av_update] delay before label targets: ${delay}ms`);
await sleep(delay);
```

label 批量翻译：

- `src/services/avTracker.ts:53-54`

```ts
const AV_LABEL_FETCH_LIMIT = 30;
const AV_LABEL_SUMMARY_TOPK = 10;
```

- `src/services/avTracker.ts:332-335`

```ts
const visibleItems = latestBatchItems.slice(0, AV_LABEL_SUMMARY_TOPK);
const translatedTitles = await translateLabelTitlesBatch(visibleItems.map((item) => item.title));
```

star 翻译与图集：

- `src/services/avTracker.ts:231` `translateAvTitle(title)`
- `src/services/avTracker.ts:252` `sendAvUpdateWithGallery(...)`
- `src/publishers/avTelegram.ts:77-92` 下载封面/样品图并上传 media group

## 最佳优化建议

把手动 `/fetchav` 里的 `label` 分支改成“轻量模式”。

轻量模式包含两个点：

1. 手动 `/fetchav` 跳过 `label` 前 5-10 秒等待。
2. 手动 `/fetchav` 的 `label` 摘要只翻译前 3 条，而不是前 10 条。

这是当前收益最大的组合，因为它同时覆盖两个线上样本：

- 普通无更新：直接去掉 5-10 秒等待。
- force/new label 批次：去掉 5-10 秒等待，并把最大耗时的 label 批量翻译从 10 条缩到 3 条。

## 建议实现

### 1. 扩展 `RunAvFetchOptions`

```ts
interface RunAvFetchOptions {
  forceResend?: boolean;
  healthNotify?: boolean;
  skipLabelDelay?: boolean;
  labelSummaryTopK?: number;
}
```

### 2. `/fetchav` 传手动模式参数

位置：`src/bot/interactive.ts:130`

建议改成：

```ts
const summary = await runAvFetchOnce(bot, {
  forceResend,
  healthNotify: false,
  skipLabelDelay: true,
  labelSummaryTopK: 3,
});
```

### 3. `runAvFetchOnce` 中按参数处理 label delay

位置：`src/services/avTracker.ts:431-434`

建议改成：

```ts
if (labelTargets.length > 0) {
  if (!options.skipLabelDelay) {
    const delay = LABEL_DELAY_MIN_MS + Math.floor(Math.random() * (LABEL_DELAY_MAX_MS - LABEL_DELAY_MIN_MS + 1));
    console.log(`[av_update] delay before label targets: ${delay}ms`);
    await sleep(delay);
  }
  for (const target of labelTargets) {
    results.push(await processTargetWithHealth(target));
  }
}
```

### 4. `processLabelTarget` 中按参数控制 TopK

位置：`src/services/avTracker.ts:332`

建议改成：

```ts
const labelSummaryTopK = options.labelSummaryTopK ?? AV_LABEL_SUMMARY_TOPK;
const visibleItems = latestBatchItems.slice(0, labelSummaryTopK);
```

定时任务不传 `labelSummaryTopK`，继续使用默认 10 条摘要。

## 预期收益

### 普通 `/fetchav` 无更新

基于样本一：

```text
现状：约 12.9s
去掉手动 label delay 后：约 3s
```

在真实 resident bot 里没有 `pnpm/tsx` 启动开销，体感可能更接近：

```text
现状：约 6-11s
改后：约 1-2s
```

### `/fetchav force` 或 label 有新批次

基于样本二：

现状：

```text
31.0s
```

去掉 label delay：

```text
约 22.7s
```

再把 label 翻译从 10 条降到 3 条：

```text
预计约 13-18s
```

这个估算保守，因为 DeepSeek 批量翻译耗时不一定严格线性，但 10 条标题降到 3 条会明显减少 prompt 和生成长度。

star 新内容仍然需要约 7 秒，这是翻译 + 图集上传的真实业务成本。如果要继续优化 star 分支，需要在“内容质量”和“速度”之间做取舍。

## 为什么不建议先做其它改动

### 不建议先做目标级并发

当前线上只有 2 个目标。force 样本的主要耗时是：

- label 翻译 12.35s
- label delay 8.31s
- star 翻译 + 图集 6.79s

目标并发理论上可以让 star 和 label 重叠，但如果仍保留 label delay 和 10 条翻译，收益不如直接修 label 分支。

而且目标并发会让 JavBus/RSSHub/DeepSeek/Telegram 同时受压，不是第一优先级。

### 不建议先缓存 RSS

RSS 请求耗时：

- 376-624ms
- 132-304ms

不是当前瓶颈。

### 不建议先优化 Cheerio 解析

label 30 条解析总量不到 1 秒，单条大多是个位数毫秒。

### 不建议先取消图集

图集发送在 force 样本里耗时 3.66 秒，确实不小，但它是 star 详情推送的重要价值。相比之下，label delay 和 10 条 label 翻译更该先修。

## 推荐落地边界

第一版只做：

- `/fetchav` 传 `skipLabelDelay: true`
- `/fetchav` 传 `labelSummaryTopK: 3`
- 定时 `av_update` 保持原默认：有 delay、TopK 10
- 不改 star 图集
- 不改 DeepSeek 模型
- 不改去重策略
- 不引入并发队列

这是当前最小的根因修复，能直接改善手动检查体验。

