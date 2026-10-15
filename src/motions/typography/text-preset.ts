import { cssEasing } from '../core/easing'
import { timing, waapiGroup } from '../core/controllers'
import { createDomStage, el, PALETTE } from '../core/dom'
import type { MotionContext, MotionInstance, MotionModule, MotionParams } from '../core/types'
import { EFFECTS, type Frame, type Pose } from './effects'

export type TextVariant =
  | 'mask'
  | 'glitch'
  | 'shine'
  | 'fill'
  | 'reflection'
  | 'cursor'
  | 'underline'
  | 'highlight'
  | 'box'

export interface TextPreset {
  text: string
  // 動畫套用的單位：每個字母、每個單字或整段文字
  split?: 'letter' | 'word' | 'none'
  // effects.ts 的 keyframes 名稱
  animation: string
  // 每個單位錯開的秒數（以預設持續時間為基準，隨持續時間等比縮放）
  stagger?: number
  order?: 'normal' | 'reverse' | 'center' | 'random'
  origin?: 'center' | 'bottom' | 'top'
  size?: number
  variant?: TextVariant
  // 使用彈簧緩動（剛性、阻尼、質量）
  spring?: boolean
}

const COLORS = [PALETTE.c1, PALETTE.c2, PALETTE.c3, PALETTE.c4, PALETTE.c5]

type Prop = Exclude<keyof Pose, 'color'>
const PROPS: Prop[] = [
  'x', 'y', 'z', 'rx', 'ry', 'rz', 's', 'sx', 'sy', 'skx', 'sky', 'o', 'glow', 'blur',
  'shadow', 'split', 'spacing', 'clipStart', 'clipEnd', 'light', 'fill',
]
const BASE: Record<Prop, number> = {
  x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, sx: 1, sy: 1, skx: 0, sky: 0, o: 1, glow: 0, blur: 0,
  shadow: 0, split: 0, spacing: 0, clipStart: 0, clipEnd: 1, light: 0, fill: 0,
}
// 套用在整行文字容器上的屬性
const LINE_PROPS: Prop[] = ['clipStart', 'clipEnd', 'light', 'fill']

// 錯開順序換算成延遲倍數
export function orderIndex(order: TextPreset['order'], i: number, count: number) {
  if (order === 'reverse') return count - 1 - i
  if (order === 'center') return Math.abs(i - (count - 1) / 2)
  if (order === 'random') {
    const hash = Math.sin(i * 12.9898 + 78.233) * 43758.5453
    return (hash - Math.floor(hash)) * (count - 1)
  }
  return i
}

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const mixHex = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return `rgb(${Math.round(r1! + (r2! - r1!) * t)}, ${Math.round(g1! + (g2! - g1!) * t)}, ${Math.round(b1! + (b2! - b1!) * t)})`
}

/**
 * 將 Pose 影格轉為 Web Animations API 的 keyframes。
 * 每個屬性只在有定義的影格之間線性內插，再於所有影格位置取值；緩動曲線設在每個 keyframe 上，作用於每一段。
 */
