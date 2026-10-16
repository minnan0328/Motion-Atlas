import { createRouter, createWebHistory } from 'vue-router'
import urls from './urls'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: urls,
  // 換頁時回到頂端；返回時還原原本的捲動位置（過場中共用元素才能回到原卡片）；只改篩選條件時不捲動
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.path !== from.path) return { top: 0 }
    return false
  },
})

export default router
