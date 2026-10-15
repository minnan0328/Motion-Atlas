import * as THREE from 'three'
import type { Component } from 'vue'
import { Body, DEFAULT_PHYSICS, pokeFalloff, type PhysicsSettings } from './physics'
import type { Ease } from './timeline'

export const toRad = THREE.MathUtils.degToRad

// 主要動作的時間軸，用於分頁顯示 keyframe
export interface Timeline {
  duration: number
  direction: 'normal' | 'alternate'
  offsets: number[]
}

export interface Motion {
  scene: THREE.Scene
  camera: THREE.Camera
  timeline: Timeline
  // 畫面寬高比，預設為 1
  aspect?: number
  overlay?: MotionOverlay
  update(time: number, ease: Ease): void
  // 每格在 update 之後執行物理模擬
  physics?(dt: number, settings: PhysicsSettings): void
  // 點擊畫面給予衝量，u、v 為畫面座標 0 ~ 1
  poke?(u: number, v: number): void
  // 以滑鼠或觸控操作鏡頭
  controls?(element: HTMLElement): CameraHandle
  // 場景自訂的診斷資訊（例如場景時間），time 為場景秒數
  diagnostics?(time: number): { progress?: number; note?: string; keyframes?: false }
  setColors(colors: string[]): void
  dispose(): void
}

// 疊在 canvas 上的 CSS 輔助效果（例如時間標籤）
export interface MotionOverlay {
  component: Component
  props: Record<string, unknown>
  // 設計時的畫面寬度，疊加層依實際寬度等比縮放
  width: number
  // 縮放上限，避免大畫面時文字過大
  maxScale?: number
}

// 鏡頭操作：綁定後可重設視角、切換自動環繞，dispose 解除事件監聽
export interface CameraHandle {
  reset(): void
  setAutoRotate(enabled: boolean): void
  dispose(): void
}

export type MotionFactory = () => Motion
export type MotionLoader = () => Promise<{ default: MotionFactory }>

type ColoredMaterial = THREE.Material & { color: THREE.Color }

interface StageOptions {
  // flat：平面 2D（無光影、無陰影）；3d：立體光影與陰影
  mode?: 'flat' | '3d'
  // 平面模式預設使用正交相機的正面視角；需要景深時可改用透視相機
  projection?: 'orthographic' | 'perspective'
  // 正交相機的取景：畫面中心高度與畫面高度（場景單位）
  view?: { centerY: number; height: number }
  // 平面模式的地面線
  groundLine?: boolean
  cameraY?: number
  lookY?: number
  distance?: number
  fov?: number
  aspect?: number
  // floor：水平地面（基本動態）；wall：文字後方的牆面（文字動態）
  ground?: 'floor' | 'wall'
  wallZ?: number
  light?: [number, number, number]
  // 陰影相機的範圍
  shadowSize?: number
  // 陰影貼圖解析度
  shadowMapSize?: number
  // 每 px 對應的場景單位，用於換算重力與衝量
  unit?: number
}

/**
 * 建立共用場景：相機、燈光、接收陰影的地面，以及跟著顏色組合變化的材質。
 * 顏色索引：0 點綴、1 次要、2 主體、3 背景、4 地面 / 陰影
 */
export type StageMaterial = THREE.MeshBasicMaterial | THREE.MeshLambertMaterial

