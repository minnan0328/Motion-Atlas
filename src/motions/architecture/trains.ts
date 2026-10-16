import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * 台鐵觀光列車的縮尺模型：車廂的 +x 為行進方向，原點在軌面中心。
 *
 * - 山嵐號、海風號：EMU500 型電聯車改裝。方正的車體、側面的水平壓紋、黑框圓角車窗與單扇車門；
 *   車頭平整，三扇圓角車窗，車窗下方左右各一組圓形頭燈與紅色尾燈，車頂前緣有雙頭燈，下方為黑色排障器。
 *   山嵐為淡黃綠色、海風為薄荷綠（依使用者提供的照片取色）。
 * - 鳴日號：由莒光號客車改造，黑色車身搭配延續莒光號的橘色線條，大面積景觀車窗。
 * - 藍皮解憂號：藍皮普通車的「浪漫藍」車身與白色腰線，可開式的小車窗。
 * 牽引鳴日號與藍皮解憂號的機車頭造型、各車的比例與車窗數量為藝術化補充。
 */

const LENGTH = 1.45
const LOCO_LENGTH = 1.3
const WIDTH = 0.56
// 車體底部離軌面的高度與車體高度
const FLOOR = 0.2
const BODY = 0.58

export interface TrainMaterials {
  // 夜晚亮起的車窗（共用）
  window: THREE.MeshStandardMaterial
  // 頭燈（共用）
  headlight: THREE.MeshStandardMaterial
}

export interface Train {
  name: string
  cars: THREE.Group[]
}

// 車身烤漆：鋼板加透明漆層
const lacquer = (color: string, roughness = 0.35) =>
  new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 })
const metal = (color: string, roughness = 0.45, metalness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness, metalness })

