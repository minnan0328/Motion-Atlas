import * as THREE from 'three'
import type { PhysicsSettings } from './physics'
import type { Motion } from './stage'
import type { Ease } from './timeline'

interface Entry {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  motion: Motion
  width: number
  height: number
  getEase: () => Ease
  getPhysics: () => PhysicsSettings
  getTime: () => number
  // 0 表示不限制，否則為每秒最多繪製次數（卡片預覽降頻）
  maxFps: number
  last: number
  visible: boolean
}

// 所有動態共用一個 WebGL renderer，再複製到各自的 canvas，避免超過瀏覽器的 WebGL context 上限
const entries = new Map<HTMLCanvasElement, Entry>()
let renderer: THREE.WebGLRenderer | null = null
let observer: IntersectionObserver | null = null
let frame = 0
let rendererWidth = 0
let rendererHeight = 0

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(1)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    // 文字動態以裁切平面做遮罩與擦拭效果
    renderer.localClippingEnabled = true
  }
  return renderer
}

function getObserver() {
  observer ??= new IntersectionObserver((records) => {
    for (const record of records) {
      const entry = entries.get(record.target as HTMLCanvasElement)
      if (entry) entry.visible = record.isIntersecting
    }
  })
  return observer
}

function tick() {
  frame = requestAnimationFrame(tick)
  // 與 mountMotion 的起始時間使用同一個時鐘
  const now = performance.now()
  const webgl = getRenderer()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  // 不可見的預覽不繪製；限制影格率的預覽在間隔未到時略過
  const visible = [...entries.values()].filter(
    (e) => e.visible && (!e.maxFps || now - e.last >= 1000 / e.maxFps - 2),
  )
  if (!visible.length) return

  // renderer 只放大不縮小，每個動態畫在左下角的區域內，避免每格都重設尺寸
  const widest = Math.max(...visible.map((e) => Math.round(e.width * dpr)))
  const tallest = Math.max(...visible.map((e) => Math.round(e.height * dpr)))
  if (rendererWidth < widest || rendererHeight < tallest) {
    rendererWidth = Math.max(rendererWidth, widest)
    rendererHeight = Math.max(rendererHeight, tallest)
    webgl.setSize(rendererWidth, rendererHeight, false)
  }
  webgl.setScissorTest(true)

  for (const entry of visible) {
    const w = Math.round(entry.width * dpr)
    const h = Math.round(entry.height * dpr)
    // canvas 預設為 300 × 150，寬高都要檢查
    if (entry.canvas.width !== w || entry.canvas.height !== h) {
      entry.canvas.width = w
      entry.canvas.height = h
    }
    // 畫面比例改變時（例如沉浸式預覽隨視窗縮放）同步相機
    const camera = entry.motion.camera
    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.aspect - w / h) > 1e-3) {
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    webgl.setViewport(0, 0, w, h)
    webgl.setScissor(0, 0, w, h)

    entry.motion.update(entry.getTime(), entry.getEase())
    entry.motion.physics?.((now - entry.last) / 1000, entry.getPhysics())
    entry.last = now
    webgl.render(entry.motion.scene, entry.motion.camera)
    // WebGL 原點在左下，canvas 原點在左上
    entry.context.drawImage(webgl.domElement, 0, rendererHeight - h, w, h, 0, 0, w, h)
  }
}

export interface MountedMotion {
  resize(width: number, height: number): void
  stop(): void
}

export function mountMotion(
  canvas: HTMLCanvasElement,
  motion: Motion,
  width: number,
  height: number,
  getEase: () => Ease,
  getPhysics: () => PhysicsSettings,
  getTime: () => number,
  maxFps = 0,
): MountedMotion {
  const context = canvas.getContext('2d')
  const entry: Entry | null = context
    ? { canvas, context, motion, width, height, getEase, getPhysics, getTime, maxFps, last: performance.now(), visible: true }
    : null

  if (entry) {
    entries.set(canvas, entry)
    getObserver().observe(canvas)
    if (!frame) frame = requestAnimationFrame(tick)
  }

  return {
    resize(nextWidth, nextHeight) {
      if (!entry) return
      entry.width = nextWidth
      entry.height = nextHeight
    },
    stop() {
      motion.dispose()
      if (!entry) return
      getObserver().unobserve(canvas)
      entries.delete(canvas)
      if (!entries.size) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    },
  }
}
