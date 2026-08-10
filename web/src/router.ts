import { createRouter, createWebHistory } from 'vue-router';
import AboutView from './components/about/AboutView.vue';
import ArticleEditorView from './components/article/ArticleEditorView.vue';
import NotFoundView from './components/NotFoundView.vue';
import FeedView from './components/journal/FeedView.vue';
import EntryPublisherView from './components/publisher/EntryPublisherView.vue';
import SiteProfileSettingsView from './components/settings/SiteProfileSettingsView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'public', component: FeedView },
    { path: '/about', name: 'about', component: AboutView },
    { path: '/me', name: 'private', component: FeedView },
    {
      path: '/me/settings',
      name: 'settings',
      component: SiteProfileSettingsView,
    },
    {
      path: '/me/contributions',
      name: 'contribution-inbox',
      component: () => import('./components/contribution/AdminContributionInboxView.vue'),
    },
    {
      path: '/me/contributions/:publicId',
      name: 'contribution-review',
      component: () => import('./components/contribution/AdminContributionReviewView.vue'),
      props: true,
    },
    {
      path: '/me/entries/new',
      name: 'entry-new',
      component: EntryPublisherView,
    },
    {
      path: '/me/entries/:entryId(\\d+)/edit',
      name: 'entry-edit',
      component: EntryPublisherView,
      props: route => ({ entryId: Number(route.params.entryId) }),
    },
    {
      path: '/me/articles/new',
      name: 'article-new',
      component: ArticleEditorView,
    },
    {
      path: '/me/articles/:articleId(\\d+)/edit',
      name: 'article-edit',
      component: ArticleEditorView,
      props: route => ({ articleId: Number(route.params.articleId) }),
    },
    { path: '/p/:publicId', name: 'detail', component: FeedView },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView,
    },
  ],
});

router.afterEach((to) => {
  document.title = to.name === 'about' ? '关于我 · 小明同学' : '小明同学';
});
