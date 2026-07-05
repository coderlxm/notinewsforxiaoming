# AV Telegram 推送链路优化方案

## 1. 目标

围绕 `src/publishers/avTelegram.ts` 和 star 类型的 AV 推送链路做一轮针对性优化，目标只有两个：

- 降低单条新作推送的网络耗时和内存占用
- 把“发送策略”和“媒体抓取”拆开，后续还能继续调优，不需要再回头改 `avTracker` 主流程

本方案范围外：

- 不动 label 摘要逻辑
- 不改 `push_history` / `push_batch_history` 的去重语义
- 不新增重试、降级、备用发送通道

## 2. 当前实现梳理

现在 star 追踪的发送链路是：

1. `src/services/avTracker.ts:198-270` 拉 RSS、解析 HTML、翻译标题、挑磁力
2. `src/services/avTracker.ts:250-255` 无条件把 `coverUrl + sampleUrls` 交给 `sendAvUpdateWithGallery`
3. `src/publishers/avTelegram.ts:55-93`
   - 无封面：发纯文本
   - 有封面但无样品图：`sendPhoto`
   - 有封面且有样品图：先下载封面和最多 9 张样品图到 `Buffer`，再一次性 `sendMediaGroup`

当前 `avTelegram.ts` 的关键特征：

- `fetchImageBuffer()` 每张图单独走一次 `axios.get(..., { responseType: 'arraybuffer' })`
- 图集路径在 `sendMediaGroup` 之前会把所有图片完整读进内存
- `sendAvUpdateWithGallery()` 同时承担了发送策略、远端媒体抓取、Telegram 上传三件事

另外，历史提交 `bb35d0c` 和 `42bbd69` 已经证明一件事：**不能回退到“直接把 JavBus 图片 URL 交给 Telegram”这条路**。JavBus 图片抓取依赖浏览器头，优化方案必须保留“本地先取图，再交给 Telegram”的前提。

## 3. 现在这版的主要问题

### 3.1 图集路径的首包时间偏慢

`src/publishers/avTelegram.ts:76-92` 会先完成：

- 1 次封面下载
- 最多 9 次样品图下载

全部下载完后才真正调用 `sendMediaGroup`。这意味着一条 star 新作只要走图集分支，就一定先经历一整段“上游图片拉取时间”，Telegram 那边直到最后一步才开始发送。

### 3.2 内存占用和瞬时 IO 放大

图集模式下当前是 `coverBuffer + sampleBuffers[]` 全量入内存。对单条消息来说不是架构级灾难，但它把这条路径做成了明显的“大块二进制搬运”：

- 峰值内存跟图片总大小线性相关
- Node 先把字节吃进来，再重新组 multipart 往 Telegram 发
- 本地机器同时扮演“下载缓存器”和“上传缓存器”

### 3.3 `avTelegram.ts` 职责过重

这个文件现在同时决定：

- 发文本、封面还是图集
- 怎样抓 JavBus 图片
- 怎样组织 Telegram media group

结果就是：

- `avTracker` 不能显式选择“这次只发封面”还是“这次发图集”
- 后续如果要按定时任务 / 手动命令区分发送强度，只能继续把策略堆进 publisher

### 3.4 当前自动推送默认总是走“最重模式”

`src/services/avTracker.ts:250-255` 只要解析出样品图，就直接进入图集路径。也就是说，自动定时 `av_update` 和手动 `/fetchav` 在 star 场景下使用的是同一档发送强度。

如果你对“性能表现”不满意，这里其实是一个核心原因：当前自动任务并没有区分“及时告知”与“完整预览”。

## 4. 可选优化方向

| 方向 | 做法 | 优点 | 代价 |
| --- | --- | --- | --- |
| A. 传输层优化，行为不变 | 保留现有图集效果，但把图片抓取改成流式上传，复用连接，顺手把发送策略和抓图逻辑拆开 | 不改用户看到的内容，风险最小，先把最明显的实现问题收掉 | 每条图集消息仍然要拉多张样品图 |
| B. 自动任务只发封面，手动命令发图集 | 定时 `av_update` 走封面模式，`/fetchav` 或 force 模式保留图集 | 耗时和带宽收益最大，自动任务会明显变轻 | 会改变自动推送的信息密度 |
| C. 两段式发送 | 先立即发封面，再单独补一条图集 | 先到达速度最快，仍保留样品图 | 聊天流会更碎，消息数增加，实现也更绕 |

## 5. 推荐方案

推荐分两阶段做，但第一阶段就能单独落地：

### 第一阶段：采用 A，先把传输层和职责边界修正

这一阶段不改业务体验，重点是把 `avTelegram.ts` 从“全量 Buffer 搬运器”改成“明确的 Telegram 发送器”。

