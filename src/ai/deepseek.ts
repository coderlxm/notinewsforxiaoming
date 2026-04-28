import OpenAI from 'openai';
import { config } from '../config';
import { GameNews } from '../fetchers/games';

export async function summarizeNewsWithAI(newsList: GameNews[]): Promise<GameNews[]> {
  if (!config.deepseekApiKey) {
    console.log('DeepSeek API Key is not set. Skipping AI summary.');
    return newsList;
  }

  if (newsList.length === 0) return newsList;

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const prompt = `
请作为一名资深且幽默的游戏媒体编辑，对以下的新闻标题进行简要的中文润色和一句话看点提取。
要求：
1. 语言风格轻松幽默，加上适合的 Emoji。
2. 保持原意不变。
3. 返回格式必须是一行文字，不要有额外的解释。

新闻列表：
${newsList.map((n, i) => `[${i}] ${n.title}`).join('\n')}

请依次输出每个新闻的处理结果，格式为：
[0] 你的润色结果
[1] 你的润色结果
...
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-chat',
    });

    const aiContent = completion.choices[0].message.content || '';
    
    // 解析 AI 的输出，并覆盖到原数组中
    const lines = aiContent.split('\n');
    const summarizedNews = [...newsList];
    
    lines.forEach(line => {
      const match = line.match(/^\[(\d+)\]\s*(.*)/);
      if (match) {
        const index = parseInt(match[1]);
        const summary = match[2].trim();
        if (summarizedNews[index]) {
          summarizedNews[index].title = summary;
        }
      }
    });

    return summarizedNews;
  } catch (error) {
    console.error('Failed to summarize news with DeepSeek:', error);
    return newsList; // 发生错误时回退到原始新闻
  }
}
