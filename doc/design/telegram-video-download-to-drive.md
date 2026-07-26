# Telegram 通用视频下载并上传 Google Drive 方案

状态：已实施（本机 Bilibili worker 数据链路已验证；运行仍假设 Tailscale 兼容已解决）  
粗探日期：2026-07-26（Asia/Shanghai）

## 结论

bot 仍部署在 `bwgdc01`，但下载执行调整为确定性分流：

- YouTube 和其他服务器可访问站点：在 `bwgdc01` 下载并上传。
- `bilibili.com` 与 `b23.tv`：经 Tailscale 私网 SSH 交给用户本机下载并上传。

三个常用样本的实机探测表明：YouTube 可以在 `bwgdc01` 直接支持，两个 Bilibili URL 在 `bwgdc01` 和 `rndc02` 都被 Bilibili 以 HTTP 412 拒绝，但用户本机已经完成 Bilibili 下载、ffmpeg 合并和同一 Google Drive 上传的真实链路。

方案不实现反向 SSH、备用入口或自动切换。命令开始时根据 URL host 只选择一条固定主路径；本机 Tailscale worker 不可用时直接失败。`rndc02` 不参与，Journal 服务也不需要修改。

## 需求边界

新增命令：

```text
/download <视频页面 URL>
```

“所有网站”按 yt-dlp 的实际能力定义：

