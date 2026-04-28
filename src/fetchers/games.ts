import Parser from 'rss-parser';

export interface GameNews {
  title: string;
  link: string;
  pubDate: string;
}

const parser = new Parser();

const RSS_FEEDS = [
  'https://www.gcores.com/rss', // 机核网
  'https://www.polygon.com/rss/index.xml', // Polygon (外媒，DeepSeek 会自动翻译)
  'http://feeds.ign.com/ign/news' // IGN
];

const KEYWORDS_REGEX = /PS5|PS4|PlayStation|Switch|任天堂|Xbox|Steam/i;

export async function fetchGameNews(): Promise<GameNews[]> {
  const allNews: GameNews[] = [];
  
  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed);
      parsed.items.forEach(item => {
        const titleAndContent = (item.title || '') + ' ' + (item.contentSnippet || '');
        // 如果标题或者内容匹配到主机/Steam相关关键字，就收录
        if (KEYWORDS_REGEX.test(titleAndContent)) {
          allNews.push({
            title: item.title || '无标题',
            link: item.link || '',
            pubDate: item.pubDate || new Date().toISOString()
          });
        }
      });
    } catch (error) {
      console.error(`Failed to fetch RSS from ${feed}:`, error);
    }
  }

  // 按发布时间倒序排序
  allNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  // 返回前 5 条
  return allNews.slice(0, 5);
}
