# Journal 全链路灾难备份与新机恢复方案

状态：已确认，已实施，待发布  
日期：2026-07-25  
范围：`bwgdc01` Telegram bot 与 `rndc02` Journal 网站/API 的数据资产、运行配置和异机恢复  
目标：两台服务器同时永久丢失后，仍能依靠 GitHub、Google Drive 和密码管理器中的恢复卡片，在两台全新服务器上恢复完整业务主路径

## 1. 结论

不替换当前已经稳定运行的备份技术，继续使用：

- 普通 `tar.gz` 恢复包；
- rclone；
- Google Drive；
- systemd timer；
- 备份时短暂停止对应服务，直接取得 SQLite、WAL 和媒体的一致快照。

在此基础上补齐四项当前真正缺失的能力：

1. 将两台服务器的归档统一成有版本的固定恢复包格式；
2. 为每个归档生成独立完整性摘要，恢复入口只接受摘要匹配的归档；
3. 将“30 天后全部删除”改为短期每日恢复点加长期月度恢复点；
4. 在仓库中提供 bot 与 Journal 各自唯一的恢复入口，把新机恢复收敛为每台机器一次操作。

最终主路径：

```text
日常
  两台服务器各自在 04:50 停止自身服务
  → 生成版本化恢复包和完整性摘要
  → 上传到各自独立的 Google Drive 目录
  → 保留每日与月度恢复点
  → 恢复自身服务

两台旧机器同时丢失
  准备两台新的 Debian x86_64 服务器
  → 从 GitHub 取得仓库
  → 用密码管理器中的恢复卡片重新连接 Google Drive
  → Journal 新机执行 Journal 恢复入口
  → bot 新机执行 bot 恢复入口
  → 修改域名解析到 Journal 新 IP
```

不增加第二个自动上传通道、备份集群、热备数据库、双写、增量链、重试或失败降级。任一备份步骤失败时任务直接失败并保留明确日志，不生成或上传声称成功的不完整恢复点。

## 2. 要保护的灾难

本方案覆盖：

- `bwgdc01` 永久损坏或供应商账号丢失；
- `rndc02` 永久损坏或供应商账号丢失；
- 两台服务器同时需要更换；
- 新服务器 IP、磁盘和主机名与旧服务器不同；
- 需要从较早时间点恢复，以避开超过 30 天才发现的数据误删或数据库损坏；
- GitHub Actions 不能直接复用旧服务器环境，需要从空机器重建。

本方案不覆盖 Google 账号和 GitHub 账号同时永久丢失。解决这一风险的最小方式不是再增加自动备份系统，而是把账号恢复信息写入用户自己的密码管理器恢复卡片，见第 8 节。

## 3. 当前生产事实

以下事实于 2026-07-25 只读确认：

| 项目 | 当前状态 |
| --- | --- |
| bot 数据位置 | `bwgdc01:/root/NotiNewsForXiaoming/data` |
| bot 当前数据规模 | 约 4.4 MB |
| bot 关键数据 | `notinews.sqlite`、WAL/SHM、`reminders.db`、提醒与订阅 JSON |
| Journal 数据位置 | `rndc02:/opt/journal/data` |
| Journal 当前数据规模 | 约 24 MB |
| Journal 关键数据 | `journal.sqlite`、WAL/SHM、全部原始媒体与派生预览 |
| bot 备份 timer | enabled、active，每日 04:50 |
| Journal 备份 timer | enabled、active，每日 04:50 |
| bot 异地归档 | Google Drive 中已有连续每日归档 |
| Journal 异地归档 | Google Drive 中已有连续每日归档 |
| 当前保留时间 | 30 天 |
| 当前恢复方式 | 文档描述的人工下载、解压、放置配置、恢复服务 |

现有机制已经解决了“服务器磁盘损坏后仍有异地副本”，但还没有形成足够无脑的灾难恢复机制。

## 4. 当前缺口

### 4.1 只有备份脚本，没有正式恢复入口

现有恢复依赖人工理解旧机器目录、systemd、Docker Compose、OpenResty 和文件权限。真正换机时最容易出错的恰恰是这些只在灾难发生时才执行一次的步骤。

### 4.2 30 天后没有历史恢复点

当前两个脚本都会删除 30 天前的远端文件。如果误删、静默数据损坏或错误迁移在一个月后才被发现，所有保留归档可能已经带有相同问题。

### 4.3 两个脚本的远端清理边界不一致

Journal 只清理自己的子目录；bot 当前从 `NotiNewsBackups-LongTerm` 根目录执行过期删除。组件不应该清理另一个组件的归档。

### 4.4 恢复包没有独立完整性摘要

