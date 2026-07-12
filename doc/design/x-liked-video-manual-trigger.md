# X 点赞视频手动触发方案

## 结论

可以和 NotiNewsForXiaoming 串联，且适合当前部署形态。

两个项目都运行在 `bwgdc01`：

- NotiNewsForXiaoming 位于 `/root/NotiNewsForXiaoming`，由 `notinews-bot.service` 以 root 用户常驻运行。
- X 点赞视频下载器位于 `/opt/x-liked-video-downloader`，通过 Docker Compose 执行一次性同步任务。

因此无需新增 HTTP 服务、端口或鉴权密钥。Bot 收到授权聊天中的固定命令后，直接在宿主机启动下载器即可。

## 推荐交互

新增 Telegram 命令：

```text
/syncx
```

交互过程：

1. Bot 立即回复“已开始检查 X 点赞视频”。
2. Bot 在后台执行一次现有 `sync`。
3. 执行结束后，Bot 根据下载器输出的 JSON 返回简短摘要，例如：
   - “同步完成：发现 2 条，下载 2 个，上传 2 个。”
   - “同步完成：没有发现新的点赞视频。”
   - “同步失败：X API 返回 429。”

命令不接受路径、Shell 参数或下载数量等用户输入，避免把 Telegram 消息拼接进 Shell。

## 调用方式

在 Bot 项目中增加一个独立服务模块，使用 Node.js `child_process.spawn` 启动固定程序和固定参数：

```text
/usr/bin/docker compose \
  --project-directory /opt/x-liked-video-downloader \
  --env-file /opt/x-liked-video-downloader/.env \
  -f /opt/x-liked-video-downloader/current/compose.yml \
  run --rm app sync
```

不使用 `shell: true`。收集标准输出并解析下载器最后输出的 JSON；标准错误和非零退出码直接作为失败结果反馈。

Bot 的消息处理不等待整个下载过程占住处理链：收到命令后先回复，再异步等待子进程，完成后主动发送结果。

## 可直接复用的现有能力

- `isAuthorized(ctx)` 已按 `TG_CHAT_ID` 限制为当前私人聊天，未授权用户不能触发。
- 下载器自己的 `sync.lock` 会阻止两个同步实例同时处理数据。
- 下载器已有单次最多 50 个文件、总计最多 10 GiB 的安全限制。
- 下载器已有去重、下载、rclone 上传、状态持久化和 JSON 统计输出。
- NotiNews Bot 的 systemd 服务当前以 root 运行，具备启动 Docker Compose 的权限。

## 最小代码范围

NotiNewsForXiaoming：

- 新增 `src/services/xLikedVideoSync.ts`，只负责启动固定命令、解析结果和限制输出大小。
- 在 `src/bot/interactive.ts` 注册 `/syncx`，复用现有授权校验和消息风格。
- 在 `/help` 内容中增加命令说明。

X 点赞视频下载器无需修改。

## 并发和错误处理

- 下载器文件锁是最终并发保护；若凌晨自动任务正在运行，手动命令会直接返回“已有同步任务正在运行”。
- Bot 进程内保留一个简单的运行中标记，让连续点击时立即得到提示，无需任务队列。
- 子进程设置合理的最长运行时间，例如 30 分钟；超时后终止并反馈失败。
- Telegram 只展示统计数字和简短错误，不发送视频标题、文件名、Token、rclone 配置或完整日志。
- 不增加自动重试；失败原因直接反馈，由用户决定是否再次执行。

## 与每日自动任务的关系

有两种使用方式：

### 保留每日自动同步

`/syncx` 只是临时提前同步。北京时间凌晨 2 点的自动任务继续运行。

优点是不会因为忘记操作而漏掉当天同步；缺点是每天的自动 API 请求成本仍然存在，即使当天没有新增点赞。

### 改为纯手动同步

停用下载器当前的 cron，只在点赞后通过 `/syncx` 执行。

这是 API 成本最低的模式：没有操作就没有 X API 请求。但同步完全依赖手动触发。

建议先保留凌晨 2 点自动任务，并加入 `/syncx`。使用一段时间后，如果确认自己能稳定手动触发，再单独停用 cron。这样本次串联不改变现有可靠性。

## 成本和复杂度评估

- 开发量：小，主要是一个子进程封装和一个 Bot 命令。
- 服务器成本：无新增常驻服务，无新增端口，资源增量可忽略。
- X API 成本：每次 `/syncx` 都会真实调用一次 liked posts API；如果同一天手动执行后凌晨任务又执行，会产生两次同步请求。
- 运维复杂度：低；两个项目仍保持独立，Bot 只负责触发，不接触下载器内部数据库和凭据。

## 实施前需要确认的内容

当前信息已经足够实施，不需要新增凭据。实施时只需决定一件事：

- 保留北京时间凌晨 2 点自动任务，还是改成仅 `/syncx` 手动触发。

已确认按“保留自动任务，同时增加 `/syncx`”实施。
