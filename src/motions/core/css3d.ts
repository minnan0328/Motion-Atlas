import { Body, DEFAULT_PHYSICS, pokeFalloff, type PhysicsSettings } from '../../three/physics'
import { alternate, loop, type Ease } from '../../three/timeline'
import { keyframeAt } from './controllers'
import { createDomStage, el } from './dom'
import { jsEasing } from './easing'
import type { MotionContext, MotionInstance, MotionModule, MotionParams } from './types'

/**
 * CSS 3D 物件：以 transform-style: preserve-3d 組成立體結構。
 * 座標為設計 px，y 向上（寫入 CSS 時反轉），角度為度。
 */
export class Node3D {
  readonly element: HTMLDivElement
  position = [0, 0, 0]
  rotation = [0, 0, 0]
  scale = [1, 1, 1]
  // 在自身變換之後附加的 transform（例如讓球體面向鏡頭）
  suffix = ''
  hop = 0

  constructor(parent: HTMLElement) {
    this.element = el('div', { position: 'absolute', left: '0', top: '0', width: '0', height: '0', transformStyle: 'preserve-3d' }, parent)
  }

  write() {
    const [x, y, z] = this.position
    const [rx, ry, rz] = this.rotation
    const [sx, sy, sz] = this.scale
    this.element.style.transform =
      `translate3d(${x}px, ${-(y! + this.hop)}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale3d(${sx}, ${sy}, ${sz}) ${this.suffix}`
  }
}

// 平面：以中心為原點的矩形，face 指定朝向（front 面向鏡頭，y 向上）
export function plane(
  parent: HTMLElement,
  width: number,
  height: number,
  transform: string,
  style: Partial<CSSStyleDeclaration> = {},
) {
  return el('div', {
    position: 'absolute',
    left: `${-width / 2}px`,
    top: `${-height / 2}px`,
    width: `${width}px`,
    height: `${height}px`,
    transform,
    backfaceVisibility: 'hidden',
    ...style,
  }, parent)
}

// 立方體的六個面：法向量與 transform；colors 依序為 +x、-x、+y、-y、+z、-z
const FACES: { normal: [number, number, number]; transform: (h: number) => string }[] = [
  { normal: [1, 0, 0], transform: (h) => `rotateY(90deg) translateZ(${h}px)` },
  { normal: [-1, 0, 0], transform: (h) => `rotateY(-90deg) translateZ(${h}px)` },
  { normal: [0, 1, 0], transform: (h) => `rotateX(90deg) translateZ(${h}px)` },
  { normal: [0, -1, 0], transform: (h) => `rotateX(-90deg) translateZ(${h}px)` },
  { normal: [0, 0, 1], transform: (h) => `translateZ(${h}px)` },
  { normal: [0, 0, -1], transform: (h) => `rotateY(180deg) translateZ(${h}px)` },
]

/**
 * 表面材質：CSS 3D 沒有真實光照，以多層漸層與雜訊模擬粗糙度、倒角與金屬反射。
 * matte：霧面烤漆（細微顆粒、邊緣倒角受光）；metal：髮絲紋金屬（細密拉絲與斜向高光）。
 * 數值為設計 px，舞台會依預覽尺寸放大，陰影與倒角需維持在 1px 以下
 */
export type Finish = 'matte' | 'metal'
// 可無縫重複的細微顆粒（SVG 分形雜訊，透明度隨雜訊變化）
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.28 0 0 0 0'/%3E%3C/filter%3E%3Crect width='48' height='48' filter='url(%23n)'/%3E%3C/svg%3E\")"
export function surface(color: string, finish: Finish = 'matte'): Partial<CSSStyleDeclaration> {
  if (finish === 'metal') {
    return {
      backgroundColor: color,
      backgroundImage: [
        'repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.08) 0 0.5px, rgba(0, 0, 0, 0.07) 0.5px 1.2px)',
        'linear-gradient(155deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0) 38%, rgba(0, 0, 0, 0) 60%, rgba(0, 0, 0, 0.3) 100%)',
      ].join(', '),
      boxShadow: 'inset 0 0 0 0.3px rgba(255, 255, 255, 0.45), inset 0 0 0.6px rgba(0, 0, 0, 0.3)',
    }
  }
  return {
    backgroundColor: color,
    backgroundImage: `${GRAIN}, linear-gradient(140deg, rgba(255, 255, 255, 0.12), rgba(0, 0, 0, 0.12))`,
    backgroundSize: '10px 10px, 100% 100%',
    boxShadow: 'inset 0 0 0 0.3px rgba(255, 255, 255, 0.3), inset 0 0 0.8px rgba(0, 0, 0, 0.3)',
  }
}

