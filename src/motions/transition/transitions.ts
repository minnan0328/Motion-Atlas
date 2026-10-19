import { el, svg } from '../core/dom'
import { H, hideAt, k, pageTransition, showAt, W, type Track } from './engine'

// 20 種網頁轉場：佔滿（色幕蓋住整個畫面後換頁）、遮罩（以 clip-path / mask 露出新頁）、移動（頁面本身位移、縮放、旋轉）
// 每件都包含前進（首頁 → 文章頁）與返回（文章頁 → 首頁）兩段，同時呈現離開與進入的頁面

const px = (value: number) => `${value}px`
const translateX = (value: number) => `translateX(${px(value)})`
const translateY = (value: number) => `translateY(${px(value)})`

// ─── 佔滿 ───────────────────────────────────────────────

// 色幕掃過：單一色幕從一側滑入蓋滿畫面，停頓後往另一側離開；返回時方向相反
export const coverWipe = pageTransition((ctx) => {
  const panel = ctx.layer({ background: 'var(--c5)' })
  return {
    phase: ({ entering, forward }) => {
      const s = forward ? 1 : -1
      return {
        tracks: [
          {
            el: panel,
            frames: [
              k(0, { transform: translateX(-W * s) }),
              k(0.45, { transform: translateX(0) }),
              k(0.55, { transform: translateX(0) }),
              k(1, { transform: translateX(W * s) }),
            ],
          },
          { el: entering.root, frames: showAt(0.5) },
        ],
      }
    },
  }
})

// 多層色幕：三層色幕依序升起，蓋滿後由最上層開始離開，逐層露出新頁
export const coverLayers = pageTransition((ctx) => {
  const panels = ['var(--c1)', 'var(--c5)', 'var(--c2)'].map((background) => ctx.layer({ background }))
  return {
    phase: ({ entering, forward }) => {
      const s = forward ? 1 : -1
      const tracks: Track[] = panels.map((panel, i) => {
        const enter = i * 0.07
        const exit = 0.5 + (panels.length - 1 - i) * 0.07
        return {
          el: panel,
          frames: [
            k(0, { transform: translateY(H * s) }),
            k(enter, { transform: translateY(H * s) }),
            k(enter + 0.3, { transform: translateY(0) }),
            k(exit, { transform: translateY(0) }),
            k(exit + 0.3, { transform: translateY(-H * s) }),
            k(1, { transform: translateY(-H * s) }),
          ],
        }
      })
      tracks.push({ el: entering.root, frames: showAt(0.47) })
      return { tracks }
    },
  }
})

// 百葉色條：六條水平色條由一側依序伸長蓋滿，換頁後從另一側依序收回
export const coverShutter = pageTransition((ctx) => {
  const count = 6
  const layer = ctx.layer()
  const bars = Array.from({ length: count }, (_, i) =>
    el('div', { position: 'absolute', left: '0', top: px((i * H) / count), width: px(W), height: px(H / count + 0.5), background: 'var(--c2)' }, layer),
  )
  return {
    phase: ({ entering, forward }) => {
      const [grow, shrink] = forward ? ['0% 50%', '100% 50%'] : ['100% 50%', '0% 50%']
      const tracks: Track[] = bars.map((bar, i) => {
        const enter = i * 0.04
        const exit = 0.5 + i * 0.04
        const closed = { transform: 'scaleX(0)' }
        const open = { transform: 'scaleX(1)' }
        return {
          el: bar,
          frames: [
            k(0, { ...closed, transformOrigin: grow }),
            k(enter, { ...closed, transformOrigin: grow }),
            k(enter + 0.25, { ...open, transformOrigin: grow }),
            k(enter + 0.25, { ...open, transformOrigin: shrink }),
            k(exit, { ...open, transformOrigin: shrink }),
            k(exit + 0.3, { ...closed, transformOrigin: shrink }),
            k(1, { ...closed, transformOrigin: shrink }),
          ],
        }
      })
      tracks.push({ el: entering.root, frames: showAt(0.47) })
      return { tracks }
    },
  }
})

