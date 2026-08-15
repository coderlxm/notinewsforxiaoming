# App.vue 拆分优化方案

## 目标

将 `web/src/App.vue` 从同时承载页面框架、路由解释、详情浮层、滚动恢复和资料头部的巨型组件，收敛为只负责应用级依赖装配与页面框架组合的入口组件。

本次方案只规划结构重整，不改变现有页面布局、路由地址、浮层交互、缓存策略、滚动位置、登录行为和数据接口。

目标不是机械追求最少行数，而是让以后新增搜索、归档、管理页或详情交互时，不再自然地把代码继续写进 `App.vue`。

## 当前源码事实

当前 `App.vue` 共 1252 行：

- `<script setup>`：约 684 行。
- `<template>`：约 197 行。
- scoped CSS：约 368 行。

它目前同时承担六类责任：

1. 把 Vue Router 的参数和查询字符串解释成内部 `AppRoute`。
2. 管理公开信息流、私有资产和发现页的详情浮层历史状态。
3. 管理不同信息流之间的滚动位置记录与恢复。
4. 渲染资料头部、搜索框、导航和主题切换，并测量 bio 溢出动画。
5. 协调登录会话、站点资料和朋友投稿箱的加载状态。
6. 编排 `RouterView`、`KeepAlive`、信息流背景页和详情浮层。

这些责任之间存在大量共享变量，所以继续在原文件中局部追加功能，会提高修改一个区域时误伤另一个区域的概率。

## 目标结构

```text
web/src/
├── App.vue
├── app/
│   ├── appRoute.ts
│   └── appRouteTypes.ts
├── components/app/
│   ├── AppHeader.vue
│   └── AppRouteViewport.vue
└── composables/
    ├── useAppRoute.ts
    ├── useFeedEntryOverlay.ts
    ├── useDiscoveryEntryOverlay.ts
    └── useAppScrollRestoration.ts
```

最终的 `App.vue` 只保留：

- 获取 Router、Pinia 会话等应用级依赖。
- 组合四个专用 composable。
- 向 `AppHeader` 和 `AppRouteViewport` 传递明确的只读状态与事件。
- 渲染应用网格框架和 `PublicChannelNavigation`。
- 保留仅属于应用外壳的少量响应式布局样式。

建议将 `App.vue` 稳定在约 300 至 450 行。这个数字只作为失控预警，不作为为了减行而制造抽象的硬指标。

## 组件边界

### AppHeader.vue

单一责任：渲染站点资料头部及其直接交互。

迁入内容：

- 头像、站点名和 bio。
- bio 宽度测量、滚动样式和对应 `ResizeObserver` 生命周期。
- 公开搜索框。
- “公开记录”“我的资产”导航。
- `ThemeModeControl`。
- 所有 `.profile*`、`.profile-bar` 相关 scoped CSS 和响应式规则。

输入：

- `profile`
- `profileLoadError`
- `publicMode`
- `showNavigation`
- `privateContext`
- `assetActive`
- `ownerAuthenticated`

输出事件：

- `navigate(path)`

约束：

- 不读取当前 Router，不自行决定业务路由。
- 不持有登录或信息流状态。
- 只处理由自己真实 DOM 产生的 bio 测量状态。

### AppRouteViewport.vue

单一责任：根据已经解析好的应用路由，编排当前路由组件、缓存容器、背景信息流和详情浮层。

迁入内容：

- 当前 `RouterView` 插槽分支。
- 私有信息流与公开信息流的 `KeepAlive` 包装。
- 普通详情、发现页详情和 404 的渲染分支。
- `PublicDiscoveryDetailOverlay`。
- `.app-scroll` 及只属于路由视口的布局样式。

输入采用明确的类型化状态，不让组件重新解释 URL。至少包括：

- 已解析的 `AppRoute`。
- `routedViewLocation`。
- 当前背景信息流和发现页背景路由。
- 普通详情与受保护详情的展示数据。
- 发现页访问作用域。
- 登录状态和公开条目解锁集合。

