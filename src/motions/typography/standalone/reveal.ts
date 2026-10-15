import { directedProgress } from '../../core/controllers'
import { el, PALETTE, svg } from '../../core/dom'
import { cssEasing, jsEasing } from '../../core/easing'
import { rafText, timing, waapiText } from './helpers'

// 打字機：逐字打出、停頓、逐字刪除，游標跟在最後一個字後面，停頓時閃爍
export const typewriter = rafText(
  24,
  (stage, getParams, text) => {
    const line = el('div', { display: 'flex', alignItems: 'center' }, stage)
    const typed = el('span', { whiteSpace: 'pre' }, line)
    const caret = el('span', { display: 'inline-block', width: '2px', height: '1em', marginLeft: '2px', background: 'var(--c2)' }, line)
    let content = text('Hello World')
    return {
      rebuild() {
        content = text('Hello World')
      },
      step(time) {
        const params = getParams()
        const p = directedProgress(time, params)
        const ease = jsEasing(params)
        let shown = 0
        let typing = false
        if (p < 0.45) {
          shown = Math.floor(ease(p / 0.45) * content.length + 1e-4)
          typing = true
        } else if (p < 0.65) {
          shown = content.length
        } else if (p < 0.92) {
          shown = Math.ceil((1 - ease((p - 0.65) / 0.27)) * content.length)
          typing = true
        }
        typed.textContent = content.slice(0, shown)
        caret.style.opacity = typing || Math.floor(time * 2.5) % 2 === 0 ? '1' : '0'
      },
    }
  },
  '逐字顯示：依進度計算目前字數，無固定 keyframe',
)

// 亂碼解碼：字元先以亂數字形快速切換，再由左至右依序定格；退場時由右至左打亂
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=?'
export const scramble = rafText(
  26,
  (stage, getParams, text) => {
    const line = el('div', { display: 'flex' }, stage)
    let content = ''
    let spans: HTMLSpanElement[] = []
    const build = () => {
      content = text('DECODE')
      line.replaceChildren()
      spans = [...content].map((char) => el('span', { display: 'inline-block', width: '0.74em', textAlign: 'center' }, line, char))
    }
    build()
    return {
      rebuild: build,
      step(time) {
        const params = getParams()
        const q = jsEasing(params)(directedProgress(time, params))
        const frame = Math.floor(time * 22)
        const n = spans.length
        spans.forEach((span, i) => {
          const revealAt = 0.08 + (i / Math.max(n, 1)) * 0.35
          const hideAt = 0.7 + ((n - 1 - i) / Math.max(n, 1)) * 0.2
          const target = content[i] === ' ' ? ' ' : content[i]!
          if (q < 0.04 || q > 0.96) {
            span.style.opacity = '0'
            span.textContent = target
          } else if (q < revealAt || q > hideAt) {
            span.style.opacity = '1'
            span.style.color = 'var(--c5)'
            span.textContent = GLYPHS[(frame * 7 + i * 13) % GLYPHS.length]!
          } else {
            span.style.opacity = '1'
            span.style.color = 'var(--c3)'
            span.textContent = target
          }
        })
      },
    }
  },
  '字元依進度逐一解碼，無固定 keyframe',
)

// 描邊書寫：SVG 文字先以描邊畫出輪廓，再填滿顏色
export const outlineDraw = waapiText(36, (stage, params, group, text) => {
  const box = svg('svg', { viewBox: '0 0 200 100', width: 200, height: 100 }, stage)
  box.style.position = 'absolute'
  box.style.inset = '0'
  const label = svg('text', {
    x: 100,
    y: 64,
    'text-anchor': 'middle',
    'font-size': 36,
    'font-weight': 800,
    'font-family': "'Helvetica Neue', Arial, sans-serif",
    fill: PALETTE.c3,
    stroke: PALETTE.c3,
    'stroke-width': 1.2,
    'stroke-dasharray': 420,
  }, box)
  label.textContent = text('SKETCH')
  const easing = cssEasing(params)
  group.add(
    label.animate(
      [
        { offset: 0, strokeDashoffset: 420, fillOpacity: 0, opacity: 1, easing },
        { offset: 0.45, strokeDashoffset: 0, fillOpacity: 0, opacity: 1, easing },
        { offset: 0.6, strokeDashoffset: 0, fillOpacity: 1, opacity: 1, easing },
        { offset: 0.85, strokeDashoffset: 0, fillOpacity: 1, opacity: 1, easing },
        { offset: 1, strokeDashoffset: 0, fillOpacity: 1, opacity: 0, easing },
      ],
      timing(params),
    ),
  )
})

// 分行揭示：上下兩行從相反方向滑出遮罩，中間的分隔線隨之展開
export const lineSplit = waapiText(22, (stage, params, group, text) => {
  const [first = 'MOTION', second = 'GALLERY'] = text('MOTION GALLERY').split(' ')
  const column = el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }, stage)
  const easing = cssEasing(params)
  const line = (content: string, from: string, to: string, delay: number) => {
    const mask = el('div', { overflow: 'hidden', padding: '0 4px' }, column)
    const inner = el('div', {}, mask, content)
    group.add(
      inner.animate(
        [
          { offset: 0, transform: from, easing },
          { offset: 0.3, transform: 'translate(0, 0)', easing },
          { offset: 0.7, transform: 'translate(0, 0)', easing },
          { offset: 0.92, transform: to, easing },
          { offset: 1, transform: to, easing },
        ],
        timing(params, delay),
      ),
    )
  }
  line(first, 'translate(-110%, 0)', 'translate(0, -110%)', 0)
  const rule = el('div', { width: '120px', height: '2px', background: 'var(--c1)', order: '0' }, column)
  line(second, 'translate(110%, 0)', 'translate(0, 110%)', 0.08 * params.duration / 2.4)
  column.insertBefore(rule, column.lastElementChild)
  group.add(
    rule.animate(
      [
        { offset: 0, transform: 'scaleX(0)', easing },
        { offset: 0.2, transform: 'scaleX(0)', easing },
        { offset: 0.4, transform: 'scaleX(1)', easing },
        { offset: 0.75, transform: 'scaleX(1)', easing },
        { offset: 0.9, transform: 'scaleX(0)', easing },
        { offset: 1, transform: 'scaleX(0)', easing },
      ],
      timing(params),
    ),
  )
})
