import OpenAI from 'openai';
import { config } from '../config';
import { GameNews } from '../fetchers/games';
import { GithubRepo } from '../fetchers/github';

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

export async function summarizeGithubWithAI(repos: GithubRepo[]): Promise<string> {
  if (!config.deepseekApiKey || repos.length === 0) {
    return '暂无今日 GitHub 趋势。';
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const prompt = `
请作为一名资深的 Full Stack 工程师和技术博主，对以下 GitHub 今日热门项目进行解析。
要求：
1. 将项目名称和描述翻译成地道的中文。
2. 用一句话精准描述这个项目“解决了什么痛点”或“为什么值得关注”。
3. 保持专业且极客的语气。
4. 使用适当的技术类 Emoji。
5. 返回格式为 Telegram Markdown，包含链接。

项目列表：
${repos.map((n, i) => `${i + 1}. ${n.title}: ${n.description}`).join('\n')}
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });

    return completion.choices[0].message.content || 'AI 总结失败。';
  } catch (error) {
    console.error('Failed to summarize Github with DeepSeek:', error);
    return 'GitHub 趋势 AI 总结暂时不可用。';
  }
}

export async function generateLifeTipWithAI(): Promise<string> {
  if (!config.deepseekApiKey) {
    return '生活小贴士：多喝热水，早点睡觉。';
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const prompt = '请随机生成一条非常简短、实用、有趣的“生活小常识”或“健康小贴士”。要求：字数控制在 50 字以内，带上 1-2 个 Emoji，适合深夜阅读。';

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });

    return completion.choices[0].message.content || '生活小贴士：好梦！';
  } catch (error) {
    console.error('Failed to generate life tip with DeepSeek:', error);
    return '生活小贴士：放下手机，立刻闭眼。';
  }
}

export async function generateMorningQuoteWithAI(): Promise<string> {
  if (!config.deepseekApiKey) {
    return '早安！新的一天，加油！☀️';
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const prompt = '请生成一段简短、充满力量、能让人瞬间清醒并感到温暖的晨间励志语录。要求：适合程序员阅读，带上 1-2 个积极的 Emoji，字数 40 字以内。';

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });

    return completion.choices[0].message.content || '加油，你是最棒的！☀️';
  } catch (error) {
    console.error('Failed to generate morning quote with DeepSeek:', error);
    return '早安！今天又是充满可能的一天。🚀';
  }
}



