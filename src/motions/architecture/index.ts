import { withDefaults } from '../core/params'
import type { MotionMeta } from '../core/types'

// 建築動態：Three.js 即時 3D 場景
export const architectureMotions: MotionMeta[] = [
  {
    id: 'tainan-station',
    title: '台南漂浮島',
    titleEn: 'Tainan Floating Island',
    description:
      '把台南收進一座漂浮在雲間的小島：島頂以 1936 年落成的台南舊火車站為中心，山嵐號、海風號、鳴日號、藍皮解憂號四列台鐵觀光列車沿島嶼最外圍的環島鐵道行駛、輪流停靠島緣月台，步道平交道通往伸出島緣的觀景台；島上環繞赤崁樓、林百貨、安平古堡、運河與拱橋、夜市小吃攤、芒果園與鳳凰木；島身是分層的土壤剖面與垂著根鬚的岩石，運河從島緣傾瀉成瀑布，雲朵、碎石與白鷺鷥環繞。可 360 度環繞、從島底仰望；24 小時日夜與台南四季輪替（環狀鐵道與島上配置皆為藝術設計）。',
    category: 'architecture',
    tags: ['漂浮島', '歷史建築', '微縮城市', '小吃', '日夜', '四季', '列車', '觀光列車', '瀑布', '鏡頭操作'],
    renderMode: 'webgl',
    dimension: '3d',
    technique: 'Three.js',
    implementation: 'standalone',
    previewConfig: { width: 200, height: 120 },
    supportedControls: ['duration', 'easing', 'cubicBezier', 'stiffness', 'damping', 'mass', 'camera'],
    animationPrinciples: ['staging', 'slow-in-and-slow-out', 'timing', 'secondary-action', 'follow-through-and-overlapping-action', 'solid-drawing', 'appeal'],
    route: '/motion/tainan-station',
    defaults: withDefaults({ duration: 12, easing: [0.45, 0, 0.55, 1], stiffness: 380, damping: 0.45, autoRotate: true }),
    // Three.js 只在進入建築場景時載入
    load: () =>
      Promise.all([import('../core/webgl'), import('./tainan-station')]).then(([{ webglModule }, m]) => webglModule(m.default)),
  },
]
