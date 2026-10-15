import { el, PALETTE, svg } from '../core/dom'
import { cssEasing } from '../core/easing'
import { domScene, ground, shape, timing } from '../core/scene'

// 2D 基礎動畫：舞台為 150 × 100，中心 (75, 50)，以 DOM / SVG 與 Web Animations API 實作

const frames = (easing: string, list: Keyframe[]) => list.map((frame) => ({ easing, ...frame }))

// 位移：方塊在兩點之間移動，後方三個殘影依序延遲，呈現速度變化
export const translate = domScene((stage, params, group) => {
  ground(stage, 66, 20, 130)
  const easing = cssEasing(params)
  const d = 45 * params.amplitude
  const keyframes = frames(easing, [
    { offset: 0, transform: `translateX(${-d}px)` },
    { offset: 0.4, transform: `translateX(${d}px)` },
    { offset: 0.5, transform: `translateX(${d}px)` },
    { offset: 0.9, transform: `translateX(${-d}px)` },
    { offset: 1, transform: `translateX(${-d}px)` },
  ])
  ;[0.15, 0.3, 0.5].forEach((opacity, i) => {
    const ghost = shape(stage, 'square', { x: 75, y: 54, w: 20, color: 'var(--c5)' })
    ghost.style.opacity = String(opacity)
    group.add(ghost.animate(keyframes, timing(params, (3 - i) * 0.035 * params.duration)))
  })
  group.animations.unshift(shape(stage, 'square', { x: 75, y: 54, w: 20 }).animate(keyframes, timing(params)))
})

// 旋轉：方塊以 90 度為一個關鍵姿勢，轉動後停頓；角落的圓點標示方向
export const rotate = domScene((stage, params, group) => {
  const easing = cssEasing(params)
  const box = shape(stage, 'square', { x: 75, y: 50, w: 36 })
  el('div', { position: 'absolute', left: '4px', top: '4px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--c1)' }, box)
  const list: Keyframe[] = []
  for (let k = 0; k < 4; k++) {
    list.push({ offset: k / 4, transform: `rotate(${k * 90 * params.amplitude}deg)` })
    list.push({ offset: k / 4 + 0.12, transform: `rotate(${k * 90 * params.amplitude}deg)` })
  }
  list.push({ offset: 1, transform: `rotate(${360 * params.amplitude}deg)` })
  group.add(box.animate(frames(easing, list), timing(params)))
})

// 縮放：圓先縮小蓄力，再放大超出後回到停留的大小
export const scale = domScene((stage, params, group) => {
  const easing = cssEasing(params)
  const a = params.amplitude
  const s = (value: number) => 1 + (value - 1) * a
  const circle = shape(stage, 'circle', { x: 75, y: 50, w: 30 })
  group.add(
    circle.animate(
      frames(easing, [
        { offset: 0, transform: 'scale(1)' },
        { offset: 0.2, transform: `scale(${s(0.78)})` },
        { offset: 0.4, transform: `scale(${s(1.65)})` },
        { offset: 0.5, transform: `scale(${s(1.4)})` },
        { offset: 0.75, transform: `scale(${s(1.4)})` },
        { offset: 1, transform: 'scale(1)' },
      ]),
      timing(params),
    ),
  )
})

// 透明度：同一位置的圓形與方形交叉淡入淡出
export const opacity = domScene((stage, params, group) => {
  const easing = cssEasing(params)
  const circle = shape(stage, 'circle', { x: 75, y: 50, w: 40 })
  const square = shape(stage, 'square', { x: 75, y: 50, w: 36, color: 'var(--c1)' })
  const show = [1, 1, 0, 0, 1]
  const offsets = [0, 0.35, 0.5, 0.85, 1]
  group.add(circle.animate(frames(easing, offsets.map((offset, i) => ({ offset, opacity: show[i] }))), timing(params)))
  group.add(square.animate(frames(easing, offsets.map((offset, i) => ({ offset, opacity: 1 - show[i]! }))), timing(params)))
})

// 色彩轉換：長條依序換成色票中的顏色，同時微微伸展
export const color = domScene((stage, params, group) => {
  const easing = cssEasing(params)
  const bar = shape(stage, 'rect', { x: 75, y: 50, w: 90, h: 24 })
  const colors = [PALETTE.c3, PALETTE.c1, PALETTE.c5, PALETTE.c2, PALETTE.c3]
  group.add(
    bar.animate(
      frames(easing, colors.map((background, i) => ({ offset: i / 4, background, transform: `scaleX(${i % 2 ? 1 + 0.12 * params.amplitude : 1})` }))),
      timing(params),
    ),
  )
})