// 方格翻覆：6 × 4 的方格沿對角線依序旋轉放大蓋滿，再依同樣順序旋轉縮小
export const coverTiles = pageTransition((ctx) => {
  const cols = 6
  const rows = 4
  const layer = ctx.layer()
  const tiles = Array.from({ length: cols * rows }, (_, i) => {
    const c = i % cols
    const r = Math.floor(i / cols)
    const tile = el('div', {
      position: 'absolute',
      left: px((c * W) / cols),
      top: px((r * H) / rows),
      width: px(W / cols + 1),
      height: px(H / rows + 1),
      background: 'var(--c1)',
    }, layer)
    return { tile, d: (c + r) / (cols + rows - 2) }
  })
  return {
    phase: ({ entering, forward }) => {
      const tracks: Track[] = tiles.map(({ tile, d }) => {
        const order = forward ? d : 1 - d
        const enter = order * 0.18
        const exit = 0.5 + order * 0.18
        return {
          el: tile,
          frames: [
            k(0, { transform: 'scale(0) rotate(-90deg)' }),
            k(enter, { transform: 'scale(0) rotate(-90deg)' }),
            k(enter + 0.24, { transform: 'scale(1) rotate(0deg)' }),
            k(exit, { transform: 'scale(1) rotate(0deg)' }),
            k(exit + 0.24, { transform: 'scale(0) rotate(90deg)' }),
            k(1, { transform: 'scale(0) rotate(90deg)' }),
          ],
        }
      })
      tracks.push({ el: entering.root, frames: showAt(0.46) })
      return { tracks }
    },
  }
})

// 色彩淡轉：舊頁微微後退並淡入純色，換頁後新頁從略大的尺寸淡出色彩、回到原位
export const coverFade = pageTransition((ctx) => {
  const veil = ctx.layer({ background: 'var(--c2)' })
  return {
    phase: ({ leaving, entering }) => ({
      tracks: [
        { el: veil, frames: [k(0, { opacity: 0 }), k(0.42, { opacity: 1 }), k(0.58, { opacity: 1 }), k(1, { opacity: 0 })] },
        { el: leaving.root, frames: [k(0, { transform: 'scale(1)' }), k(0.42, { transform: 'scale(0.97)' }), k(1, { transform: 'scale(0.97)' })] },
        {
          el: entering.root,
          frames: [
            k(0, { opacity: 0, transform: 'scale(1.03)' }),
            k(0.5, { opacity: 0, transform: 'scale(1.03)' }),
            k(0.5, { opacity: 1, transform: 'scale(1.03)' }),
            k(1, { opacity: 1, transform: 'scale(1)' }),
          ],
        },
      ],
    }),
  }
})

