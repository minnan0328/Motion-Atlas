export type Bezier = [number, number, number, number]

// 顏色順序：c1 點綴、c2 次要、c3 主體、c4 背景、c5 地面與陰影
export const DEFAULT_COLORS = ['#cfc1ab', '#6a6b65', '#354449', '#efe9db', '#a89985']

export function toCubicBezier(bezier: Bezier): string {
  return `cubic-bezier(${bezier.join(', ')})`
}
