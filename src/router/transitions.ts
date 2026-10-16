import { nextTick, ref } from 'vue'
import type { RouteLocationNormalized, Router } from 'vue-router'
import { findMotion, MOTIONS } from '../motions/registry'

/**
 * 頁面過場：以 View Transitions API 在換頁時保留舊畫面的快照，與新畫面交疊演出。
 * - open / close：作品卡片的預覽與標題，連續變形為詳細頁的預覽與標題（共用元素），返回時反向。
 * - next / prev：詳細頁切換上一件、下一件時，整頁往左或往右滑動。
 * - page：其他頁面之間。
 * 換頁前目前頁面先即時退場（動態區塊縮小淡出），過場只負責共用元素與方向滑動，新頁由 .reveal 依序浮現。
 * 動畫樣式見 src/styles/transitions.scss；不支援 View Transitions 的瀏覽器直接換頁，
 * 新頁面仍以 .reveal 依序浮現；系統要求減少動態時不做過場。
 */

export type TransitionKind = 'open' | 'close' | 'next' | 'prev' | 'page'

// 目前參與共用元素過場的作品 id：卡片以此決定是否掛上 view-transition-name
export const sharedMotion = ref<string | null>(null)

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const supportsViewTransition = () => 'startViewTransition' in document

// 同一分類內的前後關係（含頭尾循環），與詳細頁的上一件、下一件一致
function direction(fromId: string, toId: string): 'next' | 'prev' {
  const category = findMotion(fromId)?.category
  const list = MOTIONS.filter((item) => item.category === category)
  const from = list.findIndex((item) => item.id === fromId)
  const to = list.findIndex((item) => item.id === toId)
  if (from < 0 || to < 0) return 'next'
  return (from + 1) % list.length === to ? 'next' : 'prev'
}

function kindOf(to: RouteLocationNormalized, from: RouteLocationNormalized): TransitionKind {
  if (to.name === 'Motion' && from.name === 'Motion') return direction(String(from.params.id), String(to.params.id))
  if (to.name === 'Motion') return 'open'
  if (from.name === 'Motion') return 'close'
  return 'page'
}

// —— 退場：換頁前在目前的頁面上即時演出 ——
// 動態區塊（[data-leave="shrink"]：首頁卡片、詳細頁的預覽與面板）依序縮小淡出，其餘依序浮現的文字（.reveal）快速淡出；
// 只處理畫面內可見的元素，共用元素（被點選的卡片、返回時的詳細頁預覽）保留給過場變形。
// 以 CSS 類別與 --leave 順序驅動（樣式見 transitions.scss），不持有動畫物件，避免留住舊頁元素與其中的 3D 場景
const LEAVE = { duration: 220, stagger: 15, maxStagger: 6 }

function leave(kind: TransitionKind, sharedId: string | null) {
  const content = document.querySelector<HTMLElement>('.app__content')
  if (!content) return { done: Promise.resolve(), restore: () => undefined }
  const visible = (el: Element) => {
    const rect = el.getBoundingClientRect()
    return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0
  }
  const shared = (el: Element) =>
    (kind === 'open' && sharedId !== null && el.querySelector(`[data-motion-id="${sharedId}"]`) !== null) ||
    (kind === 'close' && el.classList.contains('motion__stage'))

  const blocks = [...content.querySelectorAll<HTMLElement>('[data-leave="shrink"]')].filter((el) => visible(el) && !shared(el))
  const texts = [...content.querySelectorAll<HTMLElement>('.reveal')].filter(
    (el) => visible(el) && !el.matches('[data-leave]') && !el.closest('[data-leave="shrink"]'),
  )
  const marked = [...blocks.map((el) => [el, 'shrink'] as const), ...texts.map((el) => [el, 'fade'] as const)]
  const order = { shrink: 0, fade: 0 }
  for (const [el, type] of marked) {
    el.dataset.leaving = type
    el.style.setProperty('--leave', String(Math.min(order[type]++, LEAVE.maxStagger)))
  }
  content.classList.add('is-leaving')

  const longest = LEAVE.duration + LEAVE.maxStagger * LEAVE.stagger
  return {
    done: new Promise<void>((resolve) => window.setTimeout(resolve, marked.length ? longest : 0)),
    // 新頁渲染後移除標記（同一元件內換頁時元素會被沿用）
    restore() {
      content.classList.remove('is-leaving')
      for (const [el] of marked) {
        delete el.dataset.leaving
        el.style.removeProperty('--leave')
      }
    },
  }
}

export function installTransitions(router: Router) {
  let finish: (() => void) | null = null
  let restore: (() => void) | null = null

  router.beforeResolve(async (to, from) => {
    // 首次載入交給進場動畫；只改變篩選條件（query）時不換頁
    if (!from.matched.length || to.path === from.path || prefersReducedMotion()) return

    const kind = kindOf(to, from)
    const sharedId = kind === 'open' ? String(to.params.id) : kind === 'close' ? String(from.params.id) : null

    // 退場：目前的頁面先縮小淡出，等動畫結束再換頁
    const leaving = leave(kind, sharedId)
    restore = leaving.restore
    await leaving.done
    if (!supportsViewTransition()) return

    // 過場：共用元素變形；整頁不再交叉淡化（舊頁已退場），新頁由各區塊的進場動畫浮現
    sharedMotion.value = sharedId
    document.documentElement.dataset.transition = kind
    // 等卡片掛上共用元素名稱後，再擷取舊畫面
    await nextTick()

    await new Promise<void>((resolve) => {
      const transition = document.startViewTransition(
        () =>
          new Promise<void>((done) => {
            finish = done
            resolve()
          }),
      )
      transition.finished.finally(() => {
        delete document.documentElement.dataset.transition
        sharedMotion.value = null
      })
    })
  })

  // 新頁面渲染完成後移除退場標記，再讓瀏覽器擷取新畫面（導航失敗或取消時同樣結束）
  router.afterEach(async () => {
    await nextTick()
    restore?.()
    restore = null
    finish?.()
    finish = null
  })
}

/**
 * 首次進場：Header 由上方滑入、標誌的軌道描繪出來、內容依序浮現；結束後移除標記，之後的換頁由過場負責。
 */
export function playIntro() {
  if (prefersReducedMotion()) return
  const root = document.documentElement
  root.classList.add('is-intro')
  window.setTimeout(() => root.classList.remove('is-intro'), 1800)
}