// 曲線波幕：色幕升起時前緣中央鼓起、停下時攤平；離開時後緣中央落後，形成跟隨動作
export const coverWave = pageTransition((ctx) => {
  const crest = 24
  const panel = ctx.layer({ background: 'var(--c5)', overflow: 'visible' })
  const edge = (top: boolean) => {
    const element = svg('svg', { width: W, height: crest, viewBox: `0 0 ${W} ${crest}`, preserveAspectRatio: 'none' }, panel)
    Object.assign(element.style, {
      position: 'absolute',
      left: '0',
      top: px(top ? -crest + 0.5 : H - 0.5),
      overflow: 'visible',
      transformOrigin: top ? '50% 100%' : '50% 0%',
    })
    svg('path', { d: top ? `M0 ${crest} Q${W / 2} ${-crest} ${W} ${crest} Z` : `M0 0 Q${W / 2} ${crest * 2} ${W} 0 Z`, fill: 'var(--c5)' }, element)
    return element
  }
  const top = edge(true)
  const bottom = edge(false)
  const a = ctx.amp
  const bulge = (value: number) => `scaleY(${value * a})`
  return {
    phase: ({ entering, forward }) => {
      // 前進時由下往上，返回時由上往下；前緣在移動中鼓起，後緣在離開時落後
      const s = forward ? 1 : -1
      const [lead, trail] = forward ? [top, bottom] : [bottom, top]
      const away = H + crest
      return {
        tracks: [
          {
            el: panel,
            frames: [
              k(0, { transform: translateY(away * s) }),
              k(0.45, { transform: translateY(0) }),
              k(0.55, { transform: translateY(0) }),
              k(1, { transform: translateY(-away * s) }),
            ],
          },
          {
            el: lead,
            frames: [
              k(0, { transform: bulge(0.5), easing: 'ease-out' }),
              k(0.2, { transform: bulge(1), easing: 'ease-in-out' }),
              k(0.45, { transform: bulge(0) }),
              k(0.55, { transform: bulge(0), easing: 'ease-in' }),
              k(0.8, { transform: bulge(0.7) }),
              k(1, { transform: bulge(0.5) }),
            ],
          },
          {
            el: trail,
            frames: [
              k(0, { transform: bulge(0) }),
              k(0.55, { transform: bulge(0), easing: 'ease-in' }),
              k(0.78, { transform: bulge(1), easing: 'ease-out' }),
              k(1, { transform: bulge(0.6) }),
            ],
          },
          { el: entering.root, frames: showAt(0.5) },
        ],
      }
    },
  }
})

// 載入幕：色幕升起後顯示旋轉的載入環與不等速前進的進度條，載入完成才離開並露出新頁
export const coverLoader = pageTransition((ctx) => {
  const panel = ctx.layer({ background: 'var(--c2)' })
  const ring = el('div', {
    position: 'absolute',
    left: px(W / 2 - 8),
    top: px(42),
    width: '16px',
    height: '16px',
    boxSizing: 'border-box',
    borderRadius: '50%',
    border: '2px solid var(--c1)',
    borderTopColor: 'transparent',
  }, panel)
  const track = el('div', { position: 'absolute', left: px(W / 2 - 40), top: px(72), width: '80px', height: '3px', borderRadius: '2px', background: 'var(--c3)' }, panel)
  const fill = el('div', { width: '100%', height: '100%', borderRadius: '2px', background: 'var(--c1)' }, track)
  return {
    phase: ({ entering }) => ({
      tracks: [
        {
          el: panel,
          frames: [
            k(0, { transform: translateY(H) }),
            k(0.25, { transform: translateY(0) }),
            k(0.7, { transform: translateY(0) }),
            k(1, { transform: translateY(-H) }),
          ],
        },
        { el: ring, frames: [k(0, { transform: 'rotate(0deg)', easing: 'linear' }), k(1, { transform: 'rotate(900deg)' })] },
        {
          el: fill,
          frames: [
            k(0, { transform: 'scaleX(0)', transformOrigin: '0% 50%' }),
            k(0.28, { transform: 'scaleX(0)', transformOrigin: '0% 50%', easing: 'ease-out' }),
            k(0.38, { transform: 'scaleX(0.4)', transformOrigin: '0% 50%', easing: 'ease-in-out' }),
            k(0.48, { transform: 'scaleX(0.48)', transformOrigin: '0% 50%', easing: 'ease-in' }),
            k(0.64, { transform: 'scaleX(1)', transformOrigin: '0% 50%' }),
            k(1, { transform: 'scaleX(1)', transformOrigin: '0% 50%' }),
          ],
        },
        { el: entering.root, frames: showAt(0.66) },
      ],
    }),
  }
})

// ─── 遮罩 ───────────────────────────────────────────────