export function poseKeyframes(
  frames: Frame[],
  options: { index: number; count: number; size: number; amplitude: number; easing: string; props?: Prop[] },
): Keyframe[] {
  const { index, count, size, amplitude, easing } = options
  const props = options.props ?? PROPS.filter((prop) => !LINE_PROPS.includes(prop))
  const offsets = [...new Set(frames.map(([offset]) => offset))].sort((a, b) => a - b)

  const tracks = new Map<Prop, [number, number][]>()
  for (const prop of props) {
    const own: [number, number][] = []
    for (const [offset, pose] of frames) {
      const value = pose[prop]
      if (value === undefined) continue
      own.push([offset, typeof value === 'function' ? value(index, size) : value])
    }
    if (!own.length) continue
    if (own[0]![0] > 0) own.unshift([0, BASE[prop]])
    if (own[own.length - 1]![0] < 1) own.push([1, BASE[prop]])
    tracks.set(prop, own)
  }
  const at = (prop: Prop, offset: number) => {
    const track = tracks.get(prop)
    if (!track) return BASE[prop]
    for (let i = 1; i < track.length; i++) {
      const [to, b] = track[i]!
      if (offset > to) continue
      const [from, a] = track[i - 1]!
      return to === from ? b : a + ((b - a) * (offset - from)) / (to - from)
    }
    return track[track.length - 1]![1]
  }

  const colorFrames = frames.filter(([, pose]) => pose.color !== undefined)
  const colorAt = (offset: number) => {
    for (let i = 1; i < colorFrames.length; i++) {
      const [to, b] = colorFrames[i]!
      if (offset > to) continue
      const [from, a] = colorFrames[i - 1]!
      const t = to === from ? 1 : (offset - from) / (to - from)
      return mixHex(COLORS[a.color!]!, COLORS[b.color!]!, t)
    }
    return COLORS[colorFrames[colorFrames.length - 1]![1].color!]!
  }

  const amp = (value: number) => value * amplitude
  const ampScale = (value: number) => Math.max(1 + (value - 1) * amplitude, 0)

  return offsets.map((offset) => {
    const v = (prop: Prop) => at(prop, offset)
    const keyframe: Keyframe = { offset, easing }

    if (props.some((prop) => ['x', 'y', 'z', 'rx', 'ry', 'rz', 's', 'sx', 'sy', 'skx', 'sky', 'spacing'].includes(prop) && tracks.has(prop))) {
      const s = ampScale(v('s'))
      const spacing = (index - (count - 1) / 2) * v('spacing') * size
      keyframe.transform =
        `translate3d(${amp(v('x')) + spacing}px, ${amp(v('y'))}px, ${amp(v('z'))}px) ` +
        `rotateX(${amp(v('rx'))}deg) rotateY(${amp(v('ry'))}deg) rotateZ(${amp(v('rz'))}deg) ` +
        `skew(${amp(v('skx'))}deg, ${amp(v('sky'))}deg) scale(${ampScale(v('sx')) * s}, ${ampScale(v('sy')) * s})`
    }
    if (tracks.has('o')) keyframe.opacity = v('o')
    if (tracks.has('blur')) keyframe.filter = `blur(${v('blur')}px)`

    const shadows: string[] = []
    if (tracks.has('glow')) shadows.push(`0 0 ${4 + v('glow') * 10}px ${mixHex(PALETTE.c4, PALETTE.c1, v('glow'))}`)
    if (tracks.has('shadow')) {
      const length = Math.round(v('shadow'))
      for (let i = 1; i <= Math.max(length, 1); i++) shadows.push(`${i * (length ? 1 : 0)}px ${i * (length ? 1 : 0)}px 0 ${PALETTE.c5}`)
    }
    if (tracks.has('split')) {
      const d = amp(v('split'))
      shadows.push(`${d}px 0 0 rgba(183, 31, 36, 0.75)`, `${-d}px 0 0 rgba(134, 160, 187, 0.85)`)
    }
    if (shadows.length) keyframe.textShadow = shadows.join(', ')
    if (colorFrames.length) keyframe.color = colorAt(offset)

    // 整行文字的屬性
    if (tracks.has('clipStart') || tracks.has('clipEnd')) {
      keyframe.clipPath = `inset(-20% ${(1 - v('clipEnd')) * 100}% -20% ${v('clipStart') * 100}%)`
    }
    if (tracks.has('light')) keyframe.backgroundPosition = `${(1 - v('light')) * 100}% 0%`
    if (tracks.has('fill')) keyframe.backgroundPosition = `0% ${v('fill') * 100}%`
    return keyframe
  })
}

const ORIGIN = { center: '50% 55%', bottom: '50% 100%', top: '50% 0%' }