当前只有压缩包本身。远端存在某个文件名不能证明上传内容完整，也不能在恢复前明确排除传输损坏。

### 4.5 归档结构绑定旧机器的绝对路径

当前 tar 包直接保存 `/root/...`、`/opt/...` 和 1Panel OpenResty 的绝对路径。它便于原机覆盖恢复，但把数据、运行配置和机器路径混在了一起，不利于在新机器上明确控制落点。

### 4.6 服务器凭据本身不应成为唯一恢复钥匙

rclone 配置当前只存在于服务器。两台服务器丢失后，可以重新授权 Google Drive，但必须提前知道使用哪个 Google 账号、remote 名称、远端目录和域名账号。否则备份存在也很难快速取回。

## 5. 备份产物设计

### 5.1 两个独立恢复包

两台服务器各自产生自己的完整恢复包，不做跨服务器同步打包。

原因：

- 两边数据没有需要同一事务提交的关系；
- Journal 短暂停机不应阻塞 bot 的提醒、订阅等非 Journal 功能；
- 每台新机器只需要自己的恢复包；
- 任一服务器备份失败时直接暴露，不影响另一台服务器产生有效恢复点。

远端目录固定为：

```text
NotiNewsBackups/
├── bot/
│   ├── daily/
│   └── monthly/
└── journal/
    ├── daily/
    └── monthly/
```

bot 和 Journal 的生成、上传与过期清理只操作自己的目录。

### 5.2 统一的 v1 归档结构

bot 恢复包：

```text
notinews-backup-v1/
├── manifest.env
├── payload/
│   ├── app.env
│   ├── deploy-commit
│   ├── data/
│   └── notinews-bot.service
└── payload.sha256
```

Journal 恢复包：

```text
journal-backup-v1/
├── manifest.env
├── payload/
│   ├── app.env
│   ├── deploy-commit
│   ├── data/
│   ├── compose.yaml
│   └── proxy/
│       ├── site.conf
│       └── ssl/
└── payload.sha256
```

压缩包文件名固定包含组件、格式版本、时间和 Git commit 短 SHA：

```text
bot-v1-2026-07-25-045000-abcdef0.tar.gz
journal-v1-2026-07-25-045000-abcdef0.tar.gz
```

同名 `.sha256` 文件作为整个压缩包的远端完整性摘要。

### 5.3 manifest 内容

`manifest.env` 只使用简单的 `key=value`，避免恢复时依赖 JSON 解析工具。至少记录：

```text
format_version=1
component=journal
created_at=2026-07-25T04:50:00+08:00
git_commit=<40 位 SHA>
source_hostname=<旧主机名>
data_layout=journal-v1
```

恢复入口根据 `format_version` 和 `component` 决定如何读取归档。未知版本或组件不匹配时直接退出，不猜测、不兼容性降级。

### 5.4 明文取舍

继续沿用当前明确接受的明文 `tar.gz`：

- `.env`、Telegram token、Journal 管理密码、数据库和私有媒体都会进入 Google Drive；
- 能访问该 Google Drive 目录的人可以读取全部内容；
- 不额外引入 age、GPG、密钥轮换和“密钥丢失导致备份永久不可恢复”的风险。

如果未来不能继续接受明文，应单独设计加密迁移，不能在本方案实施时顺手增加。

## 6. 备份主路径

### 6.1 Journal

```text
systemd timer 到时
→ 停止 notinews-journal 容器
→ 将 .env、部署 SHA、Compose、Journal data 和反向代理配置复制到临时 staging 目录
→ 生成 manifest 与 payload 完整性摘要
→ 生成 tar.gz 和归档摘要
→ 上传 daily 目录
→ 当天是每月 1 日时，同一归档再进入 monthly 目录
→ 只清理 journal/daily 和 journal/monthly 中超过保留期的文件
→ 删除本机临时归档
→ systemd 恢复 Journal 容器
```

停止容器后再复制整个 `/opt/journal/data`，继续保证 SQLite、WAL、原始媒体和预览文件属于同一个时间点。不要改成只复制 `journal.sqlite`，也不要在容器运行时直接打包媒体目录。

### 6.2 bot

```text
systemd timer 到时
→ 停止 notinews-bot.service
→ 将 .env、部署 SHA、bot data 和 service 文件复制到临时 staging 目录
→ 生成 manifest 与 payload 完整性摘要
→ 生成 tar.gz 和归档摘要
→ 上传 daily 目录
→ 当天是每月 1 日时，同一归档再进入 monthly 目录
→ 只清理 bot/daily 和 bot/monthly 中超过保留期的文件
→ 删除本机临时归档
→ systemd 恢复 bot
```