// 圓形展開：按下按鈕（先壓縮再回彈），新頁以按鈕為圓心展開，舊頁微微後退
export const maskCircle = pageTransition(() => ({
  phase: ({ leaving, entering }) => {
    const [x, y] = leaving.anchorPoint
    const radius = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 2
    const circle = (r: number) => `circle(${px(r)} at ${px(x)} ${px(y)})`
    return {
      tracks: [
        {
          el: leaving.anchor,
          frames: [
            k(0, { transform: 'scale(1)', easing: 'ease-out' }),
            k(0.1, { transform: 'scale(0.84)', easing: 'ease-in-out' }),
            k(0.22, { transform: 'scale(1.06)', easing: 'ease-out' }),
            k(0.32, { transform: 'scale(1)' }),
            k(1, { transform: 'scale(1)' }),
          ],
        },
        { el: leaving.root, frames: [k(0, { transform: 'scale(1)' }), k(0.16, { transform: 'scale(1)' }), k(1, { transform: 'scale(0.96)' })] },
        { el: entering.root, frames: [k(0, { clipPath: circle(0) }), k(0.16, { clipPath: circle(0) }), k(1, { clipPath: circle(radius) })] },
      ],
    }
  },
}))

// 斜角擦除：新頁以傾斜的邊緣擦入，舊頁往反方向退後並變暗（視差）；返回時由另一側擦入
export const maskDiagonal = pageTransition((ctx) => {
  const slant = 56 * ctx.amp
  return {
    phase: ({ leaving, entering, forward }) => {
      // p 為前緣在頂端的位置，從 0 移到 W + slant
      const shape = (p: number) =>
        forward
          ? `polygon(${px(-slant)} 0px, ${px(p)} 0px, ${px(p - slant)} ${px(H)}, ${px(-slant)} ${px(H)})`
          : `polygon(${px(W + slant)} 0px, ${px(W - p)} 0px, ${px(W - p + slant)} ${px(H)}, ${px(W + slant)} ${px(H)})`
      const s = forward ? 1 : -1
      return {
        tracks: [
          { el: entering.root, frames: [k(0, { clipPath: shape(0) }), k(1, { clipPath: shape(W + slant) })] },
          {
            el: leaving.root,
            frames: [
              k(0, { transform: translateX(0), filter: 'brightness(1)' }),
              k(1, { transform: translateX(-40 * ctx.amp * s), filter: 'brightness(0.7)' }),
            ],
          },
        ],
      }
    },
  }
})

// 柔邊漸層：以 mask-image 的漸層移動露出新頁，邊緣羽化；舊頁同時微微放大
export const maskFeather = pageTransition((ctx) => {
  // 羽化寬度隨幅度改變（遮罩圖寬度為畫面的 3 倍）
  const soft = 8 * ctx.amp
  const [home, article] = ctx.pages
  // 文章頁於前進時由左往右露出，首頁於返回時由右往左露出；可見時的 mask-position 不同
  const visible = new Map([
    [article.root, '0% 0%'],
    [home.root, '100% 0%'],
  ])
  const hidden = new Map([
    [article.root, '100% 0%'],
    [home.root, '0% 0%'],
  ])
  for (const [root, side] of [
    [article.root, 'to right'],
    [home.root, 'to left'],
  ] as const) {
    const image = `linear-gradient(${side}, #000 ${50 - soft}%, transparent ${50 + soft}%)`
    root.style.setProperty('mask-image', image)
    root.style.setProperty('-webkit-mask-image', image)
    root.style.setProperty('mask-size', '300% 100%')
    root.style.setProperty('-webkit-mask-size', '300% 100%')
    root.style.setProperty('mask-repeat', 'no-repeat')
    root.style.setProperty('-webkit-mask-repeat', 'no-repeat')
  }
  return {
    phase: ({ leaving, entering }) => ({
      tracks: [
        {
          el: entering.root,
          frames: [k(0, { maskPosition: hidden.get(entering.root)! }), k(1, { maskPosition: visible.get(entering.root)! })],
        },
        {
          el: leaving.root,
          frames: [
            k(0, { maskPosition: visible.get(leaving.root)!, transform: 'scale(1)' }),
            k(1, { maskPosition: visible.get(leaving.root)!, transform: 'scale(1.05)' }),
          ],
        },
      ],
    }),
  }
})

