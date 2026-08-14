import { onBeforeUnmount, watch } from 'vue';
import { showMessage } from '../utils/message';

export function useJournalErrorMessage(
  error: { readonly value: string | null },
  isTerminal: () => boolean,
): void {
  let terminalErrorMessage: ReturnType<typeof showMessage> | null = null;

  watch(() => error.value, (message) => {
    if (!message) {
      terminalErrorMessage?.close();
      terminalErrorMessage = null;
      return;
    }
    if (isTerminal()) {
      terminalErrorMessage?.close();
      terminalErrorMessage = showMessage({ message, type: 'error', duration: 0 });
      return;
    }
    terminalErrorMessage?.close();
    terminalErrorMessage = null;
    showMessage({ message, type: 'error' });
  });

  onBeforeUnmount(() => terminalErrorMessage?.close());
}
