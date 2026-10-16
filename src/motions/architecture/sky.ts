import * as THREE from 'three'

/**
 * 天空穹頂：天頂到地平線的漸層、地平線以下的雲海色，太陽與月亮的圓盤、光暈與星空。
 * 日月低於地平線時被地平線遮住，因此能看到升起與落下的過程。穹頂跟著鏡頭移動，看起來在無限遠處。
 */

const RADIUS = 150

const vertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 ground;
  uniform vec3 sunDirection;
  uniform vec3 sunColor;
  uniform float sunGlow;
  uniform vec3 sunDiskColor;
  uniform vec3 moonDirection;
  uniform float moonVisibility;
  varying vec3 vDirection;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }

  void main() {
    vec3 direction = normalize(vDirection);
    float h = direction.y;
    // 天頂到地平線的漸層；地平線以下為雲海
    vec3 color = h > 0.0
      ? mix(horizon, zenith, pow(smoothstep(0.0, 0.7, h), 0.75))
      : mix(horizon, ground, smoothstep(0.0, -0.35, h));
    // 地平線遮住日月：只在地平線以上顯示圓盤
    float above = smoothstep(-0.006, 0.004, h);

    // 太陽：寬廣的暖色光暈與明亮的圓盤
    float s = max(dot(direction, sunDirection), 0.0);
    color += sunColor * (pow(s, 10.0) * 0.28 + pow(s, 90.0) * 0.55) * sunGlow;
    float sunDisk = smoothstep(0.99935, 0.99955, s) * above;
    color = mix(color, sunDiskColor, sunDisk * step(0.001, sunGlow));

    // 月亮：淡淡的光暈，圓盤上以雜訊表現月海的明暗
    float m = dot(direction, moonDirection);
    color += vec3(0.7, 0.78, 0.92) * pow(max(m, 0.0), 260.0) * 0.18 * moonVisibility;
    float moonDisk = smoothstep(0.99957, 0.99972, m) * above * moonVisibility;
    vec3 surface = direction - moonDirection * m;
    float maria = noise(surface * 420.0) * 0.6 + noise(surface * 1100.0) * 0.4;
    color = mix(color, vec3(0.93, 0.93, 0.88) * (0.72 + 0.28 * maria) * 1.6, moonDisk);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createSky() {
  const uniforms = {
    zenith: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    ground: { value: new THREE.Color() },
    sunDirection: { value: new THREE.Vector3(1, 0, 0) },
    sunColor: { value: new THREE.Color() },
    sunGlow: { value: 1 },
    // 太陽圓盤的顏色與亮度：接近地平線時偏橘紅、較暗，高掛時接近白色
    sunDiskColor: { value: new THREE.Color() },
    moonDirection: { value: new THREE.Vector3(-1, 0, 0) },
    moonVisibility: { value: 0 },
  }
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 48, 24),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.BackSide, depthWrite: false, fog: false }),
  )
  dome.renderOrder = -2
  dome.frustumCulled = false

  // 星空：分布在地平線以上，夜晚浮現
  const count = 700
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const y = Math.random() * 0.95 + 0.03
    const angle = Math.random() * Math.PI * 2
    const r = Math.sqrt(1 - y * y)
    positions.set([Math.cos(angle) * r * (RADIUS - 5), y * (RADIUS - 5), Math.sin(angle) * r * (RADIUS - 5)], i * 3)
  }
  const starGeometry = new THREE.BufferGeometry()
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const starMaterial = new THREE.PointsMaterial({ color: '#f4f1e8', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false })
  const stars = new THREE.Points(starGeometry, starMaterial)
  stars.renderOrder = -1
  stars.frustumCulled = false

  const group = new THREE.Group()
  group.add(dome, stars)

  return {
    group,
    uniforms,
    // 穹頂與星空跟著鏡頭，並隨時間緩慢轉動星空
    follow(camera: THREE.Vector3, time: number, starOpacity: number) {
      group.position.copy(camera)
      stars.rotation.y = time * 0.004
      starMaterial.opacity = starOpacity
      stars.visible = starOpacity > 0.01
    },
  }
}

/**
 * 日月在天球上的方向：白天（或月亮可見的期間）由東（+x）經南方天空（-z）到西（-x），
 * 其餘時間延續到地平線以下。rise、set 為升起與落下的時刻（小時），elevation 為中天高度（度）。
 */
export function celestialDirection(hour: number, rise: number, set: number, elevation: number, target: THREE.Vector3) {
  const span = (((set - rise) % 24) + 24) % 24
  const t = (((hour - rise) % 24) + 24) % 24
  const angle = t <= span ? (t / span) * Math.PI : Math.PI + ((t - span) / (24 - span)) * Math.PI
  const e = THREE.MathUtils.degToRad(elevation)
  return target.set(Math.cos(angle), Math.sin(angle) * Math.sin(e), -Math.sin(angle) * Math.cos(e)).normalize()
}
