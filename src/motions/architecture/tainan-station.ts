import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createStage, type Motion } from '../../three/stage'
import { getTextures, projectUV, type TextureSet } from '../../three/textures'
import { keyframes, loop } from '../../three/timeline'
import SceneClock from './scene-clock.vue'
import { celestialDirection, createSky } from './sky'
import { createTrains } from './trains'

// 台南漂浮島：把台南的城市意象收進一座漂浮在雲間的小島。
// 島頂以舊火車站（1936 年落成）為中心，環繞著赤崁樓、林百貨、安平古堡、運河、夜市小吃、芒果園與鳳凰木；
// 島身是分層的土壤剖面與垂著根鬚的岩石底部，運河從島緣傾瀉成瀑布，雲朵、碎石與白鷺鷥環繞小島。
// 24 小時由白天到黑夜、四季輪替，空氣中飄著帶甜味的微光

// 場景色票
const PALETTE = {
  ochre: '#cb914a',
  blue: '#86a0bb',
  navy: '#14233a',
  red: '#b71f24',
  gray: '#c0b8b4',
}
// 由色票延伸的建材色
const WALL = '#ebe6e1'
const TRIM = PALETTE.gray
const ROOF = '#a39b96'
const ROAD = '#8e8985'

const WIDTH = 200
const HEIGHT = 120
// 一天的秒數（1 秒 = 1 小時）
const DAY = 24
// 發車間隔：每個週期所有列車前進四分之一圈，下一列車進站停靠
const TRIP = 12
const START_HOUR = 6

// 小島半徑：島頂為 y = 0 的圓形平台
const R = 13
// 軌道：沿著島嶼最外圍的圓形，u = 0 為島緣後方的月台，列車順時針行駛
const TRACK_R = 12.2
const PLATFORM_DEG = 195
// 平交道：通往島緣觀景台的步道與軌道交會處
const CROSS_DEG = -16
const CAR_SPACING = 1.55
// 每列車三節（機車頭或車頭 + 兩節），四列觀光列車以四分之一圈的間隔同時行駛
const CARS = 3
const TRAIN_GAP = 0.25

// 台南屬熱帶季風氣候：樹木四季常綠，以花期與乾濕季區分季節
// 春：木棉花開（橙紅）；夏：鳳凰花開（紅）、芒果盛產，午後雷陣雨；秋：乾季、草地略黃；冬：東北季風帶來乾燥與薄霧，太陽較低
// rise、set 為日出、日落時刻（小時），noon 為太陽中天高度（度）：取四月、七月、十月、一月中旬的台南（約北緯 23 度）近似值
export const SEASONS = [
  { name: '春', en: 'Spring', lawn: '#a3ad7c', foliage: '#7f9562', blossom: '#d9733f', bloom: 1, petals: 0.8, mango: 0.35, rain: 0, haze: 0, sun: 1, rise: 5.6, set: 18.33, noon: 77 },
  { name: '夏', en: 'Summer', lawn: '#8fa06f', foliage: '#5f7a4c', blossom: PALETTE.red, bloom: 1, petals: 0.6, mango: 1, rain: 1, haze: 0, sun: 1.1, rise: 5.25, set: 18.83, noon: 88 },
  { name: '秋', en: 'Autumn', lawn: '#b3a878', foliage: '#7d8a55', blossom: PALETTE.ochre, bloom: 0, petals: 0.35, mango: 0, rain: 0, haze: 0.2, sun: 0.95, rise: 5.92, set: 17.67, noon: 59 },
  { name: '冬', en: 'Winter', lawn: '#a7a68f', foliage: '#6f7e5f', blossom: PALETTE.gray, bloom: 0, petals: 0.1, mango: 0, rain: 0, haze: 0.55, sun: 0.75, rise: 6.67, set: 17.58, noon: 46 },
]

