# 项目更名方案：NotiNewsForXiaoming → Xiaoming Hub

## 1. 文档状态

- 状态：待 Review
- 设计日期：2026-07-20
- 目标：为已经扩展为个人提醒、追踪、内容推送与 Journal 的项目建立统一且可长期使用的名称
- 推荐名称：`Xiaoming Hub`
- 技术 slug：`xiaoming-hub`
- 中文定位：小明的个人生活中枢

本方案只处理名称体系与改名边界，不改变功能、接口、数据结构、部署拓扑或 Telegram 交互主路径。

## 2. 为什么需要更名

`NotiNewsForXiaoming` 对应的是项目早期“给小明发送通知和新闻”的形态。当前已经实际落地的能力包括：

- Telegram 常驻交互；
- 一次性提醒、循环提醒和自然语言提醒；
- 固定时点的生活提醒与内容推送；
- start.gg、Steam、AV、V2EX、服务器状态等订阅和追踪；
- Telegram 内容采集；
- 公开与私有 Journal；
- 多媒体归档、富文本文章、RSS 与 JSON Feed；
- Web 端资产管理、编辑、置顶、可见性和删除。

“News” 已经只代表其中一小部分，“Noti” 也无法覆盖主动记录、内容创作和个人资产管理。旧名称继续存在会让 README、Bot 自我介绍、仓库名称和新功能的真实定位越来越不一致。

项目当前更准确的产品模型是：

```text
Xiaoming Hub
├── Bot：提醒、查询、订阅、追踪和主动推送
└── Journal：采集、归档、创作、公开信息流和私有资产管理
```

## 3. 命名结论

### 3.1 推荐名称

统一项目名称为：

```text
Xiaoming Hub
```

推荐理由：

- `Xiaoming` 保留项目只服务个人的归属，不制造通用产品或多用户平台预期；
- `Hub` 能同时容纳输入、存储、提醒、追踪和输出，不绑定某一个已有功能；
- 两个单词足够短，口头表达、仓库名和服务通知都容易识别；
- 不强调 AI，避免把 DeepSeek 这一项实现依赖误写成产品本体；
- 不使用 `OS`、`Platform` 或 `Cloud`，避免鼓励超出个人工具边界的架构扩张。

本名称是个人项目标识，不作为商业商标结论。公开检索没有发现需要优先避让的同名主流软件项目，但将来若转为公开产品或商业服务，需要重新做域名、商标和应用市场名称核对。

### 3.2 统一写法

| 场景 | 写法 |
| --- | --- |
| 项目展示名 | `Xiaoming Hub` |
| GitHub 仓库名 | `xiaoming-hub` |
| `package.json` name | `xiaoming-hub` |
| Telegram Bot 自称 | `Xiaoming Hub Bot` |
| Telegram 帮助标签 | `#XiaomingHub` |
| HTTP User-Agent | `XiaomingHubBot` |
| 中文一句话说明 | `小明的个人生活中枢` |