- 不做站点白名单；任何 `http` 或 `https` URL 都交给 yt-dlp 的站点 extractor、嵌入视频 extractor 或 generic extractor 处理。
- yt-dlp 官方说明其支持数千个站点，未列出的站点仍可能被嵌入视频或 generic extractor 支持；这不等于任意网页都保证可下载。参考：[yt-dlp README](https://github.com/yt-dlp/yt-dlp)、[Supported sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)。
- 首版只处理服务器当前网络环境可直接访问的公开、非 DRM、已结束的视频。
- 需要账号、cookies、验证码、付费权限或特殊地区网络的内容不在首版范围内。yt-dlp 官方也说明部分站点需要同 IP 的 cookies，且 Cloudflare 等反自动化机制可能直接拒绝请求。参考：[yt-dlp FAQ](https://github.com/yt-dlp/yt-dlp/wiki/FAQ)。
- 一条命令只下载一个视频；不处理播放列表、频道整库和正在直播的内容。
- 首版单个视频上限为 8 GiB。这个限制来自当前服务器 25 GiB 的可用磁盘以及音视频分轨合并时的临时空间需求，不是 yt-dlp 自身能力边界。

## 实机粗探

以下为只读运行时观察，没有安装软件、下载视频或写入 Google Drive。

| 项目 | `bwgdc01` | `rndc02` |
| --- | --- | --- |
| 当前职责 | Telegram bot、X 视频同步器及其他既有服务 | Journal、1Panel 及多组业务容器 |
| 系统 | Debian 12，x86_64 | Debian 10，x86_64 |
| CPU | 2 核，负载约 0.20 | 3 核，负载约 0.15 |
| 内存 | 2.0 GiB，available 约 827 MiB | 2.9 GiB，available 约 1.9 GiB |
| 根盘 | 40 GiB，可用约 25 GiB | 42 GiB，可用约 27 GiB |
| `yt-dlp` | 未安装 | 未安装 |
| `ffmpeg` / `ffprobe` | 未安装；Debian 12 仓库可提供 ffmpeg 5.1.9 | 未安装 |
| `rclone` | 1.74.4 | 1.74.4 |
| Google Drive remote | `notinews-drive` 可读 | `notinews-drive` 可读 |
| Google Drive 容量 | 总计 5 TiB，可用约 4.978 TiB | 同一 Drive，结果一致 |
| YouTube 出站探测 | HTTP 200，约 0.37 秒 | HTTP 200，约 0.32 秒 |
| Google API 出站探测 | 可连接，约 0.15 秒 | 可连接，约 0.13 秒 |

源码和部署配置还确认：

- `notinews-bot.service` 当前就在 `bwgdc01` 以 `root` 用户运行。
- `bwgdc01` 的 `/root/.config/rclone/rclone.conf` 权限为 `600 root:root`，现有 bot 备份已经使用同一个 `notinews-drive` remote。
- 两台服务器都已有 `NotiNewsBackups/bot` 和 `NotiNewsBackups/journal` 目录的读取能力，因此无需迁移或重新授权 Google Drive。
- `bwgdc01` 已有 Node 24，符合当前 yt-dlp 对 Node 22+ JavaScript runtime 的要求。

## 三个常用链接专项探测

探测只使用 yt-dlp 的 simulate 模式提取元数据和格式，没有下载媒体文件。服务器上的临时官方二进制和探测目录均已清理。

| URL | `bwgdc01` | `rndc02` | 本地网络对照 | 结论 |
| --- | --- | --- | --- | --- |
| YouTube `NdqnUsJk8G4` | 强制 IPv4 后成功解析；8:03，非直播，可取得 MP4 格式 | 未重复探测 | 无需对照 | 支持；实现必须固定 IPv4 |
| Bilibili `BV1m13g6rE1R` | HTTP 412 | HTTP 412 | 成功解析；4:41，可选择 1080p 视频与音频 | extractor 支持，但两台服务器出口被拒绝 |
| `b23.tv/8dzUB7L` | 短链入口 HTTP 412 | 短链入口 HTTP 412 | 成功跳转到 `BV1ZBXABBEWQ`；10:06，可选择 1080p 视频与音频 | 短链支持，但两台服务器出口被拒绝 |

专项探测还做了这些交叉核对：

- YouTube 第一次使用默认网络路径时停在 player API；加入 yt-dlp 官方 `--force-ipv4` 后立即成功，因此这是明确的部署参数，不是重试或备用路径。
- Bilibili 在 stable `2026.06.09`、nightly `2026.07.23.234303`、默认请求以及官方 standalone 的 Chrome impersonation 下结果一致。
- 两台 VPS 均失败而本地网络成功，说明链接有效、Bilibili extractor 可用，阻塞点是服务器出口受到 Bilibili 风控，不是 URL 格式、短链跳转或 ffmpeg。
- yt-dlp 官方已知问题对 Bilibili 412 的建议是优先使用不同 IP；登录 cookies 虽可能改变结果，但存在账号被封风险。参考：[yt-dlp known issues](https://github.com/yt-dlp/yt-dlp/issues/3766)、[Bilibili 412 issue](https://github.com/yt-dlp/yt-dlp/issues/16962)。

### Bilibili 建议

首版推荐直接采用下方已验证的用户本机 worker。若不采用本机 worker，其他选择按以下顺序：

1. 为 `bwgdc01` 提供一个固定、可信且已实测能访问这两个 URL 的 HTTP/HTTPS/SOCKS 出口；yt-dlp 原生支持 `--proxy`。bot 和 Google Drive 上传仍留在 `bwgdc01`，只有 yt-dlp 的站点访问经过该出口。
2. 另选一台具有可用出口的服务器，但必须先用这两个样本完成同样的只解析探测；普通海外 VPS 或仅换到 `rndc02` 已证实无效。
3. 不建议首选导入 Bilibili 登录 cookies。官方明确提示这类 412 使用登录 cookies 可能导致账号被封，而且 cookies 还会引入续期和凭据保管问题。

不建议为 Bilibili 单独手写网页/API 下载器，也不建议接入第三方视频解析服务；这会偏离“以 yt-dlp 能力为边界”的主路径。

如果暂时没有可用出口，可以先实施 YouTube 和其他当前服务器能直接访问的站点，但必须明确 Bilibili 暂不可用。这属于缩小首版范围，不应伪装成已经完整支持三个常用场景。

## 用户本机端到端探测

本机运行条件：

| 项目 | 结果 |
| --- | --- |
| 架构 | macOS arm64 |
| yt-dlp | `2026.07.04` |
| ffmpeg / ffprobe | `8.1.2`，均已安装 |
| rclone | `1.74.4` |
| Google Drive remote | `personal-gdrive` |
| 本机磁盘 | 可用约 116 GiB |
| Drive 容量 | 与服务器一致：总计 5 TiB，可用约 4.978 TiB |
| Tailscale | CLI 已安装，但本机当前状态为 Stopped |
| macOS Remote Login | 当前未开启 |
| 接电睡眠 | `sleep=0`，接电时不会因空闲自动进入系统睡眠 |
| 电池睡眠 | `sleep=1`，脱离电源时不适合作为可靠 worker |

真实链路使用 `BV1m13g6rE1R` 完成：

```text
本机 yt-dlp 下载
→ ffmpeg 合并 MP4
→ rclone 上传 personal-gdrive
→ Google Drive 回读文件元数据与哈希
→ 清理本机临时目录
```

结果：

- 最终 MP4 大小：`14,970,301` bytes。
- Google Drive 返回同样大小，MIME 为 `video/mp4`。
- 云端 SHA-256：`395ec61f647cff69df72f92454288263c5c7a01c49991f1cdf812cb12536e568`。
- 云端文件保留在：

```text
personal-gdrive:NotiNewsDownloads/_probe/2026-07-26/20260726-175159/
王虹说法国给了我自由为何成了国人的破防点？ [BV1m13g6rE1R].mp4
```

这证明本机的 Bilibili 下载、音视频合并和 Google Drive 上传数据链路已经可用。本机临时目录已经清理，当前剩余条件只有从 `bwgdc01` 触发本机的控制链路。

## 本机 worker 控制链路

方案假设 Tailscale 与 Shadowrocket 的兼容问题已经由独立任务处理完毕，`bwgdc01` 可以通过 tailnet 稳定访问 Mac。这里不实现或保留反向 SSH。

```text
bwgdc01 Telegram bot
→ 根据 host 识别 Bilibili URL
→ Tailscale 私网
→ Mac SSH
→ 本机固定 worker
→ yt-dlp + ffmpeg
→ 本机 personal-gdrive
→ 结构化结果经 SSH stdout 返回 bot
```

实施内容：

1. 假设 Mac 和 `bwgdc01` 均已在同一 tailnet 在线，并能通过固定 Tailscale hostname 或 IP 互访。
2. 开启 macOS Remote Login。
3. 为 `bwgdc01` 创建访问 Mac 的专用 SSH key。
4. Mac 端 `authorized_keys` 对该 key 配置 forced command，只允许执行下载 worker，并禁用端口转发、agent 转发、X11 和 PTY。
5. bot 不把 URL 拼进 SSH 远端命令；只连接固定 Tailscale endpoint，再通过 stdin 发送结构化请求。
6. worker 从本机固定配置使用 `personal-gdrive`，本机 rclone token 不复制到服务器。
7. Tailscale 或 SSH 不可达时直接失败，不增加反向 SSH、代理或服务器直连等备用路径。

本机作为 worker 时需要保持接电且不合盖睡眠。当前接电空闲睡眠已经关闭；脱离电源时系统会很快睡眠。届时任务直接报告本机 worker 不可达，不排队，也不改走服务器。

此前专项探测的运行时事实是：`bwgdc01` 已在 tailnet 中，本机安装了 Tailscale，但当时状态为 Stopped，Tailscale ping 没有响应。本方案不把该旧状态写成已经解决；只是按用户要求，把“兼容任务完成后两端可达”作为实施前提，本功能不负责验证或修复 Tailscale。

## 服务器选择

选择 `bwgdc01` 的依据：

1. bot 和非 Bilibili 下载进程均在同一台机器，常规主路径最短。
2. Google Drive 授权已经存在，服务用户也与 bot 一致。
3. Debian 12 可直接提供 ffmpeg，系统运行环境比 `rndc02` 新。
4. 25 GiB 可用磁盘足以支持首版 8 GiB 单文件限制和合并临时空间。
5. 不占用 Journal 所在服务器，也不需要为 `rndc02` 新增下载 worker、内部 API 或 SSH 远程执行。

`rndc02` 的资源余量略好，但不足以抵消跨机调度、状态回传和额外故障点。只有后续需要独立下载盘或明确的大文件吞吐时，才值得重新评估拆出 worker。

两台服务器对 Bilibili 都返回 412，因此这一结果不改变主机选择；它要求的是可用网络出口，而不是把 worker 从 `bwgdc01` 搬到 `rndc02`。

用户本机 worker 只承担 Bilibili 的下载和上传，不接管 Telegram long polling、提醒、Journal 或其他 bot 业务；`bwgdc01` 仍是唯一 bot 主机。

## 交互设计

授权聊天发送：

```text
/download https://example.com/video
```

bot 只创建一条状态消息，并持续编辑同一条消息：

1. `正在解析并下载视频…`
2. `下载完成，正在上传 Google Drive…`
3. `已上传：<文件名> · <文件大小> · <Drive 目录>`

失败时也编辑同一条状态消息，明确显示失败阶段和 yt-dlp 或 rclone 返回的核心错误。首版不自动重试、不切换服务器、不改用其他下载或上传通道。

其他交互约束：

- 继续复用 `isAuthorized(ctx)`，只有既有 `TG_CHAT_ID` 能触发。
- 命令只接受一个 URL，不接受任何 yt-dlp 参数，避免 Telegram 输入变成命令行选项。
- 同一时间只允许一个 `/download` 任务；繁忙时直接提示当前任务尚未结束。
- 首版不展示百分比。只展示稳定的阶段状态，避免依赖 yt-dlp/rclone 普通日志文本。
- 成功消息返回 Google Drive 内的目录，不创建公开分享链接。
- `/help` 增加 `/download <URL>` 说明。

## 下载与上传主路径

```text
Telegram /download
→ 校验授权、URL 和当前是否有任务
→ 根据 URL host 选择 bwgdc01 或用户本机 worker
→ 所选 worker 创建独立临时目录
→ 所选 worker 使用 yt-dlp 下载并由 ffmpeg 合并
→ 取得 after_move 后的最终文件
→ 所选 worker 使用自己的 rclone remote 上传同一个 Google Drive
→ 编辑 Telegram 状态消息
→ 删除本次本地临时目录
```

Google Drive 目标目录建议为：

```text
NotiNewsDownloads/YYYY-MM/<yt-dlp 最终文件名>
```

服务器使用 `notinews-drive`，用户本机使用 `personal-gdrive`；两个 remote 已确认指向同一个 Google Drive。文件名包含 yt-dlp 提供的视频 ID，重复下载同一视频时直接覆盖同名文件。

yt-dlp 使用其默认格式选择，以获得该站点能提供的最佳可用质量；不自行维护站点格式规则。官方说明默认会选择最佳可用格式，分离的音视频流需要 ffmpeg 合并。参考：[yt-dlp README 的格式选择与依赖说明](https://github.com/yt-dlp/yt-dlp#format-selection)。

调用时固定启用这些业务约束：

- 禁止播放列表，并限制最多一个下载结果。
- 最大文件 8 GiB。
- 拒绝正在直播的内容。
- 明确启用本机 Node 作为 JavaScript runtime。
- 固定强制 IPv4；这是 YouTube 样本在 `bwgdc01` 成功解析的必要条件。
- Bilibili URL 固定交给用户本机 worker，不在本机不可达时自动切换到服务器直连。
- 使用 yt-dlp 的 `--print` / `after_move:filepath` 获取最终路径，不解析易变的普通日志。官方也建议外部程序使用 `--print`、`--progress-template` 等稳定输出接口。参考：[Embedding yt-dlp](https://github.com/yt-dlp/yt-dlp#embedding-yt-dlp)。
- URL 始终作为独立参数传入，整个调用不使用 `shell: true`。

上传固定调用所选 worker 本机的 `rclone copyto`，并沿用现有备份链路的 `--retries 1 --low-level-retries 1`，不增加重试。`copyto` 适合把单个本地文件上传到指定远端路径。参考：[rclone copyto](https://rclone.org/commands/rclone_copyto/)。

## 运行资源与生命周期

- 进程内只保留一个简单的运行中标记，不建立队列和持久化任务状态。
- 单任务最长运行 6 小时，超时直接失败。
- yt-dlp 成功后才进入上传阶段；rclone 成功后才报告完成。
- 无论下载或上传在哪一步失败，本次临时文件都会删除，错误不会被吞掉。
- worker 为每个任务创建独立临时目录，并在任务结束时删除；该目录不存放任何正式业务数据。
- 不把视频再上传 Telegram，避免 Telegram 文件大小和消息链路成为第二条传输路径。

## 与每日 bot 备份的冲突

现有 `notinews-backup.service` 每天会先停止 `notinews-bot.service`，备份结束后再启动。长视频如果跨过该时间点，bot 及其下载子进程会被 systemd 终止。

首版实施必须把下载和 bot 备份放到同一个文件锁中：

- `/download` 从开始下载到 Drive 上传结束持续持有锁，包括经 SSH 等待用户本机 worker 的时间。
- bot 备份先等待同一把锁，再停止 bot 并执行原有备份。
- bot 停止后不会再有新下载进入，因此备份流程可以继续保持原来的完整停机备份语义。

这只解决两个现有本机任务之间的互斥，不增加重试、任务恢复或失败兜底。X 点赞视频同步仍按现状运行；首版不把不同功能合并成统一任务系统。

## 软件安装与版本策略

`bwgdc01` 需要补齐：

- Debian 12 仓库的 `ffmpeg`，同时提供 `ffprobe`。
- yt-dlp 官方 x86_64 Linux 独立发行文件 `yt-dlp_linux`。

粗探时官方 stable 为 `2026.06.09`，专项探测还使用了 nightly `2026.07.23.234303`。实施时在仓库部署脚本中固定已审阅版本和官方 SHA-256，不在每次部署时静默追随 latest，也不调用运行时自更新。版本升级通过后续明确的代码提交完成。

选择官方发行文件而不是 Debian 自带 yt-dlp，是因为 yt-dlp 官方明确提醒发行版包可能过旧；站点规则又会持续变化。由于本次 stable 版本正好存在 Bilibili 已知问题，实施版本应采用通过三个样本复核后的固定 nightly，而不是固定旧 stable。参考：[官方安装说明](https://github.com/yt-dlp/yt-dlp/wiki/Installation)、[官方 releases](https://github.com/yt-dlp/yt-dlp/releases)。

## 最小实现范围

建议改动：

- 新增 `src/services/videoDownload.ts`
  - 管理单任务状态、URL host 路由、服务器本机子进程或受限 SSH worker，以及结构化结果。
- 修改 `src/bot/interactive.ts`
  - 注册 `/download`，复用授权校验并编辑同一条状态消息。
- 修改 `src/reminders/formatter.ts`
  - 在帮助内容加入命令说明。
- 新增本机下载 worker
  - 从 stdin 接收一个结构化 URL 请求，固定调用本机 yt-dlp、ffmpeg 和 `personal-gdrive`，通过 stdout 返回阶段和最终结果。
- 新增本机受限 SSH 安装配置
  - 配置 forced command 和专用工作目录，不启动额外常驻业务进程。
- 增加固定的 Tailscale SSH worker endpoint 配置
  - 配置 Mac 的 Tailscale host、port、user 和专用 key，不实现第二 endpoint 或自动切换。
- 新增一个 bot 媒体工具安装脚本
  - 固定 yt-dlp 版本与校验值，安装 ffmpeg。
- 修改 `.github/workflows/deploy.yml`
  - bot 部署时同步并执行上述安装脚本；Journal 部署不受影响。
- 小幅调整 `deploy/notinews-bot.service`、`deploy/notinews-backup.service` 与现有备份脚本
  - 明确 rclone 配置路径、专用工作目录，以及下载与每日备份互斥。

不需要改动：

- Journal API、Journal 容器和 Web 页面。
- 数据库 schema。
- Google Drive OAuth 配置。
- `rndc02` 部署流程。
- X 点赞视频下载器。

## 首版明确不做

- cookies 或账号登录态管理。
- DRM 绕过。
- 播放列表、频道批量下载和直播录制。
- 多任务队列、任务恢复、跨重启续传。
- 自动重试、备用服务器或备用网盘。
- 反向 SSH 或其他本机备用入口。
- Google Drive 公开分享链接。
- 下载历史、去重记录或 Web 管理页。
- 自定义清晰度、格式、字幕、封面和 yt-dlp 参数。

## 实施后的业务验收点

1. 授权聊天中的公开单视频 URL 能完成下载并出现在 `NotiNewsDownloads`。
2. YouTube 分离音视频格式能由 ffmpeg 合并成一个最终文件。
3. 不支持的 URL、直播、播放列表、超限文件和 yt-dlp 站点错误会在原状态消息中明确失败。
4. 连续发送两个命令时，第二个命令不会启动新任务。
5. 上传失败不会显示成功，本地临时文件会被清理。
6. 长任务与每日 bot 备份不会互相终止；备份等待下载上传结束后再执行。
7. Bilibili 长链接和 `b23.tv` 短链固定交给用户本机 worker，并能上传到同一个 `NotiNewsDownloads`。
8. 用户本机不可达时明确失败，不改走服务器，不建立离线队列。
9. Tailscale endpoint 按兼容已解决的假设配置；本功能不启动、修改或验证 Tailscale 本身。