// 彈跳：以重力與反彈係數計算每次彈跳的高度與時間，落地瞬間壓扁、離地時拉長
export const bounce = domScene((stage, params, group) => {
  const floor = 82
  ground(stage, floor, 30, 120)
  const ball = shape(stage, 'circle', { x: 75, y: floor - 9, w: 18, origin: '50% 100%' })
  const shadow = el('div', { position: 'absolute', left: '63px', top: `${floor - 2}px`, width: '24px', height: '5px', borderRadius: '50%', background: 'var(--c5)', opacity: '0.5' }, stage)

  const height = 58 * params.amplitude
  const restitution = Math.min(Math.max(0.85 - params.damping * 0.7, 0.1), 0.85)
  // g = 1 的無因次時間：落下時間 √(2H)，第 k 次彈跳的飛行時間為 2√(2H)·r^k
  const fall = Math.sqrt(2 * height)
  const events: { time: number; apex: number }[] = []
  let time = fall
  let speed = 1
  for (let k = 1; k <= 7 && height * speed * speed > 1; k++) {
    events.push({ time, apex: height * (speed * restitution) ** 2 })
    time += 2 * fall * speed * restitution
    speed *= restitution
  }
  const total = time
  const at = (t: number) => (t / total) * 0.82
  const easeIn = 'cubic-bezier(0.55, 0, 1, 0.45)'
  const easeOut = 'cubic-bezier(0, 0.55, 0.45, 1)'
  const ballFrames: Keyframe[] = [{ offset: 0, transform: `translateY(${-height}px)`, easing: easeIn }]
  const shadowFrames: Keyframe[] = [{ offset: 0, transform: 'scaleX(0.5)', opacity: 0.2, easing: easeIn }]
  let previous = 0
  events.forEach(({ time: impact, apex }, k) => {
    const squash = 0.35 * restitution ** k
    const o = at(impact)
    ballFrames.push({ offset: Math.max(o - 0.008, previous), transform: `translateY(-2px) scale(${1 - squash * 0.3}, ${1 + squash * 0.4})`, easing: 'linear' })
    ballFrames.push({ offset: o, transform: `translateY(0) scale(${1 + squash}, ${1 - squash})`, easing: 'linear' })
    ballFrames.push({ offset: o + 0.008, transform: `translateY(-2px) scale(${1 - squash * 0.3}, ${1 + squash * 0.4})`, easing: easeOut })
    shadowFrames.push({ offset: o, transform: 'scaleX(1)', opacity: 0.5, easing: easeOut })
    const next = events[k + 1]
    const apexTime = next ? (impact + next.time) / 2 : impact
    if (next) {
      ballFrames.push({ offset: at(apexTime), transform: `translateY(${-apex}px)`, easing: easeIn })
      shadowFrames.push({ offset: at(apexTime), transform: `scaleX(${1 - 0.5 * (apex / height)})`, opacity: 0.5 - 0.3 * (apex / height), easing: easeIn })
    }
    previous = o + 0.008
  })
  ballFrames.push({ offset: 0.85, transform: 'translateY(0) scale(1, 1)', easing: easeOut })
  ballFrames.push({ offset: 1, transform: `translateY(${-height}px)` })
  shadowFrames.push({ offset: 0.85, transform: 'scaleX(1)', opacity: 0.5, easing: easeOut })
  shadowFrames.push({ offset: 1, transform: 'scaleX(0.5)', opacity: 0.2 })
  group.add(ball.animate(ballFrames, timing(params)))
  group.add(shadow.animate(shadowFrames, timing(params)))
})

// 彈性：方塊以彈簧緩動（剛性、阻尼、質量）往返，停下時超出並回彈
export const elastic = domScene((stage, params, group) => {
  const easing = cssEasing(params, true)
  ground(stage, 66, 20, 130)
  const box = shape(stage, 'square', { x: 75, y: 54, w: 22 })
  const d = 40 * params.amplitude
  group.add(
    box.animate(
      frames(easing, [
        { offset: 0, transform: `translateX(${-d}px)` },
        { offset: 0.5, transform: `translateX(${d}px)` },
        { offset: 1, transform: `translateX(${-d}px)` },
      ]),
      timing(params),
    ),
  )
})

