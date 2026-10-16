import * as THREE from 'three'

/**
 * 程序產生的材質貼圖：以 Canvas 繪製可無縫重複的紋理（磚、磁磚、石材、木紋、草地、岩石、水波），
 * 不依賴外部圖檔。灰階貼圖會與材質的 color 相乘，因此可沿用場景色票並隨季節變色。
 */

const SIZE = 256

// 固定亂數，讓紋理每次都一樣
function random(seed: number) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

// 週期性的值雜訊（邊界相接，可無縫重複），回傳 0 ~ 1
function periodicNoise(seed: number, octaves: number, base = 4) {
  const rand = random(seed)
  const layers = Array.from({ length: octaves }, (_, o) => {
    const grid = base * 2 ** o
    return { grid, values: Float32Array.from({ length: grid * grid }, () => rand()) }
  })
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const weight = layers.reduce((total, _, o) => total + 0.5 ** o, 0)
  return (u: number, v: number) => {
    let sum = 0
    let amplitude = 1
    for (let o = 0; o < layers.length; o++) {
      const { grid, values } = layers[o]!
      const x = u * grid
      const y = v * grid
      const x0 = Math.floor(x)
      const y0 = Math.floor(y)
      const fx = smooth(x - x0)
      const fy = smooth(y - y0)
      const i0 = ((x0 % grid) + grid) % grid
      const j0 = ((y0 % grid) + grid) % grid
      const i1 = (i0 + 1) % grid
      const j1 = (j0 + 1) % grid
      const a = values[j0 * grid + i0]!
      const b = values[j0 * grid + i1]!
      const c = values[j1 * grid + i0]!
      const d = values[j1 * grid + i1]!
      const top = a + (b - a) * fx
      const bottom = c + (d - c) * fx
      sum += (top + (bottom - top) * fy) * amplitude
      amplitude *= 0.5
    }
    return sum / weight
  }
}

function canvas(draw: (context: CanvasRenderingContext2D, size: number) => void, size = SIZE) {
  const element = document.createElement('canvas')
  element.width = size
  element.height = size
  draw(element.getContext('2d')!, size)
  return element
}

// 逐像素繪製：shade 回傳 [r, g, b]（0 ~ 255）
function pixels(shade: (u: number, v: number) => [number, number, number], size = SIZE) {
  return canvas((context) => {
    const image = context.createImageData(size, size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const [r, g, b] = shade(x / size, y / size)
        image.data.set([r, g, b, 255], (y * size + x) * 4)
      }
    }
    context.putImageData(image, 0, 0)
  }, size)
}

const grey = (value: number): [number, number, number] => {
  const v = Math.round(Math.min(Math.max(value, 0), 1) * 255)
  return [v, v, v]
}

export interface TextureSet {
  // 顏色貼圖（sRGB）
  map: THREE.CanvasTexture
  // 凹凸貼圖（線性）
  bump?: THREE.CanvasTexture
  // 法線貼圖（線性）
  normal?: THREE.CanvasTexture
}

function texture(source: HTMLCanvasElement, color: boolean) {
  const result = new THREE.CanvasTexture(source)
  result.wrapS = result.wrapT = THREE.RepeatWrapping
  result.anisotropy = 4
  if (color) result.colorSpace = THREE.SRGBColorSpace
  return result
}

// 由高度場產生法線貼圖：先取樣一次高度，再以相鄰像素（邊界環繞）計算斜率
function normalFrom(height: (u: number, v: number) => number, strength: number, size = SIZE) {
  const field = new Float32Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) field[y * size + x] = height(x / size, y / size)
  const at = (x: number, y: number) => field[((y + size) % size) * size + ((x + size) % size)]!
  return pixels((u, v) => {
    const x = Math.round(u * size)
    const y = Math.round(v * size)
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength
    const length = Math.hypot(dx, dy, 1)
    return [((-dx / length) * 0.5 + 0.5) * 255, ((-dy / length) * 0.5 + 0.5) * 255, ((1 / length) * 0.5 + 0.5) * 255]
  }, size)
}

/**
 * 場景用的程序紋理。產生一次約需數百毫秒，因此全站共用同一組（數量固定，不隨進出頁面累積），
 * 場景釋放時不 dispose 貼圖，只釋放各自的材質與幾何。
 */
export type Textures = ReturnType<typeof createTextures>
let shared: Textures | null = null
export function getTextures() {
  shared ??= createTextures()
  return shared
}