// 卡片展開：新頁從被點選卡片的範圍（圓角矩形遮罩）展開到全畫面；返回時收回卡片並淡出
export const maskCard = pageTransition((ctx) => {
  const card = ctx.pages[0].card!
  const cardInset = `inset(${px(card.y)} ${px(W - card.x - card.w)} ${px(H - card.y - card.h)} ${px(card.x)} round 3px)`
  const full = 'inset(0px 0px 0px 0px round 0px)'
  return {
    phase: ({ leaving, entering, forward }) =>
      forward
        ? {
            tracks: [
              {
                el: entering.root,
                frames: [k(0, { clipPath: cardInset, opacity: 0 }), k(0.18, { clipPath: cardInset, opacity: 1 }), k(1, { clipPath: full, opacity: 1 })],
              },
              { el: leaving.root, frames: [k(0, { transform: 'scale(1)' }), k(0.18, { transform: 'scale(1)' }), k(1, { transform: 'scale(0.94)' })] },
              { el: leaving.shade, frames: [k(0, { opacity: 0 }), k(0.18, { opacity: 0 }), k(1, { opacity: 0.4 })] },
            ],
          }
        : {
            below: true,
            tracks: [
              {
                el: leaving.root,
                frames: [k(0, { clipPath: full, opacity: 1 }), k(0.8, { clipPath: cardInset, opacity: 1 }), k(1, { clipPath: cardInset, opacity: 0 })],
              },
              { el: entering.root, frames: [k(0, { transform: 'scale(0.94)' }), k(0.8, { transform: 'scale(1)' }), k(1, { transform: 'scale(1)' })] },
              { el: entering.shade, frames: [k(0, { opacity: 0.4 }), k(0.8, { opacity: 0 }), k(1, { opacity: 0 })] },
            ],
          },
  }
})

// 對開門：舊頁沿中線切成左右兩半（各自以 clip-path 裁切）往兩側滑開，新頁從後方放大浮現
export const maskSplit = pageTransition((ctx) => {
  // 兩個頁面各複製一份左半與右半，放在最上層
  const doors = ctx.pages.map((_, i) => {
    const layer = ctx.layer()
    const builder = i === 0 ? ctx.build.home : ctx.build.article
    return (['left', 'right'] as const).map((side) => {
      const { root } = builder(layer)
      root.style.clipPath = side === 'left' ? `inset(0 ${px(W / 2)} 0 0)` : `inset(0 0 0 ${px(W / 2)})`
      return root
    })
  })
  return {
    phase: ({ leaving, entering, forward }) => {
      const [left, right] = doors[forward ? 0 : 1]!
      const away = W / 2 + 12
      return {
        below: true,
        tracks: [
          { el: leaving.root, frames: [k(0, { opacity: 0 }), k(1, { opacity: 0 })] },
          { el: left!, frames: [k(0, { transform: translateX(0) }), k(1, { transform: translateX(-away) })] },
          { el: right!, frames: [k(0, { transform: translateX(0) }), k(1, { transform: translateX(away) })] },
          { el: entering.root, frames: [k(0, { transform: 'scale(0.9)' }), k(1, { transform: 'scale(1)' })] },
          { el: entering.shade, frames: [k(0, { opacity: 0.5 }), k(1, { opacity: 0 })] },
        ],
      }
    },
  }
})

