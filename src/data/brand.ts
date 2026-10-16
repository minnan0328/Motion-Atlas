import { DEFAULT_COLORS } from './motion'

/**
 * Motion Atlas 品牌識別（CIS）：理念、標誌構成、色彩、字體與動態規範的單一來源。
 * 標誌元件（site-logo.vue）與品牌頁（/brand）都從這裡讀取，避免各處各自定義。
 */

// 理念識別（MI）
export const BRAND = {
  name: 'Motion Atlas',
  nameZh: '動態圖鑑',
  mission: '以動畫十二法則為座標，為網頁上的動態繪製一份可探索、可調整的地圖。',
  keywords: [
    { name: '精準', en: 'Precision', description: '每個動態都以時間、緩動與物理參數描述，數值可被檢視與重現。' },
    { name: '律動', en: 'Rhythm', description: '動作有預備、有跟隨、有節奏，循環時自然銜接。' },
    { name: '溫度', en: 'Warmth', description: '以砂岩、象牙等大地色系與柔和的光影，讓技術展示保有人味。' },
  ],
}

// 標誌構成：以 32 單位的方格繪製，所有尺寸皆為單位數
export const LOGO_GRID = {
  size: 32,
  center: 16,
  // 地球（Atlas）
  globe: 9,
  // 赤道的短半徑：地球半徑的 0.3 倍
  equator: 2.7,
  // 軌道（Motion）：長半徑為地球的 1.5 倍、短半徑為 0.5 倍，傾斜 -18 度
  orbit: { rx: 13.5, ry: 4.5, tilt: -18 },
  // 小星：前方 2、後方 1.5，以大小差表現深度
  star: { front: 2, back: 1.5 },
  stroke: { rim: 1.5, line: 0.9, orbit: 0.8 },
  // 淨空區：小星直徑（4 單位）
  clearSpace: 4,
}

// 最小使用尺寸（px）
export const LOGO_MIN_SIZE = { symbol: 16, horizontal: 96 }

// 品牌色票：沿用動畫預設色票（DEFAULT_COLORS），每個顏色有固定的名稱與用途
const [sandstone, graphite, ink, ivory, clay] = DEFAULT_COLORS as [string, string, string, string, string]
export const BRAND_COLORS = [
  { id: 'ink', name: '墨青', en: 'Ink Teal', hex: ink, role: '主色：標誌輪廓、文字、正向版的小星' },
  { id: 'sandstone', name: '砂岩', en: 'Sandstone', hex: sandstone, role: '強調色：反白版的小星、互動狀態' },
  { id: 'ivory', name: '象牙', en: 'Ivory', hex: ivory, role: '基底色：地球底色、淺色背景' },
  { id: 'graphite', name: '石墨', en: 'Graphite', hex: graphite, role: '輔助色：經線、赤道與次要文字' },
  { id: 'clay', name: '陶土', en: 'Clay', hex: clay, role: '點綴色：軌道、深色模式的次要文字' },
]

// 字體：系統字體優先，中文使用蘋方或思源黑體；標準字以字重對比表現「動態（Motion）」與「圖鑑（Atlas）」
export const BRAND_TYPE = {
  family: "system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', sans-serif",
  wordmark: { motion: 700, atlas: 400, tracking: '-0.01em' },
}

// 動態規範：品牌緩動、互動彈簧與標誌的節奏（經線 3 秒、軌道 3.6 秒，5 : 6 的錯落節奏）
export const BRAND_MOTION = {
  ease: { name: 'Atlas Ease', value: [0.45, 0, 0.55, 1] as const, use: '主要動作的加減速、標誌的經線與軌道' },
  spring: { name: 'Atlas Spring', value: [0.34, 1.56, 0.64, 1] as const, use: '按鈕、標誌等互動回饋（CSS 變數 --spring）' },
  meridian: 3,
  orbit: 3.6,
}
