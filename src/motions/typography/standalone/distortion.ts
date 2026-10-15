import { directedProgress } from '../../core/controllers'
import { el, svg } from '../../core/dom'
import { cssEasing } from '../../core/easing'
import { rafText, timing, waapiText } from './helpers'

// 切片錯位：文字被切成四條水平切片，各自在不同時間左右錯開
export const slice = waapiText(32, (stage, params, group, text) => {
  const content = text('SLICED')
  const holder = el('div', { position: 'relative' }, stage)
  el('div', { visibility: 'hidden' }, holder, content)
  const easing = cssEasing(params)
  const count = 4
  for (let k = 0; k < count; k++) {
    const top = (k / count) * 100
    const bottom = 100 - ((k + 1) / count) * 100
    const piece = el('div', { position: 'absolute', inset: '0', clipPath: `inset(${top}% 0 ${bottom}% 0)` }, holder, content)
    const sign = k % 2 ? 1 : -1
    const a = params.amplitude
    group.add(
      piece.animate(
        [
          { offset: 0, transform: 'translateX(0)', easing },
          { offset: 0.28 + k * 0.02, transform: 'translateX(0)', easing },
          { offset: 0.33 + k * 0.02, transform: `translateX(${sign * 12 * a}px)`, easing },
          { offset: 0.4 + k * 0.02, transform: `translateX(${-sign * 5 * a}px)`, easing },
          { offset: 0.46 + k * 0.02, transform: 'translateX(0)', easing },
          { offset: 0.7, transform: 'translateX(0)', easing },
          { offset: 0.74, transform: `translateX(${sign * (k + 1) * 5 * a}px)`, easing },
          { offset: 0.8, transform: 'translateX(0)', easing },
          { offset: 1, transform: 'translateX(0)', easing },
        ],
        timing(params),
      ),
    )
  }
})

// 波形扭曲：以 SVG 亂流濾鏡置換文字像素，扭曲程度隨時間起伏
let filterId = 0
export const waveDistort = rafText(
  34,
  (stage, getParams, text) => {
    const id = `motion-distort-${++filterId}`
    const defs = svg('svg', { width: 0, height: 0 }, stage)
    defs.style.position = 'absolute'
    const filter = svg('filter', { id, x: '-20%', y: '-40%', width: '140%', height: '180%' }, defs)
    const turbulence = svg('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.02 0.06', numOctaves: 2, seed: 3 }, filter)
    const displace = svg('feDisplacementMap', { in: 'SourceGraphic', scale: 0, xChannelSelector: 'R', yChannelSelector: 'G' }, filter)
    const label = el('div', { filter: `url(#${id})` }, stage, text('DISTORT'))
    return {
      rebuild() {
        label.textContent = text('DISTORT')
      },
      step(time) {
        const params = getParams()
        const p = directedProgress(time, params)
        const wave = (1 - Math.cos(p * Math.PI * 2)) / 2
        displace.setAttribute('scale', String(wave * 16 * params.amplitude))
        turbulence.setAttribute('baseFrequency', `${0.015 + wave * 0.02} ${0.05 + wave * 0.04}`)
      },
    }
  },
  'SVG 濾鏡參數逐幀更新，無固定 keyframe',
)