// 視窗穿越：首頁的主視覺成為窺看新頁的視窗，鏡頭推進直到視窗佔滿畫面；返回時拉遠、視窗縮回後淡出
export const maskPortal = pageTransition(() => {
  // 主視覺範圍與中心；首頁以該中心縮放，新頁的遮罩以同一比例同步放大
  const hero = { x: 10, y: 22, w: 196, h: 40 }
  const cx = hero.x + hero.w / 2
  const cy = hero.y + hero.h / 2
  const zoom = 4.4
  const window = (s: number) => {
    const x1 = cx - (hero.w / 2) * s
    const x2 = cx + (hero.w / 2) * s
    const y1 = cy - (hero.h / 2) * s
    const y2 = cy + (hero.h / 2) * s
    return `polygon(${px(x1)} ${px(y1)}, ${px(x2)} ${px(y1)}, ${px(x2)} ${px(y2)}, ${px(x1)} ${px(y2)})`
  }
  const origin = { transformOrigin: `${px(cx)} ${px(cy)}` }
  return {
    phase: ({ leaving, entering, forward }) =>
      forward
        ? {
            tracks: [
              {
                el: entering.root,
                frames: [k(0, { clipPath: window(1), opacity: 0 }), k(0.2, { clipPath: window(1), opacity: 1 }), k(1, { clipPath: window(zoom), opacity: 1 })],
              },
              {
                el: leaving.root,
                frames: [k(0, { ...origin, transform: 'scale(1)' }), k(0.2, { ...origin, transform: 'scale(1)' }), k(1, { ...origin, transform: `scale(${zoom})` })],
              },
            ],
          }
        : {
            below: true,
            tracks: [
              {
                el: leaving.root,
                frames: [k(0, { clipPath: window(zoom), opacity: 1 }), k(0.8, { clipPath: window(1), opacity: 1 }), k(1, { clipPath: window(1), opacity: 0 })],
              },
              {
                el: entering.root,
                frames: [k(0, { ...origin, transform: `scale(${zoom})` }), k(0.8, { ...origin, transform: 'scale(1)' }), k(1, { ...origin, transform: 'scale(1)' })],
              },
            ],
          },
  }
})

// ─── 移動 ───────────────────────────────────────────────

// 水平推移：新頁從一側推入，舊頁同速被推出；返回時方向相反
export const movePush = pageTransition(() => ({
  phase: ({ leaving, entering, forward }) => {
    const s = forward ? 1 : -1
    return {
      tracks: [
        { el: leaving.root, frames: [k(0, { transform: translateX(0) }), k(1, { transform: translateX(-W * s) })] },
        { el: entering.root, frames: [k(0, { transform: translateX(W * s) }), k(1, { transform: translateX(0) })] },
      ],
    }
  },
}))

// 視差覆蓋：新頁從右側滑入蓋在上方，舊頁只移動約三成距離並變暗；返回時上層頁滑出、下層頁回位
export const moveParallax = pageTransition((ctx) => {
  const lag = -0.3 * W * ctx.amp
  return {
    phase: ({ leaving, entering, forward }) =>
      forward
        ? {
            tracks: [
              { el: entering.root, frames: [k(0, { transform: translateX(W) }), k(1, { transform: translateX(0) })] },
              { el: leaving.root, frames: [k(0, { transform: translateX(0) }), k(1, { transform: translateX(lag) })] },
              { el: leaving.shade, frames: [k(0, { opacity: 0 }), k(1, { opacity: 0.45 })] },
            ],
          }
        : {
            below: true,
            tracks: [
              { el: leaving.root, frames: [k(0, { transform: translateX(0) }), k(1, { transform: translateX(W) })] },
              { el: entering.root, frames: [k(0, { transform: translateX(lag) }), k(1, { transform: translateX(0) })] },
              { el: entering.shade, frames: [k(0, { opacity: 0.45 }), k(1, { opacity: 0 })] },
            ],
          },
  }
})

// 底部面板：新頁以彈簧從底部升起成為圓角面板，舊頁縮小後退成背景卡片；返回時面板落下
export const moveSheet = pageTransition((ctx) => {
  const easing = ctx.spring
  const top = 10
  const card = { transform: 'translateY(5px) scale(0.92)', borderRadius: '6px', transformOrigin: '50% 0%' }
  const flat = { transform: 'translateY(0px) scale(1)', borderRadius: '0px', transformOrigin: '50% 0%' }
  const sheetRadius = '8px 8px 0px 0px'
  return {
    phase: ({ leaving, entering, forward }) =>
      forward
        ? {
            tracks: [
              { el: entering.root, frames: [k(0, { transform: translateY(H), borderRadius: sheetRadius, easing }), k(1, { transform: translateY(top), borderRadius: sheetRadius })] },
              { el: leaving.root, frames: [k(0, { ...flat, easing }), k(1, card)] },
              { el: leaving.shade, frames: [k(0, { opacity: 0, easing }), k(1, { opacity: 0.35 })] },
            ],
          }
        : {
            below: true,
            tracks: [
              { el: leaving.root, frames: [k(0, { transform: translateY(top), borderRadius: sheetRadius, easing }), k(1, { transform: translateY(H), borderRadius: sheetRadius })] },
              { el: entering.root, frames: [k(0, { ...card, easing }), k(1, flat)] },
              { el: entering.shade, frames: [k(0, { opacity: 0.35, easing }), k(1, { opacity: 0 })] },
            ],
          },
  }
})

