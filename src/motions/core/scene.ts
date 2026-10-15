import { timing, waapiGroup } from './controllers'
import { createDomStage, el } from './dom'
import type { MotionContext, MotionInstance, MotionModule, MotionParams } from './types'

type Group = ReturnType<typeof waapiGroup>

/**
 * 2D 動畫模組：在設計尺寸的舞台上以 DOM / SVG 建立物件並用 Web Animations API 播放。
 * 參數改變時重建並保留播放位置。
 */
export function domScene(build: (stage: HTMLElement, params: MotionParams, group: Group) => void): MotionModule {
  return {
    create(context: MotionContext): MotionInstance {
      const { stage, resize, dispose } = createDomStage(context)
      const group = waapiGroup()
      let params = context.params
      const rebuild = () => {
        group.clear()
        stage.replaceChildren()
        build(stage, params, group)
      }
      rebuild()
      return {
        play: () => group.play(),
        pause: () => group.pause(),
        reset: () => group.reset(),
        resize,
        update(next) {
          params = next
          const time = group.animations[0]?.currentTime ?? null
          rebuild()
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

export type ShapeKind = 'circle' | 'square' | 'rect' | 'triangle' | 'hexagon' | 'ring'

// 基本幾何物件，以 (x, y) 為中心放在舞台上
export function shape(
  parent: HTMLElement,
  kind: ShapeKind,
  options: { x: number; y: number; w: number; h?: number; color?: string; origin?: string },
) {
  const { x, y, w, h = w, color = 'var(--c3)', origin = '50% 50%' } = options
  const element = el('div', {
    position: 'absolute',
    left: `${x - w / 2}px`,
    top: `${y - h / 2}px`,
    width: `${w}px`,
    height: `${h}px`,
    transformOrigin: origin,
  }, parent)
  if (kind === 'ring') {
    Object.assign(element.style, { border: `2px solid ${color}`, borderRadius: '50%', boxSizing: 'border-box' })
  } else {
    element.style.background = color
  }
  if (kind === 'circle') element.style.borderRadius = '50%'
  if (kind === 'square' || kind === 'rect') element.style.borderRadius = '3px'
  if (kind === 'triangle') element.style.clipPath = 'polygon(50% 0, 100% 100%, 0 100%)'
  if (kind === 'hexagon') element.style.clipPath = 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0 50%)'
  return element
}

export const ground = (parent: HTMLElement, y: number, from = 20, to = 130) =>
  el('div', { position: 'absolute', left: `${from}px`, width: `${to - from}px`, top: `${y}px`, height: '2px', background: 'var(--c5)' }, parent)

export { timing }
