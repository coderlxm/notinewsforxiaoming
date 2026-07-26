import { Telegraf } from 'telegraf';
import type { JournalContributionDetail } from '../shared/journalProtocol.js';

export class JournalContributionNotificationService {
  private readonly bot: Telegraf;

  constructor(
    token: string,
    private readonly chatId: string,
    private readonly publicBaseUrl: string,
  ) {
    this.bot = new Telegraf(token);
  }

  async notify(contribution: JournalContributionDetail): Promise<void> {
    const photoCount = contribution.assets.filter((asset) => asset.kind === 'photo').length;
    const videoCount = contribution.assets.filter((asset) => asset.kind === 'video').length;
    const mediaParts = [
      photoCount > 0 ? `${photoCount} 张照片` : '',
      videoCount > 0 ? `${videoCount} 段视频` : '',
    ].filter(Boolean);
    const contentSummary = mediaParts.length > 0 ? mediaParts.join(' · ') : '仅文字';
    const messageLines = [
      '📮 收到朋友投稿',
      '',
      `来自：${contribution.senderName}`,
      `内容：${contentSummary}`,
    ];
    const trimmedText = contribution.contentText.trim();
    if (trimmedText !== '') {
      messageLines.push(`留言：${trimmedText.slice(0, 80)}${trimmedText.length > 80 ? '……' : ''}`);
    }
    await this.bot.telegram.sendMessage(this.chatId, messageLines.join('\n'), {
      reply_markup: {
        inline_keyboard: [[{
          text: '查看投稿',
          url: `${this.publicBaseUrl}/me/contributions/${contribution.publicId}`,
        }]],
      },
    });
  }
}
