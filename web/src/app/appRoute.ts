import type { RouteLocationNormalizedLoaded } from 'vue-router';
import {
  normalizePublicSearchQuery,
  publicSearchPath,
} from '../components/discovery/discoveryRoutes';
import { isJournalChannel } from '../journalChannels';
import { isProtectedJournalEntry } from '../types';
import type { AssetView } from '../types';
import type {
  AppRoute,
  DiscoveryOverlayContext,
  FeedRoute,
  OverlayContext,
} from './appRouteTypes';

export const PUBLIC_FEED_CACHE_LIMIT = 30;
export const MAX_PUBLIC_SEARCH_QUERY_LENGTH = 80;
const APP_ROUTE_BASE_URL = 'https://journal.local';
const PHOTO_ALBUM_ID_PATTERN = /^[0-9a-f]{64}$/;

export function parseAppRoute(
  route: RouteLocationNormalizedLoaded,
  defaultAssetView: AssetView,
): AppRoute {
  if (route.name === 'public') {
    const channelQuery = route.query.channel;
    const channel = channelQuery === undefined
      ? 'life'
      : typeof channelQuery === 'string' && isJournalChannel(channelQuery)
        ? channelQuery
        : null;
    if (channel === null) return { name: 'not-found', key: route.fullPath };
    const tag = typeof route.query.tag === 'string' ? route.query.tag : '';
    return { name: 'public', key: `public:${channel}:${tag}`, channel, tag };
  }
  if (route.name === 'private') {
    const entry = route.query.entry;
    const view = route.query.view;
    const page = route.query.page;
    if (entry !== undefined && (typeof entry !== 'string' || !/^[1-9]\d*$/.test(entry))) {
      return { name: 'not-found', key: route.fullPath };
    }
    if (view !== undefined && view !== 'table' && view !== 'waterfall') {
      return { name: 'not-found', key: route.fullPath };
    }
    if (page !== undefined && (typeof page !== 'string' || !/^[1-9]\d*$/.test(page))) {
      return { name: 'not-found', key: route.fullPath };
    }
    const assetView = view ?? defaultAssetView;
    return {
      name: 'private',
      key: 'private',
      entryId: entry === undefined ? null : Number(entry),
      assetView,
      page: assetView === 'table' && page !== undefined ? Number(page) : 1,
    };
  }
  if (route.name === 'about') {
    return { name: 'about', key: 'about' };
  }
  if (route.name === 'resume') {
    return { name: 'resume', key: 'resume' };
  }
  if (route.name === 'search') {
    const query = route.query.q;
    if (query !== undefined && typeof query !== 'string') {
      return { name: 'not-found', key: route.fullPath };
    }
    const normalizedQuery = normalizePublicSearchQuery(query ?? '');
    if (Array.from(normalizedQuery).length > MAX_PUBLIC_SEARCH_QUERY_LENGTH) {
      return { name: 'not-found', key: route.fullPath };
    }
    return {
      name: 'search',
      key: `search:${normalizedQuery}`,
      query: normalizedQuery,
    };
  }
  if (route.name === 'archive') {
    return { name: 'archive', key: 'archive' };
  }
  if (route.name === 'archive-month') {
    const year = String(route.params.year);
    const month = String(route.params.month);
    return {
      name: 'archive-month',
      key: `archive-month:${year}:${month}`,
      year,
      month,
    };
  }
  if (route.name === 'photos') {
    return { name: 'photos', key: 'photos' };
  }
  if (route.name === 'games') {
    return { name: 'games', key: 'games' };
  }
  if (route.name === 'guestbook') {
    return { name: 'guestbook', key: 'guestbook' };
  }
  if (route.name === 'photo-album') {
    const albumId = String(route.params.albumId);
    if (!PHOTO_ALBUM_ID_PATTERN.test(albumId)) {
      return { name: 'not-found', key: route.fullPath };
    }
    return {
      name: 'photo-album',
      key: `photo-album:${albumId}`,
      albumId,
    };
  }
  if (route.name === 'article-new') {
    return { name: 'article-new', key: 'article-new' };
  }
  if (route.name === 'entry-new') {
    return { name: 'entry-new', key: 'entry-new' };
  }
  if (route.name === 'entry-edit') {
    const entryId = Number(route.params.entryId);
    return { name: 'entry-edit', key: `entry-edit:${entryId}`, entryId };
  }
  if (route.name === 'article-edit') {
    const articleId = Number(route.params.articleId);
    return { name: 'article-edit', key: `article-edit:${articleId}`, articleId };
  }
  if (route.name === 'settings') {
    return { name: 'settings', key: 'settings' };
  }
  if (route.name === 'contribution-inbox') {
    return { name: 'contribution-inbox', key: 'contribution-inbox' };
  }
  if (route.name === 'contribution-review') {
    const publicId = String(route.params.publicId);
    return { name: 'contribution-review', key: `contribution-review:${publicId}`, publicId };
  }
  if (route.name === 'detail') {
    const publicId = String(route.params.publicId);
    return { name: 'detail', key: `detail:${publicId}`, publicId };
  }
  return { name: 'not-found', key: route.fullPath };
}

