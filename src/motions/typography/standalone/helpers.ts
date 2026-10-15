import { rafClock, timing, waapiGroup } from '../../core/controllers'
import type { MotionContext, MotionInstance, MotionModule, MotionParams } from '../../core/types'
import { textStage } from '../text-preset'

type Group = ReturnType<typeof waapiGroup>

/**
 * 以 Web Animations API 實作的獨立文字動畫：build 建立 DOM 與動畫，參數改變時重建並保留播放位置。
 */
export function waapiText(
  size: number,
  build: (stage: HTMLElement, params: MotionParams, group: Group, text: (fallback: string) => string) => void,
): MotionModule {
  return {
    create(context: MotionContext): MotionInstance {
      const { stage, resize, dispose } = textStage(context, size)
      const group = waapiGroup()
      let params = context.params
      const text = (fallback: string) => params.text.trim() || fallback
      const rebuild = () => {
        group.clear()
        stage.replaceChildren()
        build(stage, params, group, text)
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

export interface RafScene {
  // time 為扣除延遲後的秒數，dt 為與上一格的秒數差
  step(time: number, dt: number): void
  rebuild?(): void
}

/**
 * 逐幀計算的獨立文字動畫：用於字元亂數、彈簧鏈、連續波形等無法以固定 keyframes 表達的效果。
 */
export function rafText(
  size: number,
  setup: (stage: HTMLElement, getParams: () => MotionParams, text: (fallback: string) => string) => RafScene,
  note: string,
): MotionModule {
  return {
    create(context: MotionContext): MotionInstance {
      const { stage, resize, dispose } = textStage(context, size)
      let params = context.params
      const getParams = () => params
      const text = (fallback: string) => params.text.trim() || fallback
      const scene = setup(stage, getParams, text)
      const clock = rafClock((time, dt) => scene.step(time, dt), getParams, note)
      return {
        play: () => clock.play(),
        pause: () => clock.pause(),
        reset: () => clock.reset(),
        resize,
        update(next) {
          const rebuild = next.text !== params.text
          params = next
          if (rebuild) scene.rebuild?.()
        },
        diagnostics: () => clock.diagnostics(),
        dispose() {
          clock.dispose()
          dispose()
        },
      }
    },
  }
}

export { timing }
