import { keyframes, loop } from '../../three/timeline'
import { css3dScene, cube, plane, shade, TILT } from '../core/css3d'
import { el } from '../core/dom'

// 3D 基礎動畫：以 CSS 3D Transform（preserve-3d + perspective）建立空間深度與立體形變，
// 座標為設計 px（舞台 150 × 100），y 向上，原點在地面中心

// 地面上的柔和陰影
const floorShadow = (parent: HTMLElement, size: number) =>
  plane(parent, size, size, 'rotateX(90deg)', {
    borderRadius: '50%',
    backfaceVisibility: 'visible',
    background: 'radial-gradient(closest-side, rgba(53, 68, 73, 0.45), rgba(53, 68, 73, 0))',
  })

// 接觸陰影：物體貼近地面時，接觸點下方小而深的環境遮蔽
const contactShadow = (parent: HTMLElement, size: number) =>
  plane(parent, size, size, 'rotateX(90deg)', {
    borderRadius: '50%',
    backfaceVisibility: 'visible',
    background: 'radial-gradient(closest-side, rgba(30, 38, 41, 0.6), rgba(30, 38, 41, 0) 100%)',
  })

// 立體球體彈跳：重力加速落下、反彈高度依次遞減，觸地壓扁；陰影隨高度縮放
export const sphereBounce = css3dScene(86, ({ root, node }) => {
  const radius = 11
  const shadow = floorShadow(root, radius * 3)
  const contact = contactShadow(root, radius * 1.1)
  // 球體的原點在底部，壓扁時以觸地點為基準；球面以漸層表現受光，並保持面向鏡頭
  const ball = node(root, {}, true)
  ball.suffix = `rotateX(${-TILT}deg)`
  el('div', {
    position: 'absolute',
    left: `${-radius}px`,
    top: `${-radius * 2}px`,
    width: `${radius * 2}px`,
    height: `${radius * 2}px`,
    borderRadius: '50%',
    // 光滑的烤漆球：鏡面高光、漫射明暗、明暗交界線，底部有地面反射的暖色反光
    background: [
      'radial-gradient(circle at 33% 27%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.55) 5%, rgba(255, 255, 255, 0) 16%)',
      'radial-gradient(ellipse 70% 40% at 50% 104%, color-mix(in srgb, var(--c4), transparent 45%) 0%, transparent 70%)',
      'radial-gradient(circle at 38% 34%, color-mix(in srgb, var(--c3), white 30%) 0%, var(--c3) 42%, color-mix(in srgb, var(--c3), black 50%) 88%, color-mix(in srgb, var(--c3), black 35%) 100%)',
    ].join(', '),
    boxShadow: 'inset -1.5px -2.5px 5px rgba(0, 0, 0, 0.22)',
  }, ball.element)

  // 以重力計算（g = 1 的無因次時間）：落下高度 3，反彈係數 0.6
  const height = 3
  const scale = 18
  const restitution = 0.6
  const fall = Math.sqrt(2 * height)
  const impacts: number[] = []
  let time = fall
  let speed = 1
  while (impacts.length < 5) {
    impacts.push(time)
    speed *= restitution
    time += 2 * fall * speed
  }
  const total = time
  const DURATION = 2.4

  return {
    timeline: { duration: DURATION, direction: 'normal', offsets: [0, ...impacts.map((t) => (t / total) * 0.85), 1] },
    update(t, ease) {
      const p = loop(t, DURATION)
      // 最後 15% 把球拋回高處，與下一輪銜接
      let y = 0
      let squash = 0
      if (p > 0.85) {
        y = height * ease((p - 0.85) / 0.15)
      } else {
        const tt = (p / 0.85) * total
        if (tt < fall) y = height - (tt * tt) / 2
        else {
          let start = fall
          let v = 1
          for (const next of impacts.slice(1)) {
            v *= restitution
            if (tt < next) {
              const local = tt - start
              y = fall * v * local - (local * local) / 2
              break
            }
            start = next
          }
        }
        // 觸地前後短暫壓扁
        const nearest = Math.min(...impacts.map((impact) => Math.abs(impact - tt)))
        squash = Math.max(0, 1 - nearest / 0.12) * 0.35
      }
      ball.position = [0, Math.max(y, 0) * scale, 0]
      ball.scale = [1 + squash, 1 - squash, 1 + squash]
    },
    afterPhysics() {
      // 陰影跟隨球的實際位置（含點擊彈起），越高越小越淡
      const lift = Math.min((ball.position[1]! + ball.hop) / (height * scale), 1.5)
      shadow.style.transform = `translate3d(${ball.position[0]}px, 0, ${ball.position[2]}px) rotateX(90deg) scale(${1 - lift * 0.45})`
      shadow.style.opacity = String(1 - lift * 0.55)
      // 接觸陰影只在貼近地面時出現
      contact.style.transform = `translate3d(${ball.position[0]}px, 0, ${ball.position[2]}px) rotateX(90deg) scale(${1 + (1 - ball.scale[1]!) * 1.5})`
      contact.style.opacity = String(Math.max(0, 1 - lift * 6))
    },
  }
})

