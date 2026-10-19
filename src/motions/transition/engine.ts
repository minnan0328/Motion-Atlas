import { el } from '../core/dom'
import { cssEasing } from '../core/easing'
import { domScene, timing } from '../core/scene'
import type { MotionModule, MotionParams } from '../core/types'

// 轉場動態：舞台 232 × 156，中央為瀏覽器視窗，視窗內容區（viewport）216 × 126
export const W = 216
export const H = 126

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// 一個頁面的構成：依閱讀順序的區塊（交錯進場用）、被點擊的按鈕、變暗用的遮色層
export interface Page {
  root: HTMLElement
  parts: HTMLElement[]
  hero: HTMLElement
  // 點擊後觸發換頁的按鈕與其中心點（viewport 座標）
  anchor: HTMLElement
  anchorPoint: [number, number]
  shade: HTMLElement
  // 首頁才有：中間卡片的範圍與第一張卡片的縮圖（卡片展開、共用元素用）
  card?: Rect
  thumb?: HTMLElement
  // 文章頁 hero 內的太陽（共用元素落地後的附屬動作）
  detail?: HTMLElement
}

export interface Track {
  el: Element
  // 區間內的 keyframe，offset 為 0 ~ 1（換算到這次轉場的時間範圍）；沒有 easing 時使用參數的緩動
  frames: Keyframe[]
}

export interface Phase {
  leaving: Page
  entering: Page
  // true：首頁 → 文章頁（前進）；false：文章頁 → 首頁（返回）
  forward: boolean
}

export interface TransitionContext {
  viewport: HTMLElement
  pages: [Page, Page]
  params: MotionParams
  amp: number
  ease: string
  spring: string
  // 疊在兩個頁面之上的圖層（色幕、共用元素等）
  layer(style?: Partial<CSSStyleDeclaration>): HTMLElement
  build: typeof PAGE_BUILDERS
}

export interface TransitionSpec {
  // below：進入的頁面放在離開的頁面下方（離開的頁面被移開或遮罩後露出新頁）
  phase(phase: Phase): { tracks: Track[]; below?: boolean }
}

// 一次循環：停在首頁 → 前進轉場 → 停在文章頁 → 返回轉場 → 回到首頁
export const WINDOWS: [number, number][] = [
  [0.15, 0.45],
  [0.65, 0.95],
]

// 沒有在某段轉場中動畫的屬性，以靜止值補齊，讓每格 keyframe 的屬性一致
const NEUTRAL: Record<string, string | number> = {
  opacity: 1,
  transform: 'none',
  clipPath: 'none',
  filter: 'none',
  borderRadius: '0px',
  transformOrigin: '50% 50%',
}

export const k = (offset: number, props: Keyframe): Keyframe => ({ ...props, offset })

// 透明度在 at 時瞬間切換（被色幕蓋住時換頁）
export const showAt = (at: number): Keyframe[] => [k(0, { opacity: 0 }), k(at, { opacity: 0 }), k(at, { opacity: 1 }), k(1, { opacity: 1 })]
export const hideAt = (at: number): Keyframe[] => [k(0, { opacity: 1 }), k(at, { opacity: 1 }), k(at, { opacity: 0 }), k(1, { opacity: 0 })]

type Box = [number, number, number, number]

function box(parent: HTMLElement, [x, y, w, h]: Box, background: string, extra: Partial<CSSStyleDeclaration> = {}) {
  return el('div', { position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, background, ...extra }, parent)
}

function pageRoot(parent: HTMLElement, background: string) {
  return el('div', { position: 'absolute', left: '0', top: '0', width: `${W}px`, height: `${H}px`, overflow: 'hidden', background }, parent)
}

function shade(root: HTMLElement) {
  return box(root, [0, 0, W, H], '#1a2224', { opacity: '0', pointerEvents: 'none' })
}

// 首頁：淺色背景、導覽列、主視覺與按鈕、三張卡片
function home(parent: HTMLElement): Page {
  const root = pageRoot(parent, 'var(--c4)')
  const header = box(root, [0, 0, W, 16], 'transparent')
  box(header, [8, 5, 6, 6], 'var(--c3)', { borderRadius: '50%' })
  ;[150, 170, 190].forEach((x) => box(header, [x, 6.5, 14, 3], 'var(--c2)', { borderRadius: '2px', opacity: '0.6' }))

  const hero = box(root, [10, 22, 196, 40], 'var(--c1)', { borderRadius: '3px' })
  box(hero, [10, 10, 90, 5], 'var(--c3)', { borderRadius: '2px' })
  box(hero, [10, 19, 64, 3], 'var(--c2)', { borderRadius: '2px', opacity: '0.7' })
  const anchor = box(hero, [10, 27, 30, 8], 'var(--c3)', { borderRadius: '4px' })

  const cards = [0, 1, 2].map((i) => {
    const card = box(root, [10 + i * 68, 70, 60, 46], 'transparent')
    box(card, [0, 0, 60, 26], 'var(--c5)', { borderRadius: '2px' })
    box(card, [0, 31, 48, 3], 'var(--c3)', { borderRadius: '2px' })
    box(card, [0, 37, 36, 3], 'var(--c2)', { borderRadius: '2px', opacity: '0.6' })
    return card
  })
  return {
    root,
    parts: [header, hero, ...cards],
    hero,
    anchor,
    anchorPoint: [35, 53],
    shade: shade(root),
    card: { x: 78, y: 70, w: 60, h: 46 },
    thumb: cards[0]!.firstElementChild as HTMLElement,
  }
}

