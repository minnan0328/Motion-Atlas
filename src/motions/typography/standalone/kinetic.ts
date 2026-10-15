import { directedProgress } from '../../core/controllers'
import { el } from '../../core/dom'
import { cssEasing, jsEasing } from '../../core/easing'
import { rafText, timing, waapiText } from './helpers'

const words = (value: string, limit: number) => value.split(/[\s,]+/).filter(Boolean).slice(0, limit)

// 換字輪播：固定的字首搭配在遮罩中垂直輪播的單字，最後一個單字接回第一個形成無縫循環
export const wordSwap = waapiText(26, (stage, params, group, text) => {
  const list = words(text('FAST BOLD CALM WARM'), 6)
  const row = el('div', { display: 'flex', alignItems: 'center', gap: '0.3em' }, stage)
  el('span', { color: 'var(--c2)', fontWeight: '600' }, row, 'SO')
  const mask = el('div', { height: '1.2em', overflow: 'hidden' }, row)
  const column = el('div', { display: 'flex', flexDirection: 'column', color: 'var(--c3)' }, mask)
  for (const word of [...list, list[0]!]) el('div', { height: '1.2em', lineHeight: '1.2em' }, column, word)
  const easing = cssEasing(params)
  const frames: Keyframe[] = []
  list.forEach((_, k) => {
    frames.push({ offset: k / list.length, transform: `translateY(${-k * 1.2}em)`, easing })
    frames.push({ offset: (k + 0.7) / list.length, transform: `translateY(${-k * 1.2}em)`, easing })
  })
  frames.push({ offset: 1, transform: `translateY(${-list.length * 1.2}em)`, easing })
  group.add(column.animate(frames, timing(params)))
})

// 堆疊標題：單字依序落下並疊成標題，最後一起滑出
export const kineticStack = waapiText(28, (stage, params, group, text) => {
  const list = words(text('MAKE IT MOVE'), 4)
  const column = el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1' }, stage)
  const sizes = [1, 0.62, 1.15, 0.8]
  const easing = cssEasing(params)
  list.forEach((word, k) => {
    const item = el('div', { fontSize: `${sizes[k]}em`, color: k % 2 ? 'var(--c2)' : 'var(--c3)' }, column, word)
    const start = 0.04 + k * 0.12
    const exit = 0.72 + k * 0.04
    group.add(
      item.animate(
        [
          { offset: 0, opacity: 0, transform: 'translate(0, -40px)', easing },
          { offset: start, opacity: 0, transform: 'translate(0, -40px)', easing },
          { offset: start + 0.1, opacity: 1, transform: 'translate(0, 4px) scale(1.06, 0.9)', easing },
          { offset: start + 0.16, opacity: 1, transform: 'translate(0, 0) scale(1, 1)', easing },
          { offset: exit, opacity: 1, transform: 'translate(0, 0)', easing },
          { offset: exit + 0.14, opacity: 0, transform: 'translate(-70px, 0)', easing },
          { offset: 1, opacity: 0, transform: 'translate(-70px, 0)', easing },
        ],
        timing(params),
      ),
    )
  })
})

// 穿越縮放：單字依序從遠處放大到眼前，再穿過鏡頭消失
export const zoomThrough = waapiText(30, (stage, params, group, text) => {
  const list = words(text('READY SET GO'), 5)
  const easing = cssEasing(params)
  list.forEach((word, k) => {
    const item = el('div', { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }, stage, word)
    const start = k / list.length
    const end = (k + 1) / list.length
    const span = end - start
    const frames: Keyframe[] = [
      { offset: 0, opacity: 0, transform: 'scale(0.2)', filter: 'blur(0px)', easing },
      { offset: start, opacity: 0, transform: 'scale(0.2)', filter: 'blur(0px)', easing },
      { offset: start + span * 0.35, opacity: 1, transform: 'scale(1)', filter: 'blur(0px)', easing },
      { offset: end - span * 0.15, opacity: 1, transform: 'scale(1.15)', filter: 'blur(0px)', easing },
      { offset: end, opacity: 0, transform: 'scale(4)', filter: 'blur(4px)', easing },
    ]
    if (end < 1) frames.push({ offset: 1, opacity: 0, transform: 'scale(4)', filter: 'blur(4px)', easing })
    group.add(item.animate(frames, timing(params)))
  })
})

