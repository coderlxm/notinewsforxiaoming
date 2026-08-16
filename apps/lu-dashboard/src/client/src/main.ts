import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

const savedTheme = localStorage.getItem('lu_dashboard_theme')
if (savedTheme === 'light' || savedTheme === 'dark') {
  document.documentElement.dataset.theme = savedTheme
}

createApp(App).mount('#app')
