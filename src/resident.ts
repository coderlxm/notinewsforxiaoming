import { createBot } from './bot/createBot';
import { registerInteractiveHandlers } from './bot/interactive';
import { schedulePendingReminders } from './reminders/scheduler';
import { registerFixedJobs } from './scheduled/jobs';

async function main() {
  const bot = createBot();
  registerInteractiveHandlers(bot);
  schedulePendingReminders(bot);
  registerFixedJobs(bot);

  bot.launch({
    allowedUpdates: ['message', 'callback_query'],
    dropPendingUpdates: false
  });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  console.log('Bot started. Long polling for updates...');
}

main().catch(error => {
  console.error('Resident bot encountered an error:', error);
  process.exit(1);
});
