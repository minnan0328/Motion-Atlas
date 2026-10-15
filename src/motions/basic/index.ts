import { withDefaults } from '../core/params'
import type { PrincipleId } from '../core/principles'
import type { ControlKey, MotionMeta, MotionModule, MotionParams } from '../core/types'
import { webglModule } from '../core/webgl'

type Source2d = keyof typeof import('./basic-2d')
type Source3d = keyof typeof import('../basic3d/scenes')

interface BasicEntry {
  id: string
  title: string
  titleEn: string
  description: string
  // 動態類型（例如 Translation、Rotation）與使用的物件
  tags: string[]
  principles: PrincipleId[]
  defaults: Partial<MotionParams>
  controls: ControlKey[]
  source: { dimension: '2d'; name: Source2d } | { dimension: '3d'; name: Source3d }
}

const TIMED: ControlKey[] = ['duration', 'delay', 'repeat', 'direction']
const EASED: ControlKey[] = [...TIMED, 'easing', 'cubicBezier']

const ENTRIES: BasicEntry[] = [
  {
    id: 'translate',
    title: '位移',
    titleEn: 'Translation',
    description: '方塊在兩點之間往返，後方三個殘影依序延遲，呈現加速與減速。',
    tags: ['Position / Translation', '正方形'],
    principles: ['slow-in-and-slow-out', 'timing'],
    defaults: { duration: 2.4 },
    controls: [...EASED, 'amplitude'],
    source: { dimension: '2d', name: 'translate' },
  },
  {
    id: 'rotate',
    title: '旋轉',
    titleEn: 'Rotation',
    description: '方塊以 90 度為一個關鍵姿勢轉動並停頓，角落的圓點標示方向。',
    tags: ['Rotation', '正方形', '圓形'],
    principles: ['straight-ahead-and-pose-to-pose', 'timing'],
    defaults: { duration: 4, easing: [0.65, 0, 0.35, 1] },
    controls: [...EASED, 'amplitude'],
    source: { dimension: '2d', name: 'rotate' },
  },
  {
    id: 'scale',
    title: '縮放',
    titleEn: 'Scale',
    description: '圓形先縮小蓄力，再放大超出並回到停留的大小。',
    tags: ['Scale', '圓形'],
    principles: ['anticipation', 'exaggeration'],
    defaults: { duration: 2.2 },
    controls: [...EASED, 'amplitude'],
    source: { dimension: '2d', name: 'scale' },
  },
  {
    id: 'opacity',
    title: '透明度',
    titleEn: 'Opacity',
    description: '同一位置的圓形與方形交叉淡入淡出。',
    tags: ['Opacity', '圓形', '正方形'],
    principles: ['staging', 'slow-in-and-slow-out'],
    defaults: { duration: 3 },
    controls: EASED,
    source: { dimension: '2d', name: 'opacity' },
  },
  {
    id: 'color-transition',
    title: '色彩轉換',
    titleEn: 'Color Transition',
    description: '長條依序換成色票中的每個顏色，換色時微微伸展。',
    tags: ['Color Transition', '矩形'],
    principles: ['secondary-action', 'appeal'],
    defaults: { duration: 4 },
    controls: [...EASED, 'amplitude'],
    source: { dimension: '2d', name: 'color' },
  },
  {
    id: 'bounce',
    title: '彈跳',
    titleEn: 'Bounce',
    description: '以重力與反彈係數計算每次彈跳的高度與時間，觸地壓扁、離地拉長，影子隨高度縮放。',
    tags: ['Bounce', '圓形', '重力'],
    principles: ['squash-and-stretch', 'timing', 'slow-in-and-slow-out'],
    defaults: { duration: 2.6, damping: 0.4 },
    controls: ['duration', 'delay', 'repeat', 'amplitude', 'damping'],
    source: { dimension: '2d', name: 'bounce' },
  },
  {
    id: 'elastic-motion',
    title: '彈性',
    titleEn: 'Elastic Motion',
    description: '方塊以彈簧物理往返，剛性、阻尼與質量決定停下時的超出與回彈。',
    tags: ['Elastic Motion', '正方形', '彈簧'],
    principles: ['follow-through-and-overlapping-action', 'slow-in-and-slow-out'],
    defaults: { duration: 2.4, stiffness: 160, damping: 0.25 },
    controls: [...TIMED, 'stiffness', 'damping', 'mass', 'amplitude'],
    source: { dimension: '2d', name: 'elastic' },
  },
  {
    id: 'shake-triangle',
    title: '搖晃',
    titleEn: 'Shake',
    description: '三角形以衰減的正弦震盪左右晃動，阻尼決定收斂速度。',
    tags: ['Shake', '三角形', '衰減震盪'],
    principles: ['timing', 'exaggeration'],
    defaults: { duration: 1.8, damping: 0.4 },
    controls: ['duration', 'delay', 'repeat', 'amplitude', 'damping'],
    source: { dimension: '2d', name: 'shake' },
  },
  {
    id: 'pulse-rings',
    title: '脈動',
    titleEn: 'Pulse',
    description: '核心圓輕微跳動，兩道圓環依序向外擴散並淡出。',
    tags: ['Pulse', '圓形', '環形'],
    principles: ['secondary-action', 'timing'],
    defaults: { duration: 2, easing: [0.22, 1, 0.36, 1] },
    controls: [...EASED, 'amplitude'],
    source: { dimension: '2d', name: 'pulse' },
  },
  {
    id: 'orbit-planets',
    title: '環繞',
    titleEn: 'Orbit',
    description: '三顆行星以不同半徑與圈數等速繞行中心。',
    tags: ['Orbit', '圓形', '環形'],
    principles: ['arcs', 'timing'],
    defaults: { duration: 6 },
    controls: TIMED,
    source: { dimension: '2d', name: 'orbit' },
  },
  {
    id: 'path-motion',
    title: '路徑',
    titleEn: 'Path Motion',
    description: '三角形沿著曲線路徑前進，方向隨路徑切線轉動。',
    tags: ['Path Motion', '三角形', '線條'],
    principles: ['arcs', 'slow-in-and-slow-out'],
    defaults: { duration: 2.6, direction: 'alternate' },
    controls: EASED,
    source: { dimension: '2d', name: 'path' },
  },
  {
    id: 'stagger',
    title: '交錯',
    titleEn: 'Stagger',
    description: '七根長條從中間往兩側依序伸縮，像音樂等化器。',
    tags: ['Stagger', '矩形'],
    principles: ['follow-through-and-overlapping-action', 'timing'],
    defaults: { duration: 1.4 },
    controls: [...EASED, 'amplitude'],
    source: { dimension: '2d', name: 'stagger' },
  },
  {
    id: 'shape-morph',
    title: '形狀變形',
    titleEn: 'Shape Morphing',
    description: '以相同頂點數的多邊形在圓形、方形、三角形與六邊形之間變形並換色。',
    tags: ['Shape Morphing', '圓形', '正方形', '三角形', '多邊形'],
    principles: ['straight-ahead-and-pose-to-pose', 'appeal'],
    defaults: { duration: 4.8, easing: [0.65, 0, 0.35, 1] },
    controls: EASED,
    source: { dimension: '2d', name: 'morph' },
  },
  {
    id: 'loop-path',
    title: '無限循環',
    titleEn: 'Loop',
    description: '圓點沿著 ∞ 字形路徑繞行，後方的小圓點依序跟隨形成拖尾。',
    tags: ['Loop', '圓形', '線條'],
    principles: ['arcs', 'follow-through-and-overlapping-action'],
    defaults: { duration: 3.2, easing: [0.37, 0, 0.63, 1] },
    controls: EASED,
    source: { dimension: '2d', name: 'loopPath' },
  },
  {
    id: 'follow-through',
    title: '跟隨動作',
    titleEn: 'Follow Through',
    description: '方塊移動並停下，下方的擺錘因慣性繼續擺動後才停止。',
    tags: ['Follow Through', '正方形', '線條', '圓形'],
    principles: ['follow-through-and-overlapping-action', 'secondary-action'],
    defaults: { duration: 2.6 },
    controls: [...EASED, 'amplitude'],
    source: { dimension: '2d', name: 'followThrough' },
  },
  {
    id: 'line-draw',
    title: '線條描繪',
    titleEn: 'Line Draw',
    description: '鋸齒線由起點畫出再擦去，前端的圓點沿線引導。',
    tags: ['Path Motion', '線條', '圓形'],
    principles: ['straight-ahead-and-pose-to-pose', 'timing'],
    defaults: { duration: 2.8, easing: [0.65, 0, 0.35, 1] },
    controls: EASED,
    source: { dimension: '2d', name: 'lineDraw' },
  },
  {
    id: 'anticipation-jump',
    title: '預備跳躍',
    titleEn: 'Anticipation Jump',
    description: '長方形先下蹲蓄力，再跳起並在落地時壓扁緩衝。',
    tags: ['Position / Translation', 'Scale', '矩形'],
    principles: ['anticipation', 'squash-and-stretch'],
    defaults: { duration: 2 },
    controls: [...EASED, 'amplitude'],
    source: { dimension: '2d', name: 'anticipation' },
  },
  {
    id: 'sphere-bounce-3d',
    title: '立體球體彈跳',
    titleEn: '3D Sphere Bounce',
    description: '球體受重力落下並逐次降低彈跳高度，觸地壓扁；點擊預覽可給予衝量。',
    tags: ['Bounce', '球體', '重力', '物理回饋'],
    principles: ['squash-and-stretch', 'solid-drawing', 'timing'],
    defaults: { duration: 2.4, stiffness: 380, damping: 0.55 },
    controls: ['duration', 'delay', 'repeat', 'easing', 'cubicBezier', 'stiffness', 'damping', 'mass'],
    source: { dimension: '3d', name: 'sphereBounce' },
  },
  {
    id: 'cube-tumble-3d',
    title: '立方體翻滾',
    titleEn: '3D Cube Tumble',
    description: '立方體以底部的邊為支點逐格翻滾，往右三格後再滾回來。',
    tags: ['Rotation', 'Loop', '正方形', '立方體'],
    principles: ['solid-drawing', 'straight-ahead-and-pose-to-pose'],
    defaults: { duration: 3.6, easing: [0.65, 0, 0.35, 1] },
    controls: ['duration', 'delay', 'repeat', 'easing', 'cubicBezier', 'stiffness', 'damping', 'mass'],
    source: { dimension: '3d', name: 'cubeTumble' },
  },
  {
    id: 'gyroscope-3d',
    title: '陀螺儀',
    titleEn: '3D Gyroscope',
    description: '三層圓環分別沿 X、Y、Z 軸以 90 度為單位轉動，中心多面體持續自轉。',
    tags: ['Rotation', 'Orbit', '環形', '多邊形'],
    principles: ['solid-drawing', 'secondary-action'],
    defaults: { duration: 4, easing: [0.65, 0, 0.35, 1] },
    controls: ['duration', 'delay', 'repeat', 'easing', 'cubicBezier', 'stiffness', 'damping', 'mass'],
    source: { dimension: '3d', name: 'gyroscope' },
  },
]

export const basicMotions: MotionMeta[] = ENTRIES.map((entry) => {
  const { source } = entry
  const load: () => Promise<MotionModule> =
    source.dimension === '2d'
      ? () => import('./basic-2d').then((m) => m[source.name])
      : () => import('../basic3d/scenes').then((m) => webglModule(m[source.name]))
  const svgBased = ['path-motion', 'loop-path', 'line-draw'].includes(entry.id)
  return {
    id: entry.id,
    title: entry.title,
    titleEn: entry.titleEn,
    description: entry.description,
    category: 'basic',
    tags: entry.tags,
    renderMode: source.dimension === '3d' ? 'webgl' : svgBased ? 'svg' : 'css',
    dimension: source.dimension,
    technique: source.dimension === '3d' ? 'Three.js' : svgBased ? 'SVG + Web Animations API' : 'Web Animations API',
    implementation: 'standalone',
    previewConfig: { width: 150, height: 100 },
    supportedControls: entry.controls,
    animationPrinciples: entry.principles,
    route: `/motion/${entry.id}`,
    defaults: withDefaults(entry.defaults),
    load,
  }
})
