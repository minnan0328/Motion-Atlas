<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { MotionDiagnostics, RenderMode } from '../motions/core/types'

// 即時診斷：FPS 與 Frame Time 取自實際的繪製迴圈，其餘數值取自動畫實例
const props = defineProps<{
  read: () => MotionDiagnostics | null
  renderMode: RenderMode
  technique: string
  paused: boolean
}>()
const emit = defineEmits<{ toggle: []; reset: [] }>()

const fps = ref(0)
const frameTime = ref(0)
const state = ref<MotionDiagnostics | null>(null)

let frame = 0
let frames = 0
let since = performance.now()
let last = performance.now()
let total = 0
function tick() {
  frame = requestAnimationFrame(tick)
  const now = performance.now()
  total += now - last
  last = now
  frames++
  if (now - since >= 500) {
    fps.value = Math.round((frames * 1000) / (now - since))
    frameTime.value = total / frames
    frames = 0
    total = 0
    since = now
  }
  state.value = props.read()
}
onMounted(() => {
  frame = requestAnimationFrame(tick)
})
onBeforeUnmount(() => cancelAnimationFrame(frame))

const RENDER_LABEL: Record<RenderMode, string> = { css: 'DOM', svg: 'SVG', webgl: 'WebGL' }
const STATE_LABEL = { running: '播放中', paused: '已暫停', finished: '已結束', idle: '未啟動' }
const percent = computed(() => (state.value?.progress === null || !state.value ? null : Math.round(state.value.progress * 100)))
</script>

<template>
  <div class="diagnostics">
    <div class="diagnostics__head">
      <h2>即時資訊</h2>
      <div class="diagnostics__actions">
        <button type="button" :aria-label="paused ? '播放' : '暫停'" @click="emit('toggle')">{{ paused ? '▶ 播放' : '❚❚ 暫停' }}</button>
        <button type="button" aria-label="重設" @click="emit('reset')">↺ 重設</button>
      </div>
    </div>

    <dl class="diagnostics__grid">
      <div>
        <dt>FPS</dt>
        <dd>{{ fps }}</dd>
      </div>
      <div>
        <dt>Frame Time</dt>
        <dd>{{ frameTime.toFixed(1) }}<small> ms</small></dd>
      </div>
      <div>
        <dt>Progress</dt>
        <dd>{{ percent === null ? '—' : `${percent}%` }}</dd>
      </div>
      <div>
        <dt>Keyframe</dt>
        <dd v-if="state?.keyframe">{{ state.keyframe.current }}<small> / {{ state.keyframe.total }}</small></dd>
        <dd v-else class="diagnostics__na">無</dd>
      </div>
      <div>
        <dt>Playback</dt>
        <dd class="diagnostics__text">{{ state ? STATE_LABEL[state.playState] : '—' }}</dd>
      </div>
      <div>
        <dt>Rendering</dt>
        <dd class="diagnostics__text">{{ RENDER_LABEL[renderMode] }}</dd>
      </div>
    </dl>

    <div class="diagnostics__track" aria-hidden="true">
      <div class="diagnostics__fill" :style="{ width: `${percent ?? 0}%` }" />
    </div>
    <p class="diagnostics__meta">
      <span>{{ technique }}</span>
      <span v-if="state?.note">{{ state.note }}</span>
      <span v-else-if="state && state.iteration !== null">第 {{ state.iteration + 1 }} 輪</span>
    </p>
  </div>
</template>

<style lang="scss" scoped>
.diagnostics {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;

    h2 {
      margin: 0;
      font-size: 15px;
    }
  }

  &__actions {
    display: flex;
    gap: 6px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
    margin: 0;

    div {
      padding: 8px 10px;
      border-radius: 8px;
      background: var(--ui-bg);
    }

    dt {
      font-size: 11px;
      color: var(--ui-muted);
    }

    dd {
      margin: 2px 0 0;
      font-size: 17px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    small {
      font-size: 11px;
      font-weight: 400;
      color: var(--ui-muted);
    }

    @media (max-width: 1100px) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  &__text {
    font-size: 14px !important;
  }

  &__na {
    font-size: 14px !important;
    color: var(--ui-muted);
  }

  &__track {
    height: 4px;
    border-radius: 2px;
    background: var(--ui-border);
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    background: var(--ui-accent);
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
    margin: 0;
    font-size: 12px;
    color: var(--ui-muted);
  }
}
</style>
