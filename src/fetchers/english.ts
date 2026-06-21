import Parser from 'rss-parser';
import { load as cheerioLoad } from 'cheerio';
import pTimeout from 'p-timeout';

export interface EnglishContent {
  source: string;
  title: string;
  content: string;
  link: string;
}

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
});

type EnglishSource = {
  name: string;
  urls: string[];
};

const SOURCES = [
  {
    name: 'VOA Learning English - Everyday Grammar',
    urls: ['https://learningenglish.voanews.com/api/zmg_pl-vomx-tpeymtm']
  },
  {
    name: 'VOA Learning English - Words and Their Stories',
    urls: ['https://learningenglish.voanews.com/api/zmypyl-vomx-tpeyry_']
  },
  {
    name: 'VOA Learning English - As It Is',
    urls: ['https://learningenglish.voanews.com/api/zkm-ql-vomx-tpej-rqi']
  },
  {
    name: 'TechCrunch',
    urls: ['https://techcrunch.com/feed/']
  },
  {
    name: 'The Verge',
    urls: ['https://www.theverge.com/rss/index.xml']
  },
  {
    name: 'BBC News',
    urls: ['https://feeds.bbci.co.uk/news/rss.xml']
  },
  {
    name: 'BBC World',
    urls: ['https://feeds.bbci.co.uk/news/world/rss.xml']
  },
  {
    name: 'The Guardian International',
    urls: ['https://www.theguardian.com/international/rss']
  },
  {
    name: 'The Guardian Technology',
    urls: ['https://www.theguardian.com/technology/rss']
  },
  {
    name: 'NPR News',
    urls: ['https://feeds.npr.org/1001/rss.xml']
  },
  {
    name: 'NPR Technology',
    urls: ['https://feeds.npr.org/1019/rss.xml']
  }
];

function stripHtml(input: string): string {
  const $ = cheerioLoad(input);
  $('script, style').remove();
  return $.root().text().replace(/\s+/g, ' ').trim();
}

function countWords(input: string): number {
  return input.split(/\s+/).filter(Boolean).length;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

async function parseWithTimeout(url: string, timeoutMs: number): Promise<Parser.Output<unknown>> {
  return pTimeout(parser.parseURL(url), { milliseconds: timeoutMs, message: `Timeout after ${timeoutMs}ms: ${url}` });
}

function pickCandidate(
  items: Parser.Item[],
  sourceName: string
): EnglishContent | null {
  const normalized = items.map((item) => {
    const raw = item.contentSnippet || item.content || '';
    const content = stripHtml(raw);
    return {
      title: item.title || 'No Title',
      link: item.link || '',
      content,
      words: countWords(content)
    };
  }).filter((item) => item.content.length > 0);

  if (normalized.length === 0) return null;

  const preferred = normalized.filter((item) => item.words >= 100 && item.words <= 300);
  const pool = preferred.length > 0 ? preferred : normalized;
  const selected = pool[Math.floor(Math.random() * pool.length)]!;

  return {
    source: sourceName,
    title: selected.title,
    content: selected.content,
    link: selected.link
  };
}

async function fetchFromSource(source: EnglishSource): Promise<EnglishContent | null> {
  for (const url of source.urls) {
    try {
      const parsed = await parseWithTimeout(url, 10000);
      const sample = shuffle(parsed.items).slice(0, 12);
      const picked = pickCandidate(sample, source.name);
      if (picked) return picked;
    } catch (error) {
      console.error(`Failed to fetch English content from ${source.name} (${url}):`, error);
    }
  }
  return null;
}

export async function fetchEnglishContent(): Promise<EnglishContent | null> {
  const shuffled = shuffle(SOURCES);
  const requests = shuffled.map(async (source) => {
    const result = await fetchFromSource(source);
    if (!result) {
      throw new Error(`No valid content from ${source.name}`);
    }
    return result;
  });

  try {
    return await Promise.any(requests);
  } catch (error) {
    console.error('Failed to fetch English content from all sources:', error);
    return null;
  }
}