export function createTrains({ window: glass, headlight }: TrainMaterials) {
  const underframe = metal('#1e1f22', 0.6, 0.6)
  const black = lacquer('#151618', 0.4)
  const rubber = new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.6 })
  const roofGray = metal('#9a9da1', 0.5, 0.7)
  const wheel = metal('#5c6066', 0.35, 0.9)
  const taillight = new THREE.MeshStandardMaterial({ color: '#7a1712', emissive: '#ff2a1a', emissiveIntensity: 0.6, roughness: 0.3 })
  const nightMaterials = [taillight]

  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) => {
    const object = new THREE.Mesh(geometry, material)
    object.position.set(x, y, z)
    object.castShadow = true
    object.receiveShadow = true
    parent.add(object)
    return object
  }
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
  const rounded = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, r)

  // 台車與車輪、車底設備
  const chassis = (car: THREE.Group, length: number) => {
    mesh(box(length - 0.12, 0.08, WIDTH - 0.1), underframe, 0, FLOOR - 0.02, 0, car)
    for (const x of [-length * 0.32, length * 0.32]) {
      mesh(box(0.34, 0.07, WIDTH - 0.14), underframe, x, 0.11, 0, car)
      for (const dx of [-0.1, 0.1]) {
        for (const z of [-0.2, 0.2]) {
          const w = mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 14), wheel, x + dx, 0.075, z, car)
          w.rotation.x = Math.PI / 2
        }
      }
    }
  }

  // 側面的圓角車窗（黑色窗框 + 玻璃），兩側對稱
  const sideWindow = (car: THREE.Group, x: number, y: number, w: number, h: number, radius = 0.035) => {
    for (const side of [-1, 1]) {
      mesh(rounded(w + 0.03, h + 0.03, 0.02, radius + 0.01), rubber, x, y, side * (WIDTH / 2), car)
      mesh(rounded(w, h, 0.024, radius), glass, x, y, side * (WIDTH / 2), car)
    }
  }

  // 車頭：front 為 1 時在 +x 端，-1 時在 -x 端（尾車）
  const emuCab = (car: THREE.Group, length: number, front: 1 | -1, paint: THREE.Material) => {
    const x = front * (length / 2)
    const group = new THREE.Group()
    group.position.x = x
    group.rotation.y = front > 0 ? 0 : Math.PI
    car.add(group)
    // 三扇圓角車窗：左右較寬、中間為貫通門的窗
    for (const [z, w] of [[-0.17, 0.15], [0, 0.11], [0.17, 0.15]] as const) {
      mesh(rounded(0.02, 0.19, w + 0.025, 0.035), rubber, 0.002, 0.62, z, group)
      mesh(rounded(0.024, 0.16, w, 0.03), glass, 0.003, 0.62, z, group)
    }
    // 車窗下方的圓形燈組：內側頭燈、外側紅色尾燈
    for (const side of [-1, 1]) {
      mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 18), paint, 0.006, 0.43, side * 0.17, group).rotation.z = Math.PI / 2
      mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.024, 14), headlight, 0.01, 0.43, side * 0.145, group).rotation.z = Math.PI / 2
      mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.024, 14), taillight, 0.01, 0.43, side * 0.195, group).rotation.z = Math.PI / 2
    }
    // 車頂前緣的雙頭燈
    mesh(rounded(0.06, 0.06, 0.16, 0.02), paint, -0.01, FLOOR + BODY + 0.02, 0, group)
    for (const z of [-0.035, 0.035]) mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 14), headlight, 0.022, FLOOR + BODY + 0.02, z, group).rotation.z = Math.PI / 2
    // 黑色排障器與連結器
    mesh(box(0.06, 0.13, WIDTH - 0.04), black, 0.01, FLOOR + 0.02, 0, group)
    mesh(box(0.08, 0.04, 0.08), underframe, 0.06, FLOOR - 0.02, 0, group)
  }

  // EMU500 改裝的山嵐號、海風號：方正車體、水平壓紋、圓角車窗、單扇車門
  const emu = (color: string): THREE.Group[] => {
    const paint = lacquer(color, 0.4)
    const rib = lacquer(color, 0.25)
    return [1, 0, -1].map((cab) => {
      const car = new THREE.Group()
      chassis(car, LENGTH)
      mesh(rounded(LENGTH, BODY, WIDTH, 0.05), paint, 0, FLOOR + BODY / 2, 0, car)
      // 側面的水平壓紋
      for (const y of [0.3, 0.36, 0.42, 0.74]) {
        for (const side of [-1, 1]) mesh(box(LENGTH - 0.16, 0.01, 0.006), rib, 0, y, side * (WIDTH / 2 + 0.002), car)
      }
      // 側窗與車門（門上為細長的圓角窗）
      for (const x of [-0.45, -0.15, 0.32]) sideWindow(car, x, 0.6, 0.2, 0.15)
      for (const side of [-1, 1]) mesh(box(0.16, 0.46, 0.006), rib, 0.1, 0.45, side * (WIDTH / 2 + 0.003), car)
      sideWindow(car, 0.1, 0.6, 0.06, 0.15, 0.03)
      // 車頂空調
      mesh(rounded(0.42, 0.07, 0.32, 0.025), roofGray, cab === 0 ? 0 : -cab * 0.2, FLOOR + BODY + 0.03, 0, car)
      if (cab !== 0) emuCab(car, LENGTH, cab as 1 | -1, paint)
      return car
    })
  }

  // 機車頭：平整的車頭、兩扇車窗與頭燈，車身沿用列車的配色
  const locomotive = (body: THREE.Material, band: THREE.Material) => {
    const car = new THREE.Group()
    chassis(car, LOCO_LENGTH)
    mesh(rounded(LOCO_LENGTH, BODY - 0.02, WIDTH, 0.05), body, 0, FLOOR + (BODY - 0.02) / 2, 0, car)
    for (const side of [-1, 1]) mesh(box(LOCO_LENGTH - 0.1, 0.05, 0.006), band, 0, 0.36, side * (WIDTH / 2 + 0.002), car)
    const front = new THREE.Group()
    front.position.x = LOCO_LENGTH / 2
    car.add(front)
    mesh(box(0.012, 0.05, WIDTH - 0.06), band, 0.004, 0.36, 0, front)
    for (const z of [-0.12, 0.12]) {
      mesh(rounded(0.02, 0.17, 0.19, 0.03), rubber, 0.002, 0.62, z, front)
      mesh(rounded(0.024, 0.14, 0.16, 0.025), glass, 0.003, 0.62, z, front)
      mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.024, 14), headlight, 0.01, 0.45, z * 1.3, front).rotation.z = Math.PI / 2
    }
    mesh(box(0.06, 0.13, WIDTH - 0.04), black, 0.01, FLOOR + 0.02, 0, front)
    // 側面的小窗與百葉散熱口
    sideWindow(car, 0.45, 0.62, 0.14, 0.12)
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) mesh(box(0.12, 0.08, 0.006), underframe, -0.4 + i * 0.16, 0.6, side * (WIDTH / 2 + 0.003), car)
    }
    mesh(rounded(0.5, 0.06, 0.3, 0.02), roofGray, -0.15, FLOOR + BODY + 0.01, 0, car)
    return car
  }

  // 鳴日號：黑色車身、橘色線條、大面積景觀車窗
  const mingri = (): THREE.Group[] => {
    const body = lacquer('#17181b', 0.3)
    const orange = lacquer('#e5732a', 0.35)
    const coaches = [0, 1].map(() => {
      const car = new THREE.Group()
      chassis(car, LENGTH)
      mesh(rounded(LENGTH, BODY, WIDTH, 0.05), body, 0, FLOOR + BODY / 2, 0, car)
      for (const side of [-1, 1]) {
        // 車窗下緣的橘色寬帶與車頂邊緣的細線
        mesh(box(LENGTH - 0.08, 0.05, 0.006), orange, 0, 0.44, side * (WIDTH / 2 + 0.002), car)
        mesh(box(LENGTH - 0.08, 0.012, 0.006), orange, 0, 0.75, side * (WIDTH / 2 + 0.002), car)
      }
      // 寬幅景觀車窗
      for (const x of [-0.42, 0, 0.42]) sideWindow(car, x, 0.6, 0.34, 0.17, 0.02)
      mesh(rounded(0.9, 0.05, 0.34, 0.02), metal('#2a2c30', 0.5, 0.6), 0, FLOOR + BODY + 0.02, 0, car)
      return car
    })
    return [locomotive(body, orange), ...coaches]
  }

  // 藍皮解憂號：浪漫藍車身、白色腰線、成排的可開式小車窗、圓弧車頂
  const bluetrain = (): THREE.Group[] => {
    const blue = lacquer('#2f63a8', 0.4)
    const white = lacquer('#f2f2ee', 0.35)
    const coaches = [0, 1].map(() => {
      const car = new THREE.Group()
      chassis(car, LENGTH)
      mesh(rounded(LENGTH, BODY - 0.06, WIDTH, 0.04), blue, 0, FLOOR + (BODY - 0.06) / 2, 0, car)
      // 圓弧車頂
      const roof = mesh(new THREE.CylinderGeometry(WIDTH / 2, WIDTH / 2, LENGTH - 0.02, 20, 1, false, 0, Math.PI), roofGray, 0, FLOOR + BODY - 0.07, 0, car)
      // 半圓柱的軸轉到行進方向，弧面朝上並壓低
      roof.rotation.z = Math.PI / 2
      roof.scale.set(0.3, 1, 1)
      for (const side of [-1, 1]) mesh(box(LENGTH - 0.06, 0.018, 0.006), white, 0, 0.47, side * (WIDTH / 2 + 0.002), car)
      for (let i = 0; i < 6; i++) sideWindow(car, -0.55 + i * 0.22, 0.6, 0.12, 0.13, 0.015)
      // 兩端的車門
      for (const x of [-0.68, 0.68]) for (const side of [-1, 1]) mesh(box(0.06, 0.4, 0.006), white, x, 0.44, side * (WIDTH / 2 + 0.003), car)
      return car
    })
    return [locomotive(blue, white), ...coaches]
  }

  const trains: Train[] = [
    { name: '山嵐號', cars: emu('#dbe39c') },
    { name: '海風號', cars: emu('#9fd8c8') },
    { name: '鳴日號', cars: mingri() },
    { name: '藍皮解憂號', cars: bluetrain() },
  ]
  return { trains, nightMaterials }
}