// 文章頁：深色背景、返回按鈕、大圖與內文
function article(parent: HTMLElement): Page {
  const root = pageRoot(parent, 'var(--c3)')
  const header = box(root, [0, 0, W, 16], 'transparent')
  const anchor = box(header, [5, 3, 10, 10], 'transparent')
  box(anchor, [3.5, 2.5, 5, 5], 'transparent', { borderLeft: '1.5px solid var(--c4)', borderBottom: '1.5px solid var(--c4)', transform: 'rotate(45deg)' })
  ;[170, 190].forEach((x) => box(header, [x, 6.5, 14, 3], 'var(--c4)', { borderRadius: '2px', opacity: '0.5' }))

  const hero = box(root, [10, 22, 196, 52], 'var(--c5)', { borderRadius: '3px', overflow: 'hidden' })
  const detail = box(hero, [150, 10, 16, 16], 'var(--c1)', { borderRadius: '50%' })
  box(hero, [-20, 30, 140, 40], 'var(--c2)', { clipPath: 'polygon(0 100%, 45% 10%, 100% 100%)' })
  box(hero, [70, 34, 160, 40], 'var(--c3)', { clipPath: 'polygon(0 100%, 55% 20%, 100% 100%)', opacity: '0.8' })

  const title = box(root, [10, 82, 120, 6], 'var(--c4)', { borderRadius: '2px' })
  const lines = [196, 184, 190, 110].map((w, i) => box(root, [10, 93 + i * 6, w, 3], 'var(--c4)', { borderRadius: '2px', opacity: '0.45' }))
  return { root, parts: [header, hero, title, ...lines], hero, anchor, anchorPoint: [10, 8], shade: shade(root), detail }
}

const PAGE_BUILDERS = { home, article }

// 瀏覽器視窗外框：標籤列（三個圓點與網址列）與內容區
function browser(stage: HTMLElement) {
  const frame = box(stage, [8, 8, W, H + 14], 'var(--c2)', { borderRadius: '6px', overflow: 'hidden' })
  const bar = box(frame, [0, 0, W, 14], 'var(--c1)')
  ;[0, 1, 2].forEach((i) => box(bar, [7 + i * 7, 5, 4, 4], 'var(--c5)', { borderRadius: '50%' }))
  box(bar, [63, 4, 90, 6], 'var(--c4)', { borderRadius: '3px' })
  return box(frame, [0, 14, W, H], 'var(--c2)', { overflow: 'hidden' })
}

/**
 * 頁面轉場模組：建立兩個頁面，依 spec 在兩段轉場時間（前進、返回）中產生各元素的 keyframe，
 * 合併成一整個循環的 Web Animation；轉場以外的時間停在該段的起點或終點。
 */
export function pageTransition(create: (ctx: TransitionContext) => TransitionSpec): MotionModule {
  return domScene((stage, params, group) => {
    const viewport = browser(stage)
    const pages: [Page, Page] = [home(viewport), article(viewport)]
    const ease = cssEasing(params)
    const ctx: TransitionContext = {
      viewport,
      pages,
      params,
      amp: params.amplitude,
      ease,
      spring: cssEasing(params, true),
      layer: (style = {}) => box(viewport, [0, 0, W, H], 'transparent', { zIndex: '5', pointerEvents: 'none', ...style }),
      build: PAGE_BUILDERS,
    }
    const spec = create(ctx)

    const segments = new Map<Element, { from: number; to: number; frames: Keyframe[] }[]>()
    const add = (target: Element, from: number, to: number, frames: Keyframe[]) => {
      const list = segments.get(target) ?? []
      list.push({ from, to, frames })
      segments.set(target, list)
    }

    WINDOWS.forEach(([from, to], i) => {
      const leaving = pages[i]!
      const entering = pages[1 - i]!
      const { tracks, below = false } = spec.phase({ leaving, entering, forward: i === 0 })
      // 頁面的上下順序跟著每段轉場切換
      const depth = new Map<Element, number>([
        [leaving.root, below ? 2 : 1],
        [entering.root, below ? 1 : 2],
      ])
      for (const root of depth.keys()) {
        if (!tracks.some((track) => track.el === root)) tracks.push({ el: root, frames: [k(0, {}), k(1, {})] })
      }
      for (const track of tracks) {
        const z = depth.get(track.el)
        add(track.el, from, to, z === undefined ? track.frames : track.frames.map((frame) => ({ ...frame, zIndex: z })))
      }
    })

    // 首頁的根元素放在第一個，診斷資訊取自它
    const ordered = [...segments.keys()].sort((a, b) => Number(b === pages[0].root) - Number(a === pages[0].root))
    for (const target of ordered) {
      const list = segments.get(target)!.sort((a, b) => a.from - b.from)
      const props = new Set(list.flatMap((s) => s.frames.flatMap((f) => Object.keys(f))))
      ;['offset', 'easing', 'composite'].forEach((key) => props.delete(key))
      const fill = (frame: Keyframe): Keyframe => {
        const out: Keyframe = {}
        for (const prop of props) {
          const value = frame[prop] ?? NEUTRAL[prop]
          if (value !== undefined) out[prop] = value
        }
        return out
      }

      // 循環首尾相接：起點等於最後一段轉場的終點
      let rest = fill(list.at(-1)!.frames.at(-1)!)
      const frames: Keyframe[] = [{ ...rest, offset: 0, easing: 'linear' }]
      for (const { from, to, frames: local } of list) {
        frames.push({ ...rest, offset: from, easing: 'linear' })
        local.forEach((frame, j) => {
          const last = j === local.length - 1
          frames.push({ ...fill(frame), offset: from + (frame.offset as number) * (to - from), easing: last ? 'linear' : (frame.easing ?? ease) })
        })
        rest = fill(local.at(-1)!)
      }
      frames.push({ ...rest, offset: 1, easing: 'linear' })
      group.add(target.animate(frames, timing(params)))
    }
  })
}
