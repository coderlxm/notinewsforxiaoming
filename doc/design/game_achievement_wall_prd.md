# 游戏成就墙（Game Achievement Wall）产品设计文档

## 1. 产品定位与目标

### 1.1 产品愿景
打造一个极具视觉冲击力、沉浸感与仪式感的**个人游戏终身成就馆与通关记录墙**。
区别于普通博客文章瀑布流，该模块将游戏作为独立的一等公民资产进行管理与展示，参考小黑盒的数据统计与成就展示感、IGN 的权威评分与优缺点评测架构、以及 Steam / PlayStation 的白金成就与海报墙质感，为站长提供一个极简易录入、沉浸式浏览的个人游戏殿堂。

### 1.2 核心目标
1. **全屏沉浸体验**：进入后隐藏全局顶部 Header Bar，与照片墙保持一致的无干扰沉浸式视觉，全屏渲染高质感游戏海报与数据看板。
2. **权威评测与深度记录**：支持 10 分制个人评分（带评级定性）、核心优缺点总结、多维评分及详尽的通关感受（Markdown）。
3. **成就与通关仪式感**：突出通关状态（通关 / 白金完美 / 正在游玩 / 封盘）、游玩时长、通关时间戳、平台徽标与通关瞬间截图画廊。
4. **极简录入主路径**：站长（Owner）可在线快速录入新通关游戏，支持快捷填报与图片上传，无复杂冗余流程。

---

## 2. 页面结构与路由规划

### 2.1 导航入口
- **位置**：左侧全局频道导航栏（`PublicChannelNavigation`）中，紧随“照片墙”下方新增 **「游戏墙」**（或「游戏成就」）独立入口。
- **状态联动**：点击后激活沉浸模式（`gameImmersiveActive`），全局顶部 `AppHeader` 隐藏，桌面端左侧悬浮抽屉导航（沉浸式边栏）保持一致交互。

### 2.2 路由定义
- **游戏成就主视图**：`/games`
  - 沉浸式主页，包含 Hero 殿堂精选、统计仪表盘、筛选栏与游戏海报画廊。
- **游戏详情档案页 / 弹层**：`/games/:gameId` 或详情 Overlay
  - 单款游戏的深度档案：包含超大背景 Banner、IGN 式评分看板、优缺点红黑榜、长评与成就截图墙。

---

## 3. 核心功能与模块设计

### 3.1 顶部 Hero 殿堂 / 年度精选（Billboard）
- **视觉风格**：全宽沉浸式背景海报（支持轮播或固定站长当前年度最佳 GOTY / 最近通关神作）。
- **展示要素**：
  - 游戏高清 Banner / 概念图背景（带暗色渐变与微发光处理）；
  - 游戏标题、副标题 / 原名、开发商与发售年份；
  - 醒目的个人总评分（如 `9.8 / 10 Masterpiece`）；
  - 通关标签（如 `🏆 白金全成就`、`⏱ 85 小时通关`、`🎮 PS5`）；
  - 一句话评语 / 核心印象（Punchline）；
  - 「查看游戏档案」快捷按钮。

### 3.2 统计仪表盘（Player Stats Bar）
以紧凑而高质感的 HUD 仪表盘卡片呈现个人游戏生涯数据概览：
1. **通关总数（Cleared Games）**：记录的通关作品总数；
2. **白金 / 完美率（Platinum & 100%）**：全成就达成数量与占比；
3. **累计游戏时长（Total Playtime）**：总投入时长（小时）；
4. **生涯平均评分（Average Rating）**：个人给出的平均评分走势；
5. **平台分布（Platforms）**：PS5 / PC (Steam) / Nintendo Switch / Xbox / 掌机等分布胶囊。

### 3.3 筛选与分类工具栏（Filter & Sort Bar）
- **通关状态筛选**：全部（All）、已通关（Completed）、白金/完美（100% Mastered）、正在游玩（Playing）、神作殿堂（Score ≥ 9.0）。
- **平台筛选**：PlayStation, Nintendo Switch, Steam/PC, Xbox, Retro 等。
- **排序方式**：通关日期（最新优先）、个人评分（从高到低）、游玩时长、发售年份。
- **快速搜索**：按游戏名（中英文）即时本地过滤。

