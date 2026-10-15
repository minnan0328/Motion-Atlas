// 動畫十二項原則
export const PRINCIPLES = [
  { id: 'squash-and-stretch', name: '擠壓與伸展', en: 'Squash and Stretch' },
  { id: 'anticipation', name: '預期動作', en: 'Anticipation' },
  { id: 'staging', name: '演出方式', en: 'Staging' },
  { id: 'straight-ahead-and-pose-to-pose', name: '接續動作與關鍵動作', en: 'Straight Ahead and Pose to Pose' },
  { id: 'follow-through-and-overlapping-action', name: '跟隨動作與重疊動作', en: 'Follow Through and Overlapping Action' },
  { id: 'slow-in-and-slow-out', name: '漸快與漸慢', en: 'Slow In and Slow Out' },
  { id: 'arcs', name: '弧形', en: 'Arcs' },
  { id: 'secondary-action', name: '附屬動作', en: 'Secondary Action' },
  { id: 'timing', name: '時間控制', en: 'Timing' },
  { id: 'exaggeration', name: '誇張', en: 'Exaggeration' },
  { id: 'solid-drawing', name: '立體造型', en: 'Solid Drawing' },
  { id: 'appeal', name: '吸引力', en: 'Appeal' },
] as const

export type PrincipleId = (typeof PRINCIPLES)[number]['id']

export const principleName = (id: PrincipleId) => PRINCIPLES.find((p) => p.id === id)!.name
