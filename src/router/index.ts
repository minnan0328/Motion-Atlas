import { createRouter, createWebHistory } from 'vue-router'
import urls from './urls'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: urls,
})

export default router
