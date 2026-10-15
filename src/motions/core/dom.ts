import { DEFAULT_COLORS } from '../../data/motion'
import type { MotionContext } from './types'

// 2D 動畫的舞台：以設計尺寸建立，等比縮放置中填入容器，並提供色票變數 --c1 ~ --c5
export function createDomStage(context: MotionContext) {
  const { width, height } = context.preview
  const stage = document.createElement('div')
  stage.className = 'motion-stage'
  Object.assign(stage.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: `${width}px`,
    height: `${height}px`,
    overflow: 'hidden',
    transformOrigin: '50% 50%',
  })
  DEFAULT_COLORS.forEach((color, i) => stage.style.setProperty(`--c${i + 1}`, color))
  context.container.append(stage)

  const resize = (containerWidth: number, containerHeight: number) => {
    const scale = Math.min(containerWidth / width, containerHeight / height)
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`
  }
  resize(context.width, context.height)

  return { stage, resize, dispose: () => stage.remove() }
}

// 建立元素的簡寫
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Partial<CSSStyleDeclaration> = {},
  parent?: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  Object.assign(element.style, style)
  if (text !== undefined) element.textContent = text
  parent?.append(element)
  return element
}

const SVG_NS = 'http://www.w3.org/2000/svg'
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag)
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value))
  parent?.append(element)
  return element
}

export const PALETTE = {
  c1: DEFAULT_COLORS[0]!,
  c2: DEFAULT_COLORS[1]!,
  c3: DEFAULT_COLORS[2]!,
  c4: DEFAULT_COLORS[3]!,
  c5: DEFAULT_COLORS[4]!,
}