停止 bot 后完整复制 `data`，保留两个 SQLite 文件及其 WAL/SHM、提醒状态、订阅配置和健康检查目标。

### 6.3 保留规则

推荐固定为：

| 恢复点 | 频率 | 保留时间 | 用途 |
| --- | --- | --- | --- |
| daily | 每天一次 | 35 天 | 日常误删和近期故障 |
| monthly | 每月 1 日一次 | 24 个月 | 很晚才发现的数据问题与换机 |

当前数据总量约 28.4 MB，即使不考虑压缩，两年 24 份月度双机恢复点也不到 700 MB。以当前规模没有必要为了节省这部分空间引入增量备份、去重仓库或复杂保留算法。

月度归档是从当天已经生成的同一份完整包复制过去，不再次停止服务、不再次读取数据库，也不产生第二套备份逻辑。

### 6.4 完整性规则

一次备份只有在以下产物全部存在时才算完成：

- `.tar.gz`；
- 对应的 `.tar.gz.sha256`；
- 归档内部的 `manifest.env`；
- 归档内部的 `payload.sha256`。

恢复入口在覆盖任何目标文件前先核对归档摘要、格式版本、组件类型和 payload 摘要。任一不一致直接退出，不继续恢复，也不尝试选取另一个归档。

## 7. 新机器恢复设计

### 7.1 支持边界

“一键恢复”明确支持：

- 已完成基础系统初始化的全新 Debian 12 或后续兼容 Debian stable；
- x86_64；
- Journal 使用 Docker Compose；
- bot 使用 Node 24 与 pnpm；
- 新旧服务器 IP、磁盘大小和主机名可以不同；
- 应用仍使用仓库中的现有目录约定。

跨发行版仍可以手工读取标准 tar.gz 中的数据，但仓库恢复入口不为 Ubuntu、Alpine、ARM 或面板差异添加分支。

这里的“一键”指恢复应用与全部业务资产，不包含三个无法由项目安全替用户决定的外部动作：

- 购买新服务器并取得 root 权限；
- 重新授权 Google Drive 并下载用户明确选择的恢复包；
- 将域名 DNS 改到新 Journal IP。

新 Debian 的运行时初始化沿用仓库现有部署文档，恢复入口不在灾难发生时临时发明另一套 Node、Docker 或反向代理安装方式。

### 7.2 仓库新增两个唯一恢复入口

实施时新增：

```text
scripts/restore-notinews
scripts/restore-journal
```

每个入口只接受一个明确的本地恢复包路径。下载哪个归档由用户决定，恢复入口不自动扫描、不自动选择“看起来最新”的文件，避免选错组件、时间点或损坏后的新归档。

bot 恢复入口负责：

1. 读取并核对 v1 bot 归档；
2. 停止 bot；
3. 将 `app.env`、`data` 和 service 文件放到仓库约定路径；
4. 使用 manifest 中的 Git commit 固定应用版本；
5. 安装该版本锁定的依赖；
6. 恢复文件所有者和权限；
7. 注册现有 systemd service 与备份 timer；
8. 启动 bot。

Journal 恢复入口负责：

1. 读取并核对 v1 Journal 归档；
2. 停止 Journal；
3. 恢复 `/opt/journal/.env`、部署标记、`data` 和 `compose.yaml`；
4. 使用 manifest 中的 Git commit 和仓库 Dockerfile 生成同版本 Journal 镜像；
5. 恢复反向代理站点配置和 SSL 文件；
6. 注册现有 Journal 备份 service 与 timer；
7. 启动 Journal。

恢复入口直接恢复归档指定的版本，不自动升级到 main 最新代码。灾难恢复完成后再走正常 GitHub Actions 发布流程升级，避免“恢复数据”和“升级应用/迁移数据库”混成一次操作。

### 7.3 两台服务器全部丢失时的顺序

固定顺序：

```text
1. 恢复 Journal 新机
2. 将 feeds.xmcloud.buzz 解析切到 Journal 新 IP
3. 恢复 bot 新机
```

先恢复 Journal 是因为 bot 的 `/note`、`/post` 和可见性操作依赖 Journal API。提醒、订阅等 bot 数据仍来自 bot 自己的恢复包，不需要从 Journal 反向生成。

### 7.4 不追求跨机同一秒一致

两台服务器的每日备份是独立快照，时间可能相差几十秒。灾难恢复后可能出现：

- bot 中保留了一个刚开始但尚未发送到 Journal 的捕获会话；
- Telegram 中已有成功提示，但对应 Journal 写入发生在 Journal 备份之后。

这属于每日全量备份 RPO 内的数据窗口。为消除这个窗口而做分布式快照、跨机锁或双机停机，会显著增加复杂度，不适合当前单用户项目。

