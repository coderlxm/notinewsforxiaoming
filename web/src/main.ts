import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './assets/main.css';
import 'element-plus/es/components/dropdown/style/css';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/table/style/css';
import 'element-plus/es/components/table-column/style/css';
import 'element-plus/es/components/tooltip/style/css';

createApp(App)
  .use(createPinia())
  .use(router)
  .mount('#app');
