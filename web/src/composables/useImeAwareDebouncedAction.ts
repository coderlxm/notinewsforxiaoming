import { useDebounceFn } from '@vueuse/core';

export function useImeAwareDebouncedAction(action: () => void, delay: number) {
  let composing = false;
  const queue = useDebounceFn(() => {
    if (!composing) action();
  }, delay);

  function handleInput(event: Event): void {
    if (composing || (event as InputEvent).isComposing) return;
    void queue();
  }

  function handleCompositionStart(): void {
    composing = true;
  }

  function handleCompositionEnd(): void {
    composing = false;
    void queue();
  }

  return {
    queue,
    handleInput,
    handleCompositionStart,
    handleCompositionEnd,
  };
}
