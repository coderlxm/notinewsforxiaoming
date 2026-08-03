# CSS Multi-column 瀑布流学习笔记

<!-- Note date: 2026-07-20 -->

配套示例：[打开 CSS Multi-column 瀑布流 Demo](./css-multi-column-waterfall-demo.html)

## 1. 先记住一个心智模型

CSS Multi-column 的职责不是计算每张卡片的高度，而是把一个普通内容流切成多列。

可以记成一句话：

> 容器负责分列和列间距，卡片负责保持完整和垂直间距，高度交给内容。

对应的四个核心属性是：

| 位置 | 属性 | 记忆方式 |
| --- | --- | --- |
| 容器 | `column-count` | 分几列 |
| 容器 | `column-gap` | 列之间多远 |
| 卡片 | `break-inside: avoid` | 一张卡片不要被截成两段 |
| 卡片 | `margin-bottom` | 同一列中两张卡片的垂直间距 |

最小实现：

```css
.waterfall {
  column-count: 4;
  column-gap: 16px;
}

.waterfall__card {
  break-inside: avoid;
  margin-bottom: 16px;
}
```

## 2. 卡片高度从哪里来

真实页面通常不设置卡片高度。卡片由内部内容自然撑开：

- 文字行数；
- 图片宽高比；
- 视频、音频等原生控件；
- 标签、结构化字段和操作区；
- 内部 `padding`、`gap` 和 `margin`。

Demo 中的 `--height` 只是为了用色块模拟不同内容高度：

```html
<article class="card" style="--height: 230px">
  纵向图片
</article>
```

它对应的 `min-height` 只属于演示代码，真实卡片不需要照搬：

```css
.card {
  min-height: var(--height); /* 仅用于 Demo 制造高低差 */
}
```

真实卡片可以保持：

```css
.card {
  padding: 12px;
  border-radius: 8px;
}
```

### 图片高度

图片使用自身比例决定高度：

```css
.card img {
  display: block;
  width: 100%;
  height: auto;
}
```

如果数据中已有图片宽高，可以提前声明比例，减少图片加载前后的尺寸变化：

```css
.card img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}
```

这里的 `4 / 3` 应来自真实媒体比例或明确的产品裁切规则，不要为了让卡片等高随意固定。

## 3. 浏览器到底怎样排卡片

假设 DOM 顺序是：

```text
01 → 02 → 03 → 04 → 05 → 06
```

Multi-column 会保持这个内容顺序，按列纵向填充：

```text
第一列 ↓    第二列 ↓    第三列 ↓
01          03          05
02          04          06
```

实际在哪张卡片后换列，由浏览器根据内容高度和平衡结果决定。`break-inside: avoid` 会要求浏览器只在两张卡片之间换列，不要把一张卡片截开。

它不是下面这种 JavaScript masonry 算法：

```text
每来一张卡片 → 测量所有列 → 放进当前最短列
```

因此，追加或更新内容后，浏览器可能重新平衡分列，已有卡片的视觉列位置也可能变化。

## 4. 为什么推荐写完整属性

下面的简写可以工作：

```css
.waterfall {
  columns: 4;
}
```

但手写项目代码时更推荐：

```css
.waterfall {
  column-count: 4;
}
```

`columns` 同时是 `column-width` 和 `column-count` 的简写。完整属性能直接说明这里控制的是固定列数，后续阅读和调整更明确。

## 5. 响应式写法

推荐让同一个变量同时控制横向和纵向间距：

```css
.waterfall {
  --waterfall-gap: 20px;

  column-count: 4;
  column-gap: var(--waterfall-gap);
}

.waterfall__card {
  break-inside: avoid;
  margin-bottom: var(--waterfall-gap);
}

@media (max-width: 1359px) {
  .waterfall {
    --waterfall-gap: 18px;
    column-count: 3;
  }
}

@media (max-width: 959px) {
  .waterfall {
    --waterfall-gap: 14px;
    column-count: 2;
  }
}

@media (max-width: 599px) {
  .waterfall {
    --waterfall-gap: 8px;
  }
}
```

移动端仍保持两列时，最后一个断点只需要缩小间距，不需要重复写 `column-count: 2`。

## 6. 快速手写顺序

从空白页面开始时，可以按以下顺序写：

1. 按真实时间或业务顺序输出普通 DOM 列表。
2. 给列表容器添加 `column-count`。
3. 给容器添加 `column-gap`。
4. 给直属卡片添加 `break-inside: avoid`。
5. 给卡片添加与列间距一致的 `margin-bottom`。
6. 用 media query 只调整列数和 gap。
7. 让文字、图片和媒体自然决定卡片高度。

记忆骨架：

```css
.wall {
  column-count: 列数;
  column-gap: 间距;
}

.item {
  break-inside: avoid;
  margin-bottom: 间距;
}
```

## 7. 常见误区

### 7.1 给卡片设置固定高度

```css
.card {
  height: 300px;
}
```

这会把不同内容强行压成相同高度，失去瀑布流最重要的自然高低差，还可能造成内容溢出。

### 7.2 给卡片设置百分比宽度

```css
.card {
  width: 25%;
}
```

不需要这样写。Multi-column 已经根据容器宽度、列数和列间距计算出每列宽度，卡片默认使用当前列的可用宽度。

### 7.3 在同一个容器同时使用 Grid 或 Flex 分列

```css
.waterfall {
  display: grid;
  column-count: 4;
}
```

不要把两种布局模型叠加到同一个容器。需要 Multi-column 时，容器保持普通 block flow 即可。

### 7.4 把它理解为横向逐行排序

Multi-column 的阅读方向是先纵向、再横向。如果页面必须严格呈现：

```text
第一行：01 02 03
第二行：04 05 06
```

就不应使用 Multi-column。

### 7.5 为了“更整齐”手写列高计算

一旦业务要求逐项放入当前最短列，应直接采用已评审的成熟布局库方案，不要在组件中自行测量高度、维护列数组或计算绝对定位。

## 8. 什么时候适合使用

适合：

- 图片、文字、媒体混合导致卡片自然高度不同；
- 页面是连续浏览流；
- 接受先纵向、后横向的阅读顺序；
- 希望布局完全由 CSS 完成；
- 卡片内容变化时可以接受浏览器重新平衡列。

不适合：

- 必须严格从左到右逐行阅读；
- 必须让每个新条目进入当前最短列；
- 视觉位置必须和数组索引形成固定横向对应；
- 布局需要命令式定位、滚动锚定或精确的元素坐标控制。

项目中的对应选择：

| 需求 | 方案 |
| --- | --- |
| 接受纵向填充，追求最短实现 | CSS Multi-column 主方案 |
| 要求按数据顺序逐项进入当前最短列 | `@egjs/grid` 的 `MasonryGrid` 备用方案 |

相关文档：

- [Journal 瀑布流视觉重构主方案](../journal/journal-waterfall-layout-redesign.md)
- [Journal MasonryGrid 备用方案](../journal/journal-waterfall-layout-vue-masonry-alternative.md)

## 9. 最后复习

```text
卡片高度：内容自然撑开
容器分列：column-count
列间距：column-gap
禁止截卡：break-inside: avoid
纵向间距：margin-bottom
阅读顺序：先纵向，再向右
严格最短列：不用 Multi-column，改用成熟 masonry 布局库
```