function createTextures() {
  const all: THREE.Texture[] = []
  const keep = <T extends THREE.Texture>(t: T) => (all.push(t), t)
  const set = (map: HTMLCanvasElement, bump?: HTMLCanvasElement): TextureSet => ({
    map: keep(texture(map, true)),
    bump: bump ? keep(texture(bump, false)) : undefined,
  })

  // 草地：細碎的草葉明暗與小片土色
  const grassNoise = periodicNoise(11, 5, 8)
  const grassRand = random(12)
  const grass = set(
    canvas((context, size) => {
      const image = context.createImageData(size, size)
      for (let i = 0; i < size * size; i++) {
        const u = (i % size) / size
        const v = Math.floor(i / size) / size
        const n = grassNoise(u, v)
        image.data.set(grey(0.6 + n * 0.42 + (grassRand() - 0.5) * 0.16), i * 4)
        image.data[i * 4 + 3] = 255
      }
      context.putImageData(image, 0, 0)
      // 草葉筆觸
      for (let i = 0; i < 1400; i++) {
        const x = grassRand() * size
        const y = grassRand() * size
        const light = 0.62 + grassRand() * 0.4
        context.strokeStyle = `rgba(${light * 255}, ${light * 255}, ${light * 255}, 0.55)`
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(x, y)
        context.lineTo(x + (grassRand() - 0.5) * 3, y - 2 - grassRand() * 4)
        context.stroke()
      }
    }),
  )

  // 土壤：粗糙顆粒與小石子
  const soilNoise = periodicNoise(21, 5, 6)
  const soilRand = random(22)
  const soilCanvas = pixels((u, v) => grey(0.6 + soilNoise(u, v) * 0.35 + (soilRand() - 0.5) * 0.18))
  const soil = set(soilCanvas, soilCanvas)

  // 岩石：層理與裂隙
  const rockNoise = periodicNoise(31, 5, 4)
  const rockDetail = periodicNoise(32, 4, 16)
  const rockCanvas = pixels((u, v) => {
    // 低頻的岩塊明暗、細碎顆粒，加上淡淡的水平層理與少量裂隙
    const n = rockNoise(u, v)
    const strata = Math.sin((v + n * 0.2) * Math.PI * 6) * 0.5 + 0.5
    const crack = Math.abs(n - 0.5) < 0.008 ? -0.25 : 0
    return grey(0.42 + n * 0.35 + rockDetail(u, v) * 0.25 + strata * 0.06 + crack)
  })
  const rock = set(rockCanvas, rockCanvas)

  // 紅磚：交錯砌法、每塊磚色略有差異、灰色灰縫
  const brickRand = random(41)
  const brickNoise = periodicNoise(42, 4, 16)
  const brickBump = canvas(() => undefined)
  const brick = set(
    canvas((context, size) => {
      const rows = 8
      const columns = 4
      const h = size / rows
      const w = size / columns
      const bump = brickBump.getContext('2d')!
      context.fillStyle = '#b7aa9a'
      context.fillRect(0, 0, size, size)
      bump.fillStyle = '#000'
      bump.fillRect(0, 0, size, size)
      for (let r = 0; r < rows; r++) {
        for (let c = -1; c < columns; c++) {
          const x = c * w + (r % 2 ? w / 2 : 0)
          const tone = 0.82 + brickRand() * 0.3
          context.fillStyle = `rgb(${163 * tone}, ${86 * tone}, ${63 * tone})`
          context.fillRect(x + 2, r * h + 2, w - 4, h - 4)
          bump.fillStyle = '#fff'
          bump.fillRect(x + 2, r * h + 2, w - 4, h - 4)
        }
      }
      // 表面的風化斑駁
      const image = context.getImageData(0, 0, size, size)
      for (let i = 0; i < size * size; i++) {
        const n = 0.85 + brickNoise((i % size) / size, Math.floor(i / size) / size) * 0.3
        for (let k = 0; k < 3; k++) image.data[i * 4 + k] = image.data[i * 4 + k]! * n
      }
      context.putImageData(image, 0, 0)
    }),
    brickBump,
  )

  // 白色方磚：細小的方形磁磚與淺灰縫
  const tileRand = random(51)
  const tileBump = canvas(() => undefined)
  const tile = set(
    canvas((context, size) => {
      const count = 8
      const s = size / count
      const bump = tileBump.getContext('2d')!
      context.fillStyle = '#bdb8b2'
      context.fillRect(0, 0, size, size)
      bump.fillStyle = '#000'
      bump.fillRect(0, 0, size, size)
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          const tone = 236 + Math.round((tileRand() - 0.5) * 18)
          context.fillStyle = `rgb(${tone}, ${tone - 2}, ${tone - 5})`
          context.fillRect(c * s + 1.5, r * s + 1.5, s - 3, s - 3)
          bump.fillStyle = '#fff'
          bump.fillRect(c * s + 1.5, r * s + 1.5, s - 3, s - 3)
        }
      }
    }),
    tileBump,
  )

  // 人造石（洗石子）：細密的斑點
  const stoneRand = random(61)
  const stoneNoise = periodicNoise(62, 4, 8)
  const stoneCanvas = pixels((u, v) => {
    const speck = stoneRand()
    return grey(0.78 + stoneNoise(u, v) * 0.14 + (speck > 0.93 ? -0.25 : speck < 0.05 ? 0.12 : 0))
  })
  const stone = set(stoneCanvas, stoneCanvas)

  // 灰泥外牆：低頻的污漬與細微顆粒
  const plasterNoise = periodicNoise(71, 5, 3)
  const plasterRand = random(72)
  const plasterCanvas = pixels((u, v) => grey(0.84 + plasterNoise(u, v) * 0.16 + (plasterRand() - 0.5) * 0.05))
  const plaster = set(plasterCanvas, plasterCanvas)

  // 屋瓦：一列列筒瓦，每列上緣受光、下緣陰影
  const roofNoise = periodicNoise(81, 3, 8)
  const roofCanvas = pixels((u, v) => {
    const row = (v * 10) % 1
    const column = Math.abs(Math.sin(u * Math.PI * 16))
    return grey(0.45 + (1 - row) * 0.3 + column * 0.2 + roofNoise(u, v) * 0.15)
  })
  const roofTiles = set(roofCanvas, roofCanvas)

  // 木紋：沿 u 方向的年輪條紋
  const woodNoise = periodicNoise(91, 4, 4)
  const woodCanvas = pixels((u, v) => {
    const ring = Math.sin((v * 18 + woodNoise(u, v) * 3) * Math.PI) * 0.5 + 0.5
    return grey(0.62 + ring * 0.28 + woodNoise(u * 4, v) * 0.1)
  })
  const wood = set(woodCanvas, woodCanvas)

  // 柏油與碎石道碴：高頻的顆粒
  const asphaltRand = random(101)
  const asphaltNoise = periodicNoise(102, 3, 8)
  const asphaltCanvas = pixels((u, v) => grey(0.7 + asphaltNoise(u, v) * 0.15 + (asphaltRand() - 0.5) * 0.35))
  const asphalt = set(asphaltCanvas, asphaltCanvas)

  // 樹葉：成簇的葉片明暗
  const leafNoise = periodicNoise(111, 5, 10)
  const leafCanvas = pixels((u, v) => {
    const n = leafNoise(u, v)
    return grey(0.62 + n * 0.45)
  })
  const leaves = set(leafCanvas, leafCanvas)

  // 水面：多組正弦波疊加的法線貼圖，於場景中平移產生流動
  const waveNoise = periodicNoise(121, 4, 6)
  const water: TextureSet = {
    map: keep(texture(pixels(() => [255, 255, 255], 8), true)),
    normal: keep(
      texture(
        normalFrom((u, v) => Math.sin((u * 6 + waveNoise(u, v) * 2) * Math.PI * 2) * 0.3 + waveNoise(u * 2, v * 2), 6),
        false,
      ),
    ),
  }

  // 瀑布水幕：沿 v 方向拉長的水流條紋，作為顏色與透明度貼圖，於場景中往下捲動
  const streakNoise = periodicNoise(131, 4, 4)
  const streakCanvas = pixels((u, v) => {
    const streak = streakNoise(u * 4, v)
    const foam = streakNoise(u * 8, v * 2)
    return grey(Math.min(1, 0.25 + Math.pow(streak, 2.2) * 1.3 + foam * 0.25))
  })
  const falls: TextureSet = { map: keep(texture(streakCanvas, true)), bump: keep(texture(streakCanvas, false)) }

  return {
    falls,
    grass,
    soil,
    rock,
    brick,
    tile,
    stone,
    plaster,
    roofTiles,
    wood,
    asphalt,
    leaves,
    water,
    dispose() {
      for (const t of all) t.dispose()
    },
  }
}

/**
 * 依頂點位置與法線重新計算 UV（方塊投影）：讓紋理以世界尺寸鋪設，不因物件大小被拉伸。
 * tile 為貼圖一次重複對應的場景單位。
 */
export function projectUV(geometry: THREE.BufferGeometry, tile: number) {
  const position = geometry.attributes.position
  if (!position) return
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  const normal = geometry.attributes.normal!
  const uv = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i))
    const ny = Math.abs(normal.getY(i))
    const nz = Math.abs(normal.getZ(i))
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const [a, b] = nx >= ny && nx >= nz ? [z, y] : ny >= nz ? [x, z] : [x, y]
    uv[i * 2] = a / tile
    uv[i * 2 + 1] = b / tile
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}