### 3.4 游戏成就画廊（Game Grid Showcase）
- **布局形式**：响应式游戏海报卡片网格（采用标准 3:4 游戏竖版封面或 16:9 宽画幅海报）。
- **卡片内容（小黑盒 + IGN 融合设计）**：
  - **海报封面**：高精度封面图，悬浮微放大动效；
  - **平台角标**：左上角极简平台徽标（PS5/Switch/PC 等）；
  - **评分徽章**：右上角醒目多边形 / 圆角评分 Badge（根据分数动态变色：9.0+ 殿堂金/紫、8.0-8.9 优秀蓝、7.0-7.9 良好绿等）；
  - **通关标识**：底部白金奖杯 / 通关打勾小图标；
  - **信息区**：中文名、英文名、通关耗时（如 `42h`）、通关时间（如 `2026.04`）。
- **交互**：点击卡片平滑进入游戏专属档案详情页/沉浸弹层。

### 3.5 游戏档案详情页（Game Deep Archive）
进入单款游戏后，呈现权威感十足的专属评测与成就记录：
1. **Header 档案头部**：
   - 动态背景：游戏 4K 壁纸虚化叠加；
   - 基础元数据：类型（RPG/动作/魂类/开放世界）、发行时间、开发商、通关难度、通关平台。
2. **IGN 风格评分与速评看板**：
   - **巨大评分数字** + **定性评语**（如 `10 MASTERPIECE` / `9.0 AMAZING` / `8.5 GREAT`）；
   - **一句话速评**：精炼总结本作的核心体验；
   - **红黑榜（The Good & The Bad）**：
     - `+ 优点（Pros）`：如“极其深邃的箱庭地图设计”、“令人惊艳的 Boss 战演出”；
     - `- 缺点（Cons）`：如“后期数值膨胀”、“个别支线引导略显晦涩”。
3. **多维评分体系（Dimension Breakdown）**：
   - 玩法/操作（Gameplay）：0 - 10
   - 剧情/叙事（Story & Lore）：0 - 10
   - 画面/美术（Visuals & Art）：0 - 10
   - 音乐/音效（Music & Sound）：0 - 10
   - 性能/优化（Performance）：0 - 10
4. **深度通关长评与心得（Personal Review）**：
   - 支持完整 Markdown 排版，记录游玩心路历程、剧情解析与感悟。
5. **通关高光与截图画廊（Memories & Screenshots）**：
   - 通关时刻截图、白金跳杯瞬间、精彩游戏风景照（支持 Lightbox 全屏画廊查看）。

---

## 4. 数据结构设计（Schema Proposal）

```typescript
export type GamePlayStatus = 'completed' | 'mastered' | 'playing' | 'shelved' | 'backlog';
export type GamePlatform = 'PS5' | 'PS4' | 'Switch' | 'PC' | 'Xbox' | 'iOS' | 'Other';

export interface GameRatingDimensions {
  gameplay?: number;    // 玩法
  story?: number;       // 剧情
  visuals?: number;     // 画面
  music?: number;       // 音效
  performance?: number; // 优化
}

export interface GameReviewItem {
  id: string;
  title: string;              // 游戏中文名（如：艾尔登法环）
  originalTitle?: string;     // 游戏原名 / 英文名（如：Elden Ring）
  coverUrl: string;           // 封面图 URL (3:4)
  bannerUrl?: string;         // 背景横幅 URL (16:9 / 21:9)
  platforms: GamePlatform[];  // 游玩平台
  genre: string[];            // 类型标签（如：["ARPG", "开放世界", "魂系"]）
  developer?: string;         // 开发商（如：FromSoftware）
  releaseYear?: number;       // 发行年份
  
  // 通关与成就
  status: GamePlayStatus;     // 状态
  completedAt?: string;       // 通关日期 (YYYY-MM-DD)
  playtimeHours?: number;     // 游玩时长（小时）
  difficulty?: string;        // 游玩难度（如：最高难度 / 默认）
  isGoty?: boolean;           // 是否为站长年度最佳/个人殿堂推荐
  
  // 评分与评测
  rating: number;             // 个人总分 (0.0 - 10.0)
  verdict: string;            // 一句话定性（如：无可挑剔的开放世界奇迹）
  pros: string[];             // 优点列表
  cons: string[];             // 缺点列表
  dimensionRatings?: GameRatingDimensions; // 多维评分
  reviewMarkdown?: string;    // 通关长评感受
  
  // 视觉画廊
  screenshots?: Array<{
    url: string;
    caption?: string;
    takenAt?: string;
  }>;

  createdAt: string;
  updatedAt: string;
}
```

---

## 5. 录入与管理体验（Owner Admin）

