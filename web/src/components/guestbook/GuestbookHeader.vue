<script setup lang="ts">
defineProps<{
  total: number | null;
  repliedTotal: number;
  hiddenTotal: number | null;
  ownerMode: boolean;
}>();
</script>

<template>
  <header class="guestbook-header">
    <p class="guestbook-header__eyebrow">GUESTBOOK</p>
    <div class="guestbook-header__title-row">
      <h1 class="guestbook-header__title">留言板</h1>

      <div class="guestbook-header__stats" aria-live="polite">
        <div class="guestbook-header__stat-chip">
          <span class="guestbook-header__stat-label">留言</span>
          <span class="guestbook-header__stat-val">{{ total !== null ? total : '—' }}</span>
        </div>

        <div v-if="total !== null && total > 0" class="guestbook-header__stat-chip">
          <span class="guestbook-header__stat-label">已回复</span>
          <span class="guestbook-header__stat-val guestbook-header__stat-val--replied">
            {{ repliedTotal }}
          </span>
        </div>

        <div v-if="ownerMode && hiddenTotal !== null && hiddenTotal > 0" class="guestbook-header__stat-chip guestbook-header__stat-chip--warning">
          <span class="guestbook-header__stat-label">已隐藏</span>
          <span class="guestbook-header__stat-val">{{ hiddenTotal }}</span>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.guestbook-header {
  display: grid;
  gap: 0.35rem;
}

.guestbook-header__eyebrow {
  margin: 0;
  color: var(--accent-strong);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.guestbook-header__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem 1.4rem;
}

.guestbook-header__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: clamp(1.85rem, 4vw, 2.4rem);
  font-weight: 650;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.guestbook-header__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.guestbook-header__stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.26rem 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--surface-card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  font-size: 0.76rem;
}

.guestbook-header__stat-label {
  color: var(--text-muted);
}

.guestbook-header__stat-val {
  font-weight: 700;
  color: var(--text-primary);
}

.guestbook-header__stat-val--replied {
  color: var(--accent-strong);
}

.guestbook-header__stat-chip--warning {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-subtle));
  background: var(--accent-soft);
}

.guestbook-header__stat-chip--warning .guestbook-header__stat-label,
.guestbook-header__stat-chip--warning .guestbook-header__stat-val {
  color: var(--accent-strong);
}
</style>
