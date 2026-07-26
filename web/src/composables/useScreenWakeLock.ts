import { onBeforeUnmount, onMounted, shallowRef } from 'vue';

export function useScreenWakeLock() {
  const isActive = shallowRef(false);
  const requested = shallowRef(false);
  let sentinel: WakeLockSentinel | null = null;

  async function acquire(): Promise<void> {
    if (
      !requested.value
      || sentinel
      || document.visibilityState !== 'visible'
      || !('wakeLock' in navigator)
    ) {
      return;
    }

    try {
      const nextSentinel = await navigator.wakeLock.request('screen');
      if (!requested.value) {
        await nextSentinel.release();
        return;
      }
      sentinel = nextSentinel;
      isActive.value = true;
      nextSentinel.addEventListener('release', () => {
        if (sentinel !== nextSentinel) return;
        sentinel = null;
        isActive.value = false;
      }, { once: true });
    } catch {
      isActive.value = false;
    }
  }

  async function start(): Promise<void> {
    requested.value = true;
    await acquire();
  }

  async function stop(): Promise<void> {
    requested.value = false;
    const activeSentinel = sentinel;
    sentinel = null;
    isActive.value = false;
    await activeSentinel?.release();
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') void acquire();
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    void stop();
  });

  return {
    isActive,
    start,
    stop,
  };
}
