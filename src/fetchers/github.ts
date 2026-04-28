import axios from 'axios';

export interface GithubRepo {
  title: string;
  link: string;
  description: string;
}

export async function fetchGithubTrending(): Promise<GithubRepo[]> {
  // 计算 7 天前的日期，模拟 Trending 效果
  const date = new Date();
  date.setDate(date.getDate() - 7);
  const dateString = date.toISOString().split('T')[0];

  // 使用 GitHub 官方 Search API：搜索过去 7 天创建、Star 数最高的项目
  const API_URL = `https://api.github.com/search/repositories?q=created:>${dateString}&sort=stars&order=desc&per_page=5`;
  
  try {
    const response = await axios.get(API_URL, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'NotiNewsBot'
      }
    });

    if (response.data && response.data.items) {
      return response.data.items.map((item: any) => ({
        title: item.full_name,
        link: item.html_url,
        description: item.description || 'No description'
      }));
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch Github Trending from official API:', error);
    return [];
  }
}

