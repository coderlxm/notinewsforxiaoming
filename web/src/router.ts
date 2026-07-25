import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'public' },
    { path: '/me', name: 'private' },
    { path: '/me/entries/new', name: 'entry-new' },
    { path: '/me/entries/:entryId(\\d+)/edit', name: 'entry-edit' },
    { path: '/me/articles/new', name: 'article-new' },
    { path: '/me/articles/:articleId(\\d+)/edit', name: 'article-edit' },
    { path: '/p/:publicId', name: 'detail' },
    { path: '/:pathMatch(.*)*', name: 'not-found' },
  ],
});
