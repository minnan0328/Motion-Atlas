<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { PALETTE } from '../motions/core/dom'
import type { MotionInstance, MotionMeta, MotionOverlay, MotionParams } from '../motions/core/types'

// 動畫預覽：載入動畫模組並依統一的生命週期管理（建立、播放、暫停、尺寸、更新、釋放）
const props = withDefaults(
  defineProps<{
    meta: MotionMeta
    params: MotionParams
    // 詳細頁主要預覽：啟用鏡頭操作與點擊互動
    interactive?: boolean
    // 使用者手動暫停
    paused?: boolean
  }>(),
  { interactive: false, paused: false },
)

const host = ref<HTMLElement>()
const overlay = shallowRef<MotionOverlay | null>(null)
const size = ref({ width: 0, height: 0 })
const ready = ref(false)

let instance: MotionInstance | null = null
let visible = true
let destroyed = false

// 不在畫面內的預覽暫停，回到畫面時繼續（除非使用者手動暫停）
function applyPlayback() {
  if (!instance) return
  if (props.paused || !visible) instance.pause()
  else instance.play()
}

const resizeObserver = new ResizeObserver(([entry]) => {
  const { width, height } = entry!.contentRect
  size.value = { width, height }
  instance?.resize(width, height)
})
const visibilityObserver = new IntersectionObserver(([entry]) => {
  visible = entry!.isIntersecting
  applyPlayback()
})

onMounted(async () => {
  const element = host.value!
  resizeObserver.observe(element)
  visibilityObserver.observe(element)
  const rect = element.getBoundingClientRect()
  const module = await props.meta.load()
  if (destroyed) return
  instance = module.create({
    container: element,
    width: rect.width,
    height: rect.height,
    params: props.params,
    preview: props.meta.previewConfig,
    interactive: props.interactive,
  })
  overlay.value = instance.overlay ?? null
  ready.value = true
  applyPlayback()
})

onBeforeUnmount(() => {
  destroyed = true
  resizeObserver.disconnect()
  visibilityObserver.disconnect()
  instance?.dispose()
  instance = null
})

watch(
  () => props.params,
  (params) => instance?.update(params),
  { deep: true },
)
watch(() => props.paused, applyPlayback)

// 疊加層依設計寬度等比縮放，並限制最大倍率
const overlayFit = computed(() => {
  if (!overlay.value || !size.value.width) return null
  const scale = Math.min(size.value.width / overlay.value.width, overlay.value.maxScale ?? Infinity)
  return { scale, width: size.value.width / scale, height: size.value.height / scale }
})

defineExpose({
  getInstance: () => instance,
})
</script>

<template>
  <div
    ref="host"
    class="motion-preview"
    :class="{ 'motion-preview--interactive': interactive && meta.renderMode === 'webgl' }"
    :style="{ background: PALETTE.c4 }"
  >
    <div
      v-if="overlay && overlayFit"
      class="motion-preview__overlay"
      :style="{ width: `${overlayFit.width}px`, height: `${overlayFit.height}px`, transform: `scale(${overlayFit.scale})` }"
    >
      <component :is="overlay.component" v-bind="overlay.props" />
    </div>
    <span v-if="!ready" class="motion-preview__loading">載入中…</span>
  </div>
</template>

<style lang="scss" scoped>
.motion-preview {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;

  &--interactive {
    cursor: grab;
    touch-action: none;

    &:active {
      cursor: grabbing;
    }
  }

  &__overlay {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    transform-origin: 0 0;
  }

  &__loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #a89985;
  }
}
</style>
