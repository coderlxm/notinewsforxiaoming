import { computed, type ComputedRef } from 'vue';
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import { parseAppRoute } from '../app/appRoute';
import type { AppRoute } from '../app/appRouteTypes';
import type { AssetView } from '../types';

export function useAppRoute(
  currentRoute: RouteLocationNormalizedLoaded,
  defaultAssetView: ComputedRef<AssetView>,
) {
  const route = computed<AppRoute>(() => parseAppRoute(currentRoute, defaultAssetView.value));

  const isContributionRoute = computed(() =>
    route.value.name === 'contribution-inbox' || route.value.name === 'contribution-review',
  );

  const isAssetRoute = computed(() =>
    route.value.name === 'private'
    || route.value.name === 'entry-new'
    || route.value.name === 'entry-edit'
    || route.value.name === 'article-new'
    || route.value.name === 'article-edit'
    || route.value.name === 'settings',
  );

  const isPrivateRoute = computed(() =>
    isAssetRoute.value || isContributionRoute.value,
  );

  const publicShellActive = computed(() =>
    route.value.name === 'public'
    || route.value.name === 'about'
    || route.value.name === 'search'
    || route.value.name === 'archive'
    || route.value.name === 'archive-month'
    || route.value.name === 'detail',
  );

  return {
    route,
    isContributionRoute,
    isAssetRoute,
    isPrivateRoute,
    publicShellActive,
  };
}
