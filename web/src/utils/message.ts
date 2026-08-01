import { ElMessage } from 'element-plus';
import type { MessageHandler, MessageType } from 'element-plus';

export interface ShowMessageOptions {
  message: string;
  type?: MessageType;
  duration?: number;
}

export function showMessage(options: ShowMessageOptions): MessageHandler {
  return ElMessage({
    placement: 'top',
    offset: 20,
    showClose: true,
    ...options,
    customClass: 'journal-message',
  });
}
