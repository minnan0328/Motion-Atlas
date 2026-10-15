import type { MotionParams } from './types'

export const BASE_PARAMS: MotionParams = {
  duration: 2.4,
  delay: 0,
  iterations: Infinity,
  direction: 'normal',
  easing: [0.45, 0, 0.55, 1],
  amplitude: 1,
  stiffness: 180,
  damping: 0.35,
  mass: 1,
  text: '',
  autoRotate: false,
}

export const withDefaults = (overrides: Partial<MotionParams> = {}): MotionParams => ({ ...BASE_PARAMS, ...overrides })

export const EASING_PRESETS: { label: string; value: MotionParams['easing'] }[] = [
  { label: 'linear', value: [0, 0, 1, 1] },
  { label: 'ease', value: [0.25, 0.1, 0.25, 1] },
  { label: 'ease-in', value: [0.42, 0, 1, 1] },
  { label: 'ease-out', value: [0, 0, 0.58, 1] },
  { label: 'ease-in-out', value: [0.42, 0, 0.58, 1] },
  { label: 'sine-in-out', value: [0.37, 0, 0.63, 1] },
  { label: 'quad-in-out', value: [0.45, 0, 0.55, 1] },
  { label: 'cubic-in-out', value: [0.65, 0, 0.35, 1] },
  { label: 'expo-in-out', value: [0.76, 0, 0.24, 1] },
  { label: 'quint-out', value: [0.22, 1, 0.36, 1] },
  { label: 'expo-out', value: [0.16, 1, 0.3, 1] },
  { label: 'back-out', value: [0.34, 1.56, 0.64, 1] },
]
