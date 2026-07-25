# NotiNews 全链路灾难恢复提示词

用途：当 `rndc02` 与 `bwgdc01` 均永久丢失，需要在两台全新服务器上恢复 Journal 网站、Telegram bot、全部数据库、媒体、配置和自动备份机制时，将下方提示词完整交给具备本机文件、SSH、GitHub 和浏览器操作能力的 AI。

使用前只需准备：

- 两台全新 Debian stable x86_64 服务器的 root SSH 登录信息；
- GitHub 仓库访问权限；
- `NotiNews 灾难恢复`密码管理器卡片；
- Google Drive 账号访问权限；
- `feeds.xmcloud.buzz` 的 DNS 管理权限。

---

## 可直接使用的提示词

```text
现在发生了 NotiNews 全链路灾难：原 Journal 服务器 rndc02 和原 Telegram bot 服务器 bwgdc01 均已永久丢失。请你直接负责把整套系统恢复到灾难前最近一个由我明确选择的有效备份状态，直到 Journal 和 bot 的业务主路径、自动部署入口与后续自动备份机制全部恢复。

项目仓库：
https://github.com/coderlxm/notinewsforxiaoming

恢复前提：
- 我会提供两台全新 Debian stable x86_64 服务器的 root SSH 登录信息：
  - Journal 新服务器：<填写 SSH 信息>
  - bot 新服务器：<填写 SSH 信息>
- 我会提供或协助完成 Google Drive 与 rclone 授权。
- rclone remote 名称固定为：notinews-drive
- Google Drive 备份根目录固定为：NotiNewsBackups
- 域名固定为：feeds.xmcloud.buzz
- 我会提供 DNS 管理入口，涉及 DNS 切换时可以直接让我确认最终目标 IP。

开始操作后，先完整阅读仓库根目录 AGENTS.md，并以仓库实际代码和以下文件作为恢复事实来源：
- doc/design/journal-disaster-recovery-backup.md
- doc/reference/简易使用手册.md
- scripts/restore-journal
- scripts/restore-notinews
- scripts/journal-backup
- scripts/notinews-backup
- deploy/journal/
- deploy/notinews-bot.service
- deploy/notinews-backup.service
- deploy/notinews-backup.timer
- .github/workflows/deploy.yml

必须遵守以下恢复原则：

1. 严格按“Journal → DNS → bot”的顺序恢复，不要并行启动两条业务链路。
2. 先列出 Google Drive 中 Journal 和 bot 可用的 v1 daily/monthly 恢复点，向我展示时间、组件、文件名和归档记录的 Git commit，由我明确选择两个恢复包。不得自动选择最新包，也不得替我猜测恢复时间点。
3. 每个恢复包必须同时取得 `.tar.gz` 和同名 `.tar.gz.sha256`。只使用仓库已有恢复入口完成摘要、格式版本、组件类型和 payload 完整性处理；任一不一致立即停止并报告根因，不得跳过。
4. 恢复到归档 manifest 记录的 Git commit，不要恢复到 main 最新版本，不要在灾难恢复过程中升级依赖、迁移架构或顺手重构代码。
5. 不添加重试、fallback、降级、静默跳过或临时替代通道。遇到错误直接定位并修复主路径根因；如修复会改变归档数据、仓库恢复协议、部署架构或安全边界，先向我说明并取得确认。
6. 不删除或覆盖 Google Drive 中的任何既有恢复包。不要清理旧的 `NotiNewsBackups-LongTerm`。
7. `.env`、数据库、媒体、SSL 文件和其他恢复资产不得输出到对话、日志或提交到 GitHub。

执行顺序：

A. 建立恢复记录
- 记录两台新服务器的 IP、主机名、系统架构、选定恢复包和对应 Git commit。
- 所有写入前先确认目标确实是两台新服务器，避免触碰其他机器。

B. 准备 Journal 新服务器
- 按仓库现有部署约定准备 Docker、Docker Compose、Git、rclone 和现有 OpenResty 目录布局。
- 将仓库克隆到能够满足 `scripts/restore-journal` 路径推导的目录，并确保选定 manifest 中的 Git commit 可以取得。
- 使用同一个 Google 账号把 rclone remote 配置为 `notinews-drive`。
- 从 `NotiNewsBackups/journal/daily` 或 `NotiNewsBackups/journal/monthly` 下载我选定的 Journal v1 归档及其摘要到新服务器。
- 以 root 身份调用仓库唯一入口 `scripts/restore-journal`，参数只传入我选定的本地 Journal 归档路径。
- 让恢复入口负责恢复 `/opt/journal` 数据与配置、代理配置与 SSL、归档指定版本、Journal 容器及 Journal 备份 timer；不要手工复制归档内部文件绕过恢复入口。

C. 切换域名
- Journal 恢复完成后，将 `feeds.xmcloud.buzz` 的 DNS 记录切到 Journal 新服务器 IP。
- 保持现有域名、HTTPS 和路径不变，不建立临时域名或第二套代理配置。
- DNS 目标涉及用户最终确认时，只询问新 IP 是否正确，不扩大修改范围。

D. 准备 bot 新服务器
- 按仓库现有部署约定准备 Git、Node 24、pnpm 和 rclone。
- 仓库必须克隆到 `/root/NotiNewsForXiaoming`，这是 `scripts/restore-notinews` 的明确路径约束。
- 使用同一个 Google 账号把 rclone remote 配置为 `notinews-drive`。
- 从 `NotiNewsBackups/bot/daily` 或 `NotiNewsBackups/bot/monthly` 下载我选定的 bot v1 归档及其摘要到新服务器。
- 以 root 身份调用仓库唯一入口 `scripts/restore-notinews`，参数只传入我选定的本地 bot 归档路径。
- 让恢复入口负责恢复 `.env`、全部 bot 数据、归档指定版本、依赖、systemd service 和 bot 备份 timer；不要手工复制归档内部文件绕过恢复入口。
- 确保只有这台新 bot 服务器运行 Telegram long polling 消费者。

E. 恢复后外部连接
- 更新 GitHub Actions 中已因换机而变化的 Journal 和 bot 主机、端口、用户、SSH key 与 known_hosts 等部署 Secrets；保留仓库现有 workflow 和权限边界。
- 更新密码管理器中的 `NotiNews 灾难恢复`卡片，记录两台新服务器的 SSH 信息和新 IP。
- 不轮换恢复包内已有业务 token 或管理员密码，除非我明确要求或已有证据表明凭据泄露。

完成标准：
- Journal 的公开信息流、私有管理入口、RSS、JSON Feed、数据库、原始媒体与预览资产均来自所选 Journal 恢复点。
- Telegram bot 的提醒、订阅、Journal 写入链路和全部本地状态均来自所选 bot 恢复点。
- `feeds.xmcloud.buzz` 已指向 Journal 新服务器，原有 HTTPS 地址保持不变。
- GitHub main 后续 push 仍能按现有 workflow 发布到两台新服务器。
- 两台新服务器继续每日北京时间 04:50 生成各自 v1 备份；daily 保留 35 天，每月 1 日归档保留 24 个月。
- Google Drive 继续使用：
  - NotiNewsBackups/journal/daily
  - NotiNewsBackups/journal/monthly
  - NotiNewsBackups/bot/daily
  - NotiNewsBackups/bot/monthly

整个恢复过程中持续给我简短进度。只有在需要我选择明确恢复点、提供无法自行取得的登录信息、确认 DNS 目标，或某项操作会扩大既定恢复范围时才暂停询问。

最终只汇报：
- Journal 和 bot 各自选用的恢复包、备份时间与 Git commit；
- 两台新服务器和域名的最终对应关系；
- 已恢复的数据资产与运行机制；
- GitHub Actions 部署目标是否已换成新服务器；
- 下一次自动备份时间；
- 仍需我亲自完成的外部事项（如存在）。
```

## 使用边界

这份提示词恢复的是恢复包产生时的完整状态，而不是灾难发生瞬间尚未进入备份的数据。当前设计的最大数据窗口约为 24 小时；Journal 与 bot 是两个独立快照，其备份时间可能相差几十秒。

若只有一台服务器损坏，可保留提示词中的共同约束，只执行对应机器的恢复段落；不要重建仍然正常的另一台服务器。
