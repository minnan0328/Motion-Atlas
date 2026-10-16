<script setup lang="ts">
import { computed } from 'vue'
import { EASING_PRESETS } from '../motions/core/params'
import type { ControlKey, MotionMeta, MotionParams } from '../motions/core/types'
import BezierEditor from './bezier-editor.vue'

// 動畫設定：只顯示該動畫支援的控制項，每個控制項都直接改變動畫參數
const props = defineProps<{
  meta: MotionMeta
  camera?: { reset(): void; setAutoRotate(enabled: boolean): void } | null
}>()
const params = defineModel<MotionParams>({ required: true })

const has = (key: ControlKey) => props.meta.supportedControls.includes(key)
const set = <K extends keyof MotionParams>(key: K, value: MotionParams[K]) => {
  params.value = { ...params.value, [key]: value }
}

const isScene = computed(() => props.meta.category === 'architecture')
const durationLabel = computed(() => (isScene.value ? '發車間隔（秒）' : '持續時間（秒）'))
const durationRange = computed(() => (isScene.value ? { min: 4, max: 40, step: 1 } : { min: 0.3, max: 10, step: 0.1 }))

const presetLabel = computed(
  () => EASING_PRESETS.find((preset) => preset.value.every((v, i) => Math.abs(v - params.value.easing[i]!) < 1e-3))?.label ?? 'custom',
)
const infinite = computed(() => !Number.isFinite(params.value.iterations))

const num = (event: Event) => Number((event.target as HTMLInputElement).value)
const reset = () => {
  params.value = { ...props.meta.defaults }
  props.camera?.reset()
}
</script>

<template>
  <div class="controls">
    <div class="controls__head">
      <h2>動畫設定</h2>
      <button type="button" @click="reset">全部重設</button>
    </div>

    <section v-if="has('duration') || has('delay') || has('repeat') || has('direction')" class="controls__section">
      <h3>時間</h3>
      <label v-if="has('duration')" class="controls__slider">
        <span>{{ durationLabel }}</span>
        <output>{{ params.duration.toFixed(1) }}</output>
        <input type="range" v-bind="durationRange" :value="params.duration" @input="set('duration', num($event))" />
      </label>
      <label v-if="has('delay')" class="controls__slider">
        <span>延遲（秒）</span>
        <output>{{ params.delay.toFixed(1) }}</output>
        <input type="range" min="0" max="3" step="0.1" :value="params.delay" @input="set('delay', num($event))" />
      </label>
      <div v-if="has('repeat')" class="controls__row">
        <span>重複</span>
        <label class="controls__check">
          <input type="checkbox" :checked="infinite" @change="set('iterations', infinite ? 3 : Infinity)" />
          無限循環
        </label>
        <input
          v-if="!infinite"
          class="controls__number"
          type="number"
          min="1"
          max="20"
          :value="params.iterations"
          aria-label="重複次數"
          @change="set('iterations', Math.max(1, Math.round(num($event))))"
        />
      </div>
      <label v-if="has('direction')" class="controls__row">
        <span>方向</span>
        <select :value="params.direction" @change="set('direction', ($event.target as HTMLSelectElement).value as PlaybackDirection)">
          <option value="normal">normal</option>
          <option value="reverse">reverse</option>
          <option value="alternate">alternate</option>
          <option value="alternate-reverse">alternate-reverse</option>
        </select>
      </label>
    </section>

    <section v-if="has('easing') || has('cubicBezier')" class="controls__section">
      <h3>緩動</h3>
      <label v-if="has('easing')" class="controls__row">
        <span>Easing</span>
        <select
          :value="presetLabel"
          @change="set('easing', [...EASING_PRESETS.find((p) => p.label === ($event.target as HTMLSelectElement).value)!.value])"
        >
          <option v-if="presetLabel === 'custom'" value="custom" disabled>custom</option>
          <option v-for="preset in EASING_PRESETS" :key="preset.label" :value="preset.label">{{ preset.label }}</option>
        </select>
      </label>
      <BezierEditor v-if="has('cubicBezier')" :model-value="params.easing" @update:model-value="set('easing', $event)" />
    </section>

    <section v-if="has('amplitude')" class="controls__section">
      <h3>幅度</h3>
      <label class="controls__slider">
        <span>Amplitude</span>
        <output>{{ params.amplitude.toFixed(2) }}</output>
        <input type="range" min="0" max="2" step="0.05" :value="params.amplitude" @input="set('amplitude', num($event))" />
      </label>
    </section>

    <section v-if="has('stiffness') || has('damping') || has('mass')" class="controls__section">
      <h3>物理</h3>
      <label v-if="has('stiffness')" class="controls__slider">
        <span>Stiffness 剛性</span>
        <output>{{ Math.round(params.stiffness) }}</output>
        <input type="range" min="40" max="800" step="10" :value="params.stiffness" @input="set('stiffness', num($event))" />
      </label>
      <label v-if="has('damping')" class="controls__slider">
        <span>Damping 阻尼比</span>
        <output>{{ params.damping.toFixed(2) }}</output>
        <input type="range" min="0.05" max="1" step="0.01" :value="params.damping" @input="set('damping', num($event))" />
      </label>
      <label v-if="has('mass')" class="controls__slider">
        <span>Mass 質量</span>
        <output>{{ params.mass.toFixed(1) }}</output>
        <input type="range" min="0.2" max="5" step="0.1" :value="params.mass" @input="set('mass', num($event))" />
      </label>
    </section>

    <section v-if="has('text')" class="controls__section">
      <h3>文字</h3>
      <input
        class="controls__text"
        type="text"
        maxlength="16"
        placeholder="輸入示範文字（留空使用預設）"
        :value="params.text"
        @change="set('text', ($event.target as HTMLInputElement).value)"
      />
    </section>

    <section v-if="has('camera')" class="controls__section">
      <h3>鏡頭</h3>
      <p class="controls__hint">左鍵拖曳旋轉、滾輪縮放、右鍵拖曳平移；觸控為單指旋轉、雙指縮放與平移。</p>
      <div class="controls__row">
        <label class="controls__check">
          <input type="checkbox" :checked="params.autoRotate" @change="set('autoRotate', !params.autoRotate)" />
          自動環繞
        </label>
        <button type="button" :disabled="!camera" @click="camera?.reset()">重設視角</button>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.controls {
  display: flex;
  flex-direction: column;
  gap: 22px;

  &__head {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h2 {
      margin: 0;
      font-size: 16px;
    }
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 12px;

    h3 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--ui-muted);
    }
  }

  &__slider {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 8px;
    font-size: 14px;

    output {
      font-variant-numeric: tabular-nums;
      color: var(--ui-muted);
    }

    input {
      grid-column: 1 / -1;
      width: 100%;
      accent-color: var(--ui-accent);
    }
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;

    > span {
      min-width: 3em;
    }

    select {
      flex: 1;
      padding: 4px 6px;
      border: 1px solid var(--ui-border);
      border-radius: 6px;
      background: var(--ui-surface);
      color: inherit;
      font: inherit;
      font-size: 13px;
    }
  }

  &__check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;

    input {
      accent-color: var(--ui-accent);
    }
  }

  &__number {
    width: 64px;
  }

  &__text {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--ui-border);
    border-radius: 8px;
    background: var(--ui-surface);
    color: inherit;
    font: inherit;
    font-size: 14px;
  }

  &__hint {
    margin: 0;
    font-size: 12px;
    color: var(--ui-muted);
  }
}
</style>
