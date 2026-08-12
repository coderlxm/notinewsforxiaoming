import { onBeforeUnmount, onMounted } from 'vue';

interface PublicDiscoveryHead {
  title: string;
  robots: 'index, follow' | 'noindex, follow';
  canonicalPath: string;
  structuredData: Record<string, unknown> | null;
}

export function usePublicDiscoveryHead(initialHead: () => PublicDiscoveryHead) {
  let originalTitle = '';
  let existingRobots: HTMLMetaElement | null = null;
  let existingCanonical: HTMLLinkElement | null = null;
  let originalRobotsContent = '';
  let originalCanonicalHref: string | null = null;
  let robotsElement: HTMLMetaElement | null = null;
  let canonicalElement: HTMLLinkElement | null = null;
  let structuredDataElement: HTMLScriptElement | null = null;
  let mounted = false;

  function apply(head: PublicDiscoveryHead): void {
    if (!mounted) return;
    document.title = head.title;

    if (!robotsElement) {
      robotsElement = document.createElement('meta');
      robotsElement.name = 'robots';
      document.head.append(robotsElement);
    }
    robotsElement.content = head.robots;

    if (!canonicalElement) {
      canonicalElement = document.createElement('link');
      canonicalElement.rel = 'canonical';
      document.head.append(canonicalElement);
    }
    canonicalElement.href = new URL(head.canonicalPath, window.location.origin).href;

    if (head.structuredData === null) {
      structuredDataElement?.remove();
      structuredDataElement = null;
      return;
    }
    if (!structuredDataElement) {
      structuredDataElement = document.createElement('script');
      structuredDataElement.type = 'application/ld+json';
      structuredDataElement.dataset.publicDiscovery = '';
      document.head.append(structuredDataElement);
    }
    structuredDataElement.textContent = JSON.stringify(head.structuredData);
  }

  onMounted(() => {
    originalTitle = document.title;
    existingRobots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    existingCanonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    originalRobotsContent = existingRobots?.content ?? '';
    originalCanonicalHref = existingCanonical?.getAttribute('href') ?? null;
    robotsElement = existingRobots;
    canonicalElement = existingCanonical;
    mounted = true;
    apply(initialHead());
  });

  onBeforeUnmount(() => {
    mounted = false;
    document.title = originalTitle;

    if (existingRobots) existingRobots.content = originalRobotsContent;
    else robotsElement?.remove();

    if (existingCanonical) {
      if (originalCanonicalHref === null) existingCanonical.removeAttribute('href');
      else existingCanonical.setAttribute('href', originalCanonicalHref);
    }
    else canonicalElement?.remove();

    structuredDataElement?.remove();
  });

  return { apply };
}