export function cube(parent: HTMLElement, size: number, colors: string[], radius = 0, finish: Finish = 'matte') {
  return FACES.map(({ normal, transform }, i) => ({
    normal,
    element: plane(parent, size, size, transform(size / 2), { ...surface(colors[i]!, finish), borderRadius: `${radius}px` }),
  }))
}

// 以面的法向量模擬平行光：旋轉後與光線方向的夾角決定亮度（CSS 3D 沒有光照）
const LIGHT = normalize([0.45, 0.8, 0.55])
function normalize(v: number[]) {
  const length = Math.hypot(...v)
  return v.map((value) => value / length)
}
// 依 CSS rotateX → rotateY → rotateZ 的順序旋轉向量（y 向上的座標）
function rotate([x, y, z]: number[], [rx, ry, rz]: number[]) {
  const toRad = Math.PI / 180
  // CSS 的 y 向下，換成 y 向上時 X、Z 軸的旋轉方向相反
  const a = -rz! * toRad
  const b = ry! * toRad
  const c = -rx! * toRad
  ;[x, y] = [x! * Math.cos(a) - y! * Math.sin(a), x! * Math.sin(a) + y! * Math.cos(a)]
  ;[x, z] = [x * Math.cos(b) + z! * Math.sin(b), -x * Math.sin(b) + z! * Math.cos(b)]
  ;[y, z] = [y * Math.cos(c) - z * Math.sin(c), y * Math.sin(c) + z * Math.cos(c)]
  return [x, y, z]
}
export function shade(faces: { normal: number[]; element: HTMLElement }[], rotations: number[][]) {
  for (const face of faces) {
    let normal = face.normal
    // rotations 由內而外：先套用物件自身，再套用父層
    for (const r of rotations) normal = rotate(normal, r)
    const light = normal[0]! * LIGHT[0]! + normal[1]! * LIGHT[1]! + normal[2]! * LIGHT[2]!
    face.element.style.filter = `brightness(${(0.78 + 0.3 * Math.max(light, -0.4)).toFixed(3)})`
  }
}

export interface Css3dScene {
  // 主要動作的時間軸（秒），用於換算時間倍率與 keyframe
  timeline: { duration: number; direction: 'normal' | 'alternate'; offsets: number[] }
  update(time: number, ease: Ease): void
  // 物理模擬之後、寫入畫面之前執行（例如依實際高度調整陰影、依旋轉調整明暗）
  afterPhysics?(): void
}

export interface Css3dWorld {
  // 地面中心的 3D 根節點
  root: HTMLElement
  // 建立物件：每格先回到建立時的姿勢，再由 update 設定；
  // body 為 true 時 update 的數值是物理目標，點擊時彈起並推開
  node(parent: HTMLElement, pose?: { position?: number[]; rotation?: number[]; scale?: number[] }, body?: boolean): Node3D
}

// 每 px 的重力與衝量換算（設計尺寸 150 × 100）
const UNIT = 0.3
export const TILT = -16

/**
 * CSS 3D 基礎動畫模組：透視舞台、可暫停的場景時鐘、緩動與彈簧物理、點擊衝量與診斷資訊。
 * 卡片預覽降為 30 fps，詳細頁維持完整影格率。
 */