本方案接受最大约 24 小时的数据丢失窗口。若以后真实使用强度上升，再单独评估提高备份频率，不在当前方案中预设复杂调度。

## 8. 密码管理器中的灾难恢复卡片

服务器备份之外，用户需要在自己的密码管理器中保存一条不提交 GitHub 的“NotiNews 灾难恢复”记录：

```text
GitHub 仓库地址
Google 账号
rclone remote 名称：notinews-drive
Google Drive 根目录：NotiNewsBackups
feeds.xmcloud.buzz 的 DNS/域名管理入口
Journal 与 bot 新服务器的 SSH 登录信息
```

恢复卡片不复制 `.env` 中的所有业务 token；业务 token 已经存在恢复包中。它只保存“如何找到代码、归档和新机器”的入口信息。

rclone 配置文件不放入它自己上传的恢复包，因为机器丢失后仍需先取得备份才能读到配置，形成循环依赖。新机器使用恢复卡片中的 Google 账号重新授权同名 remote。

## 9. 需要实施的最小文件范围

方案通过后，实施只修改：

```text
scripts/notinews-backup
scripts/journal-backup
scripts/restore-notinews
scripts/restore-journal
deploy/notinews-backup.service
deploy/journal/journal-backup.service
deploy/journal/deploy-release
.github/workflows/deploy.yml
doc/reference/简易使用手册.md
```

timer 继续使用现有每日 04:50，不修改业务代码、数据库结构、Journal API、Telegram 交互、Docker 网络或 GitHub Actions 发布架构。

Actions 仍沿用现有两个 job 和权限边界，只在原发布包中附带宿主机备份文件：bot job 直接安装系统文件；Journal job 由既有 root `journal-deploy-release` 安装受信任的 host assets 包，不增加新的远程命令权限。

Journal 第一次发布新机制前，需要把支持 `--install-host-assets` 显式参数的新版 `journal-deploy-release` 安装到宿主机一次。新版入口保留原单参数发布方式，因此可以先完成这次 trust anchor 更新，再推送代码；之后每次 Journal 发布都会随 host assets 包更新自身和备份设施，不再需要人工同步。

## 10. 实施顺序

### 阶段一：先固定新归档格式

- 调整两个备份脚本使用 staging 目录和 v1 相对路径；
- 增加 manifest、payload 摘要和归档摘要；
- 分离 bot 与 Journal 的远端目录；
- 增加 daily/monthly 保留规则；
- 保持现有 timer 和停机方式不变。

新格式开始产生后，旧 `NotiNewsBackups-LongTerm` 目录保持不动，不写兼容读取逻辑，也不批量转换或自动删除历史归档。确认新格式已经形成连续恢复点后，再把旧目录清理作为一次独立操作处理，避免新脚本跨目录删除既有资产。

### 阶段二：增加恢复入口

- bot 恢复入口只理解 bot v1；
- Journal 恢复入口只理解 Journal v1；
- 两者都要求用户显式指定恢复包；
- 两者都先读取 manifest 和摘要，再写入目标目录；
- 两者都按归档 Git commit 恢复，不默认使用 main。

### 阶段三：完善用户恢复信息

- 更新简易使用手册中的灾难恢复边界；
- 在密码管理器建立恢复卡片；
- 明确 Google Drive 中 daily/monthly 目录用途。

## 11. 明确不做

- 不引入 Restic、Borg、Duplicati、Kopia 或备份管理面板；
- 不增加 S3、115、另一块服务器磁盘等自动替代上传通道；
- 不做失败重试、fallback 或上传失败后保留“成功”标记；
- 不做 SQLite 主从、实时复制、双写或跨服务器事务；
- 不把 Docker 镜像长期塞进每日数据归档；
- 不把 node_modules、Git 工作区或可重新取得的依赖放进恢复包；
- 不自动选择最新归档；
- 不自动恢复到 main 最新版本；
- 不对未知归档版本做猜测性兼容；
- 不为了支持任意 Linux 发行版给恢复脚本增加复杂分支；
- 不在本方案中改变业务数据模型或部署拓扑。

## 12. Review 重点

建议本轮只确认以下四个决定：

1. 继续接受 Google Drive 中的明文恢复包；
2. 接受每日 35 天、月度 24 个月的保留规则；
3. 接受 Debian x86_64 作为一键恢复的明确支持边界；
4. 接受两台新机器分别执行一次恢复入口，而不是引入第三个编排节点追求真正的单按钮双机恢复。

这四点确认后，实施可以保持很小：沿用现有备份主路径，只规范产物、延长恢复窗口并补齐恢复脚本。
