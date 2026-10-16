import { createApp } from 'vue'
import './styles/main.scss'
import './styles/transitions.scss'
import App from './app.vue'
import { toCssEasing, UI_SPRING } from './data/easing'
import router from './router'
import { installTransitions, playIntro } from './router/transitions'

// UI 互動共用的彈簧曲線
document.documentElement.style.setProperty('--spring', toCssEasing(UI_SPRING))

// 換頁過場與首次進場
installTransitions(router)
playIntro()

createApp(App).use(router).mount('#app')