// 文字動畫的共用舞台樣式
export function textStage(context: MotionContext, size: number) {
  const dom = createDomStage(context)
  Object.assign(dom.stage.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--c3)',
    fontFamily: "'Helvetica Neue', Arial, 'PingFang TC', sans-serif",
    fontWeight: '800',
    fontSize: `${size}px`,
    lineHeight: '1.15',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  })
  return dom
}

/**
 * Preset 文字動畫：拆字後逐一套用相同的 keyframes，以錯開時間、順序與基準點產生變化。
 * 遮罩、光澤、填色、倒影、故障殘影與底線等效果以 DOM 疊加層實作。
 */
export function textPreset(preset: TextPreset, baseDuration: number): MotionModule {
  return {
    create(context): MotionInstance {
      const size = preset.size ?? 28
      const { stage, resize, dispose } = textStage(context, size)
      const group = waapiGroup()
      let params = context.params

      function build() {
        group.clear()
        stage.replaceChildren()
        const text = params.text.trim() || preset.text
        const split = preset.split ?? 'none'
        const units = split === 'letter' ? [...text] : split === 'word' ? text.split(' ') : [text]
        const frames = EFFECTS[preset.animation] ?? EFFECTS['fade-in']!
        const easing = cssEasing(params, preset.spring)
        const stagger = (preset.stagger ?? 0) * (params.duration / baseDuration)
        const amplitude = params.amplitude

        const wrapper = el('div', { position: 'relative', perspective: '320px' }, stage)
        const makeLine = (parent: HTMLElement) => {
          const line = el('div', { position: 'relative', display: 'flex', alignItems: 'baseline', gap: split === 'word' ? '0.3em' : '0' }, parent)
          const inners = units.map((unit) => {
            const outer = el('span', { display: 'inline-block', overflow: preset.variant === 'mask' ? 'hidden' : 'visible', padding: preset.variant === 'mask' ? '0 0.02em' : '0', verticalAlign: 'bottom' }, line)
            return el('span', { display: 'inline-block', transformOrigin: ORIGIN[preset.origin ?? 'center'] }, outer, unit === ' ' ? ' ' : unit)
          })
          return { line, inners }
        }

        const main = makeLine(wrapper)
        const lines = [main]

        // 倒影：翻轉的副本與漸層遮罩
        if (preset.variant === 'reflection') {
          const mirror = el('div', {
            position: 'absolute',
            left: '0',
            top: '100%',
            transform: 'scaleY(-1)',
            opacity: '0.35',
            maskImage: 'linear-gradient(to top, #000, transparent 75%)',
            webkitMaskImage: 'linear-gradient(to top, #000, transparent 75%)',
          } as Partial<CSSStyleDeclaration>, wrapper)
          lines.push(makeLine(mirror))
          el('div', { position: 'absolute', left: '-20%', right: '-20%', top: '100%', height: '1px', background: 'var(--c5)' }, wrapper)
        }

        // 光澤與填色：以背景裁切文字，背景位置隨動畫移動
        if (preset.variant === 'shine' || preset.variant === 'fill') {
          const gradient =
            preset.variant === 'shine'
              ? `linear-gradient(110deg, ${PALETTE.c3} 40%, ${PALETTE.c1} 50%, ${PALETTE.c3} 60%)`
              : `linear-gradient(to top, ${PALETTE.c3} 50%, ${PALETTE.c1} 50%)`
          Object.assign(main.line.style, {
            backgroundImage: gradient,
            backgroundSize: preset.variant === 'shine' ? '250% 100%' : '100% 200%',
            webkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          } as Partial<CSSStyleDeclaration>)
          main.inners.forEach((inner) => (inner.style.color = 'transparent'))
        }

        // 每個單位的動畫
        for (const { inners } of lines) {
          inners.forEach((inner, i) => {
            const keyframes = poseKeyframes(frames, { index: i, count: units.length, size, amplitude, easing })
            group.add(inner.animate(keyframes, timing(params, orderIndex(preset.order, i, units.length) * stagger)))
          })
        }

        // 整行的屬性（擦拭、光澤、填色）
        const lineFrames = poseKeyframes(frames, { index: 0, count: 1, size, amplitude: 1, easing, props: LINE_PROPS })
        if (lineFrames.some((frame) => frame.clipPath || frame.backgroundPosition)) {
          for (const { line } of lines) group.add(line.animate(lineFrames, timing(params)))
        }

        // 故障：主體前方兩層色彩殘影
        if (preset.variant === 'glitch') {
          for (const [name, color] of [['glitch-a', PALETTE.c1], ['glitch-b', PALETTE.c5]] as const) {
            const ghost = el('div', { position: 'absolute', inset: '0', color, mixBlendMode: 'multiply' }, wrapper, text)
            group.add(ghost.animate(poseKeyframes(EFFECTS[name]!, { index: 0, count: 1, size, amplitude, easing }), timing(params)))
          }
        }

        // 底線、螢光筆、外框、游標
        const decoration = (style: Partial<CSSStyleDeclaration>, keyframes: Keyframe[]) => {
          const element = el('span', { position: 'absolute', pointerEvents: 'none', ...style }, main.line)
          group.add(element.animate(keyframes.map((frame) => ({ ...frame, easing })), timing(params)))
        }
        if (preset.variant === 'underline') {
          decoration({ left: '0', right: '0', bottom: '-0.18em', height: '3px', background: 'var(--c2)', transformOrigin: '0 50%' }, [
            { offset: 0, transform: 'scaleX(0)', transformOrigin: '0 50%' },
            { offset: 0.15, transform: 'scaleX(0)', transformOrigin: '0 50%' },
            { offset: 0.45, transform: 'scaleX(1)', transformOrigin: '0 50%' },
            { offset: 0.7, transform: 'scaleX(1)', transformOrigin: '100% 50%' },
            { offset: 1, transform: 'scaleX(0)', transformOrigin: '100% 50%' },
          ])
        }
        if (preset.variant === 'highlight') {
          main.line.style.isolation = 'isolate'
          decoration({ left: '-0.15em', right: '-0.15em', bottom: '0.05em', height: '0.42em', background: 'var(--c1)', zIndex: '-1' }, [
            { offset: 0, transform: 'scaleX(0)', transformOrigin: '0 50%' },
            { offset: 0.1, transform: 'scaleX(0)', transformOrigin: '0 50%' },
            { offset: 0.4, transform: 'scaleX(1)', transformOrigin: '0 50%' },
            { offset: 0.7, transform: 'scaleX(1)', transformOrigin: '100% 50%' },
            { offset: 1, transform: 'scaleX(0)', transformOrigin: '100% 50%' },
          ])
        }
        if (preset.variant === 'box') {
          decoration({ left: '-0.3em', right: '-0.3em', top: '-0.2em', bottom: '-0.2em', border: '2px solid var(--c2)' }, [
            { offset: 0, clipPath: 'inset(0 100% 100% 0)' },
            { offset: 0.1, clipPath: 'inset(0 100% 100% 0)' },
            { offset: 0.25, clipPath: 'inset(0 0 100% 0)' },
            { offset: 0.4, clipPath: 'inset(0 0 0 0)' },
            { offset: 0.7, clipPath: 'inset(0 0 0 0)' },
            { offset: 1, clipPath: 'inset(0 0 0 100%)' },
          ])
        }
      }

      build()
      return {
        play: () => group.play(),
        pause: () => group.pause(),
        reset: () => group.reset(),
        resize,
        update(next: MotionParams) {
          params = next
          // 重建後回到原本的播放位置，調整參數時動畫不會從頭開始
          const time = group.animations[0]?.currentTime ?? null
          build()
          if (time !== null) group.animations.forEach((animation) => (animation.currentTime = time))
        },
        diagnostics: () => group.diagnostics(),
        dispose() {
          group.clear()
          dispose()
        },
      }
    },
  }
}