export function privateFeedPath(options: {
  assetView: AssetView;
  page: number;
  entryId?: number;
}): string {
  const search = new URLSearchParams();
  search.set('view', options.assetView);
  if (options.assetView === 'table' && options.page > 1) search.set('page', String(options.page));
  if (options.entryId !== undefined) search.set('entry', String(options.entryId));
  const query = search.toString();
  return query ? `/me?${query}` : '/me';
}

export function persistentFeedKey(path: string): string | null {
  const url = new URL(path, APP_ROUTE_BASE_URL);
  if (url.pathname === '/') {
    const channel = url.searchParams.get('channel') ?? 'life';
    const tag = url.searchParams.get('tag') ?? '';
    if (!isJournalChannel(channel)) return null;
    return `public:${channel}:${tag}`;
  }
  if (url.pathname === '/me') return 'private';
  if (url.pathname === '/search') {
    const queryValues = url.searchParams.getAll('q');
    if (queryValues.length > 1) return null;
    const query = normalizePublicSearchQuery(queryValues[0] ?? '');
    if (Array.from(query).length > MAX_PUBLIC_SEARCH_QUERY_LENGTH) return null;
    return `discovery:${publicSearchPath(query)}`;
  }
  if (
    url.pathname === '/archive'
    || /^\/archive\/\d{4}\/(?:0[1-9]|1[0-2])$/.test(url.pathname)
  ) {
    return `discovery:${url.pathname}`;
  }
  if (url.pathname === '/photos') return 'photos';
  if (url.pathname === '/games') return 'games';
  const photoAlbumMatch = url.pathname.match(/^\/photos\/([0-9a-f]{64})$/);
  if (photoAlbumMatch) return `photo-album:${photoAlbumMatch[1]}`;
  return null;
}

export function persistentFeedRouteKey(feedRoute: FeedRoute): string | null {
  if (feedRoute.name === 'private') return 'private';
  return `public:${feedRoute.channel}:${feedRoute.tag}`;
}

export function pathMatchesOverlayContext(path: string, context: OverlayContext): boolean {
  const url = new URL(path, APP_ROUTE_BASE_URL);
  if (context.origin.name === 'public') {
    return url.pathname === `/p/${encodeURIComponent(context.entry.publicId)}`;
  }
  if (isProtectedJournalEntry(context.entry)) {
    throw new Error('Protected previews require a public feed origin.');
  }
  return url.pathname === '/me' && url.searchParams.get('entry') === String(context.entry.id);
}

export function pathMatchesDiscoveryOverlayContext(
  path: string,
  context: DiscoveryOverlayContext,
): boolean {
  const url = new URL(path, APP_ROUTE_BASE_URL);
  return url.pathname === `/p/${encodeURIComponent(context.entry.publicId)}`;
}