// 內容交錯：舊頁的區塊由上而下依序上移淡出，新頁背景浮現後，各區塊依序從下方浮現；返回時方向相反
export const moveStagger = pageTransition((ctx) => {
  const d = 14 * ctx.amp
  return {
    phase: ({ leaving, entering, forward }) => {
      const s = forward ? 1 : -1
      const out: Track[] = leaving.parts.map((part, i) => {
        const start = i * 0.04
        return {
          el: part,
          frames: [
            k(0, { transform: translateY(0), opacity: 1 }),
            k(start, { transform: translateY(0), opacity: 1 }),
            k(start + 0.25, { transform: translateY(-d * 0.6 * s), opacity: 0 }),
            k(1, { transform: translateY(-d * 0.6 * s), opacity: 0 }),
          ],
        }
      })
      const into: Track[] = entering.parts.map((part, i) => {
        const start = 0.38 + i * 0.05
        return {
          el: part,
          frames: [
            k(0, { transform: translateY(d * s), opacity: 0 }),
            k(start, { transform: translateY(d * s), opacity: 0 }),
            k(start + 0.3, { transform: translateY(0), opacity: 1 }),
            k(1, { transform: translateY(0), opacity: 1 }),
          ],
        }
      })
      const backdrop = { el: entering.root, frames: [k(0, { opacity: 0 }), k(0.28, { opacity: 0 }), k(0.5, { opacity: 1 }), k(1, { opacity: 1 })] }
      return { tracks: [...out, ...into, backdrop] }
    },
  }
})

// 縮放穿越：前進時舊頁放大淡出、新頁由小放大到位（往前穿過）；返回時舊頁縮小淡出、新頁由大縮回（往後退）
export const moveZoom = pageTransition((ctx) => {
  const z = 0.22 * ctx.amp
  return {
    phase: ({ leaving, entering, forward }) => {
      const [away, from] = forward ? [1 + z, 1 - z * 0.6] : [1 - z * 0.6, 1 + z]
      return {
        tracks: [
          {
            el: leaving.root,
            frames: [k(0, { transform: 'scale(1)', opacity: 1 }), k(0.6, { transform: `scale(${away})`, opacity: 0 }), k(1, { transform: `scale(${away})`, opacity: 0 })],
          },
          {
            el: entering.root,
            frames: [k(0, { transform: `scale(${from})`, opacity: 0 }), k(0.3, { transform: `scale(${from})`, opacity: 0 }), k(1, { transform: 'scale(1)', opacity: 1 })],
          },
        ],
      }
    },
  }
})

// 立方體旋轉：兩頁為立方體相鄰的兩面，以 CSS 3D Transform 繞 Y 軸轉 90 度；轉離正面的一面逐漸變暗
export const moveCube = pageTransition((ctx) => {
  ctx.viewport.style.perspective = '520px'
  for (const page of ctx.pages) page.root.style.backfaceVisibility = 'hidden'
  const face = (angle: number) => `translateZ(${px(-W / 2)}) rotateY(${angle}deg) translateZ(${px(W / 2)})`
  return {
    phase: ({ leaving, entering, forward }) => {
      const s = forward ? 1 : -1
      return {
        tracks: [
          { el: leaving.root, frames: [k(0, { transform: face(0) }), k(1, { transform: face(-90 * s) })] },
          { el: entering.root, frames: [k(0, { transform: face(90 * s) }), k(1, { transform: face(0) })] },
          { el: leaving.shade, frames: [k(0, { opacity: 0 }), k(1, { opacity: 0.55 })] },
          { el: entering.shade, frames: [k(0, { opacity: 0.55 }), k(1, { opacity: 0 })] },
        ],
      }
    },
  }
})