export function css3dScene(
  floorY: number,
  build: (world: Css3dWorld) => Css3dScene,
): MotionModule {
  return {
    create(context: MotionContext): MotionInstance {
      const { stage, dispose } = createDomStage(context)
      const root = el('div', { position: 'absolute', width: '0', height: '0', transformStyle: 'preserve-3d' }, stage)
      // 縮放放在 3D 內容裡，而不是縮放整個舞台：舞台縮放會先以設計尺寸點陣化再放大，邊緣鋸齒
      const { width, height } = context.preview
      const resize = (containerWidth: number, containerHeight: number) => {
        const scale = Math.min(containerWidth / width, containerHeight / height)
        Object.assign(stage.style, {
          width: `${width * scale}px`,
          height: `${height * scale}px`,
          transform: 'translate(-50%, -50%)',
          perspective: `${320 * scale}px`,
          perspectiveOrigin: '50% 30%',
        })
        Object.assign(root.style, {
          left: `${(width / 2) * scale}px`,
          top: `${floorY * scale}px`,
          transform: `scale3d(${scale}, ${scale}, ${scale}) rotateX(${TILT}deg)`,
        })
      }
      resize(context.width, context.height)

      const nodes: { node: Node3D; base: number[]; body: Body | null }[] = []
      const read = (node: Node3D) => [...node.position, ...node.rotation, ...node.scale]
      const apply = (node: Node3D, value: number[]) => {
        node.position = value.slice(0, 3)
        node.rotation = value.slice(3, 6)
        node.scale = value.slice(6, 9)
      }
      const scene = build({
        root,
        node(parent, pose = {}, body = false) {
          const node = new Node3D(parent)
          Object.assign(node, pose)
          nodes.push({ node, base: read(node), body: body ? new Body([null, null, null, 360, 360, 360, null, null, null]) : null })
          return node
        },
      })
      const bodies = nodes.filter((entry) => entry.body) as { node: Node3D; body: Body }[]

      let params = context.params
      let ease = jsEasing(params)
      const physics = (): PhysicsSettings => ({ ...DEFAULT_PHYSICS, stiffness: params.stiffness, damping: params.damping, mass: params.mass })

      // 場景時鐘：暫停時停止累積，持續時間改變時以倍率調整速度
      let elapsed = 0
      let last = performance.now()
      let running = true
      let drawn = 0
      const minFrame = context.interactive ? 0 : 1000 / 30
      const time = () => {
        const t = Math.max(elapsed - params.delay, 0)
        const limit = Number.isFinite(params.iterations) ? scene.timeline.duration * params.iterations - 1e-3 : Infinity
        return Math.min(t, limit)
      }

      const render = (dt: number) => {
        for (const { node, base } of nodes) apply(node, base)
        scene.update(time(), ease)
        for (const { node, body } of nodes) {
          if (!body) continue
          apply(node, body.step(read(node), dt, physics(), UNIT))
          node.hop = body.hop
        }
        scene.afterPhysics?.()
        for (const { node } of nodes) node.write()
      }

      let frame = requestAnimationFrame(tick)
      function tick(now: number) {
        frame = requestAnimationFrame(tick)
        if (now - drawn < minFrame - 1) return
        const dt = Math.min((now - last) / 1000, 0.1)
        drawn = now
        last = now
        if (!running) return
        elapsed += dt * (scene.timeline.duration / params.duration)
        render(dt)
      }
      render(0)

      // 詳細頁：點擊給予衝量，往上彈起並往遠離點擊處推開、旋轉
      const onPointerDown = (event: PointerEvent) => {
        const rect = context.container.getBoundingClientRect()
        const u = (event.clientX - rect.left) / rect.width
        const v = (event.clientY - rect.top) / rect.height
        for (const { node, body } of bodies) {
          const box = node.element.getBoundingClientRect()
          const du = (box.left - rect.left) / rect.width - u
          const dv = (box.top - rect.top) / rect.height - v
          const force = pokeFalloff(du, dv)
          if (force < 0.02) continue
          body.jump(520 * UNIT * force, physics())
          body.push(0, Math.sign(du || 1) * 380 * UNIT * force, physics())
          body.push(5, Math.sign(du || 1) * 400 * force, physics())
        }
      }
      if (context.interactive && bodies.length) context.container.addEventListener('pointerdown', onPointerDown)

      return {
        play() {
          running = true
          last = performance.now()
        },
        pause() {
          running = false
        },
        reset() {
          elapsed = 0
          render(0)
        },
        resize,
        update(next: MotionParams) {
          params = next
          ease = jsEasing(params)
          if (!running) render(0)
        },
        diagnostics() {
          const t = time()
          const { duration, direction, offsets } = scene.timeline
          const finished = Number.isFinite(params.iterations) && t >= duration * params.iterations - 2e-3
          const progress = finished ? 1 : direction === 'alternate' ? alternate(t, duration) : loop(t, duration)
          return {
            playState: finished ? 'finished' : running ? 'running' : 'paused',
            progress,
            iteration: Math.floor(t / duration),
            keyframe: keyframeAt(offsets, progress),
          }
        },
        dispose() {
          cancelAnimationFrame(frame)
          context.container.removeEventListener('pointerdown', onPointerDown)
          dispose()
        },
      }
    },
  }
}
