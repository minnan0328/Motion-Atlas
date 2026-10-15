import { withDefaults } from '../core/params'
import type { MotionMeta } from '../core/types'
import { webglModule } from '../core/webgl'

// 建築動態：Three.js 即時 3D 場景
export const architectureMotions: MotionMeta[] = [
  {
    id: 'tainan-station',
    title: '台南火車站',
    titleEn: 'Tainan Old Railway Station',
    description:
      '以 1936 年落成的台南舊火車站為主體的微縮城市：火車沿環繞車站的軌道行駛（環狀鐵道為微縮城市的藝術設計，並非真實配置），前方平交道依列車位置升降，行人等候與散步；24 小時由白天走到黑夜，四季依台南的氣候輪替。',
    category: 'architecture',
    tags: ['歷史建築', '微縮城市', '日夜', '四季', '列車', '平交道', '鏡頭操作'],
    renderMode: 'webgl',
    dimension: '3d',
    technique: 'Three.js',
    implementation: 'standalone',
    previewConfig: { width: 200, height: 120 },
    supportedControls: ['duration', 'easing', 'cubicBezier', 'stiffness', 'damping', 'mass', 'camera'],
    animationPrinciples: ['staging', 'slow-in-and-slow-out', 'timing', 'secondary-action', 'follow-through-and-overlapping-action', 'solid-drawing', 'appeal'],
    route: '/motion/tainan-station',
    defaults: withDefaults({ duration: 12, easing: [0.45, 0, 0.55, 1], stiffness: 380, damping: 0.45 }),
    load: () => import('./tainan-station').then((m) => webglModule(m.default)),
  },
]
