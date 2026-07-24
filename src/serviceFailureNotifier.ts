import { sendTelegramMessage } from './publishers/telegram.js';
import { bj } from './utils/time.js';

const failedUnit = process.argv[2];
if (!failedUnit) {
  throw new Error('Failed systemd unit name is required.');
}

await sendTelegramMessage([
  '⚠️ <b>NotiNews 服务异常退出</b>',
  '',
  `服务：<code>${failedUnit}</code>`,
  `时间：${bj().format('YYYY-MM-DD HH:mm:ss')}`,
  'systemd 将按服务配置自动重启。',
].join('\n'));
