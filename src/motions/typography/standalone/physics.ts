import { directedProgress } from '../../core/controllers'
import { el } from '../../core/dom'
import { jsEasing } from '../../core/easing'
import { rafText } from './helpers'

// 液態波浪：以正弦函數連續計算每個字母的高度與縮放，形成不斷流動的波
export const liquidWave = rafText(
  30,
  (stage, getParams, text) => {
    const line = el('div', { display: 'flex' }, stage)
    let spans: HTMLSpanElement[] = []
    const build = () => {
      line.replaceChildren()
      spans = [...text('LIQUID')].map((char) => el('span', { display: 'inline-block', transformOrigin: '50% 100%' }, line, char === ' ' ? ' ' : char))
    }
    build()
    return {
      rebuild: build,
      step(time) {
        const { duration, amplitude } = getParams()
        const phase = (time / duration) * Math.PI * 2
        spans.forEach((span, i) => {
          const wave = Math.sin(phase + i * 0.6)
          const crest = Math.cos(phase + i * 0.6)
          span.style.transform = `translateY(${-wave * 7 * amplitude}px) scale(${1 - crest * 0.08 * amplitude}, ${1 + crest * 0.14 * amplitude}) rotate(${crest * 4 * amplitude}deg)`
        })
      },
    }
  },
  '連續正弦波形，無固定 keyframe',
)

// 彈簧拖曳：第一個字母依緩動曲線左右移動，其餘字母以彈簧（剛性、阻尼、質量）一個接一個跟隨
export const elasticDrag = rafText(
  28,
  (stage, getParams, text) => {
    const line = el('div', { display: 'flex' }, stage)
    let spans: HTMLSpanElement[] = []
    let state: { x: number; v: number }[] = []
    const build = () => {
      line.replaceChildren()
      spans = [...text('ELASTIC')].map((char) => el('span', { display: 'inline-block' }, line, char === ' ' ? ' ' : char))
      state = spans.map(() => ({ x: 0, v: 0 }))
    }
    build()
    return {
      rebuild: build,
      step(time, dt) {
        const params = getParams()
        const p = directedProgress(time, params)
        const ease = jsEasing(params)
        // 領頭字母：左 → 右 → 左，中間停頓
        const leader = p < 0.4 ? -1 + 2 * ease(p / 0.4) : p < 0.5 ? 1 : p < 0.9 ? 1 - 2 * ease((p - 0.5) / 0.4) : -1
        const reach = 36 * params.amplitude
        const { stiffness, mass } = params
        const friction = 2 * params.damping * Math.sqrt(stiffness * mass)
        const steps = 4
        const h = dt / steps
        for (let n = 0; n < steps; n++) {
          state.forEach((item, i) => {
            const target = i === 0 ? leader * reach : state[i - 1]!.x
            const force = stiffness * (target - item.x) - friction * item.v
            item.v += (force / mass) * h
            item.x += item.v * h
          })
        }
        spans.forEach((span, i) => {
          const { x, v } = state[i]!
          span.style.transform = `translateX(${x}px) skewX(${Math.max(Math.min(-v * 0.08, 20), -20)}deg)`
        })
      },
    }
  },
  '彈簧鏈物理模擬，無固定 keyframe',
)
