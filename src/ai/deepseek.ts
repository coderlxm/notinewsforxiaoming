import OpenAI from 'openai';
import { config } from '../config';
import { GameNews } from '../fetchers/games';
import { EnglishContent } from '../fetchers/english';

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

export async function teachEnglishWithAI(article: EnglishContent): Promise<string> {
  if (!config.deepseekApiKey) {
    return '名师英语教学暂时掉线，请稍后再试。';
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const prompt = `
Role: 你是一位拥有 20 年经验的资深英语老师，擅长将原版新闻作为教材。
Target: 你的学生是 CET-6 水平（词汇量 5000 左右），希望在 5 分钟内通过阅读原版资讯完成碎片化学习。
Input: 下面是一段来自 ${article.source} 的英语原文摘要：
Title: ${article.title}
Content: ${article.content}

Task:
请严格按以下格式输出教学内容（使用 Telegram Markdown 格式）：

1. 📖 **今日原文 (Selection)**:
   > (请精选并修正原文中的一小段地道表达，100词以内)

2. 💡 **重点词汇 (Key Vocabulary)**:
   * (单词/短语) [音标] - (中文含义，需包含在本句中的具体含义)
   * (再列举 2-3 个符合 CET-6 难度的词汇)

3. 🔍 **长难句拆解 (Sentence Analysis)**:
   * (从原文中提取 1 个长难句)
   * **解析**: (简明扼要地拆解语法结构，如定语从句、分词短语等)

4. 📝 **名师总结 (Summary)**:
   * (用中英双语简单概括这段内容的核心信息)

5. 🎓 **课后私语**:
   * (用一句鼓励性的英文话语结尾，并附带中文翻译)

注意：保持排版整洁，使用 Emoji 增加可读性。
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });

    return completion.choices[0].message.content || '老师今天累了，请明天再来。';
  } catch (error) {
    console.error('Failed to teach English with DeepSeek:', error);
    return '英语教学 AI 暂时不可用。';
  }
}

export async function generateEnglishFallbackWithAI(): Promise<string> {
  if (!config.deepseekApiKey) {
    return [
      '📖 **今日原文 (Selection)**:',
      '> "Small progress each day adds up to big results."',
      '',
      '💡 **重点词汇 (Key Vocabulary)**:',
      '* progress [ˈprɑːɡres] - 进步（逐步推进）',
      '* add up to - 累积成，最终达到',
      '* result [rɪˈzʌlt] - 结果',
      '',
      '🔍 **长难句拆解 (Sentence Analysis)**:',
      '* Small progress each day adds up to big results.',
      '* **解析**: 主语是 `Small progress each day`，谓语短语是 `adds up to`，宾语是 `big results`。',
      '',
      '📝 **名师总结 (Summary)**:',
      '* EN: Consistency matters more than speed.',
      '* 中: 每天一点点，坚持比速度更重要。',
      '',
      '🎓 **课后私语**:',
      '* Keep going, your future self will thank you.（坚持下去，未来的你会感谢现在的努力。）'
    ].join('\n');
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const prompt = `
你是一位资深英语老师。当前 RSS 抓取失败，请生成一份“替补版每日英语微课”，用于 CET-6 学习者的 5 分钟碎片学习。

请严格按以下 Telegram Markdown 结构输出：
1. 📖 **今日原文 (Selection)**: 选一句励志名言或常用表达（英文）
2. 💡 **重点词汇 (Key Vocabulary)**: 给出 3-5 个词或短语，含音标和中文义
3. 🔍 **长难句拆解 (Sentence Analysis)**: 给 1 句并做结构解析
4. 📝 **名师总结 (Summary)**: 中英双语概括
5. 🎓 **课后私语**: 一句鼓励性英文 + 中文
`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });

    return completion.choices[0].message.content || '今日英语替补内容生成失败。';
  } catch (error) {
    console.error('Failed to generate English fallback with DeepSeek:', error);
    return [
      '📖 **今日原文 (Selection)**:',
      '> "Practice makes progress, not perfection."',
      '',
      '💡 **重点词汇 (Key Vocabulary)**:',
      '* practice [ˈpræktɪs] - 练习',
      '* progress [ˈprɑːɡres] - 进步',
      '* perfection [pərˈfekʃn] - 完美',
      '',
      '🔍 **长难句拆解 (Sentence Analysis)**:',
      '* Practice makes progress, not perfection.',
      '* **解析**: 主语 `Practice`，谓语 `makes`，宾语 `progress`，后置对比 `not perfection` 强调方向。',
      '',
      '📝 **名师总结 (Summary)**:',
      '* EN: Focus on improvement rather than being perfect.',
      '* 中: 学习关键在持续变好，而不是一开始就完美。',
      '',
      '🎓 **课后私语**:',
      '* One more page today is a better you tomorrow.（今天多学一页，明天就更强一点。）'
    ].join('\n');
  }
}


