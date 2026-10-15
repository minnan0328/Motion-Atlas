import * as THREE from 'three'
import { createStage, type Motion } from '../../three/stage'
import { keyframes, loop } from '../../three/timeline'

// 3D 基礎動畫：需要空間深度與立體形變時才使用 Three.js，畫面比例 3:2
const ASPECT = 1.5
const stage3d = () =>
  createStage({ mode: '3d', aspect: ASPECT, fov: 32, cameraY: 4.2, lookY: 1.1, distance: 11, light: [4, 9, 6], shadowSize: 6 })

// 立體球體彈跳：重力加速落下、反彈高度依次遞減，觸地壓扁；陰影隨高度縮放
export function sphereBounce(): Motion {
  const stage = stage3d()
  const pivot = new THREE.Group()
  const ball = stage.mesh(new THREE.SphereGeometry(0.6, 48, 32), 2)
  ball.position.y = 0.6
  pivot.add(ball)
  stage.scene.add(stage.body(pivot))

  // 以重力計算：落下高度 3，反彈係數 0.6
  const height = 3
  const restitution = 0.6
  const fall = Math.sqrt(2 * height)
  const impacts: number[] = []
  let time = fall
  let speed = 1
  while (impacts.length < 5) {
    impacts.push(time)
    speed *= restitution
    time += 2 * fall * speed
  }
  const total = time
  const DURATION = 2.4

  return {
    ...stage,
    timeline: { duration: DURATION, direction: 'normal', offsets: [0, ...impacts.map((t) => (t / total) * 0.85), 1] },
    update(t, ease) {
      const p = loop(t, DURATION)
      // 最後 15% 把球拋回高處，與下一輪銜接
      let y = 0
      let squash = 0
      if (p > 0.85) {
        y = height * ease((p - 0.85) / 0.15)
      } else {
        const tt = (p / 0.85) * total
        if (tt < fall) y = height - tt * tt / 2
        else {
          let start = fall
          let v = 1
          for (const next of impacts.slice(1)) {
            v *= restitution
            if (tt < next) {
              const local = tt - start
              const v0 = fall * v
              y = v0 * local - (local * local) / 2
              break
            }
            start = next
          }
        }
        // 觸地前後短暫壓扁
        const nearest = Math.min(...impacts.map((impact) => Math.abs(impact - tt)))
        squash = Math.max(0, 1 - nearest / 0.12) * 0.35
      }
      pivot.position.y = Math.max(y, 0)
      pivot.scale.set(1 + squash, 1 - squash, 1 + squash)
    },
  }
}

// 立方體翻滾：以底部的邊為支點每次翻轉 90 度，往右滾三格再滾回來
export function cubeTumble(): Motion {
  const stage = stage3d()
  const size = 1
  const cube = stage.mesh(new THREE.BoxGeometry(size, size, size), [1, 1, 0, 4, 2, 2].map((index) => stage.material(index)))
  stage.scene.add(stage.body(cube))
  const STEPS = 3
  const DURATION = 3.6
  const start = -1.5
  // 每一步：前 70% 翻轉、後 30% 停頓
  const roll = keyframes(
    Array.from({ length: STEPS + 1 }, (_, k) => [k / STEPS, k] as [number, number]).flatMap(([offset, k], i) =>
      i === 0 ? [[offset, k] as [number, number]] : [[offset - 0.3 / STEPS, k] as [number, number], [offset, k] as [number, number]],
    ),
  )
  const pivot = new THREE.Vector3()
  const offset = new THREE.Vector3()
  return {
    ...stage,
    timeline: { duration: DURATION, direction: 'alternate', offsets: roll.offsets },
    update(t, ease) {
      const p = 1 - Math.abs(1 - ((t / DURATION) % 2))
      const value = roll(p, ease)
      const k = Math.min(Math.floor(value), STEPS - 1)
      const f = value - k
      // 支點在目前所在格的右下邊
      pivot.set(start + k * size + size / 2, 0, 0)
      const angle = -f * (Math.PI / 2)
      offset.set(-size / 2, size / 2, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), angle)
      cube.position.copy(pivot).add(offset)
      cube.rotation.set(0, 0, angle - k * (Math.PI / 2))
    },
  }
}

// 陀螺儀：三層圓環分別沿 X、Y、Z 軸轉動，每次轉動 90 度後停頓，中心球體持續自轉
export function gyroscope(): Motion {
  const stage = stage3d()
  const group = new THREE.Group()
  group.position.y = 1.4
  stage.scene.add(stage.body(group))
  const rings = [1.3, 1.0, 0.72].map((radius, i) => {
    const ring = stage.mesh(new THREE.TorusGeometry(radius, 0.06, 16, 80), [2, 0, 1][i]!)
    group.add(ring)
    return ring
  })
  const core = stage.mesh(new THREE.IcosahedronGeometry(0.32, 1), 4)
  group.add(core)
  const DURATION = 4
  const quarter = keyframes([
    [0, 0], [0.18, 1], [0.25, 1], [0.43, 2], [0.5, 2], [0.68, 3], [0.75, 3], [0.93, 4], [1, 4],
  ])
  return {
    ...stage,
    timeline: { duration: DURATION, direction: 'normal', offsets: quarter.offsets },
    update(t, ease) {
      const p = loop(t, DURATION)
      const turns = quarter(p, ease) * (Math.PI / 2)
      rings[0]!.rotation.set(turns, 0, 0)
      rings[1]!.rotation.set(0, turns, Math.PI / 2)
      rings[2]!.rotation.set(Math.PI / 2, 0, turns)
      core.rotation.set(t * 0.7, t * 1.1, 0)
    },
  }
}
