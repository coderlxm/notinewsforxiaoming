import { onUnmounted, readonly, shallowRef, watch, type Ref } from 'vue';

export function useDeferredLoading(source: Readonly<Ref<boolean>>) {
  const visible = shallowRef(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  watch(source, (value) => {
    if (value) {
      timer = setTimeout(() => {
        visible.value = true;
        timer = null;
      }, 120);
    } else {
      clearTimer();
      visible.value = false;
    }
  }, { immediate: true });

  onUnmounted(() => {
    clearTimer();
  });

  return {
    visible: readonly(visible),
  };
}
