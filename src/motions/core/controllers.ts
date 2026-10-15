import type { MotionDiagnostics, MotionParams, PlayState } from './types'

// Web Animations API 的時間設定
export function timing(params: MotionParams, extraDelay = 0): KeyframeAnimationOptions {
  return {
    duration: params.duration * 1000,
    delay: (params.delay + extraDelay) * 1000,
    iterations: params.iterations,
    direction: params.direction,
    fill: 'both',
  }
}

// 依進度找出目前所在的 keyframe（最後一個不超過進度的位置）
export function keyframeAt(offsets: number[], progress: number) {
  let current = 0
  offsets.forEach((offset, i) => {
    if (offset <= progress + 1e-6) current = i
  })
  return { current: current + 1, total: offsets.length }
}

/**
 * 管理一組 Web Animations：播放、暫停、重設與診斷。
 * 診斷資訊取自主要動畫（第一個）實際的計算時間。
 */
export function waapiGroup() {
  let animations: Animation[] = []
  let paused = false

  const add = (animation: Animation) => {
    animations.push(animation)
    if (paused) animation.pause()
    return animation
  }

  return {
    add,
    get animations() {
      return animations
    },
    play() {
      paused = false
      animations.forEach((animation) => animation.play())
    },
    pause() {
      paused = true
      animations.forEach((animation) => animation.pause())
    },
    reset() {
      animations.forEach((animation) => {
        animation.cancel()
        if (!paused) animation.play()
      })
    },
    clear() {
      animations.forEach((animation) => animation.cancel())
      animations = []
    },
    diagnostics(): MotionDiagnostics {
      const main = animations[0]
      if (!main || !(main.effect instanceof KeyframeEffect)) {
        return { playState: 'idle', progress: null, iteration: null, keyframe: null }
      }
      const computed = main.effect.getComputedTiming()
      const offsets = [...new Set(main.effect.getKeyframes().map((frame) => frame.computedOffset))]
      const progress = computed.progress ?? null
      return {
        playState: main.playState as PlayState,
        progress,
        iteration: computed.currentIteration ?? null,
        keyframe: progress === null ? null : keyframeAt(offsets, progress),
      }
    },
  }
}

/**
 * 逐幀動畫（requestAnimationFrame）的時鐘：可暫停、重設，並依持續時間回報進度。
 * step 收到的是經過的秒數（不含暫停時間），不依賴固定影格位移。
 */
export function rafClock(step: (time: number, dt: number) => void, getParams: () => MotionParams, note?: string) {
  let elapsed = 0
  let last = performance.now()
  let running = true
  let frame = requestAnimationFrame(tick)

  function tick(now: number) {
    frame = requestAnimationFrame(tick)
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    if (!running) return
    elapsed += dt
    const { delay, duration, iterations } = getParams()
    // 有限次數播放結束後停在最後一格
    const t = Math.min(Math.max(elapsed - delay, 0), Number.isFinite(iterations) ? duration * iterations - 1e-3 : Infinity)
    step(t, dt)
  }

  const cycle = () => {
    const { duration, iterations, delay } = getParams()
    const t = Math.max(elapsed - delay, 0)
    const iteration = Math.floor(t / duration)
    const finished = iteration >= iterations
    return { iteration: Math.min(iteration, iterations - 1), progress: finished ? 1 : (t % duration) / duration, finished }
  }

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
      step(0, 0)
    },
    cycle,
    diagnostics(): MotionDiagnostics {
      const { progress, iteration, finished } = cycle()
      return {
        playState: finished ? 'finished' : running ? 'running' : 'paused',
        progress,
        iteration,
        keyframe: null,
        note: note ?? '逐幀計算，無固定 keyframe',
      }
    },
    dispose() {
      cancelAnimationFrame(frame)
    },
  }
}

// 依播放方向換算目前這一輪的進度（與 CSS animation-direction 相同）
export function directedProgress(time: number, params: MotionParams) {
  const cycle = time / params.duration
  const iteration = Math.floor(cycle)
  const progress = cycle - iteration
  const reversed =
    params.direction === 'reverse' ||
    (params.direction === 'alternate' && iteration % 2 === 1) ||
    (params.direction === 'alternate-reverse' && iteration % 2 === 0)
  return reversed ? 1 - progress : progress
}
