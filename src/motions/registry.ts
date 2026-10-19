import { architectureMotions } from './architecture'
import { basicMotions } from './basic'
import type { Category, MotionMeta } from './core/types'
import { transitionMotions } from './transition'
import { typographyMotions } from './typography'

// 所有動畫的註冊表：首頁、搜尋、篩選與路由都由這份 Metadata 產生
export const CATEGORIES: { id: Category; name: string; nameEn: string; description: string }[] = [
  { id: 'basic', name: '基礎動態', nameEn: 'Basic Motion', description: '以圓形、方形、三角形、線條與環形等基本物件建立的動態。' },
  { id: 'typography', name: '文字動態', nameEn: 'Typography Motion', description: '100 種具有實質差異的文字動畫，涵蓋十種分類。' },
  { id: 'transition', name: '轉場動態', nameEn: 'Transition Motion', description: '網頁版型的換頁轉場：同時呈現離開與進入的頁面，分為佔滿、遮罩、移動三類。' },
  { id: 'architecture', name: '建築動態', nameEn: 'Architectural Motion', description: '即時 3D 建築與城市動態。' },
]

export const MOTIONS: MotionMeta[] = [...basicMotions, ...typographyMotions, ...transitionMotions, ...architectureMotions]

const byId = new Map(MOTIONS.map((motion) => [motion.id, motion]))
if (byId.size !== MOTIONS.length) throw new Error('動畫 ID 重複')

export const findMotion = (id: string) => byId.get(id)
export const categoryName = (id: Category) => CATEGORIES.find((category) => category.id === id)!.name

// 篩選選項：由 Metadata 收集
export const TECHNIQUES = [...new Set(MOTIONS.map((motion) => motion.technique))]
export const TAGS = [...new Set(MOTIONS.flatMap((motion) => motion.tags))]