`package.json` 使用全小写连字符形式，符合 npm 对 package name 的格式要求：[npm package.json name 规则](https://docs.npmjs.com/creating-a-package-json-file/)。代码中不新增 `XH`、`XMH` 等缩写，避免同一个项目出现第二套不直观名称。

### 3.3 保留 Journal 的领域名

`Journal` 已经是稳定且准确的业务领域名，继续用于：

- `src/journal-server`、`src/journal-bot` 和 Journal 相关类型；
- `JOURNAL_*` 环境变量；
- `/api` 路由、数据库表和附件目录；
- 部署通知中的 `Journal` 服务名称；
- 设计文档中的 Journal 产品描述。

`Xiaoming Hub` 是项目总名，`Journal` 是其中一个业务模块，两者不是互斥品牌。

### 3.4 保留“小明同学”的公开身份

Web 公开页当前使用“小明同学”作为作者名称、头像身份、Feed 作者和页面标题。这是内容作者身份，不是旧项目名，继续保留：

- 页面标题“小明同学”；
- 头像和作者署名；
- RSS / JSON Feed 作者；
- 页脚“小明同学的生活记录”。

不在公开 Journal 页强行增加 `Xiaoming Hub` Logo、导航品牌条或“Powered by”文案。项目改名不应破坏当前个人内容页的表达。

## 4. 候选名称对比

| 候选 | 优点 | 不采用原因 |
| --- | --- | --- |
| `Xiaoming Hub` | 个人归属明确，覆盖提醒、追踪和 Journal，语义稳定 | 采用 |
| `MingFlow` | 简短，有信息流和自动化含义 | 更像工作流产品，且已有同名 PyPI 项目：[mingflow](https://pypi.org/project/mingflow/) |
| `MingMate` | 有私人助手感 | 容易把项目理解成聊天助手，弱化 Journal 和自动追踪 |
| `MingNest` | 有私人空间和归档感 | 更适合收藏或笔记产品，提醒与主动推送语义较弱 |
| `Xiaoming LifeOS` | 功能覆盖听起来最广 | 定位过大，会诱导通用平台、插件系统和复杂抽象 |
| `Xiaoming Journal` | 与当前 Web 产品一致 | 无法覆盖提醒、订阅、巡检和 Telegram 自动化 |

## 5. 改名边界

改名分为三类：产品标识立即统一、仓库入口同步调整、稳定基础设施标识继续保留。禁止对整个仓库执行全局字符串替换。

### 5.1 本次应修改的产品标识

| 位置 | 当前值 | 目标值 |
| --- | --- | --- |
| `README.md` 标题与定位 | `NotiNewsForXiaoming` | `Xiaoming Hub` |
| `package.json` name | `NotiNewsForXiaoming` | `xiaoming-hub` |
| `package.json` description | 空 | `Personal Telegram automation and journal hub for Xiaoming` |
| Bot `/start` 自我介绍 | `NotiNews Bot` | `Xiaoming Hub Bot` |
| Bot 帮助标签 | `#NotiNews` | `#XiaomingHub` |
| GitHub 抓取 User-Agent | `NotiNewsBot` | `XiaomingHubBot` |
| Bot 部署成功通知 | `NotiNews Bot 已更新` | `Xiaoming Hub Bot 已更新` |
| 服务器巡检角色名 | `NotiNews 当前主部署机` | `Xiaoming Hub 当前主部署机` |
| `AGENTS.md` 项目说明 | 个人 Telegram 提醒 bot | Xiaoming Hub 的个人 Telegram 自动化与 Journal 项目 |

README 同步补入已经落地的 Journal 与富文本文章能力，不只替换标题。README 中现有的本机绝对路径全部改为仓库相对链接，使本地目录和仓库改名不再造成链接失效。

### 5.2 GitHub 仓库入口

GitHub 仓库从：

```text
coderlxm/notinewsforxiaoming
```

更名为：

```text
coderlxm/xiaoming-hub
```

采用原仓库直接 Rename，不创建新仓库、不搬运提交历史。GitHub 会将旧仓库网页与 Git 访问重定向到新名称，但官方仍建议更新本地 clone 的 remote URL；旧仓库名之后不得重新创建，否则会破坏重定向。[GitHub：Renaming a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)

当前仓库没有作为第三方 GitHub Action 被引用，也没有使用仓库名生成的 GitHub Pages 地址；线上 Journal 使用独立域名，因此不涉及 GitHub 明确列出的这两类改名例外。

仓库设置中的 Description 建议同步为：

```text
Personal Telegram automation and journal hub for Xiaoming.
```

本地开发目录可以在 GitHub 改名后改为 `xiaoming-hub`，但这不属于代码提交内容。仓库内文档不再记录某一台电脑的绝对路径。

### 5.3 本次明确不修改的稳定标识

下列名称虽包含 `notinews`，但已经承担线上路径、持久化或运维定位职责，本次保持不变：

| 稳定标识 | 保留原因 |
| --- | --- |
| `/root/NotiNewsForXiaoming` | Bot 线上目录，关联 `.env`、`.deploy-commit`、数据目录和部署 secret |
| `notinews-bot.service` | 当前唯一 Telegram long polling systemd 单元；改名过程稍有顺序错误就可能产生双实例 |
| `notinews-backup.service/.timer` | 与 service、脚本安装位置和定时任务绑定 |
| `scripts/notinews-backup` | 备份制品和服务器安装路径已经稳定 |
| `data/notinews.sqlite` | 全项目历史业务数据入口，改文件名没有用户收益 |
| `notinews-journal` image/container | Journal 部署脚本、Compose、备份启停和镜像制品共同引用 |
| `noti-news-data` Docker volume | 修改 volume 名会让旧 Docker 运行方式看到一个新的空数据卷 |
| `notinews-drive` rclone remote | 服务器本地凭据配置名，不是产品展示名 |
| `NotiNewsBackups-LongTerm` | 现有长期备份目录和恢复路径 |
| `/root/.ssh/notinews_health_ed25519` | 已部署的 SSH 私钥路径，不对用户展示 |
| `JOURNAL_*`、`TG_*` 环境变量 | 表达领域和外部系统，不含错误产品语义 |
| Journal 数据库表、API 路由和 TypeScript 类型 | 属于稳定业务协议，不是品牌文案 |

这些名称在 README 的“历史稳定标识”小节中集中说明一次，不在每个文件旁重复解释。它们不是运行时 fallback，也不保留两套产品名；只是已有基础设施的不可见标识。

未来如果某个稳定标识已经实际造成维护困扰，再单独设计一次原子迁移。不得仅为字符串整齐同时改服务名、数据文件、容器、备份目录和线上路径。

### 5.4 历史文档不批量改写

`doc` 中已有设计、验收、部署报告记录了功能当时的名称和线上路径。处理原则：

- 当前入口文档、架构总览和仍在使用的部署说明更新为新项目名；
- 旧设计稿和历史报告正文保持原样，保留时间上下文；
- 历史文档中的绝对路径只有在仍被当前操作依赖时才更新；
- 不通过全局替换把 `Journal`、数据库文件名或 systemd 单元误改成品牌名。

## 6. 外部系统处理

### 6.1 Telegram

Telegram 中需要区分展示名与 username：

- Bot 展示名改为 `Xiaoming Hub`；
- 代码中的自我介绍改为 `Xiaoming Hub Bot`；
- Bot username 作为稳定地址继续保留，不为了视觉统一改变；
- 已有命令名、inline callback data 和聊天记录不变；
- 不发送额外“品牌迁移”消息，下一次用户主动打开 `/start` 或 `/help` 时自然看到新名称。

该项目是单用户 bot，username 没有对外营销价值；保持地址稳定比完全清除旧词更重要。

### 6.2 Journal 域名和 Feed

继续保留当前 Journal 域名、公开 URL、永久链接、RSS 与 JSON Feed 地址。它们承载内容入口，不包含旧项目名，没有迁移必要。

Feed 的作者仍为“小明同学”。如果 Feed generator 或 HTTP header 中存在应用生成器名称，可以改为 `Xiaoming Hub Journal`，但不改变 Feed id、item id 或历史永久链接。

### 6.3 GitHub Actions 与部署

工作流 job 名 `bot`、`journal`，secret 名 `SERVER_*`、`JOURNAL_*` 继续保留。只修改用户可见的部署成功消息和源码路径筛选中因文件本身改名而必须调整的条目。

由于本方案不改线上目录、systemd 单元和 Journal 容器名，仓库 Rename 不要求同步迁移服务器数据或部署 secret。GitHub 仓库旧 URL 的重定向只作为平台行为，不在项目中增加兼容脚本。

## 7. 实施顺序

### 阶段一：代码内产品身份

1. 修改 `package.json` 的 name 与 description。
2. 重写 README 顶部定位，补入 Journal 能力，并把绝对文件链接改为相对链接。
3. 修改 Bot 自我介绍、帮助标签、GitHub User-Agent、部署成功通知和服务器角色文案。
4. 更新 `AGENTS.md` 的项目说明，但完整保留单用户、短主路径、严禁兜底等协作原则。
5. 更新仍在使用的架构与部署入口文档；历史设计稿保持原文。
6. 在 README 记录仍保留的 `notinews-*` 稳定基础设施标识，避免后续误删或再次发起无收益迁移。

这一阶段不修改功能代码、数据库、接口、部署路径和服务单元。

### 阶段二：仓库入口

1. 在 GitHub 原仓库上将名称改为 `xiaoming-hub`。
2. 同步仓库 Description。
3. 将当前本地 clone 的 origin 指向新仓库 URL。
4. 本地开发目录按需要改为 `xiaoming-hub`。
5. 不重新创建旧名称的仓库。

仓库改名应紧跟阶段一提交，避免新仓库名仍展示旧 README 标题。

### 阶段三：Telegram 展示名

1. 将 Bot 展示名改为 `Xiaoming Hub`。
2. 保留原 username、Token 和命令配置。
3. 后续所有用户可见新文案只使用 `Xiaoming Hub`，不并列显示“原 NotiNews”。

阶段三只改变展示名称，不迁移 Telegram Bot 身份，也不创建第二个 Bot。

## 8. 完成标准

改名完成后应满足：

- GitHub 仓库、README、package name 和 Bot 自称统一为 `Xiaoming Hub`；
- 新的用户可见通知中不再出现 `NotiNews`；
- Journal 公开页继续显示“小明同学”，现有 URL 与内容身份不变；
- Telegram username、Token、命令和聊天记录不变；
- 线上仍只有一个 Bot long polling 实例；
- 现有 Bot SQLite、Journal SQLite、附件和长期备份继续使用原位置；
- 旧仓库 URL 只依赖 GitHub 官方重定向，仓库内没有双仓库同步逻辑；
- `notinews-*` 只存在于本方案明确列出的稳定基础设施标识和历史文档中。

## 9. 最终建议

采用 `Xiaoming Hub`，并执行“产品名彻底统一、基础设施标识保持稳定”的改名策略。

这次改名的目的，是让名称准确描述已经存在的功能，而不是借改名启动一次无业务收益的全栈迁移。完成后，项目对外有一个清晰总名，Bot 和 Journal 有明确子领域，旧名称只留在不对用户展示且迁移成本高的历史基础设施位置。
