import { createApp } from 'vue'
import './styles/main.scss'
import App from './app.vue'
import { toCssEasing, UI_SPRING } from './data/easing'
import router from './router'

// UI 互動共用的彈簧曲線
document.documentElement.style.setProperty('--spring', toCssEasing(UI_SPRING))

createApp(App).use(router).mount('#app')
