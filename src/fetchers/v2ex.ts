import axios from 'axios';

export interface V2exTopic {
  id: number;
  title: string;
  content: string;
  node: string;
  link: string;
  replies: number;
}

export async function fetchV2exHot(): Promise<V2exTopic[]> {
  const API_URL = 'https://www.v2ex.com/api/topics/hot.json';
  
  try {
    const response = await axios.get(API_URL);
    if (Array.isArray(response.data)) {
      return response.data.map((item: any) => ({
        id: item.id,
        title: item.title,
        content: item.content || '',
        node: item.node?.title || 'Unknown',
        link: item.url,
        replies: item.replies
      }));
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch V2EX hot topics:', error);
    return [];
  }
}