输出事件继续沿用现有业务动作，例如打开条目、关闭详情、切换资产视图、切换分页和恢复布局。不得通过组件引用让父组件调用内部方法。

## 逻辑边界

### appRouteTypes.ts

存放：

- `AppRoute`
- `FeedRoute`
- `DiscoveryRoute`
- `DiscoveryOverlayRoute`
- 与这些类型直接相关的上下文类型

这些类型不再声明在入口组件内，后续 header、viewport 和 composable 可以共享同一契约。

### appRoute.ts

存放无响应式状态的纯函数：

- Vue Router 路由到 `AppRoute` 的解析。
- 私有资产 URL 的生成。
- 持久化滚动位置 key 的生成。
- 普通详情与发现详情路径是否匹配上下文的判断。

这部分不导入 Vue，不操作 Router，不读写 DOM。新增路由时只修改路由定义及这一处解释规则，不进入 `App.vue`。

### useAppRoute.ts

单一责任：把 `currentRoute` 和移动端默认资产视图组合成只读的 `AppRoute`，并提供只与当前路由类别有关的派生状态。

包括：

- `route`
- `isAssetRoute`
- `isContributionRoute`
- `isPrivateRoute`
- 基于当前 URL 可以直接确定的 shell 模式

它不管理详情内容、滚动位置或历史记录。

### useFeedEntryOverlay.ts

单一责任：管理公开信息流和私有资产列表打开普通条目详情的主路径。

迁入内容：

- `overlayContext`
- `directPublicEntry`
- `revealedPublicEntries`
- `activeOverlayContext`
- `directPublicOverlayEntry`
- `backgroundFeedRoute`
- `overlayEntryId`、`overlayEntry`、`overlayProtectedEntry`
- 打开、关闭、删除后退出、直接详情返回和解锁后的状态更新

该 composable 接收 Router、当前 `AppRoute` 和必要的只读发现页状态，不访问 header DOM，也不处理滚动容器。

### useDiscoveryEntryOverlay.ts

单一责任：管理搜索和月度归档页面打开详情时的背景保留、访问作用域及返回历史。

迁入内容：

- `discoveryOverlayContext`
- `activeDiscoveryOverlayContext`
- `discoveryBackgroundRoute`
- `routedViewLocation`
- `discoveryAccessRevision`
- `renderedDiscoveryAccessScope`
- 打开、关闭、加载完成、解锁和选择标签动作
- 当前发现页标题的保存与恢复

普通信息流详情与发现页详情必须继续保持两个独立上下文，禁止为了减少文件数量合并成包含大量类型分支的通用浮层状态机。

### useAppScrollRestoration.ts

单一责任：记录和恢复应用内部滚动容器的位置。

迁入内容：

- `contentScroll`。
- `feedScrollPositions`。
- `pendingFeedScrollTop`。
- 路由切换时的位置保存。
- 页面布局完成后的恢复动作。

它通过传入的纯函数获得当前路径对应的缓存 key，不理解条目、频道或发现页数据。

## 朋友投稿状态的顺手归位

顶部“朋友投稿”入口已经移除后，`App.vue` 不应继续为了一个不存在的徽标，在管理员登录后常驻加载投稿箱。

拆分时应把投稿列表加载责任移入 `AdminContributionInboxView.vue`：进入该路由并确认会话后再加载，离开公开页面时不产生投稿箱请求。`App.vue` 只保留应用级会话初始化，不再导入 `useAdminContributions`。

这项调整只改变请求发生的位置，不改变投稿箱路由和页面数据行为。

## 实施顺序

### 第一阶段：先抽离纯展示头部

新增 `AppHeader.vue`，迁移 header 模板、bio DOM 生命周期和相关 scoped CSS。`App.vue` 继续提供原有状态和导航动作。

