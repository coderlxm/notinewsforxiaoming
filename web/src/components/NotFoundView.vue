<template>
  <main class="not-found">
    <span class="not-found__code">404</span>
    <h1 class="not-found__title">这条路没有记录</h1>
    <RouterLink class="button button--primary" to="/">返回首页</RouterLink>
  </main>
</template>

<style scoped>
.not-found {
  display: grid;
  min-height: 55vh;
  place-content: center;
  justify-items: center;
  text-align: center;
}

.not-found__code {
  color: var(--accent);
  font-family: var(--font-serif);
  font-size: 4rem;
  line-height: 1;
}

.not-found__title {
  margin: 0.5rem 0 1.2rem;
  font-family: var(--font-serif);
  font-size: 1.35rem;
}
</style>
