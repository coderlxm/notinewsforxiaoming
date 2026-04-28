import Parser from 'rss-parser';

export interface GithubRepo {
  title: string;
  link: string;
  description: string;
}

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
});

export async function fetchGithubTrending(): Promise<GithubRepo[]> {
  // 使用 GitHub Trending Daily RSS
  const RSS_URL = 'https://rsshub.app/github/trending/daily/any';
  
  try {
    const parsed = await parser.parseURL(RSS_URL);
    return parsed.items.slice(0, 5).map(item => ({
      title: item.title || 'Unknown Repo',
      link: item.link || '',
      description: item.contentSnippet || ''
    }));
  } catch (error) {
    console.error('Failed to fetch Github Trending:', error);
    return [];
  }
}