核心做法：

1. **保留本地取图前提，不走 Telegram 直连 URL。**
   原因不是风格问题，而是已有提交已经验证过 JavBus 图源需要自带请求头。

2. **把 `fetchImageBuffer()` 改成流式图片输入。**
   直接利用 telegraf 自带的 `Input.fromReadableStream()`，把 `axios` 的 `responseType` 从 `arraybuffer` 换成 `stream`。

3. **给 JavBus 图片抓取单独建一个共享 `axios` client。**
   保留现有 `User-Agent` / `Referer`，再加显式 `http(s).Agent`：
   - `keepAlive: true`
   - `maxSockets: 4` 或类似数量

   这样做的目的不是“复杂化”，而是把当前“一张图一个短连接”的模式收掉，并顺便把并发上限收在可控范围。

4. **在 publisher 内先归一化样品图列表。**
   先去重，再截断到上限，而不是直接对原数组 `slice(0, 9)`。这能避免重复图 URL 被重复抓、重复传。

5. **把发送入口收敛成一个明确的模式参数。**
   建议把现有两个导出函数收成一个输入模型：

   ```ts
   interface SendAvUpdateInput {
     message: string;
     coverUrl: string | null;
     sampleUrls: string[];
     mode: 'cover' | 'gallery';
   }
   ```

   这样 `avTracker` 明确决定“这次发哪种强度”，publisher 只负责执行。

6. **`runAvFetchOnce()` 内只解析一次 sender。**
   由 `avTracker` 在进入主流程时统一得到 `sender`，后面一路往下传，避免 publisher 再去决定是复用 bot 还是新建实例。

### 第二阶段：如果第一阶段后仍嫌慢，再采用 B

如果你真正想压的是“自动 AV 检查整体耗时”，那单纯优化传输层还不够，应该直接区分发送强度：

- 定时 `av_update`：默认 `mode = 'cover'`
- 手动 `/fetchav`：`mode = 'gallery'`
- 强制重发：继续 `mode = 'gallery'`

原因很直接：

- 自动任务的首要目标是“提醒你有新作”
- 图集更适合“我现在就要看细节”的手动场景

这一步的收益比第一阶段更大，因为 star 单条消息的图片请求数会从“封面 + 样品图”直接收缩到“只有封面”。

## 6. 建议落地方式

### 6.1 第一阶段建议只改两个文件

- `src/publishers/avTelegram.ts`
- `src/services/avTracker.ts`

第一阶段不需要额外拆很多新模块，保持短路径即可。

### 6.2 `src/publishers/avTelegram.ts` 建议改成下面的职责

只保留三件事：

1. 根据 `mode` 选择 `sendPhoto` 还是 `sendMediaGroup`
2. 把远端图片变成 Telegram 可接受的输入流
3. 组织最终的 Telegram 请求体

不要再让它决定：

- 什么时候该发图集
- 哪种调用场景该走轻量模式

这些应该由 `avTracker` 决定。

### 6.3 `src/services/avTracker.ts` 建议承担模式决策

建议扩展 `RunAvFetchOptions`，但只加和主路径直接相关的字段，例如：

```ts
interface RunAvFetchOptions {
  forceResend?: boolean;
  healthNotify?: boolean;
  avSendMode?: 'cover' | 'gallery';
}
```

然后在 star 分支把 `mode` 透传给 publisher。

这样后面你要做：

- 定时任务发封面
- 手动命令发图集
- 某些 target 永远只发封面

都不需要再回头重写 `avTelegram.ts`。

## 7. 预期收益

第一阶段完成后，能拿到的收益主要是：

- 图集发送前不再需要把所有图片完整读进 `Buffer`
- JavBus 图片抓取从零散短连接改成共享连接池
- `avTelegram.ts` 从“策略 + 抓取 + 发送”三合一，收敛成“明确模式下的发送器”

第二阶段如果继续推进，额外收益是：

- 自动 `av_update` 的单条 star 消息请求数显著下降
- 07:30 / 15:30 / 23:30 这三次定时检查的总耗时更可控

## 8. 我建议的最终取舍

如果你现在要的是“先把当前实现做对，再决定要不要改推送体验”，就按下面顺序：

1. 先做第一阶段：流式上传 + 连接复用 + 模式参数化
2. 跑一段时间再看体感
3. 如果还是觉得自动 AV 检查偏重，再把定时任务切到封面模式

这条路线的好处是：

- 第一刀先修实现方式，不碰业务体验
- 第二刀才决定要不要牺牲图集丰富度换速度
- 整个过程中都不需要引入 retry、fallback 或额外状态机
