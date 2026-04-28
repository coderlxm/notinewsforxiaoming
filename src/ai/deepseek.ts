import OpenAI from 'openai';
import { config } from '../config';
import { GameNews } from '../fetchers/games';
import { WeiboHot } from '../fetchers/weibo';

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
      model: 'deepseek-v4-flash',
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

export async function summarizeWeiboWithAI(hotList: WeiboHot[]): Promise<string> {
  if (!config.deepseekApiKey || hotList.length === 0) {
    return '暂无热搜摘要。';
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const prompt = `
请作为一名客观、敏锐的社会观察者，对以下微博热搜进行梳理和精炼。
要求：
1. 过滤掉无聊的营销号广告和过度娱乐的八卦。
2. 将剩下的内容按类别（如：社会热点、科技民生、娱乐影视）进行归类。
3. 每个类别下用简洁的语言描述现在的核心关注点。
4. 语言要干练，使用适当的 Emoji。
5. 返回格式为 Telegram Markdown。

热搜列表：
${hotList.map((n, i) => `${i + 1}. ${n.title}`).join('\n')}
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });

    return completion.choices[0].message.content || 'AI 总结失败。';
  } catch (error) {
    console.error('Failed to summarize Weibo with DeepSeek:', error);
    return '微博热搜 AI 总结暂时不可用。';
  }
}

