<script setup lang="ts">
import { computed, ref } from 'vue'
import { toCubicBezier, type Bezier } from '../data/motion'

const model = defineModel<Bezier>({ required: true })

const presets: { label: string; value: Bezier }[] = [
  { label: 'linear', value: [0, 0, 1, 1] },
  { label: 'ease', value: [0.25, 0.1, 0.25, 1] },
  { label: 'ease-in', value: [0.42, 0, 1, 1] },
  { label: 'ease-out', value: [0, 0, 0.58, 1] },
  { label: 'ease-in-out', value: [0.42, 0, 0.58, 1] },
  { label: 'back', value: [0.68, -0.4, 0.32, 1.4] },
]

// 曲線 0~1 對應 SVG 0~SIZE，上下各留 PAD 給超出範圍的控制點
const SIZE = 200
const PAD = 80
const Y_MIN = -PAD / SIZE
const Y_MAX = 1 + PAD / SIZE

const svg = ref<SVGSVGElement>()
const dragging = ref<0 | 1 | null>(null)

const toX = (x: number) => x * SIZE
const toY = (y: number) => (1 - y) * SIZE

const points = computed(() => {
  const [x1, y1, x2, y2] = model.value
  return {
    p1: { x: toX(x1), y: toY(y1) },
    p2: { x: toX(x2), y: toY(y2) },
  }
})

const curve = computed(() => {
  const { p1, p2 } = points.value
  return `M 0 ${SIZE} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${SIZE} 0`
})

const output = computed(() => toCubicBezier(model.value))

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round = (value: number) => Math.round(value * 100) / 100

function setValue(index: number, value: number) {
  if (Number.isNaN(value)) return
  const next = [...model.value] as Bezier
  next[index] = index % 2 === 0 ? clamp(value, 0, 1) : value
  model.value = next
}

function onPointerDown(handle: 0 | 1, event: PointerEvent) {
  dragging.value = handle
  ;(event.target as Element).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (dragging.value === null || !svg.value) return
  const rect = svg.value.getBoundingClientRect()
  const sx = ((event.clientX - rect.left) / rect.width) * SIZE
  const sy = ((event.clientY - rect.top) / rect.height) * (SIZE + PAD * 2) - PAD
  const x = round(clamp(sx / SIZE, 0, 1))
  const y = round(clamp(1 - sy / SIZE, Y_MIN, Y_MAX))
  const next = [...model.value] as Bezier
  next[dragging.value * 2] = x
  next[dragging.value * 2 + 1] = y
  model.value = next
}

function onPointerUp() {
  dragging.value = null
}

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(output.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    // 瀏覽器不允許存取剪貼簿時略過
  }
}
</script>

<template>
  <div class="bezier-editor">
    <svg
      ref="svg"
      class="bezier-editor__graph"
      :viewBox="`0 ${-PAD} ${SIZE} ${SIZE + PAD * 2}`"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <rect class="bezier-editor__area" x="0" y="0" :width="SIZE" :height="SIZE" />
      <line class="bezier-editor__diagonal" x1="0" :y1="SIZE" :x2="SIZE" y2="0" />
      <line class="bezier-editor__arm" x1="0" :y1="SIZE" :x2="points.p1.x" :y2="points.p1.y" />
      <line class="bezier-editor__arm" :x1="SIZE" y1="0" :x2="points.p2.x" :y2="points.p2.y" />
      <path class="bezier-editor__curve" :d="curve" />
      <circle
        class="bezier-editor__handle"
        :cx="points.p1.x"
        :cy="points.p1.y"
        r="8"
        @pointerdown="onPointerDown(0, $event)"
      />
      <circle
        class="bezier-editor__handle"
        :cx="points.p2.x"
        :cy="points.p2.y"
        r="8"
        @pointerdown="onPointerDown(1, $event)"
      />
    </svg>

    <div class="bezier-editor__inputs">
      <label v-for="(label, i) in ['x1', 'y1', 'x2', 'y2']" :key="label">
        <span>{{ label }}</span>
        <input
          type="number"
          step="0.01"
          :min="i % 2 === 0 ? 0 : undefined"
          :max="i % 2 === 0 ? 1 : undefined"
          :value="model[i]"
          @change="setValue(i, Number(($event.target as HTMLInputElement).value))"
        />
      </label>
    </div>

    <div class="bezier-editor__presets">
      <button
        v-for="preset in presets"
        :key="preset.label"
        type="button"
        @click="model = [...preset.value]"
      >
        {{ preset.label }}
      </button>
    </div>

    <button type="button" class="bezier-editor__output" @click="copy">
      <code>{{ output }}</code>
      <span>{{ copied ? '已複製' : '複製' }}</span>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.bezier-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__graph {
    width: 100%;
    max-width: 220px;
    align-self: center;
    overflow: visible;
    touch-action: none;
  }

  &__area {
    fill: var(--ui-surface);
    stroke: var(--ui-border);
  }

  &__diagonal {
    stroke: var(--ui-border);
    stroke-dasharray: 4 4;
  }

  &__arm {
    stroke: var(--ui-muted);
    stroke-width: 1.5;
  }

  &__curve {
    fill: none;
    stroke: var(--ui-text);
    stroke-width: 3;
  }

  &__handle {
    fill: var(--ui-accent);
    stroke: var(--ui-surface);
    stroke-width: 2;
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }

  &__inputs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;

    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: var(--ui-muted);
    }

    input {
      width: 100%;
      min-width: 0;
    }
  }

  &__presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__output {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;

    code {
      font-size: 12px;
      white-space: nowrap;
    }

    span {
      flex-shrink: 0;
      font-size: 12px;
      color: var(--ui-muted);
    }
  }
}
</style>
