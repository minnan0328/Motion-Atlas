import { el } from './dom'
import { jsEasing } from './easing'
import { keyframeAt } from './controllers'
import { mountMotion, webglSupported } from '../../three/renderer'
import type { CameraHandle, MotionFactory } from '../../three/stage'
import { alternate, loop } from '../../three/timeline'
import type { MotionContext, MotionInstance, MotionModule, MotionParams } from './types'

/**
 * 將 Three.js 場景包裝成統一的生命週期：
 * 共用 WebGL renderer、可暫停的場景時鐘、緩動與物理參數、鏡頭操作與診斷資訊。
 */
export function webglModule(factory: MotionFactory): MotionModule {
  return {
    create(context: MotionContext): MotionInstance {
      if (!webglSupported()) return unsupported(context)
      const canvas = el('canvas', { display: 'block', width: '100%', height: '100%' }, context.container)
      const motion = factory()
      let params = context.params
      let ease = jsEasing(params)
      const physics = () => ({ stiffness: params.stiffness, damping: params.damping, mass: params.mass, gravity: 1600 })

      // 場景時鐘：暫停時停止累積，持續時間改變時以倍率調整速度
      let elapsed = 0
      let last = performance.now()
      let running = true
      const time = () => {
        const now = performance.now()
        if (running) elapsed += ((now - last) / 1000) * (motion.timeline.duration / params.duration)
        last = now
        const t = Math.max(elapsed - params.delay, 0)
        const limit = Number.isFinite(params.iterations) ? motion.timeline.duration * params.iterations - 1e-3 : Infinity
        return Math.min(t, limit)
      }

      const mounted = mountMotion(
        canvas,
        motion,
        context.width,
        context.height,
        () => ease,
        physics,
        time,
        context.interactive ? 0 : 30,
      )

      // 詳細頁：鏡頭操作，或點擊給予衝量
      let camera: CameraHandle | null = null
      if (context.interactive && motion.controls) {
        camera = motion.controls(context.container)
        camera.setAutoRotate(params.autoRotate)
      }
      const onPointerDown = (event: PointerEvent) => {
        const rect = context.container.getBoundingClientRect()
        motion.poke?.((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height)
      }
      const pokeable = context.interactive && !motion.controls && Boolean(motion.poke)
      if (pokeable) context.container.addEventListener('pointerdown', onPointerDown)

      return {
        overlay: motion.overlay,
        camera: camera
          ? { reset: () => camera!.reset(), setAutoRotate: (enabled) => camera!.setAutoRotate(enabled) }
          : undefined,
        play() {
          running = true
          last = performance.now()
        },
        pause() {
          time()
          running = false
        },
        reset() {
          elapsed = 0
          last = performance.now()
        },
        resize: (width, height) => mounted.resize(width, height),
        update(next: MotionParams) {
          params = next
          ease = jsEasing(params)
          camera?.setAutoRotate(params.autoRotate)
        },
        diagnostics() {
          const t = time()
          const { duration, direction, offsets } = motion.timeline
          const finished = Number.isFinite(params.iterations) && t >= duration * params.iterations - 2e-3
          const progress = finished ? 1 : direction === 'alternate' ? alternate(t, duration) : loop(t, duration)
          const custom = motion.diagnostics?.(t)
          return {
            playState: finished ? 'finished' : running ? 'running' : 'paused',
            progress: custom?.progress ?? progress,
            iteration: Math.floor(t / duration),
            keyframe: custom?.keyframes === false ? null : keyframeAt(offsets, progress),
            note: custom?.note,
          }
        },
        dispose() {
          camera?.dispose()
          if (pokeable) context.container.removeEventListener('pointerdown', onPointerDown)
          mounted.stop()
          canvas.remove()
        },
      }
    },
  }
}

// 無法建立 WebGL context 時（停用硬體加速、GPU 被封鎖）顯示說明，不建立場景
function unsupported(context: MotionContext): MotionInstance {
  const message = el(
    'div',
    {
      position: 'absolute',
      inset: '0',
      display: 'grid',
      placeItems: 'center',
      padding: '16px',
      textAlign: 'center',
      fontSize: context.interactive ? '14px' : '12px',
      lineHeight: '1.6',
      color: 'var(--ui-muted)',
    },
    context.container,
    context.interactive
      ? '此瀏覽器無法使用 WebGL，3D 場景無法顯示。請在瀏覽器設定中開啟硬體加速後重新整理。'
      : '需要 WebGL',
  )
  return {
    play() {},
    pause() {},
    reset() {},
    resize() {},
    update() {},
    diagnostics: () => ({ playState: 'idle', progress: null, iteration: null, keyframe: null, note: 'WebGL 無法使用' }),
    dispose: () => message.remove(),
  }
}