// 搖晃：三角形以衰減的正弦震盪左右晃動，阻尼決定收斂速度
export const shake = domScene((stage, params, group) => {
  const triangle = shape(stage, 'triangle', { x: 75, y: 52, w: 34, h: 30, origin: '50% 100%' })
  const list: Keyframe[] = []
  const steps = 30
  const zeta = Math.max(params.damping, 0.05)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // 前 60% 震盪，之後靜止
    const local = Math.min(t / 0.6, 1)
    const decay = Math.exp(-zeta * 9 * local)
    const x = local >= 1 ? 0 : Math.sin(local * Math.PI * 9) * 12 * params.amplitude * decay
    list.push({ offset: t, transform: `translateX(${x}px) rotate(${x * 0.8}deg)`, easing: 'linear' })
  }
  group.add(triangle.animate(list, timing(params)))
})

// 脈動：核心圓輕微跳動，兩道圓環依序向外擴散並淡出
export const pulse = domScene((stage, params, group) => {
  const easing = cssEasing(params)
  ;[0, 0.5].forEach((delay) => {
    const ring = shape(stage, 'ring', { x: 75, y: 50, w: 22, color: 'var(--c1)' })
    group.add(
      ring.animate(
        frames(easing, [
          { offset: 0, transform: 'scale(1)', opacity: 0.9 },
          { offset: 1, transform: `scale(${1 + 2.4 * params.amplitude})`, opacity: 0 },
        ]),
        timing(params, delay * params.duration),
      ),
    )
  })
  const core = shape(stage, 'circle', { x: 75, y: 50, w: 20 })
  group.animations.unshift(
    core.animate(
      frames(easing, [
        { offset: 0, transform: 'scale(1)' },
        { offset: 0.15, transform: `scale(${1 + 0.18 * params.amplitude})` },
        { offset: 0.35, transform: 'scale(1)' },
        { offset: 1, transform: 'scale(1)' },
      ]),
      timing(params),
    ),
  )
})

// 環繞：三顆行星以不同半徑與圈數繞行中心
export const orbit = domScene((stage, params, group) => {
  const center = shape(stage, 'circle', { x: 75, y: 50, w: 14 })
  ;[
    { radius: 20, size: 7, color: 'var(--c1)', turns: 3 },
    { radius: 31, size: 6, color: 'var(--c2)', turns: 2 },
    { radius: 43, size: 9, color: 'var(--c5)', turns: 1 },
  ].forEach(({ radius, size, color, turns }) => {
    shape(stage, 'ring', { x: 75, y: 50, w: radius * 2, color: 'rgba(168, 153, 133, 0.35)' })
    const arm = el('div', { position: 'absolute', left: '75px', top: '50px', width: '0', height: '0' }, stage)
    shape(arm, 'circle', { x: radius, y: 0, w: size, color })
    group.add(
      arm.animate(
        [
          { offset: 0, transform: 'rotate(0deg)' },
          { offset: 1, transform: `rotate(${turns * 360}deg)` },
        ],
        { ...timing(params), easing: 'linear' },
      ),
    )
  })
  group.animations.unshift(center.animate([{ transform: 'scale(1)' }, { transform: 'scale(1)' }], timing(params)))
})

// 路徑：三角形沿著曲線路徑前進，方向隨路徑切線轉動
export const path = domScene((stage, params, group) => {
  const easing = cssEasing(params)
  const d = 'M 15 70 C 40 10, 65 10, 75 50 S 110 90, 135 30'
  const art = svg('svg', { width: 150, height: 100, viewBox: '0 0 150 100' }, stage)
  art.style.position = 'absolute'
  svg('path', { d, fill: 'none', stroke: PALETTE.c5, 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }, art)
  const mover = el('div', {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '16px',
    height: '14px',
    background: 'var(--c3)',
    clipPath: 'polygon(0 0, 100% 50%, 0 100%)',
    offsetPath: `path('${d}')`,
    offsetRotate: 'auto',
  } as Partial<CSSStyleDeclaration>, stage)
  group.add(
    mover.animate(
      frames(easing, [
        { offset: 0, offsetDistance: '0%' },
        { offset: 1, offsetDistance: '100%' },
      ]),
      timing(params),
    ),
  )
})

