import { toCssEasing, toEase, type EasingSetting } from '../../data/easing'
import type { Ease } from '../../three/timeline'
import type { MotionParams } from './types'

// 由參數取得緩動：useSpring 時以剛性、阻尼比與質量產生彈簧曲線，否則使用 cubic-bezier
export function easingSetting(params: MotionParams, useSpring = false): EasingSetting {
  if (!useSpring) return { type: 'bezier', bezier: params.easing }
  const { stiffness, mass } = params
  // 阻尼比 ζ 轉為阻尼係數 c = 2ζ√(km)
  return { type: 'spring', stiffness, mass, damping: 2 * params.damping * Math.sqrt(stiffness * mass) }
}

export const cssEasing = (params: MotionParams, useSpring = false) => toCssEasing(easingSetting(params, useSpring), 48)
export const jsEasing = (params: MotionParams, useSpring = false): Ease => toEase(easingSetting(params, useSpring))
