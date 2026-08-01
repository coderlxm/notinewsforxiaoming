<template>
  <div class="asset-table-placeholder" role="status" aria-label="正在读取资产列表">
    <div class="asset-table-placeholder__canvas" aria-hidden="true">
      <div class="asset-table-placeholder__header">
        <span v-for="column in 7" :key="column" />
      </div>
      <div v-for="row in 6" :key="row" class="asset-table-placeholder__row">
        <span class="asset-table-placeholder__time" />
        <span class="asset-table-placeholder__content">
          <i />
          <b />
        </span>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  </div>
</template>

<style scoped>
.asset-table-placeholder {
  overflow-x: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.asset-table-placeholder__canvas {
  min-width: 1080px;
}

.asset-table-placeholder__header,
.asset-table-placeholder__row {
  display: grid;
  grid-template-columns: 190px minmax(360px, 1fr) 96px 96px 88px 130px 120px;
  align-items: center;
}

.asset-table-placeholder__header {
  min-height: 2.75rem;
  background: color-mix(in srgb, var(--surface-muted) 60%, var(--surface-card));
}

.asset-table-placeholder__row {
  min-height: 5rem;
  border-top: 1px solid var(--border-subtle);
}

.asset-table-placeholder__header > span,
.asset-table-placeholder__row > span,
.asset-table-placeholder__content i,
.asset-table-placeholder__content b {
  display: block;
  height: 0.72rem;
  margin: 0 0.75rem;
  border-radius: 999px;
  background: var(--surface-muted);
  animation: asset-table-placeholder-pulse 1.4s ease-in-out infinite;
}

.asset-table-placeholder__header > span {
  width: 42%;
}

.asset-table-placeholder__time {
  width: 62%;
}

.asset-table-placeholder__content {
  display: grid !important;
  height: auto !important;
  grid-template-columns: 3.5rem minmax(0, 1fr);
  align-items: center;
  gap: 0.7rem;
  margin: 0 0.75rem !important;
  background: transparent !important;
  animation: none !important;
}

.asset-table-placeholder__content i {
  width: 3.5rem;
  height: 3.5rem;
  margin: 0;
  border-radius: 8px;
}

.asset-table-placeholder__content b {
  width: 72%;
  margin: 0;
}

@keyframes asset-table-placeholder-pulse {
  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
  }
}
</style>