export function createStage({
  mode = 'flat',
  projection = mode === 'flat' ? 'orthographic' : 'perspective',
  view = { centerY: 2.4, height: 7.8 },
  groundLine = false,
  cameraY = 4,
  lookY = 2.6,
  distance = 12,
  fov = 35,
  aspect = 1,
  ground: groundType = 'floor',
  wallZ = 0,
  light = [3, 8, 5],
  shadowSize = 7,
  shadowMapSize = 512,
  unit = 0.078,
}: StageOptions = {}) {
  const scene = new THREE.Scene()
  const flat = mode === 'flat'

  let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  if (projection === 'orthographic') {
    const halfHeight = view.height / 2
    const halfWidth = halfHeight * aspect
    camera = new THREE.OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, 0.1, 200)
    camera.position.set(0, view.centerY, 50)
    camera.lookAt(0, view.centerY, 0)
  } else {
    camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, distance * 10)
    camera.position.set(0, cameraY, distance)
    camera.lookAt(0, lookY, 0)
  }

  // 立體模式才需要光影與陰影
  const sun = new THREE.DirectionalLight(0xffffff, 1.5)
  const ambient = new THREE.AmbientLight(0xffffff, 2)
  if (!flat) {
    scene.add(ambient)
    sun.position.set(...light)
    sun.castShadow = true
    sun.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    Object.assign(sun.shadow.camera, {
      left: -shadowSize,
      right: shadowSize,
      top: shadowSize,
      bottom: -shadowSize,
      near: 1,
      far: new THREE.Vector3(...light).length() * 2.5,
    })
    scene.add(sun)
  }

  const tinted: { material: ColoredMaterial; index: number }[] = []
  let colors: string[] = []

  function tint<M extends ColoredMaterial>(material: M, index: number): M {
    tinted.push({ material, index })
    if (colors[index]) material.color.set(colors[index])
    return material
  }

  // 平面模式使用不受光影響的純色材質，顏色與色票完全一致
  function material(index: number, params?: THREE.MeshBasicMaterialParameters): StageMaterial {
    return tint(flat ? new THREE.MeshBasicMaterial(params) : new THREE.MeshLambertMaterial(params), index)
  }

  function mesh(geometry: THREE.BufferGeometry, index: number | THREE.Material | THREE.Material[]) {
    const object = new THREE.Mesh(geometry, typeof index === 'number' ? material(index) : index)
    object.castShadow = !flat
    return object
  }

  if (!flat) {
    // 透明地面只顯示陰影，陰影顏色為地面色
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(shadowSize * 6, shadowSize * 6),
      tint(new THREE.ShadowMaterial({ opacity: 0.45 }), 4),
    )
    if (groundType === 'floor') ground.rotation.x = -Math.PI / 2
    else ground.position.z = wallZ
    ground.receiveShadow = true
    scene.add(ground)
  } else if (groundLine) {
    // 平面模式以一條地面線取代陰影
    const line = new THREE.Mesh(new THREE.PlaneGeometry(view.height * aspect * 0.8, 0.06), material(4))
    line.position.set(0, -0.03, -1)
    scene.add(line)
  }

  // 正交相機以縮放推近畫面
  function setZoom(zoom: number) {
    camera.zoom = zoom
    camera.updateProjectionMatrix()
  }

  function setColors(next: string[]) {
    colors = next
    scene.background = new THREE.Color(next[3])
    for (const { material, index } of tinted) {
      if (next[index]) material.color.set(next[index])
    }
  }

  function dispose() {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((m: THREE.Material) => m.dispose())
      }
    })
  }

  // 物理體：update 設定的位置、旋轉、縮放為目標值，模擬後寫回物件
  interface StageBody {
    object: THREE.Object3D
    body: Body
    target: number[]
    written: number[] | null
  }
  const bodies: StageBody[] = []
  const TAU = Math.PI * 2
  let settings: PhysicsSettings = DEFAULT_PHYSICS

  const read = (o: THREE.Object3D) => [
    o.position.x, o.position.y, o.position.z,
    o.rotation.x, o.rotation.y, o.rotation.z,
    o.scale.x, o.scale.y, o.scale.z,
  ]

  function body<T extends THREE.Object3D>(object: T): T {
    bodies.push({ object, body: new Body([null, null, null, TAU, TAU, TAU, null, null, null]), target: read(object), written: null })
    return object
  }

  function physics(dt: number, next: PhysicsSettings) {
    settings = next
    for (const entry of bodies) {
      // 逐一比對：update 沒有改動的數值沿用上一次的目標值，避免把彈起的高度當成目標
      const current = read(entry.object)
      entry.target = current.map((value, i) =>
        entry.written && Math.abs(value - entry.written[i]!) < 1e-9 ? entry.target[i]! : value,
      )

      const [px, py, pz, rx, ry, rz, sx, sy, sz] = entry.body.step(entry.target, dt, next, unit)
      entry.object.position.set(px!, py! + entry.body.hop, pz!)
      entry.object.rotation.set(rx!, ry!, rz!)
      entry.object.scale.set(sx!, sy!, sz!)
      entry.written = read(entry.object)
    }
  }

  const projected = new THREE.Vector3()
  function poke(u: number, v: number) {
    for (const entry of bodies) {
      entry.object.getWorldPosition(projected).project(camera)
      const du = (projected.x + 1) / 2 - u
      const dv = (1 - projected.y) / 2 - v
      const force = pokeFalloff(du, dv)
      if (force < 0.02) continue
      // 往上彈起、往遠離點擊處推開並旋轉
      entry.body.jump(520 * unit * force, settings)
      entry.body.push(0, Math.sign(du || 1) * 380 * unit * force, settings)
      entry.body.push(5, -Math.sign(du || 1) * 7 * force, settings)
    }
  }

  return { scene, camera, sun, ambient, flat, tint, material, mesh, body, physics, poke, setZoom, setColors, dispose }
}