// 立方體翻滾：以底部的邊為支點每次翻轉 90 度，往右滾三格再滾回來
export const cubeTumble = css3dScene(70, ({ root, node }) => {
  const size = 22
  const STEPS = 3
  const start = -1.5 * size
  // 地面格線：標示每一次翻滾的落點
  for (let k = 0; k <= STEPS; k++) {
    plane(root, size, size, `translate3d(${start + k * size}px, 0, 0) rotateX(90deg)`, {
      border: '1px solid rgba(168, 153, 133, 0.6)',
      boxSizing: 'border-box',
      backfaceVisibility: 'visible',
    })
  }
  const shadow = floorShadow(root, size * 1.6)
  const box = node(root, { position: [start, size / 2, 0] }, true)
  const faces = cube(box.element, size, ['var(--c2)', 'var(--c2)', 'var(--c1)', 'var(--c5)', 'var(--c3)', 'var(--c3)'], 2)

  const DURATION = 3.6
  // 每一步：前 70% 翻轉、後 30% 停頓
  const roll = keyframes(
    Array.from({ length: STEPS + 1 }, (_, k) => [k / STEPS, k] as [number, number]).flatMap(([offset, k], i) =>
      i === 0 ? [[offset, k] as [number, number]] : [[offset - 0.3 / STEPS, k] as [number, number], [offset, k] as [number, number]],
    ),
  )
  return {
    timeline: { duration: DURATION, direction: 'alternate', offsets: roll.offsets },
    update(t, ease) {
      const p = 1 - Math.abs(1 - ((t / DURATION) % 2))
      const value = roll(p, ease)
      const k = Math.min(Math.floor(value), STEPS - 1)
      const f = value - k
      // 支點在目前所在格的右下邊，中心繞支點順時針轉動
      const angle = f * 90
      const a = (angle * Math.PI) / 180
      const [ox, oy] = [-size / 2, size / 2]
      const pivot = start + k * size + size / 2
      box.position = [pivot + ox * Math.cos(a) + oy * Math.sin(a), -ox * Math.sin(a) + oy * Math.cos(a), 0]
      box.rotation = [0, 0, angle + k * 90]
    },
    afterPhysics() {
      shade(faces, [box.rotation])
      const lift = Math.min(box.hop / 40, 1)
      shadow.style.transform = `translate3d(${box.position[0]}px, 0, 0) rotateX(90deg) scale(${1 - lift * 0.4})`
      shadow.style.opacity = String(1 - lift * 0.5)
    },
  }
})

// 陀螺儀：三層圓環分別沿 X、Y、Z 軸轉動，每次轉動 90 度後停頓，中心立方體持續自轉
export const gyroscope = css3dScene(84, ({ root, node }) => {
  floorShadow(root, 50)
  const group = node(root, { position: [0, 27, 0] }, true)
  const rings = [
    { radius: 23, color: 'var(--c3)' },
    { radius: 18, color: 'var(--c1)' },
    { radius: 13, color: 'var(--c2)' },
  ].map(({ radius, color }) => {
    const ring = node(group.element)
    // 三層薄環疊出厚度，側面時仍看得出是實體；以錐形漸層表現拋光金屬環的反光
    const metal = `conic-gradient(from 25deg, ${[0, 1, 2, 1, 0, 1, 2, 1, 0].map((k) => [`color-mix(in srgb, ${color}, white 55%)`, color, `color-mix(in srgb, ${color}, black 45%)`][k]).join(', ')})`
    const ring2d = `radial-gradient(closest-side, transparent calc(100% - 2.2px), #000 calc(100% - 2.2px))`
    for (const z of [-0.9, 0, 0.9]) {
      plane(ring.element, radius * 2, radius * 2, `translateZ(${z}px)`, {
        borderRadius: '50%',
        background: metal,
        maskImage: ring2d,
        webkitMaskImage: ring2d,
        backfaceVisibility: 'visible',
      })
    }
    return ring
  })
  const core = node(group.element)
  const faces = cube(core.element, 9, Array(6).fill('var(--c5)'), 1, 'metal')

  const DURATION = 4
  const quarter = keyframes([
    [0, 0], [0.18, 1], [0.25, 1], [0.43, 2], [0.5, 2], [0.68, 3], [0.75, 3], [0.93, 4], [1, 4],
  ])
  return {
    timeline: { duration: DURATION, direction: 'normal', offsets: quarter.offsets },
    update(t, ease) {
      const turns = quarter(loop(t, DURATION), ease) * 90
      rings[0]!.rotation = [turns, 0, 0]
      rings[1]!.rotation = [0, turns, 90]
      rings[2]!.rotation = [90, 0, turns]
      core.rotation = [t * 40, t * 63, 0]
    },
    afterPhysics() {
      shade(faces, [core.rotation, group.rotation])
    },
  }
})
