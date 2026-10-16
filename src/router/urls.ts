import type { RouteRecordRaw } from 'vue-router'

const CATEGORY_ALIASES: Record<string, string> = { basic: 'basic', text: 'typography', typography: 'typography', architecture: 'architecture' }

const urls: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/home/home.vue'),
  },
  {
    path: '/brand',
    name: 'Brand',
    component: () => import('../views/brand/brand.vue'),
  },
  {
    path: '/motion/:id',
    name: 'Motion',
    component: () => import('../views/motion/motion.vue'),
    props: true,
  },
  // 舊網址導向新的頁面
  {
    path: '/:category(basic|text|typography|architecture)',
    redirect: (to) => ({ path: '/', query: { category: CATEGORY_ALIASES[String(to.params.category)] } }),
  },
  {
    path: '/:category(basic|text|typography|architecture)/:id',
    redirect: (to) => ({ path: `/motion/${String(to.params.id)}` }),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'Error',
    component: () => import('../views/error/error.vue'),
  },
]

export default urls
