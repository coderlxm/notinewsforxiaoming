# 主题模式切换导致 Chromium Renderer 崩溃复盘

- 日期：2026-08-12
- 严重程度：严重
- 状态：已修复

## 1. 问题

主题模式按钮在约一秒内连续点击 6～7 次时，会使 Chromium 页面直接进入 `Aw, Snap! Error code: 5`，整个渲染进程失效，只能重新加载。这不是普通的 Vue 或 JavaScript 报错，而是浏览器页面进程级崩溃。

## 2. 唯一根因

主题状态错误地使用了 VueUse `createGlobalState()`。它创建的 detached effect scope 不随组件和 HMR 销毁，导致多次热更新后遗留多个 `useColorMode()` 监听实例。

这些实例同时监听同一个主题存储键。一次主题变化会让多个遗留实例分别调用 `document.startViewTransition()`，并发创建多份根页面快照，最终导致 Chromium Renderer 崩溃。

崩溃只有这一条原因链：`createGlobalState()` 生命周期错误 → HMR 遗留多个监听实例 → 一次操作并发创建多个根 View Transition → Renderer 崩溃。

## 3. 错误实现与正确实现

以下代码只保留与这次故障直接相关的生命周期差异。

### 错误实现（修复前）

```ts
import { createGlobalState, useColorMode } from '@vueuse/core';

const useJournalThemeState = createGlobalState(() => {
  const mode = useColorMode({
    storageKey: THEME_STORAGE_KEY,
    onChanged(theme, defaultHandler) {
      applyResolvedTheme(theme, defaultHandler);
    },
  });

  return { mode };
});
```

错误点是把 `useColorMode()` 放进了 `createGlobalState()` 创建的 detached effect scope。组件和 HMR 销毁时，这个作用域不会跟随销毁，旧的主题监听实例会继续存在。

### 正确实现（当前）

```ts
import { useColorMode } from '@vueuse/core';
import { onScopeDispose } from 'vue';

export function useJournalTheme(resolveDefaultOrigin: ThemeOriginResolver) {
  let revealAnimation: Animation | null = null;
  let disposed = false;

  const mode = useColorMode({
    selector: 'html',
    attribute: 'data-theme',
    storageKey: THEME_STORAGE_KEY,
    initialValue: 'auto',
    disableTransition: false,
    onChanged(theme, defaultHandler) {
      applyResolvedTheme(theme, defaultHandler);
    },
  });

  onScopeDispose(() => {
    disposed = true;
    revealAnimation?.cancel();
    revealAnimation = null;
  });

  return { mode };
}
```

正确点是让 `useJournalTheme()` 直接在唯一的 `ThemeModeControl` 组件作用域中创建 `useColorMode()`。组件或 HMR 销毁时，Vue 会一并销毁该作用域中的主题监听；`onScopeDispose()` 同时清理仍在运行的动画。

## 4. 当时没有考虑什么

实现时只考虑了正常运行中的单个按钮状态，没有考虑 detached 全局作用域在 HMR 后仍会存活；接入 VueUse 前也没有先核对当前安装版本中 `createGlobalState()` 和 `useStorage()` 的实际生命周期。

排查时还错误地把有调用间隔的自动点击当成真实快速点击，并过早判断问题已经解决。这延误了唯一根因的发现，但不是另一个崩溃原因。

## 5. 已完成修正

- 移除 `createGlobalState()`，主题状态改为归属唯一的 `ThemeModeControl` 组件作用域。
- 组件或 HMR 销毁时同步销毁 `useColorMode()` 监听，保证任何时刻只有一个主题实例能够创建 View Transition。

## 6. 后续约束

- 单一消费者的 UI 状态不使用 detached 全局作用域。
- 引入第三方状态 composable 前，必须核对当前安装版本的创建和销毁行为。
- 用户给出明确复现条件时，必须按相同条件复现后再作结论。
