const PUBLIC_DISCOVERY_CACHE_LIMIT = 30;

const discoveryCache = new Map<string, unknown>();

function cacheKey(accessScope: string, canonicalUrl: string): string {
  return `${accessScope}\u0000${canonicalUrl}`;
}

export interface PublicDiscoveryCachedPage<Entry> {
  entries: readonly Entry[];
  nextCursor: string | null;
}

export function usePublicDiscoveryCache() {
  function read<Value>(accessScope: string, canonicalUrl: string): Value | undefined {
    const key = cacheKey(accessScope, canonicalUrl);
    const value = discoveryCache.get(key) as Value | undefined;
    if (value === undefined) return undefined;
    discoveryCache.delete(key);
    discoveryCache.set(key, value);
    return value;
  }

  function write<Value>(accessScope: string, canonicalUrl: string, value: Value): void {
    const key = cacheKey(accessScope, canonicalUrl);
    discoveryCache.delete(key);
    discoveryCache.set(key, value);

    if (discoveryCache.size <= PUBLIC_DISCOVERY_CACHE_LIMIT) return;
    const oldestKey = discoveryCache.keys().next().value as string;
    discoveryCache.delete(oldestKey);
  }

  return { read, write };
}
