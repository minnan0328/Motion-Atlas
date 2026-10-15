// 動態的物理反應：每個物件以阻尼彈簧跟隨 keyframe 的目標值（慣性、彈性、阻尼），
// 受到點擊衝量時往上彈起，再受重力落下並反彈（重力、彈性）

export interface PhysicsSettings {
  // 剛性：越大回彈越快
  stiffness: number
  // 阻尼比 0 ~ 1：越大越快停下
  damping: number
  // 質量（慣性）：越大越難加速與停下
  mass: number
  // 重力（px/s²）
  gravity: number
}

export const DEFAULT_PHYSICS: PhysicsSettings = {
  stiffness: 380,
  damping: 0.55,
  mass: 1,
  gravity: 1600,
}

export function physicsConstants({ stiffness, mass, damping }: PhysicsSettings) {
  return {
    stiffness,
    // 阻尼係數 c = 2ζ√(km)
    friction: 2 * damping * Math.sqrt(stiffness * mass),
    // 阻尼越小，落地反彈越高
    restitution: Math.min(Math.max(0.85 - damping * 0.7, 0.1), 0.85),
  }
}

const SUBSTEPS = 2

/**
 * 跟隨目標的物理體。periods 標示角度維度的週期（例如 2π 或 360），
 * 角度會取最短的差值，避免 360° → 0° 時倒轉一圈。
 */
export class Body {
  value: number[] = []
  velocity: number[] = []
  // 往上彈起的高度與速度
  hop = 0
  hopVelocity = 0
  private ready = false
  private periods: (number | null)[]

  constructor(periods: (number | null)[]) {
    this.periods = periods
  }

  step(target: number[], dt: number, settings: PhysicsSettings, unit: number): number[] {
    if (!this.ready) {
      this.value = [...target]
      this.velocity = target.map(() => 0)
      this.ready = true
      return this.value
    }

    const { stiffness, friction, restitution } = physicsConstants(settings)
    const h = Math.min(dt, 1 / 20) / SUBSTEPS

    for (let n = 0; n < SUBSTEPS; n++) {
      for (let i = 0; i < target.length; i++) {
        let diff = target[i]! - this.value[i]!
        const period = this.periods[i]
        if (period) diff -= Math.round(diff / period) * period
        const acceleration = (stiffness * diff - friction * this.velocity[i]!) / settings.mass
        this.velocity[i]! += acceleration * h
        this.value[i]! += this.velocity[i]! * h
      }

      // 彈起的部分受重力與空氣阻力影響，落地時依彈性反彈
      this.hopVelocity -= settings.gravity * unit * h
      this.hopVelocity *= 1 - settings.damping * 1.5 * h
      this.hop += this.hopVelocity * h
      if (this.hop < 0) {
        this.hop = 0
        this.hopVelocity = Math.abs(this.hopVelocity) > 40 * unit ? -this.hopVelocity * restitution : 0
      }
    }
    return this.value
  }

  // 衝量除以質量得到速度變化（慣性）
  push(index: number, impulse: number, settings: PhysicsSettings) {
    if (!this.ready) return
    this.velocity[index]! += impulse / settings.mass
  }

  jump(impulse: number, settings: PhysicsSettings) {
    this.hopVelocity += impulse / settings.mass
  }
}

// 點擊位置對物件的影響程度，u、v 為畫面座標 0 ~ 1
export function pokeFalloff(du: number, dv: number) {
  return Math.exp(-(du * du + dv * dv) / 0.12)
}
