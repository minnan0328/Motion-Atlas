import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createStage, type Motion } from '../../three/stage'
import { keyframes, loop } from '../../three/timeline'
import SceneClock from './scene-clock.vue'

// 台南火車站：以舊火車站（1936 年落成）為主體，周圍是站前圓環與街屋；
// 火車繞行車站，前方平交道有行人等候；24 小時由白天到黑夜、四季輪替，空氣中飄著帶甜味的微光

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
const PAVEMENT = '#b9b2ad'
const ROAD = '#8e8985'

const WIDTH = 200
const HEIGHT = 120
// 一天的秒數（1 秒 = 1 小時）
const DAY = 24
// 火車繞行一圈（含停靠月台）的秒數
const TRIP = 12
const START_HOUR = 6

// 軌道：環繞車站的橢圓，u = 0 為後方月台、u = 0.5 為前方平交道
const TRACK_A = 8.4
const TRACK_B = 5
const CAR_SPACING = 1.55
const CARS = 3

// 台南屬熱帶季風氣候：樹木四季常綠，以花期與乾濕季區分季節
// 春：木棉花開（橙紅）；夏：鳳凰花開（紅），午後雷陣雨；秋：乾季、草地略黃；冬：東北季風帶來乾燥與薄霧，太陽較低
export const SEASONS = [
  { name: '春', en: 'Spring', lawn: '#a3ad7c', foliage: '#7f9562', blossom: '#d9733f', bloom: 1, petals: 0.8, rain: 0, haze: 0, sun: 1 },
  { name: '夏', en: 'Summer', lawn: '#8fa06f', foliage: '#5f7a4c', blossom: PALETTE.red, bloom: 1, petals: 0.6, rain: 1, haze: 0, sun: 1.1 },
  { name: '秋', en: 'Autumn', lawn: '#b3a878', foliage: '#7d8a55', blossom: PALETTE.ochre, bloom: 0, petals: 0.35, rain: 0, haze: 0.2, sun: 0.95 },
  { name: '冬', en: 'Winter', lawn: '#a7a68f', foliage: '#6f7e5f', blossom: PALETTE.gray, bloom: 0, petals: 0.1, rain: 0, haze: 0.55, sun: 0.75 },
]

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

// 天色：夜晚深藍、清晨與黃昏赭黃、白天藍灰
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

// 固定亂數，讓城市每次都長得一樣
function random(seed: number) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

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