// 太陽時：把實際時刻換算成「日出 = 6 時、日落 = 18 時」的刻度，天色的停靠點以此取樣，晝長隨季節改變時天色仍與日照同步
function solarHour(hour: number, rise: number, set: number) {
  const day = set - rise
  const t = (((hour - rise) % 24) + 24) % 24
  return t <= day ? 6 + (t / day) * 12 : (18 + ((t - day) / (24 - day)) * 12) % 24
}
const clock = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`

// 依時間（小時）在停靠點之間漸變
type Stops<T> = [number, T][]
function sampleStops<T>(stops: Stops<T>, hour: number, mix: (a: T, b: T, t: number) => T): T {
  for (let i = 1; i < stops.length; i++) {
    const [to, b] = stops[i]!
    if (hour > to) continue
    const [from, a] = stops[i - 1]!
    return mix(a, b, THREE.MathUtils.smoothstep(hour, from, to))
  }
  return stops[stops.length - 1]![1]
}
const hex = (value: string) => new THREE.Color(value)
const mixColor = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, t)
const mixNumber = (a: number, b: number, t: number) => a + (b - a) * t

// 地平線：日出日落時最暖，白天偏白，夜晚為深藍
const HORIZON: Stops<THREE.Color> = [
  [0, hex('#1f2c45')],
  [4.8, hex('#26324c')],
  [5.6, hex('#8a6c74')],
  [6.1, hex('#eaa06a')],
  [7, hex('#f1c79c')],
  [9, hex('#c9d8e6')],
  [15.5, hex('#d2dce4')],
  [17.4, hex('#f0b47c')],
  [18, hex('#e2804e')],
  [18.6, hex('#8c5a63')],
  [19.5, hex('#323552')],
  [21, hex('#1f2c45')],
  [24, hex('#1f2c45')],
]
// 天頂：夜晚深藍、清晨與黃昏赭黃、白天藍灰
const SKY: Stops<THREE.Color> = [
  [0, hex(PALETTE.navy)],
  [4.5, hex(PALETTE.navy)],
  [6, hex('#6d6a73')],
  [7, hex(PALETTE.ochre).lerp(hex(PALETTE.blue), 0.35)],
  [9, hex(PALETTE.blue).lerp(hex('#ffffff'), 0.2)],
  [13, hex(PALETTE.blue).lerp(hex('#ffffff'), 0.28)],
  [16, hex(PALETTE.blue).lerp(hex(PALETTE.ochre), 0.25)],
  [18, hex(PALETTE.ochre)],
  [19.3, hex('#4b3f52')],
  [20.5, hex(PALETTE.navy)],
  [24, hex(PALETTE.navy)],
]
const SUN_COLOR: Stops<THREE.Color> = [
  [0, hex('#9fb2d9')],
  [6, hex('#9fb2d9')],
  [7, hex('#ffc89a')],
  [10, hex('#fff3e2')],
  [15, hex('#fff3e2')],
  [17.5, hex('#ffb07a')],
  [19, hex('#9fb2d9')],
  [24, hex('#9fb2d9')],
]
const AMBIENT: Stops<number> = [
  [0, 0.5],
  [5, 0.55],
  [7.5, 1.45],
  [16, 1.55],
  [19, 0.75],
  [21, 0.5],
  [24, 0.5],
]
// 夜晚程度：0 白天、1 深夜，用於燈光與窗戶
const NIGHT: Stops<number> = [
  [0, 1],
  [5, 1],
  [7, 0],
  [17, 0],
  [19.5, 1],
  [24, 1],
]
// 小吃攤的熱氣：清晨的牛肉湯早餐與傍晚到深夜的夜市最旺
const STEAM: Stops<number> = [
  [0, 0.6],
  [2, 0.15],
  [4.5, 0.15],
  [5.5, 1],
  [9.5, 1],
  [11, 0.3],
  [16, 0.3],
  [18, 1],
  [23, 1],
  [24, 0.6],
]

// 固定亂數，讓城市每次都長得一樣
function random(seed: number) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

// 沿圓周起伏的雜訊；角度只乘整數，接縫處連續
const wobble = (angle: number, seed: number) =>
  Math.sin(angle * 3 + seed) * 0.5 + Math.sin(angle * 7 + seed * 2.3) * 0.3 + Math.sin(angle * 13 + seed * 0.7) * 0.2

// 島上的極座標：角度 0 為正前方（+z），順時針朝 +x
const polar = (deg: number, radius: number) => {
  const angle = THREE.MathUtils.degToRad(deg)
  return [Math.sin(angle) * radius, Math.cos(angle) * radius] as const
}
// 面向島中心的旋轉角（物件正面為 +z）
const facingCenter = (deg: number) => THREE.MathUtils.degToRad(deg) + Math.PI

/**
 * 有拱形開口的牆面：openings 的 x 為中心、y 為底部，開口上緣為半圓。
 * 牆面從 z = 0 往 +z 擠出 depth。
 */
function archedWall(
  width: number,
  height: number,
  depth: number,
  openings: { x: number; y: number; w: number; h: number; round?: boolean }[],
) {
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, 0)
  shape.lineTo(width / 2, 0)
  shape.lineTo(width / 2, height)
  shape.lineTo(-width / 2, height)
  shape.lineTo(-width / 2, 0)
  for (const { x, y, w, h, round = true } of openings) {
    const r = w / 2
    const hole = new THREE.Path()
    hole.moveTo(x - r, y)
    hole.lineTo(x + r, y)
    if (round) {
      hole.lineTo(x + r, y + h - r)
      hole.absarc(x, y + h - r, r, 0, Math.PI, false)
    } else {
      hole.lineTo(x + r, y + h)
      hole.lineTo(x - r, y + h)
    }
    hole.lineTo(x - r, y)
    shape.holes.push(hole)
  }
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 })
}

// 等距排列的開口
const row = (count: number, span: number, y: number, w: number, h: number, round = true) =>
  Array.from({ length: count }, (_, i) => ({
    x: count === 1 ? 0 : -span / 2 + (span / (count - 1)) * i,
    y,
    w,
    h,
    round,
  }))

/**
 * 中式屋頂：四角微微起翹的內凹屋面（以 4 段 Lathe 形成方形），
 * from 為屋面起點（1 為屋簷），to 為終點（0 為屋脊、大於 0 為腰簷的上緣）。
 */
function hipRoof(width: number, depth: number, height: number, to = 0) {
  const profile = [
    [1, 0.12],
    [0.9, 0.04],
    [0.72, 0.16],
    [0.5, 0.42],
    [0.28, 0.72],
    [0.02, 1],
  ]
    .filter(([r]) => r! >= to - 1e-6)
    .map(([r, y]) => new THREE.Vector2(r!, y! * height))
  const geometry = new THREE.LatheGeometry(profile, 4)
  geometry.rotateY(Math.PI / 4)
  geometry.scale(width / Math.SQRT2, 1, depth / Math.SQRT2)
  return geometry
}

export default function tainanStation(): Motion {
  const stage = createStage({
    mode: '3d',
    aspect: WIDTH / HEIGHT,
    fov: 34,
    cameraY: 11,
    lookY: -4.4,
    distance: 35,
    light: [10, 16, 6],
    ground: 'none',
    shadowSize: 16,
    shadowMapSize: 2048,
    unit: 0.1,
  })
  const { scene } = stage
  // 寫實材質的陰影偏移，避免光滑表面出現陰影條紋
  stage.sun.shadow.bias = -0.0004
  stage.sun.shadow.normalBias = 0.03
  scene.fog = new THREE.Fog(PALETTE.blue, 45, 110)

  // 小島：所有島上的物件都放在這個群組，整座島緩緩上下漂浮
  const island = new THREE.Group()
  island.name = 'island'
  scene.add(island)

  // —— 寫實材質：以物理為基礎的 MeshStandardMaterial，搭配程序紋理、環境反射與色調映射 ——
  // 程序紋理為全站共用，場景釋放時不需 dispose
  const textures = getTextures()
  // 霧面材質（灰泥、布料、植物等），roughness 越高越不反光
  const matte = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra })
  // 烤漆或上釉的表面：較光滑、帶少許反射
  const paint = (color: string, roughness = 0.45, extra: THREE.MeshStandardMaterialParameters = {}) =>
    matte(color, { roughness, metalness: 0.15, ...extra })
  const metal = (color: string, roughness = 0.35, metalness = 0.9) => matte(color, { roughness, metalness })
  const skin = matte('#e6c9a8', { roughness: 0.6 })
  const lacquer = (color: string) =>
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.08 })
  // 有紋理的材質：tile 為紋理重複一次的場景單位，建立網格時以方塊投影計算 UV
  const tiles = new Map<THREE.Material, number>()
  const textured = (color: string, set: TextureSet, tile: number, extra: THREE.MeshStandardMaterialParameters = {}, bumpScale = 1.2) => {
    const material = matte(color, { map: set.map, bumpMap: set.bump ?? null, bumpScale, ...extra })
    tiles.set(material, tile)
    return material
  }
  const fit = (mesh: THREE.Mesh) => {
    const tile = tiles.get(mesh.material as THREE.Material)
    if (tile) projectUV(mesh.geometry, tile)
    return mesh
  }
  const add = <T extends THREE.Object3D>(object: T, x = 0, y = 0, z = 0, parent: THREE.Object3D = island): T => {
    object.position.set(x, y, z)
    parent.add(object)
    return object
  }
  const solid = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const mesh = fit(new THREE.Mesh(geometry, material))
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }
  const box = (w: number, h: number, d: number, material: THREE.Material) => solid(new THREE.BoxGeometry(w, h, d), material)
  const flat = (w: number, d: number, material: THREE.Material, x: number, z: number, y = 0.004) => {
    const mesh = add(fit(new THREE.Mesh(new THREE.PlaneGeometry(w, d), material)), x, y, z)
    mesh.rotation.x = -Math.PI / 2
    mesh.receiveShadow = true
    return mesh
  }
  const disc = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = add(fit(new THREE.Mesh(geometry, material)), x, y, z)
    mesh.rotation.x = -Math.PI / 2
    mesh.receiveShadow = true
    return mesh
  }
  // 放在島上的極座標位置、面向島中心的群組
  const site = (deg: number, radius: number) => {
    const [x, z] = polar(deg, radius)
    const group = add(new THREE.Group(), x, 0, z)
    group.rotation.y = facingCenter(deg)
    return group
  }

  // 夜晚會亮起的材質
  const glowing = (emissive: string, color = PALETTE.navy, extra: THREE.MeshStandardMaterialParameters = {}) =>
    paint(color, 0.5, { emissive, emissiveIntensity: 0, ...extra })
  // 玻璃：光滑、帶金屬感的反射，白天映出天空、夜晚透出室內燈光
  const glass = { roughness: 0.08, metalness: 0.6 }
  const windowGlass = glowing('#ffcf7a', '#1d2a3c', glass)
  const cityWindow = glowing('#f3c27a', '#2a3448', glass)
  const nightMaterials: THREE.MeshStandardMaterial[] = [windowGlass, cityWindow]
  // 城市的窗戶集中成一個 InstancedMesh，夜晚一起亮起
  const cityWindows: THREE.Matrix4[] = []
  const windowScale = new THREE.Vector3(0.24, 0.32, 0.04)

  // 外牆上部為白色方磚，下部為厚重的人造石腰牆
  const wallMaterial = textured(WALL, textures.tile, 0.6, { roughness: 0.55 }, 0.6)
  const stoneMaterial = textured('#d2cbc3', textures.stone, 1.2, { roughness: 0.9 }, 0.8)
  const trimMaterial = textured(TRIM, textures.stone, 2, { roughness: 0.8 }, 0.5)
  const roofMaterial = textured(ROOF, textures.asphalt, 1.5, { roughness: 0.95 })
  const brickMaterial = textured('#ffffff', textures.brick, 1, { roughness: 0.92 }, 2.5)
  const woodMaterial = textured('#8a6a4e', textures.wood, 0.8, { roughness: 0.7 })
  const darkTile = textured('#6a605a', textures.roofTiles, 0.5, { side: THREE.DoubleSide, roughness: 0.65 }, 2)

  // —— 島身：草皮、土壤與砂岩的分層剖面，下方是垂墜的岩石 ——
  const lawnMaterial = textured(SEASONS[0]!.lawn, textures.grass, 1.4, { roughness: 0.95, bumpMap: textures.grass.map }, 0.6)
  const layer = (rTop: number, rBottom: number, height: number, top: number, material: THREE.Material, seed: number, amount: number) => {
    const geometry = new THREE.CylinderGeometry(rTop, rBottom, height, 96, 3)
    const position = geometry.attributes.position!
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const z = position.getZ(i)
      if (Math.hypot(x, z) < 1e-3) continue
      const k = 1 + wobble(Math.atan2(x, z), seed + position.getY(i) * 0.8) * amount
      position.setXYZ(i, x * k, position.getY(i), z * k)
    }
    geometry.computeVertexNormals()
    return add(solid(geometry, material), 0, top - height / 2, 0)
  }
  layer(R, R * 0.99, 0.45, 0, lawnMaterial, 1, 0.006)
  layer(R * 0.99, R * 0.975, 0.9, -0.45, textured('#7a5a43', textures.soil, 1.2, { roughness: 1 }, 3), 2, 0.012)
  layer(R * 0.975, R * 0.955, 0.75, -1.35, textured('#c79a63', textures.soil, 0.7, { roughness: 0.95 }, 2), 4, 0.018)
  layer(R * 0.955, R * 0.9, 0.8, -2.1, textured('#5e4a3d', textures.soil, 0.9, { roughness: 1 }, 3), 6, 0.022)

  // 岩石底部：往下收窄、邊緣參差、尖端偏向一側，以頂點色由土褐漸變到深岩色
  const ROCK_TOP = -2.9
  const ROCK_DEPTH = 11
  const rockGeometry = new THREE.CylinderGeometry(R * 0.9, 0.3, ROCK_DEPTH, 64, 12)
  {
    const position = rockGeometry.attributes.position!
    const colors = new Float32Array(position.count * 3)
    const upper = hex('#6b5646')
    const lower = hex('#34302e')
    const color = new THREE.Color()
    for (let i = 0; i < position.count; i++) {
      let x = position.getX(i)
      let z = position.getZ(i)
      let y = position.getY(i)
      const t = (ROCK_DEPTH / 2 - y) / ROCK_DEPTH
      const angle = Math.atan2(x, z)
      if (Math.hypot(x, z) > 1e-3) {
        const k = 1 + wobble(angle, 11 + t * 5) * 0.28 * Math.min(t * 4, 1)
        x *= k
        z *= k
      }
      y -= t * t * (1.2 + wobble(angle * 2, 5)) * 1.6
      x += t * t * 1.4
      position.setXYZ(i, x, y - ROCK_DEPTH / 2, z)
      color.copy(upper).lerp(lower, t).multiplyScalar(0.9 + Math.sin(y * 3.1) * 0.08)
      colors.set([color.r, color.g, color.b], i * 3)
    }
    rockGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    rockGeometry.computeVertexNormals()
  }
  const rockMaterial = textured('#ffffff', textures.rock, 3, { vertexColors: true, flatShading: true, roughness: 0.95 }, 4)
  add(solid(rockGeometry, rockMaterial), 0, ROCK_TOP, 0)
  // 底部的鐘乳狀岩柱：頂端嵌入岩石之中
  const stalactiteMaterial = textured('#4a423d', textures.rock, 2, { flatShading: true, roughness: 0.95 }, 4)
  const rockRadiusAt = (y: number) => THREE.MathUtils.lerp(R * 0.9, 0.3, (ROCK_TOP - y) / ROCK_DEPTH)
  const stalactites: [number, number, number, number][] = [
    [30, 5.2, 0.9, 3.2], [100, 6.4, 0.7, 2.4], [170, 4.4, 1.1, 3.6],
    [235, 6.8, 0.6, 2.2], [300, 3.6, 1.2, 4.2], [350, 7.6, 0.55, 1.8],
  ]
  for (const [deg, radius, width, length] of stalactites) {
    const [x, z] = polar(deg, radius)
    // 找出這個半徑處岩石的高度，讓岩柱從表面長出
    let y = ROCK_TOP
    while (rockRadiusAt(y) > radius + width && y > ROCK_TOP - ROCK_DEPTH) y -= 0.1
    const cone = solid(new THREE.ConeGeometry(width, length, 7), stalactiteMaterial)
    cone.rotation.x = Math.PI
    add(cone, x, y + 0.5 - length / 2, z)
  }

  // 垂掛的根鬚與藤蔓：以頂端為軸隨風擺動
  const rootMaterial = textured('#5b4636', textures.wood, 0.4, { roughness: 0.9 })
  const vineMaterial = matte('#6f8a4f', { roughness: 0.7 })
  const roots: { pivot: THREE.Group; phase: number }[] = []
  const rootRand = random(1624)
  for (let i = 0; i < 26; i++) {
    const deg = (i / 26) * 360 + rootRand() * 8
    const [x, z] = polar(deg, R * 0.92)
    const pivot = add(new THREE.Group(), x, -2.4 - rootRand() * 0.5, z)
    pivot.rotation.y = THREE.MathUtils.degToRad(deg)
    const length = 1.2 + rootRand() * 2.4
    const curve = new THREE.CatmullRomCurve3(
      Array.from({ length: 5 }, (_, j) => {
        const t = j / 4
        return new THREE.Vector3(Math.sin(t * 4 + i) * 0.12, -t * length, 0.15 + t * 0.3)
      }),
    )
    const vine = i % 3 === 0
    pivot.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, vine ? 0.035 : 0.05, 5), vine ? vineMaterial : rootMaterial))
    if (vine) {
      for (let j = 1; j <= 3; j++) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), vineMaterial)
        curve.getPoint(j / 3.4, leaf.position)
        pivot.add(leaf)
      }
    }
    roots.push({ pivot, phase: rootRand() * Math.PI * 2 })
  }

  // —— 島頂：道路、站前廣場、圓環 ——
  const roadMaterial = textured(ROAD, textures.asphalt, 1.2, { roughness: 0.92 }, 1.5)
  // 廣場與步道的鋪面磚
  const paverMaterial = textured('#ddd5cc', textures.tile, 2.4, { roughness: 0.8 }, 1)
  // 站前通往圓環的道路
  flat(2.4, 5, roadMaterial, 0, 5.8)
  const plaza = disc(new THREE.CircleGeometry(1, 48), paverMaterial, 0, 0.006, 3.2)
  plaza.scale.set(3.6, 1.4, 1)

  // 站前圓環：環狀道路、中央綠地與紀念碑
  const roundabout = new THREE.Vector3(0, 0, 9.3)
  disc(new THREE.RingGeometry(1.2, 2.1, 64), roadMaterial, roundabout.x, 0.008, roundabout.z)
  disc(new THREE.CircleGeometry(1.2, 48), lawnMaterial, roundabout.x, 0.01, roundabout.z)
  add(solid(new THREE.CylinderGeometry(0.42, 0.5, 0.22, 24), trimMaterial), roundabout.x, 0.11, roundabout.z)
  add(solid(new THREE.CylinderGeometry(0.07, 0.12, 1.4, 8), stoneMaterial), roundabout.x, 0.9, roundabout.z)

  // —— 軌道：枕木與兩條鐵軌 ——
  const track = new THREE.CatmullRomCurve3(
    Array.from({ length: 120 }, (_, i) => {
      const [x, z] = polar(PLATFORM_DEG + (i / 120) * 360, TRACK_R)
      return new THREE.Vector3(x, 0, z)
    }),
    true,
  )
  const trackLength = track.getLength()
  const tangent = new THREE.Vector3()

  disc(new THREE.RingGeometry(TRACK_R - 0.5, TRACK_R + 0.5, 180), textured('#9c948d', textures.asphalt, 0.5, { roughness: 1 }, 3), 0, 0.012, 0)

  const sleeperCount = 300
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.06, 0.16), matte('#6e5f52', { map: textures.wood.map, roughness: 0.8 }), sleeperCount)
  const dummy = new THREE.Object3D()
  for (let i = 0; i < sleeperCount; i++) {
    const u = i / sleeperCount
    track.getPointAt(u, dummy.position)
    track.getTangentAt(u, tangent)
    dummy.position.y = 0.04
    dummy.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0)
    dummy.updateMatrix()
    sleepers.setMatrixAt(i, dummy.matrix)
  }
  sleepers.receiveShadow = true
  island.add(sleepers)

  const railMaterial = metal('#8a8f96', 0.32)
  for (const side of [-1, 1]) {
    const points = Array.from({ length: 300 }, (_, i) => {
      const u = i / 300
      const p = track.getPointAt(u)
      track.getTangentAt(u, tangent)
      return p.add(new THREE.Vector3(tangent.z, 0, -tangent.x).normalize().multiplyScalar(0.22 * side)).setY(0.09)
    })
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 600, 0.035, 6, true),
      railMaterial,
    )
    rail.castShadow = true
    island.add(rail)
  }

  // —— 台南舊火車站 ——
  // 依文獻：1936 年落成的二層樓鋼骨鋼筋混凝土建築，折衷主義風格；門廊有三個圓拱門、屋簷有浮雕，
  // 正面開七扇圓拱長窗、中間三扇由四根壁柱框起，長窗上方嵌圓鐘，平頂上有小山形壁，外牆上部白色方磚、下部人造石腰牆。
  // 兩翼與端棟的開窗數量、比例為藝術化補充。
  const station = add(new THREE.Group(), 0, 0, -0.2)

  const section = (centerX: number, width: number, height: number, depth: number, front: number) => {
    // 主體：前後各內縮 0.3，留給拱形牆面與窗玻璃
    add(box(width, height, depth - 0.6, wallMaterial), centerX, height / 2, front - depth / 2, station)
    // 基座、人造石腰牆、腰帶線、簷口與女兒牆
    add(box(width + 0.12, 0.22, depth + 0.12, trimMaterial), centerX, 0.11, front - depth / 2, station)
    add(box(width + 0.04, 0.75, depth - 0.56, stoneMaterial), centerX, 0.5, front - depth / 2, station)
    add(box(width + 0.08, 0.1, depth + 0.08, trimMaterial), centerX, 1.42, front - depth / 2, station)
    add(box(width + 0.16, 0.14, depth + 0.16, trimMaterial), centerX, height, front - depth / 2, station)
    add(box(width, 0.32, depth, wallMaterial), centerX, height + 0.23, front - depth / 2, station)
    add(box(width + 0.06, 0.06, depth + 0.06, trimMaterial), centerX, height + 0.42, front - depth / 2, station)
    // 屋頂
    add(box(width - 0.2, 0.05, depth - 0.2, roofMaterial), centerX, height + 0.1, front - depth / 2, station)
  }

  // 有拱形開口的牆面與內側的窗玻璃；z 為牆面外側的位置，facing 為朝向（1 正面、-1 背面）
  const facade = (
    centerX: number,
    width: number,
    y: number,
    height: number,
    z: number,
    openings: Parameters<typeof archedWall>[3],
    facing = 1,
    material: THREE.Material = wallMaterial,
  ) => {
    const wall = solid(archedWall(width, height, 0.16, openings), material)
    wall.position.set(centerX, y, z - facing * 0.16)
    wall.rotation.y = facing > 0 ? 0 : Math.PI
    station.add(wall)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.1, height - 0.05), windowGlass)
    glass.position.set(centerX, y + height / 2, z - facing * 0.24)
    glass.rotation.y = facing > 0 ? 0 : Math.PI
    station.add(glass)
  }

  // 中央棟：二層樓挑高，正面七扇圓拱長窗，中間三扇由四根壁柱框起；長窗上方嵌圓鐘，平屋頂上有小山形壁
  section(0, 4.4, 4.2, 3, 1.75)
  facade(0, 4.4, 0.22, 1.4, 1.75, row(3, 1.7, 0.05, 0.62, 1.2, false), 1, stoneMaterial)
  facade(0, 4.4, 1.67, 2.48, 1.75, row(7, 3.6, 0.18, 0.38, 1.95))
  facade(0, 4.4, 0.22, 3.9, -1.25, row(5, 3.2, 1.7, 0.36, 1.6), -1)
  for (const x of [-0.9, -0.3, 0.3, 0.9]) add(box(0.14, 2.3, 0.12, trimMaterial), x, 2.88, 1.8, station)
  // 頂部：女兒牆中央的圓鐘與小山形壁
  add(box(1.7, 0.7, 0.42, wallMaterial), 0, 4.62, 1.5, station)
  const clockFace = add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 40), paint('#f6f1e6', 0.2)), 0, 4.6, 1.74, station)
  clockFace.rotation.x = Math.PI / 2
  add(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 40), paint(PALETTE.navy)), 0, 4.6, 1.76, station)
  const hand = (length: number) => {
    const pivot = add(new THREE.Group(), 0, 4.6, 1.79, station)
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.03, length, 0.02), paint(PALETTE.navy))
    needle.position.y = length / 2
    pivot.add(needle)
    return pivot
  }
  const hourHand = hand(0.13)
  const minuteHand = hand(0.2)
  const gableShape = new THREE.Shape()
  gableShape.moveTo(-0.85, 0)
  gableShape.lineTo(0.85, 0)
  gableShape.lineTo(0, 0.42)
  gableShape.lineTo(-0.85, 0)
  const gable = solid(new THREE.ExtrudeGeometry(gableShape, { depth: 0.36, bevelEnabled: false }), wallMaterial)
  add(gable, 0, 4.97, 1.31, station)

  // 門廊：一層樓高的突出量體，正面三個圓拱門，兩側各一個拱門，屋簷有浮雕飾帶
  const porchFront = 3.15
  const porch = (width: number, openings: Parameters<typeof archedWall>[3], x: number, z: number, angle: number) => {
    const wall = solid(archedWall(width, 1.5, 0.16, openings), stoneMaterial)
    wall.position.set(x, 0.12, z)
    wall.rotation.y = angle
    station.add(wall)
  }
  porch(3.2, row(3, 1.9, 0, 0.66, 1.25), 0, porchFront - 0.16, 0)
  porch(1.4, row(1, 0, 0, 0.6, 1.2), -1.6, porchFront - 0.7, Math.PI / 2)
  porch(1.4, row(1, 0, 0, 0.6, 1.2), 1.6, porchFront - 0.7, -Math.PI / 2)
  add(box(3.4, 0.16, 1.6, trimMaterial), 0, 1.66, porchFront - 0.72, station)
  add(box(3.3, 0.12, 1.5, wallMaterial), 0, 1.8, porchFront - 0.72, station)
  add(box(3.2, 0.1, 1.4, trimMaterial), 0, 0.05, porchFront - 0.72, station)
  // 站名牌
  add(box(1.5, 0.2, 0.05, paint(PALETTE.navy)), 0, 1.98, porchFront - 0.02, station)

  // 兩翼：一樓拱廊（人造石腰牆）、二樓為鐵道飯店的拱窗，後側也有窗
  for (const side of [-1, 1]) {
    const x = side * 3.6
    section(x, 2.8, 2.95, 2.4, 1.2)
    facade(x, 2.8, 0.22, 1.2, 1.2, row(4, 2.1, 0.05, 0.44, 1.1), 1, stoneMaterial)
    facade(x, 2.8, 1.47, 1.43, 1.2, row(4, 2.1, 0.18, 0.3, 0.92))
    facade(x, 2.8, 0.22, 2.68, -1.2, row(4, 2.1, 0.4, 0.3, 0.9).concat(row(4, 2.1, 1.5, 0.3, 0.9)), -1)
    // 端棟：略為突出、較高
    const endX = side * 5.6
    section(endX, 1.2, 3.2, 2.7, 1.35)
    const endOpenings = [
      { x: 0, y: 0.2, w: 0.42, h: 1.0 },
      { x: 0, y: 1.5, w: 0.42, h: 1.05 },
    ]
    facade(endX, 1.2, 0.22, 2.93, 1.35, endOpenings, 1, stoneMaterial)
    facade(endX, 1.2, 0.22, 2.93, -1.35, endOpenings, -1)
  }

  // 島緣的月台與雨棚：位於軌道內側，列車每圈在此停靠
  {
    const platform = site(PLATFORM_DEG, TRACK_R - 0.85)
    add(box(4.6, 0.22, 0.9, trimMaterial), 0, 0.11, 0, platform)
    add(box(4.6, 0.08, 1.1, roofMaterial), 0, 1.45, 0, platform)
    for (let x = -2; x <= 2; x += 1) add(box(0.08, 1.25, 0.08, paint(PALETTE.navy)), x, 0.82, 0.3, platform)
    add(box(0.9, 0.2, 0.04, paint(PALETTE.navy)), 0, 1.25, 0.32, platform)
  }

  // —— 赤崁樓：荷蘭時期普羅民遮城的紅磚基座上，清代興建的海神廟與文昌閣兩座樓閣 ——
  // 樓閣為二層、重簷歇山的中式建築；此處以四角起翹的屋面簡化表現，尺度與細部為藝術化補充
  {
    const chihkan = site(96, 10.2)
    add(box(4.4, 0.45, 2.2, brickMaterial), 0, 0.225, 0, chihkan)
    add(box(4.5, 0.06, 2.3, trimMaterial), 0, 0.48, 0, chihkan)
    // 正面中央的石階
    add(box(0.9, 0.24, 0.5, stoneMaterial), 0, 0.12, 1.3, chihkan)
    const redWall = textured(PALETTE.red, textures.plaster, 1, { roughness: 0.8 }, 0.6)
    for (const x of [-1.05, 1.05]) {
      add(box(1.4, 0.75, 1.1, redWall), x, 0.86, 0, chihkan)
      // 一樓的格扇門窗
      add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.42), windowGlass), x, 0.82, 0.56, chihkan)
      // 腰簷：環繞二樓、四角起翹
      add(solid(hipRoof(2.0, 1.66, 0.6, 0.5), darkTile), x, 1.2, 0, chihkan)
      add(box(1.0, 0.55, 0.8, redWall), x, 1.66, 0, chihkan)
      add(new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.26), windowGlass), x, 1.66, 0.41, chihkan)
      // 頂層屋面與屋脊
      add(solid(hipRoof(1.7, 1.36, 0.62), darkTile), x, 1.9, 0, chihkan)
      add(box(0.7, 0.06, 0.06, paint(PALETTE.ochre, 0.4)), x, 2.5, 0, chihkan)
    }
  }

  // —— 林百貨：1932 年開幕的五層樓百貨，裝飾藝術風格，屋頂有末廣社神社與鳥居 ——
  // 立面以淺褐色面磚與直向窗帶表現；轉角圓弧與開窗數量為藝術化補充
  {
    const hayashi = site(47, 10.1)
    const tile = textured('#d9c3a0', textures.tile, 0.5, { roughness: 0.5 }, 0.6)
    const floors = 5
    const floorHeight = 0.62
    const height = floors * floorHeight + 0.2
    add(box(2.6, height, 2.0, tile), 0, height / 2, 0, hayashi)
    // 各樓層的水平飾帶與頂部女兒牆
    for (let floor = 1; floor <= floors; floor++) add(box(2.66, 0.05, 2.06, trimMaterial), 0, 0.2 + floor * floorHeight, 0, hayashi)
    add(box(2.7, 0.18, 2.1, trimMaterial), 0, height + 0.05, 0, hayashi)
    // 一樓騎樓與入口
    add(box(2.4, 0.5, 0.06, matte('#4a4f59')), 0, 0.3, 1.0, hayashi)
    // 直向窗帶：各樓層的窗戶加入城市夜窗
    hayashi.updateMatrixWorld(true)
    for (let floor = 1; floor < floors; floor++) {
      for (let i = 0; i < 5; i++) {
        const local = new THREE.Vector3(-1 + i * 0.5, 0.52 + floor * floorHeight, 1.02)
        cityWindows.push(new THREE.Matrix4().compose(local.applyMatrix4(hayashi.matrixWorld), hayashi.quaternion, windowScale))
      }
    }
    // 屋頂：機房、末廣社與紅色鳥居
    add(box(0.9, 0.5, 0.7, tile), 0.6, height + 0.4, -0.4, hayashi)
    add(box(0.5, 0.32, 0.4, woodMaterial), -0.55, height + 0.3, -0.35, hayashi)
    add(solid(hipRoof(0.7, 0.6, 0.22), darkTile), -0.55, height + 0.46, -0.35, hayashi)
    const torii = paint(PALETTE.red, 0.4)
    for (const x of [-0.78, -0.32]) add(box(0.05, 0.42, 0.05, torii), x, height + 0.35, 0.25, hayashi)
    add(box(0.66, 0.05, 0.07, torii), -0.55, height + 0.58, 0.25, hayashi)
    add(box(0.56, 0.04, 0.05, torii), -0.55, height + 0.5, 0.25, hayashi)
  }

  // —— 安平古堡：荷蘭人建造的熱蘭遮城，留下紅磚城垣；上方為後期的白色瞭望塔 ——
  // 塔樓、房舍的比例為藝術化補充
  const flagPivot = new THREE.Group()
  {
    const anping = site(-135, 9.9)
    add(box(3.0, 0.8, 2.4, brickMaterial), 0, 0.4, 0, anping)
    // 殘存的城垣，順著島緣延伸
    add(box(0.3, 0.9, 1.6, brickMaterial), -1.75, 0.45, -0.6, anping)
    add(box(1.6, 0.7, 0.3, brickMaterial), -1.2, 0.35, -1.45, anping)
    add(box(1.0, 0.24, 0.45, stoneMaterial), 0.4, 0.12, 1.4, anping)
    const white = textured('#f2eee9', textures.plaster, 1.5, { roughness: 0.85 }, 0.6)
    const redTile = textured('#b5523b', textures.roofTiles, 0.4, { roughness: 0.65, side: THREE.DoubleSide }, 2)
    add(box(1.4, 0.7, 1.1, white), -0.5, 1.15, -0.2, anping)
    add(solid(hipRoof(1.6, 1.3, 0.45), redTile), -0.5, 1.5, -0.2, anping)
    add(solid(new THREE.CylinderGeometry(0.36, 0.4, 1.7, 8), white), 0.75, 1.65, 0.2, anping)
    add(solid(new THREE.CylinderGeometry(0.46, 0.46, 0.1, 8), trimMaterial), 0.75, 2.52, 0.2, anping)
    add(solid(new THREE.ConeGeometry(0.42, 0.5, 8), redTile), 0.75, 2.82, 0.2, anping)
    add(box(0.03, 0.8, 0.03, paint(PALETTE.navy)), 0.75, 3.4, 0.2, anping)
    add(flagPivot, 0.75, 3.7, 0.2, anping)
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.24), matte(PALETTE.red, { side: THREE.DoubleSide, roughness: 0.95 }))
    flag.position.x = 0.2
    flagPivot.add(flag)
  }

  // —— 運河：從安平一側流向島緣，在島的邊緣傾瀉成瀑布 ——
  const canal = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-5.4, 0, -7.6),
    new THREE.Vector3(-3.6, 0, -8.7),
    new THREE.Vector3(-0.6, 0, -9.5),
    new THREE.Vector3(2.0, 0, -10.6),
    new THREE.Vector3(3.2, 0, -12.2),
    new THREE.Vector3(3.5, 0, -13.25),
  ])
  // 運河在島緣（草皮層頂面的實際半徑）截止，水面與河岸不會懸空伸出島外
  const edgeRadius = (angle: number) => R * (1 + wobble(angle, 1 + 0.225 * 0.8) * 0.006)
  let canalEnd = 1
  for (let u = 0.7; u <= 1; u += 0.0005) {
    const p = canal.getPointAt(u)
    if (Math.hypot(p.x, p.z) >= edgeRadius(Math.atan2(p.x, p.z)) - 0.01) {
      canalEnd = u
      break
    }
  }
  const ribbon = (curve: THREE.Curve<THREE.Vector3>, width: number, y: number, material: THREE.Material, end = canalEnd) => {
    const segments = 60
    const vertices: number[] = []
    const indices: number[] = []
    const point = new THREE.Vector3()
    const direction = new THREE.Vector3()
    for (let i = 0; i <= segments; i++) {
      curve.getPointAt((i / segments) * end, point)
      curve.getTangentAt((i / segments) * end, direction)
      const nx = direction.z * (width / 2)
      const nz = -direction.x * (width / 2)
      vertices.push(point.x + nx, y, point.z + nz, point.x - nx, y, point.z - nz)
      if (i < segments) indices.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    const mesh = fit(new THREE.Mesh(geometry, material))
    mesh.receiveShadow = true
    island.add(mesh)
    return mesh
  }
  ribbon(canal, 1.5, 0.014, stoneMaterial)
  // 水面：低粗糙度反射天光，法線貼圖平移產生流動的波紋
  const waterMaterial = textured('#3f6c8a', textures.water, 2.2, {
    roughness: 0.06,
    metalness: 0.2,
    normalMap: textures.water.normal ?? null,
    normalScale: new THREE.Vector2(0.25, 0.25),
    emissive: '#1c3550',
    emissiveIntensity: 0,
    side: THREE.DoubleSide,
  }, 0)
  ribbon(canal, 1.0, 0.03, waterMaterial)
  // 跨越運河的拱橋
  {
    const shape = new THREE.Shape()
    shape.moveTo(-1.1, 0)
    shape.lineTo(-0.5, 0)
    shape.absarc(0, 0, 0.5, Math.PI, 0, true)
    shape.lineTo(1.1, 0)
    shape.quadraticCurveTo(0.55, 0.62, 0, 0.62)
    shape.quadraticCurveTo(-0.55, 0.62, -1.1, 0)
    const bridge = solid(new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false, curveSegments: 12 }), stoneMaterial)
    bridge.geometry.translate(0, 0, -0.3)
    const u = 0.42
    canal.getPointAt(u, bridge.position)
    canal.getTangentAt(u, tangent)
    // 橋身沿著運河的法線方向橫跨
    bridge.rotation.y = Math.atan2(tangent.x, tangent.z)
    island.add(bridge)
  }
  // 運河上往返的小船
  const boat = new THREE.Group()
  add(box(0.7, 0.14, 0.28, woodMaterial), 0, 0.1, 0, boat)
  add(box(0.3, 0.16, 0.24, matte(PALETTE.ochre, { roughness: 0.95 })), -0.05, 0.25, 0, boat)
  island.add(boat)

  // —— 瀑布：運河流到島緣，越過石砌堰口後以拋物線落下 ——
  // 水流離開堰口時帶有水平初速 FALL_SPEED，之後受重力加速（y = -½gt²），水幕與水滴沿同一條軌跡
  const FALL_SPEED = 0.65
  const FALL_GRAVITY = 6
  const FALL_TIME = 2.1
  const mouth = canal.getPointAt(canalEnd)
  const outward = new THREE.Vector3(mouth.x, 0, mouth.z).normalize()
  const across = new THREE.Vector3(-outward.z, 0, outward.x)
  const fallAngle = Math.atan2(outward.x, outward.z)
  // 堰口：水面下的石砌門檻與兩側的大石
  {
    const sill = add(box(1.3, 0.08, 0.32, stoneMaterial), mouth.x - outward.x * 0.12, -0.01, mouth.z - outward.z * 0.12)
    sill.rotation.y = fallAngle
    for (const [side, size] of [[-1, 0.3], [1, 0.24]] as const) {
      const rock = add(
        solid(new THREE.DodecahedronGeometry(size, 0), stalactiteMaterial),
        mouth.x + across.x * side * 0.72 - outward.x * 0.18,
        size * 0.45,
        mouth.z + across.z * side * 0.72 - outward.z * 0.18,
      )
      rock.scale.set(1.2, 0.8, 1)
      rock.rotation.y = side * 0.7
    }
  }
  // 水幕：沿拋物線往下展開、逐漸變寬；水流條紋往下捲動，頂點透明度在下方與兩側淡出
  const fallMaterial = new THREE.MeshBasicMaterial({
    map: textures.falls.map,
    alphaMap: textures.falls.bump ?? null,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  {
    const rows = 32
    const columns = 6
    const vertices: number[] = []
    const uvs: number[] = []
    const colors: number[] = []
    const indices: number[] = []
    let length = 0
    let previous: [number, number] = [0, 0.03]
    for (let r = 0; r <= rows; r++) {
      const t = (r / rows) * FALL_TIME
      const out = FALL_SPEED * t
      const y = 0.03 - 0.5 * FALL_GRAVITY * t * t
      length += Math.hypot(out - previous[0], y - previous[1])
      previous = [out, y]
      const width = 0.95 + 0.3 * (t / FALL_TIME)
      for (let c = 0; c <= columns; c++) {
        const k = c / columns
        vertices.push((k - 0.5) * width, y, out)
        uvs.push(k, -length / 2.4)
        const edge = Math.sin(k * Math.PI) ** 0.6
        colors.push(0.86, 0.93, 0.97, 0.85 * edge * (1 - (t / FALL_TIME) ** 1.3))
        if (r < rows && c < columns) {
          const i = r * (columns + 1) + c
          indices.push(i, i + columns + 1, i + 1, i + 1, i + columns + 1, i + columns + 2)
        }
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4))
    geometry.setIndex(indices)
    const curtain = add(new THREE.Mesh(geometry, fallMaterial), mouth.x, 0, mouth.z)
    curtain.rotation.y = fallAngle
    curtain.renderOrder = 1
  }
  // 水滴：從堰口以略有差異的初速拋出，受重力加速落下
  const dropCount = 160
  const dropPositions = new Float32Array(dropCount * 3)
  const dropSeeds = Array.from({ length: dropCount }, (_, i) => [i / dropCount, (Math.random() - 0.5) * 0.9, Math.random()])
  const dropGeometry = new THREE.BufferGeometry()
  dropGeometry.setAttribute('position', new THREE.BufferAttribute(dropPositions, 3))
  const dropMaterial = new THREE.PointsMaterial({ color: '#e6f0f6', size: 0.12, transparent: true, opacity: 0.75, depthWrite: false })
  const drops = new THREE.Points(dropGeometry, dropMaterial)
  drops.frustumCulled = false
  island.add(drops)
  // 水霧：水流在下方散成水霧，往外擴散並緩緩下沉
  const mistCount = 70
  const mistPositions = new Float32Array(mistCount * 3)
  const mistSeeds = Array.from({ length: mistCount }, (_, i) => [i / mistCount, Math.random() * Math.PI * 2, 0.5 + Math.random()])
  const mistGeometry = new THREE.BufferGeometry()
  mistGeometry.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3))
  const mistMaterial = new THREE.PointsMaterial({ color: '#eef4f8', size: 0.55, transparent: true, opacity: 0.18, depthWrite: false })
  const mist = new THREE.Points(mistGeometry, mistMaterial)
  mist.frustumCulled = false
  island.add(mist)
  const mistOrigin = mouth.clone().addScaledVector(outward, FALL_SPEED * FALL_TIME).setY(-0.5 * FALL_GRAVITY * FALL_TIME * FALL_TIME)

  // —— 城市：沿島緣排列的街屋，一樓騎樓、樓上住家，夜晚亮燈，掛著直立招牌 ——
  const rand = random(1936)
  const cityMaterials = ['#d9d1ca', '#cfc6be', PALETTE.gray, '#d8c3a8', '#e2dbd4'].map((color) => textured(color, textures.plaster, 1.2, { roughness: 0.9 }, 0.8))
  const signMaterials = [glowing(PALETTE.red, PALETTE.red), glowing(PALETTE.ochre, PALETTE.ochre)]
  nightMaterials.push(...signMaterials)

  // 沿著圓弧排一列街屋，正面朝向島中心
  const arcStreet = (fromDeg: number, toDeg: number, radius: number) => {
    const span = THREE.MathUtils.degToRad(toDeg - fromDeg) * radius
    let offset = 0
    while (offset < span - 0.7) {
      const width = Math.min(0.95 + rand() * 0.7, span - offset)
      const floors = 2 + Math.floor(rand() * 3)
      const height = 0.4 + floors * 0.82
      const depth = 1.5
      const deg = fromDeg + THREE.MathUtils.radToDeg((offset + width / 2) / radius)
      const house = site(deg, radius)
      house.updateMatrixWorld(true)

      const material = cityMaterials[Math.floor(rand() * cityMaterials.length)]!
      add(box(width - 0.06, height, depth, material), 0, height / 2, -depth / 2, house)
      // 騎樓：一樓內縮的深色空間與樑
      add(box(width - 0.06, 0.82, 0.06, matte('#4a4f59')), 0, 0.41, 0.0, house).castShadow = false
      add(box(width - 0.02, 0.12, 0.5, material), 0, 0.88, 0.2, house)
      // 屋頂水塔
      if (rand() > 0.5) add(box(0.32, 0.28, 0.32, metal('#a7a39f', 0.45, 0.7)), (rand() - 0.5) * 0.4, height + 0.14, -depth / 2, house)
      // 樓上窗戶
      const perRow = Math.max(1, Math.floor(width / 0.45))
      for (let floor = 1; floor < floors; floor++) {
        for (let i = 0; i < perRow; i++) {
          const local = new THREE.Vector3(-width / 2 + (width / perRow) * (i + 0.5), 0.45 + floor * 0.82, 0.02)
          cityWindows.push(new THREE.Matrix4().compose(local.applyMatrix4(house.matrixWorld), house.quaternion, windowScale))
        }
      }
      // 直立招牌
      if (rand() > 0.45 && floors > 2) {
        const sign = add(box(0.12, 0.9, 0.36, signMaterials[Math.floor(rand() * 2)]!), width / 2 - 0.1, 1.6, 0.28, house)
        sign.castShadow = false
      }
      offset += width
    }
  }
  // 街屋退到軌道內側（背面不超過半徑 11.4），讓出最外圍給環島鐵道
  arcStreet(17, 37, 9.9)
  arcStreet(58, 78, 9.9)
  arcStreet(-118, -86, 9.9)
  arcStreet(111, 124, 10.1)

  const windows = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cityWindow, cityWindows.length)
  cityWindows.forEach((matrix, i) => windows.setMatrixAt(i, matrix))
  island.add(windows)

  // —— 夜市小吃：條紋遮棚的攤車，牛肉湯、擔仔麵的湯鍋冒著熱氣，夜晚燈泡亮起 ——
  // 帆布遮棚與平交道柵欄
  const stripeMaterials = [paint(PALETTE.red, 0.55), paint('#f2eee9', 0.55)]
  const canvasMaterials = [matte(PALETTE.red, { roughness: 0.95 }), matte('#f2eee9', { roughness: 0.95 })]
  const canopyMaterials = [canvasMaterials, [matte(PALETTE.ochre, { roughness: 0.95 }), canvasMaterials[1]!]]
  const bulbMaterial = glowing('#ffd890', '#f6ead0')
  const lanternMaterial = glowing('#ff6a3d', PALETTE.red)
  nightMaterials.push(bulbMaterial, lanternMaterial)
  // 不鏽鋼湯鍋、瓷碗與塑膠板凳
  const potMaterial = metal('#c4c8cc', 0.28)
  const porcelain = paint('#f6f1e6', 0.18)
  const steelPost = metal('#7d858d', 0.45, 0.8)
  const pots: THREE.Vector3[] = []
  const stallDegrees = [-28, -36, -44, -52, -60]
  stallDegrees.forEach((deg, index) => {
    const stall = site(deg, 10.3)
    add(box(1.0, 0.5, 0.5, woodMaterial), 0, 0.25, 0, stall)
    for (const x of [-0.46, 0.46]) for (const z of [-0.22, 0.22]) add(box(0.04, 1.1, 0.04, steelPost), x, 0.55, z, stall)
    // 斜向前方的條紋遮棚
    for (let i = 0; i < 5; i++) {
      const stripe = add(box(0.21, 0.04, 0.8, canopyMaterials[index % 2]![i % 2]!), -0.42 + i * 0.21, 1.14, 0.05, stall)
      stripe.rotation.x = 0.18
    }
    // 招牌與燈泡
    add(box(0.8, 0.16, 0.03, signMaterials[index % 2]!), 0, 0.95, 0.42, stall)
    for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), bulbMaterial), -0.36 + i * 0.24, 1.02, 0.46, stall)
    // 湯鍋與碗
    if (index % 2 === 0) {
      add(solid(new THREE.CylinderGeometry(0.16, 0.14, 0.18, 14), potMaterial), -0.22, 0.59, 0, stall)
      stall.updateMatrixWorld(true)
      pots.push(new THREE.Vector3(-0.22, 0.7, 0).applyMatrix4(stall.matrixWorld))
    }
    for (const x of [0.18, 0.36]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.05, 10), porcelain), x, 0.53, 0.06, stall)
    // 擔仔麵攤掛著紅燈籠
    if (index === 2) {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), lanternMaterial), 0.5, 0.82, 0.32, stall).scale.set(1, 1.25, 1)
    }
  })
  // 攤位前的圓桌與板凳
  for (const deg of [-33, -47, -59]) {
    const [x, z] = polar(deg, 8.7)
    add(solid(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 16), paint('#f2eee9', 0.35)), x, 0.42, z)
    add(solid(new THREE.CylinderGeometry(0.04, 0.06, 0.4, 6), steelPost), x, 0.2, z)
    for (let i = 0; i < 3; i++) {
      const angle = i * ((Math.PI * 2) / 3) + deg
      add(solid(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 10), paint(PALETTE.red, 0.4)), x + Math.cos(angle) * 0.5, 0.12, z + Math.sin(angle) * 0.5)
    }
  }
  // 熱氣：沿著小幅度擺動上升
  const steamPerPot = 18
  const steamCount = pots.length * steamPerPot
  const steamPositions = new Float32Array(steamCount * 3)
  const steamGeometry = new THREE.BufferGeometry()
  steamGeometry.setAttribute('position', new THREE.BufferAttribute(steamPositions, 3))
  const steamMaterial = new THREE.PointsMaterial({ color: '#ffffff', size: 0.2, transparent: true, opacity: 0, depthWrite: false })
  const steam = new THREE.Points(steamGeometry, steamMaterial)
  steam.frustumCulled = false
  island.add(steam)

  // —— 樹木：鳳凰木（傘狀樹冠、依季節開花）與芒果園（夏季結果） ——
  const foliageMaterial = textured(SEASONS[0]!.foliage, textures.leaves, 0.7, { roughness: 0.8 }, 3)
  const blossomMaterial = matte(SEASONS[0]!.blossom, { flatShading: true, roughness: 0.7 })
  const trunkMaterial = textured('#6b5544', textures.wood, 0.3, { roughness: 0.9 }, 2)
  const blossoms: THREE.Group[] = []
  const crowns: { group: THREE.Group; phase: number }[] = []
  const treeSpots: [number, number][] = [
    [-5.6, 2.7], [5.6, 2.7], [-6.6, -2.6], [6.6, -2.6], [-2.9, 6.6], [2.9, 6.6],
    [-9.6, 3.6], [-3.8, -5.6], [3.2, -6.0],
  ]
  for (const [x, z] of treeSpots) {
    const tree = add(new THREE.Group(), x, 0, z)
    add(solid(new THREE.CylinderGeometry(0.07, 0.11, 1, 6), trunkMaterial), 0, 0.5, 0, tree)
    // 樹冠以樹幹頂端為軸，隨風擺動
    const crown = add(new THREE.Group(), 0, 0.95, 0, tree)
    add(solid(new THREE.IcosahedronGeometry(0.72, 3), foliageMaterial), 0, 0.28, 0, crown).scale.set(1.25, 0.55, 1.25)
    add(solid(new THREE.IcosahedronGeometry(0.45, 3), foliageMaterial), 0.25, 0.52, -0.1, crown).scale.set(1.2, 0.6, 1.2)
    crowns.push({ group: crown, phase: x * 0.37 + z * 0.21 })
    const flowers = add(new THREE.Group(), 0, 0, 0, crown)
    for (let i = 0; i < 7; i++) {
      const angle = i * 0.9
      add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), blossomMaterial), Math.cos(angle) * 0.6, 0.48 + Math.sin(i * 2.1) * 0.08, Math.sin(angle) * 0.6, flowers)
    }
    blossoms.push(flowers)
  }
  // 芒果園：濃密的圓形樹冠，夏季掛滿金黃的果實
  const mangoLeaf = textured('#4f6b3c', textures.leaves, 0.6, { roughness: 0.75 }, 3)
  // 芒果果皮帶蠟質光澤
  const mangoFruit = paint('#f0a830', 0.35)
  const fruits: THREE.Group[] = []
  const mangoSpots: [number, number][] = [[5.4, -8.2], [7.2, -6.6], [4.0, -9.6], [6.4, -9.0]]
  for (const [x, z] of mangoSpots) {
    const tree = add(new THREE.Group(), x, 0, z)
    add(solid(new THREE.CylinderGeometry(0.06, 0.1, 0.6, 6), trunkMaterial), 0, 0.3, 0, tree)
    const crown = add(new THREE.Group(), 0, 0.55, 0, tree)
    add(solid(new THREE.IcosahedronGeometry(0.55, 3), mangoLeaf), 0, 0.35, 0, crown)
    crowns.push({ group: crown, phase: x * 0.5 + z * 0.3 })
    const fruit = add(new THREE.Group(), 0, 0, 0, crown)
    for (let i = 0; i < 6; i++) {
      const angle = i * 1.05 + x
      const mango = add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mangoFruit), Math.cos(angle) * 0.5, 0.15 + (i % 3) * 0.14, Math.sin(angle) * 0.5, fruit)
      mango.scale.set(0.8, 1.2, 0.8)
    }
    fruits.push(fruit)
  }

  // 島緣的灌木與九重葛：在軌道外側，避開瀑布出口與觀景台
  {
    const bushColors = ['#6f8a4f', '#5f7a4c', '#7f9562', '#c2457a', '#d9733f', '#6f8a4f']
    const mouthDeg = THREE.MathUtils.radToDeg(Math.atan2(mouth.x, mouth.z))
    const spots: [number, number, number][] = []
    const bushRand = random(2010)
    for (let i = 0; i < 150; i++) {
      const deg = bushRand() * 360 - 180
      if (Math.abs(((deg - mouthDeg + 540) % 360) - 180) < 5) continue
      if (Math.abs(((deg - CROSS_DEG + 540) % 360) - 180) < 6) continue
      spots.push([deg, R - 0.15 - bushRand() * 0.2, 0.12 + bushRand() * 0.12])
    }
    const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), matte('#ffffff', { flatShading: true, roughness: 0.8 }), spots.length)
    const color = new THREE.Color()
    spots.forEach(([deg, radius, size], i) => {
      const [x, z] = polar(deg, radius)
      dummy.position.set(x, size * 0.5, z)
      dummy.rotation.set(0, deg, 0)
      dummy.scale.set(size, size * 0.8, size)
      dummy.updateMatrix()
      bushes.setMatrixAt(i, dummy.matrix)
      bushes.setColorAt(i, color.set(bushColors[i % bushColors.length]!))
    })
    bushes.castShadow = true
    bushes.receiveShadow = true
    island.add(bushes)
  }

  // —— 路燈與紅燈籠：夜晚亮起，帶出台南的人情味 ——
  const lampMaterial = glowing('#ffd27f', '#f6ead0')
  nightMaterials.push(lampMaterial)
  const lampSpots: [number, number][] = [[-1.9, 7.6], [1.9, 7.6], [-3.2, 3], [3.2, 3]]
  for (const [x, z] of lampSpots) {
    add(solid(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 8), paint(PALETTE.navy)), x, 0.75, z)
    add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), lampMaterial), x, 1.55, z)
  }
  const glows = [
    add(new THREE.PointLight('#ffcf8a', 0, 8, 1.6), -2.4, 1.7, 4.2),
    add(new THREE.PointLight('#ffcf8a', 0, 8, 1.6), 2.4, 1.7, 4.2),
    add(new THREE.PointLight('#ff9a6a', 0, 7, 1.6), polar(-44, 9.2)[0], 1.6, polar(-44, 9.2)[1]),
  ]
  for (const z of [6.6, 7.6]) {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 3.8, 4), metal('#3a3a3a', 0.6, 0.5))
    wire.rotation.z = Math.PI / 2
    add(wire, 0, 1.75, z)
    for (let i = 0; i < 6; i++) {
      const x = -1.6 + i * 0.64
      add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), lanternMaterial), x, 1.6 - Math.sin((i / 5) * Math.PI) * 0.15, z).scale.set(1, 1.25, 1)
    }
  }

  // —— 平交道：步道從圓環旁通往島緣的觀景台，與環島鐵道交會；紅白柵欄與交替閃爍的警示燈 ——
  // crossing 群組的原點在軌道上，+z 朝島外，步道沿 z 軸、軌道沿 x 軸
  const [crossX, crossZ] = polar(CROSS_DEG, TRACK_R)
  const crossing = add(new THREE.Group(), crossX, 0, crossZ)
  crossing.rotation.y = THREE.MathUtils.degToRad(CROSS_DEG)
  const path = add(fit(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.6), paverMaterial)), 0, 0.006, -2.3, crossing)
  path.rotation.x = -Math.PI / 2
  path.receiveShadow = true
  // 伸出島緣的木造觀景台與欄杆
  add(box(1.5, 0.12, 1.6, woodMaterial), 0, -0.04, 1.35, crossing)
  add(box(1.5, 0.04, 0.04, woodMaterial), 0, 0.45, 2.12, crossing)
  for (const x of [-0.73, 0.73]) {
    add(box(0.04, 0.04, 1.4, woodMaterial), x, 0.45, 1.45, crossing)
    for (const z of [0.85, 1.5, 2.12]) add(box(0.05, 0.45, 0.05, woodMaterial), x, 0.22, z, crossing)
  }
  const warningMaterials = [glowing('#ff4a32', '#5a1a16'), glowing('#ff4a32', '#5a1a16')]
  const barriers: { pivot: THREE.Group; side: number }[] = []
  for (const side of [-1, 1]) {
    const postX = -0.85 * side
    const postZ = 0.78 * side
    add(solid(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), paint('#f2eee9', 0.4)), postX, 0.65, postZ, crossing)
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      add(box(0.55, 0.08, 0.03, stripeMaterials[0]!), postX, 1.25, postZ, crossing).rotation.z = angle
    }
    warningMaterials.forEach((material, i) => {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), material), postX + (i ? 0.11 : -0.11), 1.0, postZ + 0.06 * side, crossing)
    })
    const pivot = add(stage.body(new THREE.Group()), postX, 0.58, postZ, crossing)
    // 柵欄放下時橫跨整條步道（步道寬 0.9，柵欄長 1.36）
    for (let i = 0; i < 4; i++) {
      const segment = box(0.34, 0.07, 0.07, stripeMaterials[i % 2]!)
      segment.position.x = (0.17 + i * 0.34) * side
      pivot.add(segment)
    }
    barriers.push({ pivot, side })
  }

  // —— 鐵道橋：環島鐵道跨越運河出口的位置 ——
  {
    let best = 0
    for (let i = 0; i <= 100; i++) {
      const p = canal.getPointAt(i / 100)
      const q = canal.getPointAt(best)
      if (Math.abs(Math.hypot(p.x, p.z) - TRACK_R) < Math.abs(Math.hypot(q.x, q.z) - TRACK_R)) best = i / 100
    }
    const point = canal.getPointAt(best)
    const angle = Math.atan2(point.x, point.z)
    const bridge = add(new THREE.Group(), Math.sin(angle) * TRACK_R, 0, Math.cos(angle) * TRACK_R)
    // 群組 +x 沿著軌道切線
    bridge.rotation.y = angle
    add(box(2.2, 0.06, 1.3, stoneMaterial), 0, 0.03, 0, bridge)
    for (const z of [-0.62, 0.62]) add(box(2.2, 0.22, 0.06, paint(PALETTE.navy)), 0, 0.17, z, bridge)
  }

  // —— 火車：深藍車身、紅色腰帶，夜晚車窗與頭燈亮起 ——
  // —— 台鐵觀光列車：山嵐號、海風號、鳴日號、藍皮解憂號（造型見 trains.ts），夜晚車窗與頭燈亮起 ——
  const trainWindow = glowing('#ffd890', '#1c2a40', glass)
  const headlight = glowing('#fff2c4', '#f6f1e6')
  const { trains, nightMaterials: trainLights } = createTrains({ window: trainWindow, headlight })
  nightMaterials.push(trainWindow, headlight)
  for (const train of trains) {
    for (const car of train.cars) {
      car.name = 'train-car'
      island.add(car)
    }
  }

  // —— 機車：繞行站前圓環 ——
  const scooters = [0, 1, 2, 3].map((i) => {
    const scooter = new THREE.Group()
    add(box(0.42, 0.16, 0.14, lacquer([PALETTE.red, PALETTE.blue, PALETTE.ochre, '#f2eee9'][i]!)), 0, 0.16, 0, scooter)
    add(solid(new THREE.CapsuleGeometry(0.07, 0.14, 4, 8), matte(['#6f8f9c', '#354449', '#d9a441', '#6a6b65'][i]!, { roughness: 0.95 })), -0.02, 0.38, 0, scooter)
    add(solid(new THREE.SphereGeometry(0.07, 10, 8), skin), -0.02, 0.56, 0, scooter)
    island.add(scooter)
    return { scooter, angle: i * (Math.PI / 2), speed: 0.55 + (i % 2) * 0.1 }
  })

  // —— 行人：道路上往返並在平交道前等候，廣場、夜市與林百貨前散步 ——
  const coats = [PALETTE.red, PALETTE.blue, '#d9a441', '#6a6b65', PALETTE.ochre, '#354449', '#f2eee9', '#8f6a5a']
  const person = (coat: string, parent: THREE.Object3D = island) => {
    const group = new THREE.Group()
    add(solid(new THREE.CapsuleGeometry(0.1, 0.26, 4, 8), matte(coat, { roughness: 0.95 })), 0, 0.26, 0, group)
    add(solid(new THREE.SphereGeometry(0.085, 12, 8), skin), 0, 0.55, 0, group)
    parent.add(stage.body(group))
    return group
  }
  // 步道上的行人：往返於圓環旁與觀景台之間（crossing 的區域座標，z = 0 為軌道、+z 往觀景台）
  // 靠右通行：往觀景台走 x < 0、往回走 x > 0；每人固定一條車道（內側或外側），彼此不會重疊
  const walkers = [0, 1, 2, 3].map((i) => ({
    group: person(coats[i]!, crossing),
    lane: i < 2 ? 0.14 : 0.36,
    x: 0,
    z: -3.8 + i * 1.5,
    dir: i % 2 ? -1 : 1,
    speed: 0.75 + i * 0.12,
    phase: i,
    state: 'walk' as 'walk' | 'wait' | 'hurry',
  }))
  for (const walker of walkers) {
    walker.x = -walker.dir * walker.lane
    walker.group.name = 'crossing-walker'
  }
  const strollers = [4, 5, 6, 7].map((i, n) => ({
    group: person(coats[i]!),
    center: new THREE.Vector2([-2.3, 2.3, -5.0, 5.4][n]!, [3.2, 3.2, 5.4, 5.4][n]!),
    radius: [0.7, 0.8, 0.55, 0.7][n]!,
    speed: (n % 2 ? -1 : 1) * (0.35 + n * 0.06),
    angle: n * 2,
    phase: n,
  }))

  // —— 空氣中的糖分：台南小吃偏甜，島上緩緩上升的金色微光 ——
  const sugarCount = 200
  const sugarPositions = new Float32Array(sugarCount * 3)
  const sugarSeeds = new Float32Array(sugarCount)
  for (let i = 0; i < sugarCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = Math.sqrt(Math.random()) * (R - 1)
    sugarPositions.set([Math.sin(angle) * radius, 0.3 + Math.random() * 6, Math.cos(angle) * radius], i * 3)
    sugarSeeds[i] = Math.random() * Math.PI * 2
  }
  const sugarGeometry = new THREE.BufferGeometry()
  sugarGeometry.setAttribute('position', new THREE.BufferAttribute(sugarPositions, 3))
  const sugarMaterial = new THREE.PointsMaterial({
    color: '#f6d9a0',
    size: 0.1,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  island.add(new THREE.Points(sugarGeometry, sugarMaterial))

  // —— 飄落的鳳凰花瓣與落葉：受重力加速、空氣阻力限制終端速度 ——
  const petalCount = 100
  const petalPositions = new Float32Array(petalCount * 3)
  const petalVelocity = new Float32Array(petalCount)
  const resetPetal = (i: number, randomHeight: boolean) => {
    const [x, z] = treeSpots[i % treeSpots.length]!
    petalPositions.set(
      [x + (Math.random() - 0.5) * 1.5, randomHeight ? Math.random() * 1.6 : 1.5, z + (Math.random() - 0.5) * 1.5],
      i * 3,
    )
    petalVelocity[i] = 0
  }
  for (let i = 0; i < petalCount; i++) resetPetal(i, true)
  const petalGeometry = new THREE.BufferGeometry()
  petalGeometry.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3))
  const petalMaterial = new THREE.PointsMaterial({ color: SEASONS[0]!.blossom, size: 0.12, transparent: true, depthWrite: false })
  island.add(new THREE.Points(petalGeometry, petalMaterial))

  // —— 小島周圍：漂浮的碎石、雲朵與白鷺鷥 ——
  const floaterMaterial = textured('#7a6352', textures.rock, 1.2, { flatShading: true, roughness: 0.95 }, 4)
  const floaters = [
    [0, 17, -2.5, 0.5], [50, 19, -7, 0.35], [110, 16.5, 0.5, 0.45], [160, 18, -9, 0.65],
    [205, 17, -4, 0.3], [250, 19.5, -0.5, 0.5], [300, 16.8, -8, 0.4], [335, 18, -11, 0.3],
  ].map(([deg, radius, y, size], i) => {
    const group = add(new THREE.Group(), 0, 0, 0, scene)
    add(solid(new THREE.DodecahedronGeometry(size!, 0), floaterMaterial), 0, -size! * 0.3, 0, group).scale.set(1, 1.3, 1)
    if (i % 2 === 0) add(solid(new THREE.CylinderGeometry(size! * 0.85, size! * 0.8, size! * 0.25, 7), lawnMaterial), 0, size! * 0.35, 0, group)
    return { group, angle: THREE.MathUtils.degToRad(deg!), radius: radius!, y: y!, phase: i * 1.3 }
  })

  const clouds = Array.from({ length: 9 }, (_, i) => {
    const cloudRand = random(300 + i * 17)
    const material = matte('#f7f4ee', { transparent: true, roughness: 1 })
    const group = add(new THREE.Group(), 0, 0, 0, scene)
    const puffs = 4 + Math.floor(cloudRand() * 3)
    for (let j = 0; j < puffs; j++) {
      const size = 0.9 + cloudRand() * 1.1
      add(new THREE.Mesh(new THREE.IcosahedronGeometry(size, 3), material), (j - puffs / 2) * 1.1, cloudRand() * 0.6, (cloudRand() - 0.5) * 1.4, group).scale.set(1, 0.7, 1)
    }
    return {
      group,
      material,
      angle: (i / 9) * Math.PI * 2 + cloudRand(),
      radius: 23 + cloudRand() * 10,
      y: [-11, 4, -4, 7, -8, 2, -13, 6, -2][i]!,
      speed: 0.012 + cloudRand() * 0.01,
    }
  })

  // 白鷺鷥：環繞小島飛行，白天出現、入夜歸巢
  const birdMaterial = matte('#fbfaf7', { side: THREE.DoubleSide, roughness: 0.75 })
  const flock = add(new THREE.Group(), 0, 0, 0, scene)
  const birds = Array.from({ length: 5 }, (_, i) => {
    const bird = add(new THREE.Group(), 0, 0, 0, flock)
    const body = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.28, 3, 6), birdMaterial), 0, 0, 0, bird)
    body.rotation.z = Math.PI / 2
    const wings = [-1, 1].map((sideZ) => {
      const pivot = add(new THREE.Group(), 0, 0.02, 0, bird)
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.5).rotateX(-Math.PI / 2), birdMaterial)
      wing.position.z = sideZ * 0.26
      pivot.add(wing)
      return { pivot, sideZ }
    })
    return { bird, wings, offset: i * 0.09, height: (i % 2) * 0.6 + i * 0.15, lane: i * 0.35 }
  })

  // —— 天空：漸層穹頂、日月與星空；月光為另一盞不投影的平行光 ——
  const sky = createSky()
  scene.add(sky.group)
  const sunDirection = new THREE.Vector3()
  const moonDirection = new THREE.Vector3()
  const moonLight = new THREE.DirectionalLight('#a9bde0', 0)
  scene.add(moonLight)

  // 從下方打亮岩石的反光
  const bounce = new THREE.DirectionalLight('#c9a37a', 0.4)
  bounce.position.set(-6, -14, 8)
  scene.add(bounce)

  // —— 夏季午後雷陣雨：雨絲以等速落下（已達終端速度）；島上的雨落在島頂，島外的雨落到雲下 ——
  const rainCount = 420
  const rainPositions = new Float32Array(rainCount * 6)
  const rainSeeds = Array.from({ length: rainCount }, () => {
    const angle = Math.random() * Math.PI * 2
    const radius = Math.sqrt(Math.random()) * 19
    return [Math.sin(angle) * radius, Math.random(), Math.cos(angle) * radius, radius < R ? 0 : -14]
  })
  const rainGeometry = new THREE.BufferGeometry()
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3))
  const rainMaterial = new THREE.LineBasicMaterial({ color: '#c9d4e0', transparent: true, opacity: 0 })
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial)
  rain.frustumCulled = false
  scene.add(rain)

  // —— 時間軸：火車停靠月台 → 繞行一圈 → 回到月台 ——
  const trip = keyframes([
    [0, 0],
    [0.15, 0],
    [0.85, 1],
    [1, 1],
  ])
  const stopOffset = ((CARS - 1) * CAR_SPACING) / 2 / trackLength
  // 平交道在軌道上的位置，以及整列車的長度（u）
  const crossU = (((CROSS_DEG - PLATFORM_DEG) / 360) % 1 + 1) % 1
  const trainU = ((CARS - 1) * CAR_SPACING + 1.4) / trackLength
  // 平交道的安全規則（場景秒數）：列車抵達前 WARN 秒警示燈閃爍、行人停在停止線，DOWN 秒前柵欄放下；
  // 車尾通過 CLEAR 秒後才升起。以時間預測而非距離判斷，發車間隔或緩動改變時仍保有足夠的警示時間
  const CROSSING = { WARN: 3.2, DOWN: 2.2, CLEAR: 0.5, STEP: 0.1 }
  // 柵欄之間的危險區（軌道兩側各 0.78）與停止線
  const DANGER_Z = 0.85
  const STOP_Z = 1.05
  // 列車佔用平交道的範圍：步道寬度加上安全距離
  const crossMargin = 0.7 / trackLength
  const wrapU = (u: number) => ((u % 1) + 1) % 1
  // 第 k 列車在場景時間 t 的車頭位置
  const headAt = (t: number, k: number, ease: (t: number) => number) =>
    wrapU(stopOffset + (Math.floor(t / TRIP) + trip(loop(t, TRIP), ease)) * TRAIN_GAP - k * TRAIN_GAP)
  const occupied = (head: number) => wrapU(head - crossU + crossMargin) < trainU + crossMargin * 2
  // 在 [from, to] 秒之間是否有任何列車佔用平交道
  const trainWithin = (time: number, from: number, to: number, ease: (t: number) => number) => {
    for (let dt = from; dt <= to + 1e-6; dt += CROSSING.STEP) {
      for (let k = 0; k < trains.length; k++) if (occupied(headAt(time + dt, k, ease))) return true
    }
    return false
  }

  let lastTime = 0
  let warning = false
  let hour = START_HOUR
  let seasonIndex = 0
  let isNight = false
  let sunrise = SEASONS[0]!.rise
  let sunset = SEASONS[0]!.set
  let controls: OrbitControls | null = null
  const working = new THREE.Color()
  const cameraWorld = new THREE.Vector3()

  return {
    ...stage,
    aspect: WIDTH / HEIGHT,
    toneMapping: { exposure: 1.1 },
    environment: true,
    timeline: { duration: TRIP, direction: 'normal', offsets: trip.offsets },
    overlay: {
      component: SceneClock,
      props: { read: () => ({ hour, season: SEASONS[seasonIndex]!, night: isNight }) },
      width: WIDTH,
      maxScale: 2.4,
    },
    // 左鍵拖曳旋轉、滾輪縮放、右鍵拖曳平移；觸控為單指旋轉、雙指縮放與平移
    // 可 360 度環繞並從島底仰望；限制距離與平移範圍，鏡頭始終在小島外側，不會穿入島身或建築
    controls(element) {
      const home = { position: stage.camera.position.clone(), target: new THREE.Vector3(0, -4.4, 0) }
      controls = new OrbitControls(stage.camera, element)
      controls.target.copy(home.target)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.enablePan = true
      controls.screenSpacePanning = true
      controls.panSpeed = 0.6
      controls.minDistance = 24
      controls.maxDistance = 62
      controls.minPolarAngle = THREE.MathUtils.degToRad(8)
      controls.maxPolarAngle = THREE.MathUtils.degToRad(172)
      controls.autoRotateSpeed = 0.8
      const clamp = () => {
        if (!controls) return
        controls.target.x = THREE.MathUtils.clamp(controls.target.x, -4, 4)
        controls.target.z = THREE.MathUtils.clamp(controls.target.z, -4, 4)
        controls.target.y = THREE.MathUtils.clamp(controls.target.y, -7, 2)
      }
      controls.addEventListener('change', clamp)
      controls.update()
      return {
        reset() {
          if (!controls) return
          stage.camera.position.copy(home.position)
          controls.target.copy(home.target)
          controls.update()
        },
        setAutoRotate(enabled) {
          if (controls) controls.autoRotate = enabled
        },
        dispose() {
          controls?.removeEventListener('change', clamp)
          controls?.dispose()
          controls = null
        },
      }
    },
    // 場景時間：列車的 keyframe 之外，另外回報一天的進度與季節
    diagnostics(time) {
      const label = clock(hour)
      // 月台上的列車：週期前半為停靠或剛出站的列車，後半為即將進站的下一列車
      const cycle = Math.floor(time / TRIP) + (loop(time, TRIP) >= 0.5 ? 1 : 0)
      const train = trains[cycle % trains.length]!.name
      const docked = loop(time, TRIP) < 0.15 || loop(time, TRIP) > 0.85
      const sun = `日出 ${clock(sunrise)} · 日落 ${clock(sunset)}`
      const day = Math.floor(time / DAY + START_HOUR / 24) + 1
      return {
        note: `場景時間 ${label} · ${SEASONS[seasonIndex]!.name}季（第 ${day} 天）· ${sun} · ${train}${docked ? '停靠月台' : '行駛中'}${warning ? ' · 平交道警示中' : ''}`,
      }
    },
    update(time, ease) {
      const dt = THREE.MathUtils.clamp(time - lastTime, 0, 0.1)
      lastTime = time
      controls?.update()

      // 漂浮：整座島緩慢上下起伏、輕微傾擺；卡片預覽沒有鏡頭操作時，小島自行緩緩旋轉展示全貌
      island.position.y = Math.sin(time * 0.5) * 0.3
      island.rotation.x = Math.sin(time * 0.37) * 0.012
      island.rotation.z = Math.sin(time * 0.29 + 1) * 0.012
      if (!controls) island.rotation.y = time * 0.12

      // 時間與季節：每天 24 秒，每天換一個季節，換季在深夜漸變
      const days = time / DAY + START_HOUR / 24
      hour = (days * 24) % 24
      seasonIndex = Math.floor(days) % 4
      const season = SEASONS[seasonIndex]!
      const next = SEASONS[(seasonIndex + 1) % 4]!
      const blend = THREE.MathUtils.smoothstep(days % 1, 0.9, 1)

      // 日月：依季節的日出、日落時刻與中天高度計算方向。月亮以滿月表示，與太陽相對：
      // 日落後升起、日出後落下，中天高度與太陽相反（冬季的滿月高、夏季的滿月低）
      sunrise = THREE.MathUtils.lerp(season.rise, next.rise, blend)
      sunset = THREE.MathUtils.lerp(season.set, next.set, blend)
      const noon = THREE.MathUtils.lerp(season.noon, next.noon, blend)
      celestialDirection(hour, sunrise, sunset, noon, sunDirection)
      celestialDirection(hour, sunset + 0.5, sunrise + 0.5, 134 - noon, moonDirection)

      // 天色依太陽時取樣：日出前後地平線最暖，日落後轉為深藍
      const solar = solarHour(hour, sunrise, sunset)
      const night = sampleStops(NIGHT, solar, mixNumber)
      isNight = night > 0.5
      // 夏季午後 14 ~ 17 時雷陣雨：雲層遮蔽日照、天色轉灰
      const rainAmount =
        THREE.MathUtils.lerp(season.rain, next.rain, blend) *
        THREE.MathUtils.smoothstep(hour, 13.5, 14.5) *
        (1 - THREE.MathUtils.smoothstep(hour, 16.5, 17.5))
      const haze = THREE.MathUtils.lerp(season.haze, next.haze, blend)
      const gray = hex('#7d8794')
      const mist = hex(PALETTE.gray)
      const zenith = sampleStops(SKY, solar, mixColor).clone().lerp(gray, rainAmount * 0.55).lerp(mist, haze * 0.25 * (1 - night))
      const horizon = sampleStops(HORIZON, solar, mixColor).clone().lerp(gray, rainAmount * 0.5).lerp(mist, haze * 0.35 * (1 - night))
      sky.uniforms.zenith.value.copy(zenith)
      sky.uniforms.horizon.value.copy(horizon)
      // 地平線以下是雲海：白天較亮、夜晚較暗
      sky.uniforms.ground.value.copy(horizon).lerp(hex('#f4f1ea'), 0.3 * (1 - night)).multiplyScalar(0.92)
      scene.background = horizon
      const fog = scene.fog as THREE.Fog
      fog.color.copy(horizon)
      fog.near = 45 - haze * 14 - rainAmount * 10
      stage.camera.getWorldPosition(cameraWorld)
      sky.follow(cameraWorld, time, night * (1 - haze * 0.6) * (1 - rainAmount) * 0.9)

      // 日照：太陽越過地平線後才有直射光，低角度時較弱、較暖；陰影隨太陽方向移動
      const sunColor = sampleStops(SUN_COLOR, solar, mixColor)
      const daylight = THREE.MathUtils.smoothstep(sunDirection.y, -0.03, 0.1)
      const sunStrength = THREE.MathUtils.lerp(season.sun, next.sun, blend) * (1 - rainAmount * 0.6)
      stage.sun.position.copy(sunDirection).multiplyScalar(30)
      stage.sun.color.copy(sunColor)
      stage.sun.intensity = 1.8 * sunStrength * daylight * (0.45 + 0.55 * THREE.MathUtils.smoothstep(sunDirection.y, 0, 0.5))
      sky.uniforms.sunColor.value.copy(sunColor)
      sky.uniforms.sunDirection.value.copy(sunDirection)
      // 低角度的陽光穿過較厚的大氣，圓盤偏橘紅且較暗
      const low = 1 - THREE.MathUtils.smoothstep(sunDirection.y, 0, 0.18)
      sky.uniforms.sunDiskColor.value
        .copy(sunColor)
        .lerp(hex('#ff6a2e'), low * 0.75)
        .multiplyScalar(1.4 + 2.6 * THREE.MathUtils.smoothstep(sunDirection.y, 0.02, 0.35))
      // 光暈在日出日落時最寬最亮，太陽沉到地平線下後逐漸消失
      sky.uniforms.sunGlow.value =
        (0.35 + 0.9 * (1 - THREE.MathUtils.smoothstep(sunDirection.y, 0.05, 0.6))) *
        THREE.MathUtils.smoothstep(sunDirection.y, -0.25, 0) *
        (1 - rainAmount * 0.8) +
        0.001
      // 月亮：升到地平線上後才有月光；白天仍在天上時只剩淡淡的圓盤
      const moonUp = THREE.MathUtils.smoothstep(moonDirection.y, -0.02, 0.15)
      moonLight.position.copy(moonDirection).multiplyScalar(30)
      moonLight.intensity = 0.5 * moonUp * (1 - daylight) * (1 - rainAmount * 0.7)
      sky.uniforms.moonDirection.value.copy(moonDirection)
      sky.uniforms.moonVisibility.value = THREE.MathUtils.smoothstep(moonDirection.y, -0.1, 0) * (1 - daylight * 0.8) * (1 - rainAmount)
      // 環境光照貼圖提供反射與間接光，平行環境光減量避免過亮
      stage.ambient.intensity = sampleStops(AMBIENT, solar, mixNumber) * 0.55
      scene.environmentIntensity = (0.12 + 0.5 * (1 - night)) * (1 - rainAmount * 0.3)
      stage.ambient.color.setRGB(1, 1, 1).lerp(hex(PALETTE.blue), night * 0.7)
      bounce.intensity = 0.45 * (1 - night * 0.6)

      for (const material of nightMaterials) material.emissiveIntensity = night * 0.95
      for (const material of trainLights) material.emissiveIntensity = 0.4 + night * 1.2
      for (const glow of glows) glow.intensity = night * 6
      waterMaterial.emissiveIntensity = night * 0.6
      // 水波沿運河方向流動
      textures.water.normal!.offset.set(time * 0.04, time * 0.11)
      fallMaterial.color.setScalar(0.45 + 0.55 * (1 - night))
      dropMaterial.color.setScalar(0.5 + 0.5 * (1 - night))
      mistMaterial.color.setScalar(0.5 + 0.5 * (1 - night))

      // 季節：草地、樹葉、花朵、芒果與飄落物
      lawnMaterial.color.copy(working.set(season.lawn).lerp(hex(next.lawn), blend))
      foliageMaterial.color.copy(working.set(season.foliage).lerp(hex(next.foliage), blend))
      blossomMaterial.color.copy(working.set(season.blossom).lerp(hex(next.blossom), blend))
      petalMaterial.color.copy(blossomMaterial.color)
      const bloom = THREE.MathUtils.lerp(season.bloom, next.bloom, blend)
      for (const flowers of blossoms) flowers.scale.setScalar(Math.max(bloom, 0.001))
      const mango = THREE.MathUtils.lerp(season.mango, next.mango, blend)
      for (const fruit of fruits) fruit.scale.setScalar(Math.max(mango, 0.001))
      petalMaterial.opacity = THREE.MathUtils.lerp(season.petals, next.petals, blend) * 0.9

      // 風：樹冠、根鬚與旗幟以不同相位擺動，下雨時風勢較強
      const wind = 0.04 + rainAmount * 0.06
      for (const { group, phase } of crowns) {
        group.rotation.z = Math.sin(time * 1.3 + phase) * wind
        group.rotation.x = Math.sin(time * 0.9 + phase * 1.7) * wind * 0.6
      }
      for (const { pivot, phase } of roots) {
        pivot.rotation.x = Math.sin(time * 0.8 + phase) * (0.06 + wind)
        pivot.rotation.z = Math.sin(time * 0.6 + phase * 1.3) * 0.05
      }
      flagPivot.rotation.y = Math.sin(time * 2.2) * 0.35 + 0.2

      // 雨絲：以時間差計算位置，不受影格率影響
      rainMaterial.opacity = rainAmount * 0.55
      rain.visible = rainAmount > 0.01
      if (rain.visible) {
        for (let i = 0; i < rainCount; i++) {
          const [x, seed, z, bottom] = rainSeeds[i]!
          const span = 10 - bottom!
          const y = 10 - ((seed! * span + time * 14) % span)
          rainPositions.set([x! + y * 0.04, y, z!, x! + (y - 0.35) * 0.04, y - 0.35, z!], i * 6)
        }
        rainGeometry.attributes.position!.needsUpdate = true
      }

      // 時鐘指針
      hourHand.rotation.z = -((hour % 12) / 12) * Math.PI * 2
      minuteHand.rotation.z = -(hour % 1) * Math.PI * 2

      // 列車：每個週期前進四分之一圈，緩動曲線作用在出站與進站的加減速；
      // 第 k 列車落後 k 個間隔，因此每個週期輪到下一列車停靠月台
      trains.forEach((train, k) => {
        const head = headAt(time, k, ease)
        train.cars.forEach((car, i) => {
          const u = wrapU(head - (i * CAR_SPACING) / trackLength)
          track.getPointAt(u, car.position)
          car.position.y = 0.06
          track.getTangentAt(u, tangent)
          car.rotation.y = Math.atan2(-tangent.z, tangent.x)
        })
      })

      // 平交道：預測未來數秒內是否有列車通過。先警示、再放下柵欄（物理彈簧回彈），車尾通過後才升起
      warning = trainWithin(time, -CROSSING.CLEAR, CROSSING.WARN, ease)
      const lowered = trainWithin(time, -CROSSING.CLEAR, CROSSING.DOWN, ease)
      for (const { pivot, side } of barriers) pivot.rotation.z = lowered ? 0 : side * THREE.MathUtils.degToRad(82)
      const blink = Math.floor(time * 3) % 2
      warningMaterials.forEach((material, i) => (material.emissiveIntensity = warning && blink === i ? 1.8 : 0))

      // 行人：警示期間不進入危險區，停在停止線等候；已在危險區內的行人加快腳步離開
      for (const walker of walkers) {
        const inside = Math.abs(walker.z) < DANGER_Z
        walker.state = !warning ? 'walk' : inside ? 'hurry' : walker.state === 'wait' ? 'wait' : 'walk'
        const speed = walker.speed * (walker.state === 'hurry' ? 2.2 : 1)
        let nextZ = walker.z + walker.dir * speed * dt
        // 在危險區外、正朝軌道走，且下一步會越過停止線：停在停止線（已越過停止線者原地停下）
        const inward = Math.sign(walker.z) !== Math.sign(walker.dir)
        if (warning && !inside && inward && Math.abs(nextZ) < STOP_Z) {
          nextZ = Math.sign(walker.z) * Math.min(Math.abs(walker.z), STOP_Z)
          walker.state = 'wait'
        }
        const moving = walker.state !== 'wait'
        walker.z = nextZ
        if (walker.z < -3.9) walker.dir = 1
        if (walker.z > 1.9) walker.dir = -1
        // 掉頭時換到另一側的車道（靠右通行）
        walker.x += (-walker.dir * walker.lane - walker.x) * Math.min(dt * 4, 1)
        if (moving) walker.phase += dt * speed * 9
        walker.group.position.set(walker.x, Math.abs(Math.sin(walker.phase)) * (moving ? 0.05 : 0), walker.z)
        walker.group.rotation.set(0, walker.dir > 0 ? 0 : Math.PI, moving ? Math.sin(walker.phase) * 0.06 : 0)
      }
      for (const stroller of strollers) {
        stroller.angle += stroller.speed * dt
        stroller.phase += dt * 6
        stroller.group.position.set(
          stroller.center.x + Math.cos(stroller.angle) * stroller.radius,
          Math.abs(Math.sin(stroller.phase)) * 0.04,
          stroller.center.y + Math.sin(stroller.angle) * stroller.radius,
        )
        stroller.group.rotation.y = -stroller.angle - (Math.sign(stroller.speed) * Math.PI) / 2
      }

      // 機車：沿圓環逆時針行駛
      for (const item of scooters) {
        item.angle += item.speed * dt
        item.scooter.position.set(
          roundabout.x + Math.cos(item.angle) * 1.65,
          0,
          roundabout.z + Math.sin(item.angle) * 1.65,
        )
        item.scooter.rotation.y = -item.angle - Math.PI / 2
      }

      // 運河小船：在上下游之間往返，兩端緩慢減速、掉頭
      const voyage = (1 - Math.cos((time / 20) * Math.PI * 2)) / 2
      const boatU = 0.06 + voyage * 0.6
      canal.getPointAt(boatU, boat.position)
      boat.position.y = 0.02 + Math.sin(time * 2.4) * 0.015
      canal.getTangentAt(boatU, tangent)
      const downstream = Math.sin((time / 20) * Math.PI * 2) >= 0
      boat.rotation.y = Math.atan2(-tangent.z, tangent.x) + (downstream ? 0 : Math.PI)

      // 瀑布：水幕條紋往下捲動；水滴沿拋物線落下、水霧在下方擴散，皆以時間差計算位置
      textures.falls.map.offset.y = time * 1.1
      textures.falls.bump!.offset.y = time * 1.1
      for (let i = 0; i < dropCount; i++) {
        const [offset, lateral, jitter] = dropSeeds[i]!
        const t = ((time * 0.45 + offset!) % 1) * (FALL_TIME + 0.1)
        const out = t * (FALL_SPEED * (0.8 + jitter! * 0.4))
        dropPositions.set(
          [
            mouth.x + outward.x * out + across.x * lateral! * (1 + t * 0.15),
            0.03 - 0.5 * FALL_GRAVITY * t * t,
            mouth.z + outward.z * out + across.z * lateral! * (1 + t * 0.15),
          ],
          i * 3,
        )
      }
      dropGeometry.attributes.position!.needsUpdate = true
      for (let i = 0; i < mistCount; i++) {
        const [offset, angle, speed] = mistSeeds[i]!
        const t = (time * 0.22 + offset!) % 1
        const spread = t * 1.8 * speed!
        mistPositions.set(
          [mistOrigin.x + Math.cos(angle!) * spread, mistOrigin.y - t * 1.4, mistOrigin.z + Math.sin(angle!) * spread],
          i * 3,
        )
      }
      mistGeometry.attributes.position!.needsUpdate = true

      // 小吃攤的熱氣：清晨與夜晚最旺
      steamMaterial.opacity = sampleStops(STEAM, hour, mixNumber) * 0.45
      pots.forEach((pot, p) => {
        for (let j = 0; j < steamPerPot; j++) {
          const t = (time * 0.4 + j / steamPerPot) % 1
          const i = p * steamPerPot + j
          steamPositions.set([pot.x + Math.sin(t * 6 + j) * 0.08 * (1 + t), pot.y + t * 1.2, pot.z + Math.cos(t * 5 + j) * 0.08 * (1 + t)], i * 3)
        }
      })
      steamGeometry.attributes.position!.needsUpdate = true

      // 漂浮碎石：繞著小島緩慢公轉、上下起伏
      for (const floater of floaters) {
        const a = floater.angle + time * 0.03
        floater.group.position.set(Math.sin(a) * floater.radius, floater.y + Math.sin(time * 0.6 + floater.phase) * 0.4, Math.cos(a) * floater.radius)
        floater.group.rotation.y = time * 0.1 + floater.phase
      }

      // 雲朵：以不同速度環繞；靠近鏡頭時淡出，避免遮住畫面
      for (const cloud of clouds) {
        const a = cloud.angle + time * cloud.speed
        cloud.group.position.set(Math.sin(a) * cloud.radius, cloud.y + Math.sin(time * 0.3 + cloud.angle) * 0.3, Math.cos(a) * cloud.radius)
        cloud.group.rotation.y = a
        const distance = cloud.group.position.distanceTo(cameraWorld)
        cloud.material.opacity = THREE.MathUtils.smoothstep(distance, 5, 11)
        cloud.group.visible = cloud.material.opacity > 0.01
      }

      // 白鷺鷥：沿著略為起伏的圓周飛行、拍翅；入夜後淡出
      flock.visible = night < 0.6
      birds.forEach(({ bird, wings, offset, height, lane }, i) => {
        const a = time * 0.16 + offset
        const radius = 17.5 + lane
        bird.position.set(Math.sin(a) * radius, 4.5 + height + Math.sin(time * 0.7 + i) * 0.4, Math.cos(a) * radius)
        // 機身 +x 對齊飛行方向
        bird.rotation.y = a
        const flap = Math.sin(time * 7 + i * 1.3) * 0.6
        for (const { pivot, sideZ } of wings) pivot.rotation.x = flap * sideZ
      })

      // 糖分微光：緩慢上升、左右飄動，傍晚與夜晚更明顯
      for (let i = 0; i < sugarCount; i++) {
        const y = sugarPositions[i * 3 + 1]! + dt * 0.25
        sugarPositions[i * 3]! += Math.sin(time * 0.8 + sugarSeeds[i]!) * dt * 0.15
        sugarPositions[i * 3 + 1] = y > 6.3 ? 0.3 : y
      }
      sugarGeometry.attributes.position!.needsUpdate = true
      sugarMaterial.opacity = 0.3 + night * 0.5

      // 花瓣：重力加速、空氣阻力（阻尼）限制下落速度，左右飄盪
      for (let i = 0; i < petalCount; i++) {
        petalVelocity[i] = (petalVelocity[i]! - 2.4 * dt) * (1 - 1.8 * dt)
        petalPositions[i * 3 + 1]! += petalVelocity[i]! * dt
        petalPositions[i * 3]! += Math.sin(time * 1.6 + i) * dt * 0.3
        if (petalPositions[i * 3 + 1]! < 0.02) resetPetal(i, false)
      }
      petalGeometry.attributes.position!.needsUpdate = true
    },
  }
}
