<script setup lang="ts">
defineProps<{
  total: number | null;
  hiddenTotal: number | null;
  ownerMode: boolean;
}>();
</script>

<template>
  <header class="guestbook-header">
    <p class="guestbook-header__eyebrow">GUESTBOOK</p>
    <div class="guestbook-header__row">
      <h1 class="guestbook-header__title">留言板</h1>
      <p class="guestbook-header__count" aria-live="polite">
        <template v-if="total === null">— 条留言</template>
        <template v-else-if="ownerMode && hiddenTotal !== null">
          {{ total }} 条留言 · {{ hiddenTotal }} 条已隐藏
        </template>
        <template v-else>{{ total }} 条留言</template>
      </p>
    </div>
    <p class="guestbook-header__description">来都来了，留句话吧。问候、想法或问题，我都会认真看。</p>
  </header>
</template>

<style scoped>
.guestbook-header {
  display: grid;
  gap: 0.45rem;
}

.guestbook-header__eyebrow,
.guestbook-header__title,
.guestbook-header__description,
.guestbook-header__count {
  margin: 0;
}

.guestbook-header__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  font-weight: 780;
  letter-spacing: 0.2em;
}

.guestbook-header__row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.9rem;
}

.guestbook-header__title {
  font-family: var(--font-serif);
  font-size: clamp(1.7rem, 4vw, 2.45rem);
}

.guestbook-header__count {
  color: var(--text-muted);
  font-size: 0.78rem;
  white-space: nowrap;
}

.guestbook-header__description {
  color: var(--text-muted);
  font-size: 0.84rem;
  line-height: 1.7;
}
</style>