// 共用元素：首頁卡片的縮圖飛到文章頁大圖的位置並放大（FLIP），其餘內容淡出，落地後太陽浮現、內文依序進場；返回時縮回卡片
export const moveShared = pageTransition((ctx) => {
  const [home, article] = ctx.pages
  const from = { x: 10, y: 70, w: 60, h: 26 }
  const to = { x: 10, y: 22, w: 196, h: 52 }
  const flyer = ctx.layer({ left: px(to.x), top: px(to.y), width: px(to.w), height: px(to.h), background: 'var(--c5)', borderRadius: '3px', transformOrigin: '0 0' })
  const small = `translate(${px(from.x - to.x)}, ${px(from.y - to.y)}) scale(${from.w / to.w}, ${from.h / to.h})`
  const large = 'translate(0px, 0px) scale(1, 1)'
  const text = article.parts.slice(2)
  return {
    phase: ({ forward }) =>
      forward
        ? {
            tracks: [
              {
                el: flyer,
                frames: [
                  k(0, { transform: small, opacity: 1 }),
                  k(0.1, { transform: small, opacity: 1 }),
                  k(0.65, { transform: large, opacity: 1 }),
                  k(0.65, { transform: large, opacity: 0 }),
                  k(1, { transform: large, opacity: 0 }),
                ],
              },
              { el: home.root, frames: [k(0, { opacity: 1 }), k(0.05, { opacity: 1 }), k(0.35, { opacity: 0 }), k(1, { opacity: 0 })] },
              { el: article.root, frames: [k(0, { opacity: 0 }), k(0.3, { opacity: 0 }), k(0.55, { opacity: 1 }), k(1, { opacity: 1 })] },
              { el: article.hero, frames: showAt(0.65) },
              {
                el: article.detail!,
                frames: [k(0, { transform: 'scale(0)' }), k(0.65, { transform: 'scale(0)', easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }), k(0.85, { transform: 'scale(1)' }), k(1, { transform: 'scale(1)' })],
              },
              ...text.map((part, i) => {
                const start = 0.55 + i * 0.05
                return {
                  el: part,
                  frames: [
                    k(0, { transform: translateY(8), opacity: 0 }),
                    k(start, { transform: translateY(8), opacity: 0 }),
                    k(start + 0.25, { transform: translateY(0), opacity: 1 }),
                    k(1, { transform: translateY(0), opacity: 1 }),
                  ],
                }
              }),
            ],
          }
        : {
            tracks: [
              {
                el: flyer,
                frames: [
                  k(0, { transform: large, opacity: 0 }),
                  k(0.1, { transform: large, opacity: 0 }),
                  k(0.1, { transform: large, opacity: 1 }),
                  k(0.65, { transform: small, opacity: 1 }),
                  k(0.65, { transform: small, opacity: 0 }),
                  k(1, { transform: small, opacity: 0 }),
                ],
              },
              { el: article.hero, frames: hideAt(0.1) },
              ...text.map((part, i) => {
                const start = i * 0.03
                return {
                  el: part,
                  frames: [
                    k(0, { transform: translateY(0), opacity: 1 }),
                    k(start, { transform: translateY(0), opacity: 1 }),
                    k(start + 0.2, { transform: translateY(-6), opacity: 0 }),
                    k(1, { transform: translateY(-6), opacity: 0 }),
                  ],
                }
              }),
              { el: home.root, frames: [k(0, { opacity: 0 }), k(0.3, { opacity: 0 }), k(0.55, { opacity: 1 }), k(1, { opacity: 1 })] },
              { el: home.thumb!, frames: showAt(0.65) },
            ],
          },
  }
})