// 環形文字：字母沿圓周排列，整圈以四分之一圈為單位停頓旋轉
export const textCircle = waapiText(11, (stage, params, group, text) => {
  const content = `${text('MOTION GALLERY')} · `
  const ring = el('div', { position: 'relative', width: '80px', height: '80px' }, stage)
  ;[...content].forEach((char, i) => {
    const angle = (i / content.length) * 360
    el('span', {
      position: 'absolute',
      left: '50%',
      top: '0',
      height: '40px',
      transformOrigin: '0 40px',
      transform: `rotate(${angle}deg)`,
    }, ring, char)
  })
  const core = el('div', { position: 'absolute', left: '50%', top: '50%', width: '16px', height: '16px', margin: '-8px', borderRadius: '50%', background: 'var(--c1)' }, stage)
  const easing = cssEasing(params)
  const frames: Keyframe[] = []
  for (let k = 0; k < 4; k++) {
    frames.push({ offset: k / 4, transform: `rotate(${k * 90}deg)`, easing })
    frames.push({ offset: k / 4 + 0.15, transform: `rotate(${k * 90}deg)`, easing })
  }
  frames.push({ offset: 1, transform: 'rotate(360deg)', easing })
  group.add(ring.animate(frames, timing(params)))
  // 中心圓點在每次轉動時跟著脈動（附屬動作）
  const pulse: Keyframe[] = []
  for (let k = 0; k < 4; k++) {
    pulse.push({ offset: k / 4 + 0.15, transform: 'scale(1)', easing })
    pulse.push({ offset: k / 4 + 0.2, transform: 'scale(1.4)', easing })
  }
  pulse.unshift({ offset: 0, transform: 'scale(1)', easing })
  pulse.push({ offset: 1, transform: 'scale(1)', easing })
  group.add(core.animate(pulse, timing(params)))
})

// 立體換字：四個單字貼在立方體的四個面，立方體以 90 度為單位翻轉
export const rotateWords = waapiText(26, (stage, params, group, text) => {
  const list = words(text('IDEA DESIGN BUILD SHIP'), 4)
  while (list.length < 4) list.push(list[list.length - 1] ?? 'IDEA')
  const scene = el('div', { perspective: '300px' }, stage)
  const cube = el('div', { position: 'relative', width: '140px', height: '1.2em', transformStyle: 'preserve-3d' }, scene)
  list.forEach((word, k) => {
    el('div', {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: k % 2 ? 'var(--c4)' : 'var(--c1)',
      backfaceVisibility: 'hidden',
      transform: `rotateX(${k * -90}deg) translateZ(0.6em)`,
    }, cube, word)
  })
  const easing = cssEasing(params)
  const frames: Keyframe[] = []
  for (let k = 0; k < 4; k++) {
    frames.push({ offset: k / 4, transform: `rotateX(${k * 90}deg)`, easing })
    frames.push({ offset: k / 4 + 0.16, transform: `rotateX(${k * 90}deg)`, easing })
  }
  frames.push({ offset: 1, transform: 'rotateX(360deg)', easing })
  group.add(cube.animate(frames, timing(params)))
})

// 翻牌看板：每個字元依序翻過字母表，停在目標字元；退場時翻回空白
const FLAP = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export const splitFlap = rafText(
  20,
  (stage, getParams, text) => {
    const board = el('div', { display: 'flex', gap: '3px' }, stage)
    let target = ''
    let cells: { face: HTMLSpanElement; last: string; flip: number }[] = []
    const build = () => {
      target = text('GATE 12').toUpperCase()
      board.replaceChildren()
      cells = [...target].map(() => {
        const cell = el('span', {
          display: 'inline-flex',
          justifyContent: 'center',
          width: '0.95em',
          padding: '4px 0',
          borderRadius: '3px',
          background: 'var(--c3)',
          color: 'var(--c4)',
          position: 'relative',
        }, board)
        el('span', { position: 'absolute', left: '0', right: '0', top: '50%', height: '1px', background: 'rgba(0,0,0,0.35)' }, cell)
        const face = el('span', { display: 'inline-block' }, cell, ' ')
        return { face, last: ' ', flip: 0 }
      })
    }
    build()
    return {
      rebuild: build,
      step(time, dt) {
        const params = getParams()
        const q = jsEasing(params)(directedProgress(time, params))
        const n = cells.length
        cells.forEach((cell, i) => {
          const targetIndex = Math.max(FLAP.indexOf(target[i] ?? ' '), 0)
          // 進場：每個字元在不同時間停下；退場：依序翻回空白
          const settle = 0.15 + (i / Math.max(n, 1)) * 0.4
          const leave = 0.75 + (i / Math.max(n, 1)) * 0.15
          let index = targetIndex
          if (q < settle) index = Math.max(targetIndex - Math.ceil((settle - q) * 60), 0)
          else if (q > leave) index = Math.max(targetIndex - Math.ceil((q - leave) * 120), 0)
          const char = FLAP[index]!
          if (char !== cell.last) {
            cell.last = char
            cell.flip = 1
            cell.face.textContent = char === ' ' ? ' ' : char
          }
          // 換字時快速翻動：以時間差衰減，與影格率無關
          cell.flip = Math.max(cell.flip - dt * 14, 0)
          cell.face.style.transform = `scaleY(${1 - cell.flip * 0.7})`
        })
      },
    }
  },
  '字元逐格翻動到目標字元，無固定 keyframe',
)
