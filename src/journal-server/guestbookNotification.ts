import { Telegraf } from 'telegraf';

export interface JournalGuestbookNotificationInput {
  messageId: number;
  authorName: string;
  content: string;
  createdAt: string;
}

const notificationTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function truncatePlainText(value: string, maxLength: number): string {
  const flat = value.replace(/\s+/gu, ' ').trim();
  const characters = [...flat];
  return characters.length > maxLength
    ? `${characters.slice(0, maxLength).join('')}…`
    : flat;
}

export class JournalGuestbookNotificationService {
  private readonly bot: Telegraf;
  private readonly publicBaseUrl: string;

  constructor(
    token: string,
    private readonly chatId: string,
    publicBaseUrl: string,
  ) {
    this.bot = new Telegraf(token);
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, '');
  }

  async notifyNewMessage(input: JournalGuestbookNotificationInput): Promise<void> {
    const message = [
      '📬 Journal 收到新留言',
      '',
      `访客：${truncatePlainText(input.authorName, 24)}`,
      `内容：${truncatePlainText(input.content, 80)}`,
      `时间：${notificationTimeFormatter.format(new Date(input.createdAt))}`,
    ].join('\n');
    await this.bot.telegram.sendMessage(this.chatId, message, {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '打开留言板',
            url: `${this.publicBaseUrl}/guestbook`,
          },
          {
            text: '隐藏留言',
            callback_data: `jg:h:${input.messageId}`,
          },
        ]],
      },
    });
  }
}
