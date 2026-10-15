import { cubicBezier, type Ease } from '../three/timeline'
import { toCubicBezier, type Bezier } from './motion'

// 彈簧：剛性決定彈性、阻尼決定衰減、質量決定慣性
export interface SpringOptions {
  stiffness: number
  damping: number
  mass: number
}

// 重力反彈：restitution 為每次反彈保留的速度比例（彈性），bounces 為反彈次數
export interface BounceOptions {
  restitution: number
  bounces: number
}

export type EasingSetting =
  | { type: 'bezier'; bezier: Bezier }
  | ({ type: 'spring' } & SpringOptions)
  | ({ type: 'bounce' } & BounceOptions)

export const DEFAULT_SPRING: SpringOptions = { stiffness: 180, damping: 14, mass: 1 }
export const DEFAULT_BOUNCE: BounceOptions = { restitution: 0.45, bounces: 3 }

export const fromBezier = (bezier: Bezier): EasingSetting => ({ type: 'bezier', bezier })

/**
 * 阻尼彈簧從 0 移動到 1 的位移（初速為 0）。
 * 曲線長度取到振幅小於 0.1% 為止，再壓縮成 0 ~ 1 的時間。
 */
function springCurve({ stiffness, damping, mass }: SpringOptions): Ease {
  const w0 = Math.sqrt(stiffness / mass)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))

  let position: (t: number) => number
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta)
    position = (t) =>
      1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
  } else if (zeta === 1) {
    position = (t) => 1 - Math.exp(-w0 * t) * (1 + w0 * t)
  } else {
    const root = Math.sqrt(zeta * zeta - 1)
    const r1 = -w0 * (zeta - root)
    const r2 = -w0 * (zeta + root)
    position = (t) => 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1)
  }

  const step = 1 / 240
  let settle = step
  for (let t = 0; t < 30; t += step) {
    if (Math.abs(1 - position(t)) > 0.001) settle = t + step
  }

  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : position(x * settle))
}

/**
 * 物體受重力落下並反彈：第一段自由落體抵達終點，之後每次反彈速度乘上 restitution。
 * 以 g = 2、高度 1 計算，落下時間為 1，第 n 次反彈時間為 2 × restitution^n。
 */
function bounceCurve({ restitution, bounces }: BounceOptions): Ease {
  const segments: { start: number; duration: number; speed: number }[] = []
  let time = 1
  for (let n = 1; n <= bounces; n++) {
    const speed = 2 * restitution ** n
    segments.push({ start: time, duration: speed, speed })
    time += speed
  }
  const total = time

  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    const t = x * total
    if (t < 1) return t * t
    for (const { start, duration, speed } of segments) {
      if (t < start + duration) {
        const local = t - start
        return 1 - (speed * local - local * local)
      }
    }
    return 1
  }
}

export function toEase(setting: EasingSetting): Ease {
  if (setting.type === 'spring') return springCurve(setting)
  if (setting.type === 'bounce') return bounceCurve(setting)
  return cubicBezier(...setting.bezier)
}

// CSS 使用的緩動：cubic-bezier() 或取樣成 linear()
export function toCssEasing(setting: EasingSetting, samples = 64): string {
  if (setting.type === 'bezier') return toCubicBezier(setting.bezier)
  const ease = toEase(setting)
  const points = Array.from({ length: samples + 1 }, (_, i) => +ease(i / samples).toFixed(4))
  return `linear(${points.join(', ')})`
}

// UI 互動使用的彈簧（hover、按壓回饋）
export const UI_SPRING: EasingSetting = { type: 'spring', stiffness: 260, damping: 18, mass: 1 }
