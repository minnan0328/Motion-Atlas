import type { Component } from 'vue'
import type { Bezier } from '../../data/motion'
import type { PrincipleId } from './principles'

export type Category = 'basic' | 'typography' | 'architecture'

// css：DOM + Web Animations API；svg：DOM/SVG + Web Animations API；webgl：Three.js
export type RenderMode = 'css' | 'svg' | 'webgl'
export type Dimension = '2d' | '3d'

// 詳細頁可顯示的控制項，只列出動畫真正支援的項目
export type ControlKey =
  | 'duration'
  | 'delay'
  | 'repeat'
  | 'direction'
  | 'easing'
  | 'cubicBezier'
  | 'amplitude'
  | 'stiffness'
  | 'damping'
  | 'mass'
  | 'camera'
  | 'text'

// 所有動畫共用的參數；各動畫只讀取自己支援的項目
export interface MotionParams {
  // 單次播放秒數（建築場景為一天的秒數）
  duration: number
  // 開始前的延遲秒數
  delay: number
  // 播放次數，Infinity 為無限循環
  iterations: number
  direction: PlaybackDirection
  easing: Bezier
  // 動作幅度倍率，1 為預設
  amplitude: number
  // 彈簧物理：剛性、阻尼比、質量
  stiffness: number
  damping: number
  mass: number
  // 文字動畫的示範文字，空字串表示使用預設文字
  text: string
  // 3D 場景的自動環繞
  autoRotate: boolean
}

export interface PreviewConfig {
  // 設計時的畫面尺寸（px），預覽時等比縮放填入容器
  width: number
  height: number
}

// 動畫的 Metadata：可序列化的描述資訊，加上延遲載入實作的函式
export interface MotionMeta {
  id: string
  title: string
  titleEn: string
  description: string
  category: Category
  tags: string[]
  renderMode: RenderMode
  dimension: Dimension
  // 主要技術，用於篩選（例如 Web Animations API、Three.js）
  technique: string
  // preset：由共用引擎與參數組成；standalone：獨立模組
  implementation: 'preset' | 'standalone'
  previewConfig: PreviewConfig
  supportedControls: ControlKey[]
  animationPrinciples: PrincipleId[]
  route: string
  defaults: MotionParams
  load: () => Promise<MotionModule>
}

export interface MotionContext {
  // 動畫掛載的容器，尺寸由預覽元件決定
  container: HTMLElement
  width: number
  height: number
  params: MotionParams
  preview: PreviewConfig
  // 詳細頁的主要預覽：啟用鏡頭操作等互動
  interactive: boolean
}

export type PlayState = 'running' | 'paused' | 'finished' | 'idle'

// 診斷資訊：只回報實際可取得的數值，沒有 keyframe 時以 note 說明
export interface MotionDiagnostics {
  playState: PlayState
  // 目前這一輪的進度 0 ~ 1
  progress: number | null
  iteration: number | null
  keyframe: { current: number; total: number } | null
  note?: string
}

// CSS 疊加層（例如 3D 場景的時間標籤），由預覽元件以 Vue 元件呈現
export interface MotionOverlay {
  component: Component
  props: Record<string, unknown>
  // 設計時的寬度，依實際寬度等比縮放
  width: number
  maxScale?: number
}

// 統一的生命週期介面
export interface MotionInstance {
  play(): void
  pause(): void
  reset(): void
  resize(width: number, height: number): void
  update(params: MotionParams): void
  diagnostics(): MotionDiagnostics
  dispose(): void
  overlay?: MotionOverlay
  camera?: { reset(): void; setAutoRotate(enabled: boolean): void }
}

export interface MotionModule {
  create(context: MotionContext): MotionInstance
}