// 交錯：七根長條從中間往兩側依序伸縮，像等化器
export const stagger = domScene((stage, params, group) => {
  const easing = cssEasing(params)
  for (let i = 0; i < 7; i++) {
    const bar = shape(stage, 'rect', { x: 39 + i * 12, y: 50, w: 8, h: 44, color: i % 2 ? 'var(--c1)' : 'var(--c3)', origin: '50% 100%' })
    group.add(
      bar.animate(
        frames(easing, [
          { offset: 0, transform: 'scaleY(0.25)' },
          { offset: 0.5, transform: `scaleY(${Math.min(0.25 + 0.75 * params.amplitude, 1.4)})` },
          { offset: 1, transform: 'scaleY(0.25)' },
        ]),
        timing(params, Math.abs(i - 3) * 0.08 * params.duration),
      ),
    )
  }
})

// 形狀變形：以相同頂點數的 clip-path 在圓形、方形、三角形與六邊形之間變形
const polygon = (points: [number, number][]) => `polygon(${points.map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`).join(', ')})`
const sample = (corners: [number, number][], count: number) => {
  const points: [number, number][] = []
  for (let i = 0; i < count; i++) {
    const t = (i / count) * corners.length
    const k = Math.floor(t)
    const f = t - k
    const [x1, y1] = corners[k]!
    const [x2, y2] = corners[(k + 1) % corners.length]!
    points.push([x1 + (x2 - x1) * f, y1 + (y2 - y1) * f])
  }
  return points
}
const COUNT = 24
const SHAPES = [
  Array.from({ length: COUNT }, (_, i) => {
    const angle = (i / COUNT) * Math.PI * 2 - Math.PI / 2
    return [50 + Math.cos(angle) * 50, 50 + Math.sin(angle) * 50] as [number, number]
  }),
  sample([[0, 0], [100, 0], [100, 100], [0, 100]], COUNT),
  sample([[50, 0], [100, 100], [0, 100]], COUNT),
  sample([[25, 4], [75, 4], [100, 50], [75, 96], [25, 96], [0, 50]], COUNT),
]
export const morph = domScene((stage, params, group) => {
  const easing = cssEasing(params)
  const element = shape(stage, 'square', { x: 75, y: 50, w: 50 })
  element.style.borderRadius = '0'
  const colors = [PALETTE.c3, PALETTE.c1, PALETTE.c2, PALETTE.c5]
  const list: Keyframe[] = []
  SHAPES.forEach((points, k) => {
    list.push({ offset: k / 4, clipPath: polygon(points), background: colors[k] })
    list.push({ offset: k / 4 + 0.12, clipPath: polygon(points), background: colors[k] })
  })
  list.push({ offset: 1, clipPath: polygon(SHAPES[0]!), background: colors[0] })
  group.add(element.animate(frames(easing, list), timing(params)))
})

// 無限循環：圓點沿著 ∞ 字形路徑繞行，後方的小圓點依序跟隨形成拖尾
export const loopPath = domScene((stage, params, group) => {
  const d = 'M 75 50 C 95 20, 135 20, 135 50 C 135 80, 95 80, 75 50 C 55 20, 15 20, 15 50 C 15 80, 55 80, 75 50'
  const art = svg('svg', { width: 150, height: 100, viewBox: '0 0 150 100' }, stage)
  art.style.position = 'absolute'
  svg('path', { d, fill: 'none', stroke: 'rgba(168, 153, 133, 0.45)', 'stroke-width': 1.5 }, art)
  const easing = cssEasing(params)
  for (let i = 5; i >= 0; i--) {
    const size = 12 - i * 1.5
    const dot = el('div', {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      background: i === 0 ? 'var(--c3)' : 'var(--c1)',
      opacity: String(1 - i * 0.14),
      offsetPath: `path('${d}')`,
      offsetRotate: '0deg',
    } as Partial<CSSStyleDeclaration>, stage)
    const animation = dot.animate(frames(easing, [{ offset: 0, offsetDistance: '0%' }, { offset: 1, offsetDistance: '100%' }]), timing(params, -i * 0.025 * params.duration))
    if (i === 0) group.animations.unshift(animation)
    else group.add(animation)
  }
})

// 跟隨動作：方塊移動並停下，下方的擺錘因慣性繼續擺動後才停止
export const followThrough = domScene((stage, params, group) => {
  const easing = cssEasing(params)
  const d = 40 * params.amplitude
  const holder = el('div', { position: 'absolute', left: '75px', top: '22px', width: '0', height: '0' }, stage)
  shape(holder, 'square', { x: 0, y: 0, w: 22 })
  const pendulum = el('div', { position: 'absolute', left: '-1px', top: '10px', width: '2px', height: '36px', background: 'var(--c2)', transformOrigin: '50% 0' }, holder)
  shape(pendulum, 'circle', { x: 1, y: 38, w: 12, color: 'var(--c1)' })
  group.add(
    holder.animate(
      frames(easing, [
        { offset: 0, transform: `translateX(${-d}px)` },
        { offset: 0.35, transform: `translateX(${d}px)` },
        { offset: 0.5, transform: `translateX(${d}px)` },
        { offset: 0.85, transform: `translateX(${-d}px)` },
        { offset: 1, transform: `translateX(${-d}px)` },
      ]),
      timing(params),
    ),
  )
  const swing = [[0, 0], [0.08, 25], [0.35, 15], [0.4, -30], [0.45, 14], [0.5, -6], [0.56, 0], [0.6, -25], [0.85, -15], [0.9, 30], [0.95, -12], [1, 0]]
  group.add(pendulum.animate(frames(easing, swing.map(([offset, angle]) => ({ offset, transform: `rotate(${angle! * params.amplitude}deg)` }))), timing(params)))
})

// 線條描繪：鋸齒線由起點畫出再擦去，前端的圓點沿線引導
export const lineDraw = domScene((stage, params, group) => {
  const easing = cssEasing(params)
  const d = 'M 15 70 L 45 30 L 75 70 L 105 30 L 135 70'
  const art = svg('svg', { width: 150, height: 100, viewBox: '0 0 150 100' }, stage)
  art.style.position = 'absolute'
  const line = svg('path', { d, fill: 'none', stroke: PALETTE.c3, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': 200, pathLength: 200 }, art)
  group.add(
    line.animate(
      frames(easing, [
        { offset: 0, strokeDashoffset: 200 },
        { offset: 0.45, strokeDashoffset: 0 },
        { offset: 0.55, strokeDashoffset: 0 },
        { offset: 1, strokeDashoffset: -200 },
      ]),
      timing(params),
    ),
  )
  const dot = el('div', { position: 'absolute', left: '0', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--c1)', offsetPath: `path('${d}')`, offsetRotate: '0deg' } as Partial<CSSStyleDeclaration>, stage)
  group.add(
    dot.animate(
      frames(easing, [
        { offset: 0, offsetDistance: '0%', opacity: 1 },
        { offset: 0.45, offsetDistance: '100%', opacity: 1 },
        { offset: 0.55, offsetDistance: '100%', opacity: 0 },
        { offset: 1, offsetDistance: '100%', opacity: 0 },
      ]),
      timing(params),
    ),
  )
})

// 預備跳躍：長方形先下蹲蓄力，再跳起、落地時壓扁緩衝
export const anticipation = domScene((stage, params, group) => {
  const easing = cssEasing(params)
  const floor = 80
  ground(stage, floor, 30, 120)
  const body = shape(stage, 'rect', { x: 75, y: floor - 14, w: 24, h: 28, origin: '50% 100%' })
  const h = 52 * params.amplitude
  group.add(
    body.animate(
      frames(easing, [
        { offset: 0, transform: 'translateY(0) scale(1, 1)' },
        { offset: 0.15, transform: 'translateY(0) scale(1, 1)' },
        { offset: 0.32, transform: 'translateY(0) scale(1.28, 0.68)' },
        { offset: 0.45, transform: `translateY(${-h * 0.85}px) scale(0.86, 1.2)` },
        { offset: 0.55, transform: `translateY(${-h}px) scale(1, 1)` },
        { offset: 0.7, transform: 'translateY(0) scale(1.3, 0.7)' },
        { offset: 0.8, transform: 'translateY(0) scale(0.95, 1.06)' },
        { offset: 0.88, transform: 'translateY(0) scale(1, 1)' },
        { offset: 1, transform: 'translateY(0) scale(1, 1)' },
      ]),
      timing(params),
    ),
  )
})