export default function tainanStation(): Motion {
  const stage = createStage({
    mode: '3d',
    aspect: WIDTH / HEIGHT,
    fov: 34,
    cameraY: 13,
    lookY: 0.4,
    distance: 18.5,
    light: [10, 16, 6],
    shadowSize: 16,
    shadowMapSize: 2048,
    unit: 0.1,
  })
  const { scene } = stage
  scene.fog = new THREE.Fog(PALETTE.blue, 30, 70)

  const lambert = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) =>
    new THREE.MeshLambertMaterial({ color, ...extra })
  const add = <T extends THREE.Object3D>(object: T, x = 0, y = 0, z = 0, parent: THREE.Object3D = scene): T => {
    object.position.set(x, y, z)
    parent.add(object)
    return object
  }
  const solid = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }
  const box = (w: number, h: number, d: number, material: THREE.Material) => solid(new THREE.BoxGeometry(w, h, d), material)
  const flat = (w: number, d: number, material: THREE.Material, x: number, z: number, y = 0.004) => {
    const mesh = add(new THREE.Mesh(new THREE.PlaneGeometry(w, d), material), x, y, z)
    mesh.rotation.x = -Math.PI / 2
    mesh.receiveShadow = true
    return mesh
  }

  // 夜晚會亮起的材質
  const glowing = (emissive: string, color = PALETTE.navy) => lambert(color, { emissive, emissiveIntensity: 0 })
  const windowGlass = glowing('#ffcf7a')
  const cityWindow = glowing('#f3c27a', '#2a3448')
  const nightMaterials: THREE.MeshLambertMaterial[] = [windowGlass, cityWindow]

  // 外牆上部為白色方磚，下部為厚重的人造石腰牆
  const wallMaterial = lambert(WALL)
  const stoneMaterial = lambert('#d2cbc3')
  const trimMaterial = lambert(TRIM)
  const roofMaterial = lambert(ROOF)

  // —— 地面：鋪面、道路、站前圓環、車站內側草地 ——
  flat(120, 120, lambert(PAVEMENT), 0, 0, -0.02)
  const lawnMaterial = lambert(SEASONS[0]!.lawn)
  const lawn = add(new THREE.Mesh(new THREE.CircleGeometry(1, 64), lawnMaterial), 0, -0.005, 0)
  lawn.rotation.x = -Math.PI / 2
  lawn.scale.set(TRACK_A + 1.2, TRACK_B + 1.2, 1)
  lawn.receiveShadow = true

  const roadMaterial = lambert(ROAD)
  flat(3, 30, roadMaterial, 0, 18)
  flat(46, 2.6, roadMaterial, 0, 11.5)
  flat(2.6, 26, roadMaterial, -15, 0)
  flat(2.6, 26, roadMaterial, 15, 0)
  flat(32, 2.6, roadMaterial, 0, -11)
  // 站前廣場
  const plaza = add(new THREE.Mesh(new THREE.CircleGeometry(1, 48), lambert('#ddd5cc')), 0, 0.002, 3.2)
  plaza.rotation.x = -Math.PI / 2
  plaza.scale.set(3.6, 1.4, 1)
  plaza.receiveShadow = true

  // 站前圓環：環狀道路、中央綠地與紀念碑
  const roundabout = new THREE.Vector3(0, 0, 11.5)
  const ring = add(new THREE.Mesh(new THREE.RingGeometry(1.5, 2.9, 64), roadMaterial), roundabout.x, 0.006, roundabout.z)
  ring.rotation.x = -Math.PI / 2
  ring.receiveShadow = true
  const island = add(new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), lawnMaterial), roundabout.x, 0.008, roundabout.z)
  island.rotation.x = -Math.PI / 2
  island.receiveShadow = true
  add(solid(new THREE.CylinderGeometry(0.5, 0.6, 0.25, 24), trimMaterial), roundabout.x, 0.12, roundabout.z)
  add(solid(new THREE.CylinderGeometry(0.08, 0.14, 1.6, 8), lambert(WALL)), roundabout.x, 1, roundabout.z)

  // —— 軌道：枕木與兩條鐵軌 ——
  const track = new THREE.CatmullRomCurve3(
    Array.from({ length: 120 }, (_, i) => {
      const t = (i / 120) * Math.PI * 2
      return new THREE.Vector3(TRACK_A * Math.sin(t), 0, -TRACK_B * Math.cos(t))
    }),
    true,
  )
  const trackLength = track.getLength()
  const tangent = new THREE.Vector3()

  const ballast = add(new THREE.Mesh(new THREE.RingGeometry(0.94, 1.06, 160), lambert('#9c948d')), 0, 0.003, 0)
  ballast.rotation.x = -Math.PI / 2
  ballast.scale.set(TRACK_A, TRACK_B, 1)
  ballast.receiveShadow = true

  const sleeperCount = 190
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.06, 0.16), lambert('#6e5f52'), sleeperCount)
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
  scene.add(sleepers)

  const railMaterial = lambert('#5d6672')
  for (const side of [-1, 1]) {
    const points = Array.from({ length: 200 }, (_, i) => {
      const u = i / 200
      const p = track.getPointAt(u)
      track.getTangentAt(u, tangent)
      return p.add(new THREE.Vector3(tangent.z, 0, -tangent.x).normalize().multiplyScalar(0.22 * side)).setY(0.09)
    })
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 400, 0.035, 6, true),
      railMaterial,
    )
    rail.castShadow = true
    scene.add(rail)
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
  const clockFace = add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 40), lambert('#f6f1e6')), 0, 4.6, 1.74, station)
  clockFace.rotation.x = Math.PI / 2
  add(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 40), lambert(PALETTE.navy)), 0, 4.6, 1.76, station)
  const hand = (length: number) => {
    const pivot = add(new THREE.Group(), 0, 4.6, 1.79, station)
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.03, length, 0.02), lambert(PALETTE.navy))
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
  add(box(1.5, 0.2, 0.05, lambert(PALETTE.navy)), 0, 1.98, porchFront - 0.02, station)

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

  // 後方月台與雨棚
  add(box(9, 0.22, 1, trimMaterial), 0, 0.11, -4.35, station)
  add(box(9, 0.08, 1.3, roofMaterial), 0, 1.45, -4.35, station)
  for (let x = -4; x <= 4; x += 2) add(box(0.08, 1.25, 0.08, lambert(PALETTE.navy)), x, 0.82, -4.1, station)

  // —— 城市：周圍的街屋，一樓騎樓、樓上住家，夜晚亮燈，掛著直立招牌 ——
  const rand = random(1936)
  const cityMaterials = ['#d9d1ca', '#cfc6be', PALETTE.gray, '#d8c3a8', '#e2dbd4'].map((color) => lambert(color))
  const signMaterials = [glowing(PALETTE.red, PALETTE.red), glowing(PALETTE.ochre, PALETTE.ochre)]
  nightMaterials.push(...signMaterials)
  const cityWindows: THREE.Matrix4[] = []
  const windowScale = new THREE.Vector3(0.24, 0.32, 0.04)

  // 沿著 from → to 排一列街屋，面向 facing（建築正面的法線方向）
  const street = (from: THREE.Vector2, to: THREE.Vector2, facing: number) => {
    const direction = to.clone().sub(from)
    const length = direction.length()
    direction.normalize()
    let offset = 0
    while (offset < length - 0.8) {
      const width = Math.min(1 + rand() * 0.9, length - offset)
      const floors = 2 + Math.floor(rand() * 3)
      const height = 0.4 + floors * 0.82
      const depth = 2.2
      const center = from.clone().add(direction.clone().multiplyScalar(offset + width / 2))
      const house = new THREE.Group()
      house.position.set(center.x, 0, center.y)
      house.rotation.y = facing
      scene.add(house)

      const material = cityMaterials[Math.floor(rand() * cityMaterials.length)]!
      add(box(width - 0.06, height, depth, material), 0, height / 2, -depth / 2, house)
      // 騎樓：一樓內縮的深色空間與樑
      add(box(width - 0.06, 0.82, 0.06, lambert('#4a4f59')), 0, 0.41, 0.0, house).castShadow = false
      add(box(width - 0.02, 0.12, 0.5, material), 0, 0.88, 0.2, house)
      // 屋頂水塔或女兒牆
      if (rand() > 0.5) add(box(0.36, 0.3, 0.36, lambert('#8f8a87')), (rand() - 0.5) * 0.4, height + 0.15, -depth / 2, house)
      // 樓上窗戶
      const perRow = Math.max(1, Math.floor(width / 0.45))
      for (let floor = 1; floor < floors; floor++) {
        for (let i = 0; i < perRow; i++) {
          const local = new THREE.Vector3(-width / 2 + (width / perRow) * (i + 0.5), 0.45 + floor * 0.82, 0.02)
          house.updateMatrixWorld()
          const world = local.applyMatrix4(house.matrixWorld)
          cityWindows.push(new THREE.Matrix4().compose(world, house.quaternion, windowScale))
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
  street(new THREE.Vector2(-13.5, -13), new THREE.Vector2(13.5, -13), 0)
  street(new THREE.Vector2(-17, 10.5), new THREE.Vector2(-17, -9.5), Math.PI / 2)
  street(new THREE.Vector2(17, -9.5), new THREE.Vector2(17, 10.5), -Math.PI / 2)
  street(new THREE.Vector2(-14, 13.5), new THREE.Vector2(-3.4, 13.5), Math.PI)
  street(new THREE.Vector2(3.4, 13.5), new THREE.Vector2(14, 13.5), Math.PI)
  street(new THREE.Vector2(-13.5, 9.5), new THREE.Vector2(-4, 9.5), Math.PI)
  street(new THREE.Vector2(4, 9.5), new THREE.Vector2(13.5, 9.5), Math.PI)

  const windows = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cityWindow, cityWindows.length)
  cityWindows.forEach((matrix, i) => windows.setMatrixAt(i, matrix))
  scene.add(windows)

  // —— 樹木：依季節變色，春夏開花 ——
  const foliageMaterial = lambert(SEASONS[0]!.foliage, { flatShading: true })
  const blossomMaterial = lambert(SEASONS[0]!.blossom, { flatShading: true })
  const blossoms: THREE.Group[] = []
  const crowns: { group: THREE.Group; phase: number }[] = []
  const treeSpots: [number, number][] = [
    [-5.6, 2.7], [5.6, 2.7], [-6.6, -2.6], [6.6, -2.6], [-2.6, 7.6], [2.6, 7.6],
    [-11, 4], [11, 4], [-11, -5], [11, -5], [-1.1, 11.1], [1.1, 12],
    [-7, 11.5], [7, 11.5], [-12.5, -11], [12.5, -11],
  ]
  for (const [x, z] of treeSpots) {
    const tree = add(new THREE.Group(), x, 0, z)
    add(solid(new THREE.CylinderGeometry(0.07, 0.11, 1, 6), lambert('#6b5544')), 0, 0.5, 0, tree)
    // 樹冠以樹幹頂端為軸，隨風擺動
    const crown = add(new THREE.Group(), 0, 0.95, 0, tree)
    add(solid(new THREE.IcosahedronGeometry(0.66, 1), foliageMaterial), 0, 0.35, 0, crown)
    add(solid(new THREE.IcosahedronGeometry(0.45, 1), foliageMaterial), 0.3, 0.7, -0.1, crown)
    crowns.push({ group: crown, phase: x * 0.37 + z * 0.21 })
    const flowers = add(new THREE.Group(), 0, -0.95, 0, crown)
    for (let i = 0; i < 6; i++) {
      const angle = i * 1.05
      add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), blossomMaterial), Math.cos(angle) * 0.5, 1.35 + Math.sin(i * 2.1) * 0.35, Math.sin(angle) * 0.5, flowers)
    }
    blossoms.push(flowers)
  }

  // —— 路燈與紅燈籠：夜晚亮起，帶出台南的人情味 ——
  const lampMaterial = glowing('#ffd27f', '#f6ead0')
  nightMaterials.push(lampMaterial)
  const lampSpots: [number, number][] = [[-1.9, 7.4], [1.9, 7.4], [-3.2, 3], [3.2, 3], [-3.4, 10], [3.4, 10]]
  for (const [x, z] of lampSpots) {
    add(solid(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 8), lambert(PALETTE.navy)), x, 0.75, z)
    add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), lampMaterial), x, 1.55, z)
  }
  const glows = [
    add(new THREE.PointLight('#ffcf8a', 0, 8, 1.6), -2.4, 1.7, 4.2),
    add(new THREE.PointLight('#ffcf8a', 0, 8, 1.6), 2.4, 1.7, 4.2),
    add(new THREE.PointLight('#ff9a6a', 0, 7, 1.6), 0, 1.6, 8.6),
  ]
  const lanternMaterial = glowing('#ff6a3d', PALETTE.red)
  nightMaterials.push(lanternMaterial)
  for (const z of [6.4, 8.6]) {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 3.8, 4), lambert('#3a3a3a'))
    wire.rotation.z = Math.PI / 2
    add(wire, 0, 1.75, z)
    for (let i = 0; i < 6; i++) {
      const x = -1.6 + i * 0.64
      add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), lanternMaterial), x, 1.6 - Math.sin((i / 5) * Math.PI) * 0.15, z).scale.set(1, 1.25, 1)
    }
  }

  // —— 平交道：紅白相間的柵欄與交替閃爍的警示燈 ——
  const crossingZ = TRACK_B
  const warningMaterials = [glowing('#ff4a32', '#5a1a16'), glowing('#ff4a32', '#5a1a16')]
  const stripeMaterials = [lambert(PALETTE.red), lambert('#f2eee9')]
  const barriers: { pivot: THREE.Group; side: number }[] = []
  for (const side of [-1, 1]) {
    const postX = -1.75 * side
    const postZ = crossingZ + 0.9 * side
    add(solid(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), lambert('#f2eee9')), postX, 0.65, postZ)
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      add(box(0.55, 0.08, 0.03, stripeMaterials[0]!), postX, 1.25, postZ).rotation.z = angle
    }
    warningMaterials.forEach((material, i) => {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), material), postX + (i ? 0.11 : -0.11), 1.0, postZ + 0.06 * side)
    })
    const pivot = add(stage.body(new THREE.Group()), postX, 0.58, postZ)
    for (let i = 0; i < 7; i++) {
      const segment = box(0.46, 0.07, 0.07, stripeMaterials[i % 2]!)
      segment.position.x = (0.23 + i * 0.46) * side
      pivot.add(segment)
    }
    barriers.push({ pivot, side })
  }

  // —— 火車：深藍車身、紅色腰帶，夜晚車窗與頭燈亮起 ——
  const trainWindow = glowing('#ffd890', '#1c2a40')
  const headlight = glowing('#fff2c4', '#f6f1e6')
  nightMaterials.push(trainWindow, headlight)
  const trainBody = lambert(PALETTE.navy)
  const trainStripe = lambert(PALETTE.red)
  const trainRoof = lambert(PALETTE.gray)
  const cars = Array.from({ length: CARS }, (_, i) => {
    const car = new THREE.Group()
    add(box(1.38, 0.52, 0.58, trainBody), 0, 0.42, 0, car)
    add(box(1.39, 0.07, 0.59, trainStripe), 0, 0.3, 0, car)
    add(box(1.4, 0.08, 0.62, trainRoof), 0, 0.72, 0, car)
    add(new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.14, 0.6), trainWindow), 0, 0.53, 0, car)
    add(box(1.2, 0.1, 0.4, lambert('#2b2b2b')), 0, 0.12, 0, car)
    if (i === 0) add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), headlight), 0.7, 0.45, 0, car)
    scene.add(car)
    return car
  })

  // —— 機車：繞行站前圓環 ——
  const scooters = [0, 1, 2, 3].map((i) => {
    const scooter = new THREE.Group()
    add(box(0.42, 0.16, 0.14, lambert([PALETTE.red, PALETTE.blue, PALETTE.ochre, '#f2eee9'][i]!)), 0, 0.16, 0, scooter)
    add(solid(new THREE.CapsuleGeometry(0.07, 0.14, 4, 8), lambert(['#6f8f9c', '#354449', '#d9a441', '#6a6b65'][i]!)), -0.02, 0.38, 0, scooter)
    add(solid(new THREE.SphereGeometry(0.07, 10, 8), lambert('#e6c9a8')), -0.02, 0.56, 0, scooter)
    scene.add(scooter)
    return { scooter, angle: i * (Math.PI / 2), speed: 0.55 + (i % 2) * 0.1 }
  })

  // —— 行人：道路上往返並在平交道前等候，廣場與騎樓前散步 ——
  const coats = [PALETTE.red, PALETTE.blue, '#d9a441', '#6a6b65', PALETTE.ochre, '#354449', '#f2eee9', '#8f6a5a']
  const person = (coat: string) => {
    const group = new THREE.Group()
    add(solid(new THREE.CapsuleGeometry(0.1, 0.26, 4, 8), lambert(coat)), 0, 0.26, 0, group)
    add(solid(new THREE.SphereGeometry(0.085, 12, 8), lambert('#e6c9a8')), 0, 0.55, 0, group)
    scene.add(stage.body(group))
    return group
  }
  const walkers = [0, 1, 2, 3].map((i) => ({
    group: person(coats[i]!),
    x: (i % 2 ? 1 : -1) * (0.35 + (i % 3) * 0.2),
    z: 2.4 + i * 2.2,
    dir: i % 2 ? -1 : 1,
    speed: 0.75 + i * 0.12,
    phase: i,
  }))
  const strollers = [4, 5, 6, 7].map((i, n) => ({
    group: person(coats[i]!),
    center: new THREE.Vector2([-2.3, 2.3, -9, 9][n]!, [3.2, 3.2, 8.4, 8.4][n]!),
    radius: [0.7, 0.8, 1.6, 1.4][n]!,
    speed: (n % 2 ? -1 : 1) * (0.35 + n * 0.06),
    angle: n * 2,
    phase: n,
  }))

  // —— 空氣中的糖分：緩緩上升的金色微光 ——
  const sugarCount = 220
  const sugarPositions = new Float32Array(sugarCount * 3)
  const sugarSeeds = new Float32Array(sugarCount)
  for (let i = 0; i < sugarCount; i++) {
    sugarPositions.set([(Math.random() - 0.5) * 30, 0.3 + Math.random() * 6, -12 + Math.random() * 26], i * 3)
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
  scene.add(new THREE.Points(sugarGeometry, sugarMaterial))

  // —— 飄落的花瓣與落葉：受重力加速、空氣阻力限制終端速度 ——
  const petalCount = 110
  const petalPositions = new Float32Array(petalCount * 3)
  const petalVelocity = new Float32Array(petalCount)
  const resetPetal = (i: number, randomHeight: boolean) => {
    const [x, z] = treeSpots[i % treeSpots.length]!
    petalPositions.set(
      [x + (Math.random() - 0.5) * 1.3, randomHeight ? Math.random() * 1.8 : 1.7, z + (Math.random() - 0.5) * 1.3],
      i * 3,
    )
    petalVelocity[i] = 0
  }
  for (let i = 0; i < petalCount; i++) resetPetal(i, true)
  const petalGeometry = new THREE.BufferGeometry()
  petalGeometry.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3))
  const petalMaterial = new THREE.PointsMaterial({ color: SEASONS[0]!.blossom, size: 0.12, transparent: true, depthWrite: false })
  scene.add(new THREE.Points(petalGeometry, petalMaterial))

  // —— 夏季午後雷陣雨：雨絲以等速落下（已達終端速度），落地後回到上方 ——
  const rainCount = 420
  const rainPositions = new Float32Array(rainCount * 6)
  const rainSeeds = Array.from({ length: rainCount }, () => [(Math.random() - 0.5) * 34, Math.random() * 9, -14 + Math.random() * 30])
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

  let lastTime = 0
  let hour = START_HOUR
  let seasonIndex = 0
  let controls: OrbitControls | null = null
  const skyColor = new THREE.Color()
  const working = new THREE.Color()

  return {
    ...stage,
    aspect: WIDTH / HEIGHT,
    timeline: { duration: TRIP, direction: 'normal', offsets: trip.offsets },
    overlay: {
      component: SceneClock,
      props: { read: () => ({ hour, season: SEASONS[seasonIndex]! }) },
      width: WIDTH,
      maxScale: 2.4,
    },
    // 左鍵拖曳旋轉、滾輪縮放、右鍵拖曳平移；觸控為單指旋轉、雙指縮放與平移
    // 限制俯角、距離與平移範圍，鏡頭維持在屋頂之上，不會穿入建築
    controls(element) {
      const home = { position: stage.camera.position.clone(), target: new THREE.Vector3(0, 0.6, 0.5) }
      controls = new OrbitControls(stage.camera, element)
      controls.target.copy(home.target)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.enablePan = true
      controls.screenSpacePanning = false
      controls.panSpeed = 0.6
      controls.minDistance = 8
      controls.maxDistance = 30
      controls.maxPolarAngle = THREE.MathUtils.degToRad(60)
      controls.autoRotateSpeed = 0.6
      const clamp = () => {
        if (!controls) return
        controls.target.x = THREE.MathUtils.clamp(controls.target.x, -9, 9)
        controls.target.z = THREE.MathUtils.clamp(controls.target.z, -8, 11)
        controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, 2)
        stage.camera.position.y = Math.max(stage.camera.position.y, 4.2)
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
      const label = `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`
      return { note: `場景時間 ${label} · ${SEASONS[seasonIndex]!.name}季（第 ${Math.floor(time / DAY) + 1} 天）` }
    },
    update(time, ease) {
      const dt = THREE.MathUtils.clamp(time - lastTime, 0, 0.1)
      lastTime = time
      controls?.update()

      // 時間與季節：每天 24 秒，每天換一個季節，換季在深夜漸變
      const days = time / DAY + START_HOUR / 24
      hour = (days * 24) % 24
      seasonIndex = Math.floor(days) % 4
      const season = SEASONS[seasonIndex]!
      const next = SEASONS[(seasonIndex + 1) % 4]!
      const blend = THREE.MathUtils.smoothstep(days % 1, 0.9, 1)

      // 天色、日照與夜晚
      skyColor.copy(sampleStops(SKY, hour, mixColor))
      scene.background = skyColor
      ;(scene.fog as THREE.Fog).color.copy(skyColor)
      const night = sampleStops(NIGHT, hour, mixNumber)
      const sunAngle = ((hour - 6) / 12) * Math.PI
      const isDay = hour >= 5.5 && hour <= 18.5
      const angle = isDay ? sunAngle : sunAngle + Math.PI
      stage.sun.position.set(Math.cos(angle) * 18, Math.max(Math.sin(angle), 0.18) * 18, 7)
      stage.sun.color.copy(sampleStops(SUN_COLOR, hour, mixColor))
      // 夏季午後 14 ~ 17 時雷陣雨：雲層遮蔽日照、天色轉灰
      const rainAmount =
        THREE.MathUtils.lerp(season.rain, next.rain, blend) *
        THREE.MathUtils.smoothstep(hour, 13.5, 14.5) *
        (1 - THREE.MathUtils.smoothstep(hour, 16.5, 17.5))
      const haze = THREE.MathUtils.lerp(season.haze, next.haze, blend)
      skyColor.lerp(hex('#7d8794'), rainAmount * 0.55).lerp(hex(PALETTE.gray), haze * 0.25 * (1 - night))
      ;(scene.fog as THREE.Fog).color.copy(skyColor)
      ;(scene.fog as THREE.Fog).near = 30 - haze * 14 - rainAmount * 10
      const sunStrength = THREE.MathUtils.lerp(season.sun, next.sun, blend) * (1 - rainAmount * 0.6)
      stage.sun.intensity = isDay ? 1.7 * sunStrength * Math.max(Math.sin(sunAngle), 0.22) : 0.32
      stage.ambient.intensity = sampleStops(AMBIENT, hour, mixNumber)
      stage.ambient.color.setRGB(1, 1, 1).lerp(hex(PALETTE.blue), night * 0.7)

      for (const material of nightMaterials) material.emissiveIntensity = night * 0.95
      for (const glow of glows) glow.intensity = night * 6

      // 季節：草地、樹葉、花朵與飄落物
      lawnMaterial.color.copy(working.set(season.lawn).lerp(hex(next.lawn), blend))
      foliageMaterial.color.copy(working.set(season.foliage).lerp(hex(next.foliage), blend))
      blossomMaterial.color.copy(working.set(season.blossom).lerp(hex(next.blossom), blend))
      petalMaterial.color.copy(blossomMaterial.color)
      const bloom = THREE.MathUtils.lerp(season.bloom, next.bloom, blend)
      for (const flowers of blossoms) flowers.scale.setScalar(Math.max(bloom, 0.001))
      petalMaterial.opacity = THREE.MathUtils.lerp(season.petals, next.petals, blend) * 0.9

      // 風：樹冠以不同相位擺動，下雨時風勢較強
      const wind = 0.04 + rainAmount * 0.06
      for (const { group, phase } of crowns) {
        group.rotation.z = Math.sin(time * 1.3 + phase) * wind
        group.rotation.x = Math.sin(time * 0.9 + phase * 1.7) * wind * 0.6
      }

      // 雨絲：以時間差計算位置，不受影格率影響
      rainMaterial.opacity = rainAmount * 0.55
      rain.visible = rainAmount > 0.01
      if (rain.visible) {
        for (let i = 0; i < rainCount; i++) {
          const [x, y0, z] = rainSeeds[i]!
          const y = 9 - ((9 - y0! + time * 14) % 9)
          rainPositions.set([x! + y * 0.04, y, z!, x! + (y - 0.35) * 0.04, y - 0.35, z!], i * 6)
        }
        rainGeometry.attributes.position!.needsUpdate = true
      }

      // 時鐘指針
      hourHand.rotation.z = -((hour % 12) / 12) * Math.PI * 2
      minuteHand.rotation.z = -(hour % 1) * Math.PI * 2

      // 火車：緩動曲線作用在出站與進站的加減速
      const head = (stopOffset + trip(loop(time, TRIP), ease)) % 1
      cars.forEach((car, i) => {
        const u = (((head - (i * CAR_SPACING) / trackLength) % 1) + 1) % 1
        track.getPointAt(u, car.position)
        car.position.y = 0.06
        track.getTangentAt(u, tangent)
        car.rotation.y = Math.atan2(-tangent.z, tangent.x)
      })

      // 平交道：火車接近前方時放下柵欄（物理彈簧回彈）、警示燈交替閃爍
      const tail = (((head - ((CARS - 1) * CAR_SPACING) / trackLength) % 1) + 1) % 1
      const active = (head > 0.36 && head < 0.72) || (tail > 0.36 && tail < 0.62)
      for (const { pivot, side } of barriers) pivot.rotation.z = active ? 0 : side * THREE.MathUtils.degToRad(82)
      const blink = Math.floor(time * 3) % 2
      warningMaterials.forEach((material, i) => (material.emissiveIntensity = active && blink === i ? 1.8 : 0))

      // 行人：走到平交道前若柵欄放下就停下等候
      for (const walker of walkers) {
        const nextZ = walker.z + walker.dir * walker.speed * dt
        const entering = Math.abs(nextZ - crossingZ) < 1.1 && Math.abs(walker.z - crossingZ) >= 1.1
        const moving = !(active && entering)
        if (moving) walker.z = nextZ
        if (walker.z < 2.2) walker.dir = 1
        if (walker.z > 9.4) walker.dir = -1
        if (moving) walker.phase += dt * walker.speed * 9
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
          roundabout.x + Math.cos(item.angle) * 2.2,
          0,
          roundabout.z + Math.sin(item.angle) * 2.2,
        )
        item.scooter.rotation.y = -item.angle - Math.PI / 2
      }

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
