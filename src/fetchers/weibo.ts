import Parser from 'rss-parser';

export interface WeiboHot {
  title: string;
  link: string;
}

const parser = new Parser();

export async function fetchWeiboHot(): Promise<WeiboHot[]> {
  const RSS_URL = 'https://rsshub.app/weibo/search/hot';
  
  try {
    const parsed = await parser.parseURL(RSS_URL);
    // 微博热搜一般取前 15 条交给 AI 总结即可，太多了 AI 会乱
    return parsed.items.slice(0, 15).map(item => ({
      title: item.title || '',
      link: item.link || ''
    }));
  } catch (error) {
    console.error('Failed to fetch Weibo hot search:', error);
    return [];
  }
}
