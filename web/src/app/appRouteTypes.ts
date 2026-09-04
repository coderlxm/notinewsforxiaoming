import type { RouteLocationNormalizedLoaded } from 'vue-router';
import type {
  AssetView,
  JournalChannel,
  JournalDiscoveryListItem,
  JournalEntry,
  PublicJournalFeedItem,
} from '../types';

export type AppRoute =
  | { name: 'public'; key: string; channel: JournalChannel; tag: string }
  | { name: 'about'; key: string }
  | { name: 'resume'; key: string }
  | { name: 'search'; key: string; query: string }
  | { name: 'archive'; key: string }
  | { name: 'archive-month'; key: string; year: string; month: string }
  | { name: 'photos'; key: string }
  | { name: 'photo-album'; key: string; albumId: string }
  | { name: 'games'; key: string }
  | { name: 'guestbook'; key: 'guestbook' }
  | { name: 'detail'; key: string; publicId: string }
  | { name: 'private'; key: string; entryId: number | null; assetView: AssetView; page: number }
  | { name: 'entry-new'; key: string }
  | { name: 'entry-edit'; key: string; entryId: number }
  | { name: 'article-new'; key: string }
  | { name: 'article-edit'; key: string; articleId: number }
  | { name: 'settings'; key: string }
  | { name: 'contribution-inbox'; key: string }
  | { name: 'contribution-review'; key: string; publicId: string }
  | { name: 'not-found'; key: string };

export type FeedRoute = Extract<AppRoute, { name: 'public' | 'private' }>;
export type DiscoveryRoute = Extract<AppRoute, { name: 'search' | 'archive' | 'archive-month' }>;
export type DiscoveryOverlayRoute = Extract<AppRoute, { name: 'search' | 'archive-month' }>;

export interface OverlayContext {
  entry: PublicJournalFeedItem;
  origin: FeedRoute;
  originPath: string;
}

export interface DiscoveryOverlayContext {
  entry: JournalDiscoveryListItem;
  loadedEntry?: JournalEntry;
  origin: DiscoveryOverlayRoute;
  originLocation: RouteLocationNormalizedLoaded;
  originPath: string;
  originTitle: string;
  accessScope: string;
}