这一阶段不移动路由或浮层状态，风险最低，也能立即移除最大的一组模板和样式。

### 第二阶段：抽离路由类型与纯函数

新增 `appRouteTypes.ts`、`appRoute.ts` 和 `useAppRoute.ts`，原样迁移现有路由解析及路径函数。

迁移期间不改变正则、默认值、route key 或非法参数的 404 判断，避免结构调整混入行为修正。

### 第三阶段：拆分两套详情上下文

先迁移普通信息流详情，再迁移发现页详情。两次迁移分别完成，不能同时重写。

每个 composable 只暴露模板实际使用的只读状态和动作，内部可变 ref 不直接交给调用方修改。

### 第四阶段：抽离滚动恢复

在浮层上下文稳定后，再把滚动容器、缓存 key 和路由切换处理迁入 `useAppScrollRestoration`。

滚动恢复依赖背景页与浮层历史关系，因此不能早于第三阶段进行。

### 第五阶段：抽离路由视口

新增 `AppRouteViewport.vue`，迁移 `RouterView`、`KeepAlive` 和详情浮层模板。此时其输入已经由前四阶段形成稳定契约，不需要在子组件内重新创造业务状态。

最后清理 `App.vue` 中已经迁出的 scoped CSS，只保留 `.app-shell`、`.app-main` 及公开工作区网格等真正属于外壳的规则。

## 必须保持的行为不变量

- 公开与私有信息流的缓存数量和缓存时机不变。
- 从信息流打开详情仍保留背景页，关闭后恢复原滚动位置。
- 直接访问公开详情仍按当前频道决定返回位置。
- 搜索与月度归档打开详情后，关闭时仍回到原查询、原标题和原滚动位置。
- 口令内容解锁后，公开信息流与发现页的已解锁状态保持同步。
- 私有资产的表格页码、瀑布流视图和条目浮层 URL 不变。
- 404、About、设置、编辑器和投稿管理路由的渲染分支不变。
- 手机、平板和桌面端现有 header 与侧栏布局不变。

## 防止再次膨胀的约束

后续代码进入 `App.vue` 前按以下规则判断：

- 新增页面 UI：进入对应 route view 或 feature component。
- 新增 header UI：进入 `AppHeader` 或其直接子组件。
- 新增 URL 解析：进入 `appRoute.ts` 或 `useAppRoute.ts`。
- 新增详情历史交互：进入对应 overlay composable。
- 新增滚动记忆：进入 `useAppScrollRestoration`。
- 新增 API 请求：进入业务 store、route view 或业务 composable，禁止进入 `App.vue`。
- 新增 feature CSS：与实际渲染该 DOM 的组件共置，禁止继续堆入入口组件。

如果一次需求需要向 `App.vue` 增加超过约 30 行代码，应先确认它是否属于上述已有边界；只有真正的应用级装配才能留在入口组件。

## 明确不采用的做法

- 不创建一个新的五六百行 `useAppController` 来替代巨型 `App.vue`。
- 不把浮层状态塞入全局 Pinia；它们是当前应用视口的路由交互状态。
- 不用 provide/inject 隐藏近距离组件的数据依赖。
- 不把 scoped CSS 批量迁入全局样式文件。
- 不在拆分过程中顺便重写路由、动画、缓存或页面布局。
- 不新增 `watch`、`requestAnimationFrame` 或兜底分支；现有副作用只随所属责任迁移。

## 完成标准

- `App.vue` 只承担应用级装配、外壳布局和少量跨区域派生状态。
- 任何业务状态都能从文件名直接判断其归属。
- 新增普通页面不需要修改 `App.vue` 的业务逻辑。
- 新增 header 元素不需要进入路由视口代码。
- 普通信息流详情和发现页详情可以分别修改，不再共享一大片入口组件状态。
- `App.vue` 不再直接访问资料头部 DOM，也不再直接加载投稿箱数据。

