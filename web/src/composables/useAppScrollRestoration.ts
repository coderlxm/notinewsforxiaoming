import type { Router } from 'vue-router';

export interface UseAppScrollRestorationOptions {
  router: Router;
  getScrollContainer: () => HTMLDivElement | null;
  isOverlayTransition: (fromPath: string, toPath: string) => boolean;
  feedRouteKeyForPath: (path: string) => string | null;
}

export function useAppScrollRestoration(options: UseAppScrollRestorationOptions) {
  const feedScrollPositions = new Map<string, number>();
  let pendingFeedScrollTop: number | null = null;

  function handleRouteChange(nextPath: string, currentPath: string): void {
    if (currentPath === nextPath) return;
    const nextUrl = new URL(nextPath, window.location.origin);
    const currentUrl = new URL(currentPath, window.location.origin);
    if (
      nextUrl.pathname === currentUrl.pathname
      && nextUrl.search === currentUrl.search
    ) return;
    if (options.isOverlayTransition(currentPath, nextPath)) {
      return;
    }

    const currentFeedRouteKey = options.feedRouteKeyForPath(currentPath);
    const nextFeedRouteKey = options.feedRouteKeyForPath(nextPath);

    if (currentFeedRouteKey) {
      feedScrollPositions.set(currentFeedRouteKey, options.getScrollContainer()!.scrollTop);
    }

    if (nextFeedRouteKey && nextFeedRouteKey !== currentFeedRouteKey) {
      pendingFeedScrollTop = feedScrollPositions.get(nextFeedRouteKey) ?? 0;
    }
    else pendingFeedScrollTop = null;
    if (pendingFeedScrollTop === null) {
      options.getScrollContainer()!.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  function restoreFeedScroll(): void {
    if (pendingFeedScrollTop === null) return;

    const scrollTop = pendingFeedScrollTop;
    pendingFeedScrollTop = null;
    options.getScrollContainer()!.scrollTo({ top: scrollTop, behavior: 'auto' });
  }

  const dispose = options.router.afterEach((to, from) => {
    if (to.fullPath !== from.fullPath) handleRouteChange(to.fullPath, from.fullPath);
  });

  return {
    restoreFeedScroll,
    dispose,
  };
}