保持极简、高效的单用户录入流程，拒绝复杂化：
1. **新建游戏档案**：
   - 点击右上角/管理入口「+ 录入通关游戏」；
   - 弹窗表单直接填写：名称、平台、通关日期、游玩时长、总分、优点/缺点、短评；
   - 支持直接上传封面与背景图（或填入 URL）；
   - 支持选填多维评分与 Markdown 长评。
2. **编辑与更新**：
   - 随时在卡片/详情页点击「编辑」快速调整评分、补充最新截图或修改长评。

---

## 6. 视觉设计风格规范

1. **色彩与质感**：
   - 底色采用深空炭黑与冷灰（`--game-canvas: #0b0d11`, `--game-surface: #141820`）；
   - 强调色根据评分和平台微定制（白金成就淡金微光、IGN 风格高亮铭牌、深蓝冷光）；
   - 边框采用极细微光（`border: 1px solid rgba(255, 255, 255, 0.08)`）配合毛玻璃质感。
2. **排版与动效**：
   - 数字采用现代等宽或科技感无衬线字体（如 `Teko`, `Inter`, `DIN` 等风格数字）；
   - 封面悬浮微放大（`transform: scale(1.025)`）与光泽扫过效果；
   - 遵循系统全局 Reduced Motion 规范，保持丝滑克制。

---

## 7. 实施阶段规划（Milestones）

- **Phase 1：基础协议与沉浸式路由框架**
  - 在 `web/src/router.ts` 注册 `/games` 路由；
  - 在 `App.vue` 与 `PublicChannelNavigation.vue` 接入游戏模块与沉浸式状态；
  - 实现本地/服务端 Game 数据读写契约。
- **Phase 2：前端沉浸式画廊与详情页开发**
  - 构建 Hero 殿堂卡片、仪表盘、筛选栏与海报 Grid；
  - 实现 IGN 风格评分徽章、红黑榜、多维评分组件；
  - 接入截图画廊与 Lightbox。
- **Phase 3：Owner 快捷管理与持久化**
  - 接入后台新增/编辑表单与图片上传；
  - 完整走通录入、展示与沉浸式浏览主路径。

---

## 8. 后端持久化与接口方案

### 8.1 数据持久化

游戏档案与图片资产沿用 Journal 现有 SQLite 数据库和数据目录，不引入独立服务：

- `journal_games` 保存游戏档案主体；数组、评分维度和截图元数据以 JSON 字段保存，读取时统一通过共享协议校验后返回。
- `journal_game_images` 登记 Owner 上传的封面、横幅和截图资产，关联具体游戏档案。
- 上传文件写入 `JOURNAL_DATA_DIR/assets/games/<gameId>/`，数据库只保存相对路径；公开响应使用不可变的站内媒体 URL。
- 数据库迁移 `v21` 建表时初始化两条正式验收数据：黑神话：悟空、艾尔登法环：黄金树幽影。其余前端 mock 数据不进入生产环境。

前后端共同复用 `src/shared/gameProtocol.ts` 中的类型与输入约束，避免页面模型和持久化模型各自演进。

### 8.2 API 契约

公开读取接口：

- `GET /api/games`：返回完整游戏档案列表。
- `GET /api/games/:id`：返回单个游戏档案。
- `GET /game-media/:assetId`：返回站内上传的游戏图片。

Owner 管理接口：

- `POST /api/me/games`：创建游戏档案。
- `PUT /api/me/games/:id`：完整更新游戏档案。
- `POST /api/me/games/:id/images`：以 multipart 上传 `cover`、`banner` 或 `screenshot` 图片，并返回更新后的完整档案。

所有 `/api/me/games` 写接口复用 Journal 现有 Owner 会话鉴权；公开列表、详情和媒体不要求登录。前端只在 Owner 身份确认后显示录入与编辑入口。

### 8.3 保存与页面状态

- 首次进入 `/games` 时只请求一次真实列表；已加载数据由 Pinia store 复用，切换路由不会重复清空页面状态。
- 统计看板、筛选、排序和搜索都从真实列表本地派生，不新增统计接口。
- 创建或编辑时先保存文本档案，再按封面、横幅、截图顺序上传所选文件；基础档案与每次图片上传成功后，都立即用服务端返回的完整档案更新页面列表。
- 基础档案保存失败时保留表单并直接呈现错误；基础档案已保存但后续图片上传失败时，关闭编辑弹层并打开已成功保存的最新真实详情，同时呈现原错误。不使用 mock、默认图片、重试或 fallback。
