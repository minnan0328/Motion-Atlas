export type Ease = (t: number) => number

export const linear: Ease = (t) => t

// 與 CSS cubic-bezier() 相同的計算方式：先由 x 反解 t，再取 y
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  const solveX = (x: number) => {
    let t = x
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - x
      if (Math.abs(error) < 1e-6) return t
      const slope = slopeX(t)
      if (Math.abs(slope) < 1e-6) break
      t -= error / slope
    }
    // 牛頓法不收斂時改用二分法
    let low = 0
    let high = 1
    t = x
    while (low < high) {
      const value = sampleX(t)
      if (Math.abs(value - x) < 1e-6) return t
      if (x > value) low = t
      else high = t
      t = (low + high) / 2
      if (high - low < 1e-6) break
    }
    return t
  }

  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solveX(x)))
}

// 對應 CSS 的 animation-iteration-count: infinite
export function loop(time: number, duration: number): number {
  return (((time % duration) + duration) % duration) / duration
}

// 對應 CSS 的 animation-direction: alternate，反向時等同時間倒放
export function alternate(time: number, duration: number): number {
  const cycle = time / duration
  const progress = cycle - Math.floor(cycle)
  return Math.floor(cycle) % 2 === 0 ? progress : 1 - progress
}

type Value = number | number[]

/**
 * 對應 CSS @keyframes：[位置 0~1, 數值]，緩動曲線作用在每一段關鍵影格之間。
 * 相同數值的相鄰影格即為停格。
 */
export type Track<T> = ((progress: number, ease: Ease) => T) & { offsets: number[] }

export function keyframes<T extends Value>(frames: [number, T][]): Track<T> {
  const track = (progress: number, ease: Ease): T => {
    const first = frames[0]!
    if (progress <= first[0]) return first[1]

    for (let i = 1; i < frames.length; i++) {
      const [to, b] = frames[i]!
      if (progress > to) continue
      const [from, a] = frames[i - 1]!
      const local = to === from ? 1 : ease((progress - from) / (to - from))
      if (typeof a === 'number') return (a + ((b as number) - a) * local) as T
      return a.map((value, j) => value + ((b as number[])[j]! - value) * local) as T
    }

    return frames[frames.length - 1]![1]
  }
  return Object.assign(track, { offsets: frames.map(([offset]) => offset) })
}
