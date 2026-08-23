# 照片墙 Netflix 沉浸感增强补充方案

## 1. 方案定位与设计目标

本方案作为 [photo-library-immersive-mode.md](file:///Users/xiaomingli/Code/NotiNewsForXiaoming/doc/design/photo-library-immersive-mode.md) 的视觉与交互体验补充设计。

在原方案确立的**“路由驱动伪全屏、零新增后端接口、单用户极简状态”**工程底座之上，针对“Netflix 影院式沉浸感”进行专项视觉与动效升级，重点强化：

- **首屏冲击力**：引入大画幅焦点展板（Hero Billboard），进入页面即获影院观感。
- **浏览节奏感**：以横向内容泳道（Horizontal Shelves）与平滑滚动丰富内容探索体验。
- **交互精致度**：卡片悬停景深提升（Scale & Elevation）与毛玻璃元数据胶囊（Glass Pill）。
- **空间纯粹性**：采用极黑影院画布（#0c0c0c）与悬浮透明工具栏，让摄影作品本身成为唯一视觉焦点。

---

## 2. 核心视觉与交互升级

### 2.1 首屏 Hero Billboard 焦点展板

原方案首屏采用紧凑文字导览区，本补充方案将其升级为 Netflix 式海报大画幅：

- **展板高度与布局**：占据首屏约 `50vh–65vh` 高度，直接提取近期精选首张高质量照片或当前主打相册封面作为展板全宽背景。
- **无缝渐变融合（Vignette & Gradient Fade）**：
  - 展板底部叠加平滑垂直暗色渐变：
    ```css
    background: linear-gradient(
      to top,
      var(--photo-canvas) 0%,
      rgba(12, 12, 12, 0.8) 35%,
      rgba(12, 12, 12, 0.2) 70%,
      transparent 100%
    );
    ```
  - 左右两侧辅以轻微暗角径向渐变，让背景照片自然融入下方内容泳道。
- **影院级文字排版**：
  - 主标题采用大字号（`clamp(2rem, 4vw, 3.5rem)`）、高对比白字，悬浮于展板左下方。
  - 元数据（拍摄地点、日期、精选标签）采用半透明胶囊徽章（Pill Badge）组合排列。

### 2.2 横向内容泳道（Horizontal Shelves）

将单纯的纵向多列网格升级为 Netflix 标志性的主题式横向泳道：

- **泳道规划**：
  - **✨ 近期精选（Featured Stream）**：单行横向连贯照片带，继续保留平滑自动滚动与悬停暂停。
  - **📁 相册与合辑（Collections & Albums）**：横向滚动的相册卡片排。
- **滚动与控制体验**：
  - 使用原生 `scroll-snap-type: x mandatory` 与 `scroll-behavior: smooth`，保持操作丝滑轻量。
  - 桌面端悬停泳道时，左右边缘平滑浮现翻页指示器（Chevron Arrows），点击直接平移一个视口宽度的卡片。
  - 泳道两端预留柔和暗色羽化遮罩，提示可继续滚动的视觉暗示。

### 2.3 卡片 Hover 微交互与景深提升（Hover Elevation）

- **缩放与层级拉升**：
  - 鼠标悬停卡片时，使用 GPU 加速的轻微放大：`transform: scale(1.06)`，响应曲线使用 `cubic-bezier(0.2, 0, 0, 1)`（时长约 `0.25s`）。
  - 同时提升当前卡片的 `z-index: 10`，避免被相邻卡片遮挡。
- **深黑光晕投影（Cinema Glow）**：
  - 悬停时施加柔和深邃的扩散阴影：
    ```css
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.8), 0 4px 10px rgba(0, 0, 0, 0.5);
    ```
- **毛玻璃元数据胶囊（Pill Badges）**：
  - 照片张数、年份或 EXIF 标签采用半透明胶囊包裹（`backdrop-filter: blur(8px)`，背景 `rgba(255, 255, 255, 0.12)`）。
  - 默认状态以低不透明度弱化，卡片 Hover / Focus 时高亮，兼顾画面的整洁与交互反馈。

### 2.4 影院级极黑画布与光影氛围

升级照片模式专属色彩变量阶梯，强化明暗反差与照片色彩表现力：

```css
--photo-canvas: #0c0c0c;
--photo-surface: #171717;
--photo-surface-hover: #222222;
--photo-text-primary: #ffffff;
--photo-text-secondary: rgba(255, 255, 255, 0.7);
--photo-text-muted: rgba(255, 255, 255, 0.45);
--photo-glass-bg: rgba(20, 20, 20, 0.75);
--photo-border: rgba(255, 255, 255, 0.08);
```

### 2.5 相册详情页顶格画廊与悬浮胶囊工具条

- **顶格照片铺设**：相册详情取消传统固定 Header 对顶部的占用，Justified 画廊直接顶格铺展至视口顶部。
- **悬浮胶囊工具条（Floating Glass Pill）**：
  - 返回按钮、相册标题与计数整合成单颗悬浮毛玻璃胶囊，定位于视口左上角（或安全边距内）。
  - 样式使用 `backdrop-filter: blur(16px)` 与半透明暗色背景，页面滚动时自然浮在照片上方，完全不切割画廊视觉。

---

## 3. 技术约束与性能边界

1. **零多余 JS 动画库与状态机**：所有缩放、位移、淡入淡出均采用纯 CSS Transitions；横向泳道采用原生 CSS Scroll Snap。
2. **严禁使用 RAF**：严格遵循项目代码规范，不引入 `requestAnimationFrame`。
3. **保持既有 API 契约不变**：完全复用现有接口与前端媒体代理链路，不额外批量请求非视口内相册详情。
4. **无障碍与动效偏好适配**：在 `prefers-reduced-motion: reduce` 环境下，关闭 Hero 渐变动效、卡片 Scale 放大与 Scroll Snap 平滑过渡，直接呈现静态高对比效果。
