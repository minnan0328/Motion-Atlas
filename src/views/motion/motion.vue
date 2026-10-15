<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import ControlsPanel from '../../components/controls-panel.vue'
import DiagnosticsPanel from '../../components/diagnostics-panel.vue'
import MotionPreview from '../../components/motion-preview.vue'
import { principleName } from '../../motions/core/principles'
import type { MotionInstance, MotionParams } from '../../motions/core/types'
import { categoryName, findMotion, MOTIONS } from '../../motions/registry'
import ErrorView from '../error/error.vue'

const props = defineProps<{ id: string }>()

const meta = computed(() => findMotion(props.id))
const params = ref<MotionParams>({ ...(meta.value?.defaults ?? MOTIONS[0]!.defaults) })
const paused = ref(false)

// 切換作品時回到預設參數
watch(
  () => props.id,
  () => {
    if (meta.value) params.value = { ...meta.value.defaults }
    paused.value = false
  },
)

const sameCategory = computed(() => MOTIONS.filter((item) => item.category === meta.value?.category))
const position = computed(() => sameCategory.value.findIndex((item) => item.id === props.id))
const prev = computed(() => sameCategory.value[(position.value - 1 + sameCategory.value.length) % sameCategory.value.length])
const next = computed(() => sameCategory.value[(position.value + 1) % sameCategory.value.length])
const number = computed(() => MOTIONS.findIndex((item) => item.id === props.id) + 1)

// 預覽依設計比例顯示，最高不超過視窗的 65%
const aspect = computed(() => (meta.value ? meta.value.previewConfig.width / meta.value.previewConfig.height : 1.5))

const preview = ref<{ getInstance(): MotionInstance | null }>()
const instance = shallowRef<MotionInstance | null>(null)
const readDiagnostics = () => {
  const current = preview.value?.getInstance() ?? null
  if (current !== instance.value) instance.value = current
  return current?.diagnostics() ?? null
}
const camera = computed(() => instance.value?.camera ?? null)
const reset = () => preview.value?.getInstance()?.reset()
</script>

<template>
  <ErrorView v-if="!meta" />

  <main v-else class="motion">
    <header class="motion__header">
      <RouterLink :to="{ path: '/', query: { category: meta.category } }" class="motion__back">← {{ categoryName(meta.category) }}</RouterLink>
      <h1>
        <span class="motion__index">{{ String(number).padStart(3, '0') }}</span>
        {{ meta.title }}
      </h1>
      <p class="motion__en">{{ meta.titleEn }}</p>
      <p>{{ meta.description }}</p>
      <ul class="motion__tags">
        <li class="is-strong">{{ categoryName(meta.category) }}</li>
        <li class="is-strong">{{ meta.technique }} · {{ meta.dimension.toUpperCase() }}</li>
        <li v-for="tag in meta.tags" :key="tag">{{ tag }}</li>
      </ul>
      <p class="motion__principles">
        主要原則：<span v-for="id in meta.animationPrinciples" :key="id">{{ principleName(id) }}</span>
      </p>
    </header>

    <div class="motion__body">
      <section class="motion__left">
        <div class="motion__stage" :style="{ aspectRatio: String(aspect) }">
          <MotionPreview :key="meta.id" ref="preview" :meta="meta" :params="params" :paused="paused" interactive />
        </div>
        <p v-if="meta.supportedControls.includes('camera')" class="motion__hint">拖曳旋轉、滾輪縮放、右鍵平移</p>
        <p v-else-if="meta.renderMode === 'webgl'" class="motion__hint">點擊預覽給予衝量，觀察剛性、阻尼與質量的反應</p>
        <DiagnosticsPanel
          class="motion__diagnostics"
          :read="readDiagnostics"
          :render-mode="meta.renderMode"
          :technique="meta.technique"
          :paused="paused"
          @toggle="paused = !paused"
          @reset="reset"
        />
      </section>

      <aside class="motion__panel">
        <ControlsPanel v-model="params" :meta="meta" :camera="camera" />
      </aside>
    </div>

    <nav v-if="sameCategory.length > 1 && prev && next" class="motion__nav">
      <RouterLink :to="prev.route">← {{ prev.title }}</RouterLink>
      <RouterLink :to="next.route">{{ next.title }} →</RouterLink>
    </nav>
  </main>
</template>

<style lang="scss" scoped>
.motion {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 16px 16px;

  &__header {
    margin-bottom: 24px;

    h1 {
      margin: 10px 0 4px;
      font-size: 28px;
    }

    p {
      margin: 0;
    }
  }

  &__back {
    font-size: 14px;
    color: var(--ui-muted);
  }

  &__index {
    margin-right: 8px;
    color: var(--ui-muted);
    font-weight: 400;
  }

  &__en {
    margin-bottom: 10px !important;
    color: var(--ui-muted);
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 12px 0 8px;
    padding: 0;
    list-style: none;

    li {
      padding: 2px 10px;
      border: 1px solid var(--ui-border);
      border-radius: 999px;
      font-size: 12px;
      color: var(--ui-muted);

      &.is-strong {
        border-color: var(--ui-muted);
        color: var(--ui-text);
      }
    }
  }

  &__principles {
    font-size: 13px;
    color: var(--ui-muted);

    span + span::before {
      content: '・';
    }
  }

  // 桌面版左右兩欄 3:2、高度一致；行動版依序為預覽、即時資訊、設定
  &__body {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: 24px;
    align-items: stretch;

    @media (max-width: 900px) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__left,
  &__panel {
    border: 1px solid var(--ui-border);
    border-radius: 14px;
    background: var(--ui-surface);
  }

  &__left {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  // 預覽區靠上對齊，底色填滿
  &__stage {
    width: 100%;
    max-height: 65vh;
    overflow: hidden;
    border-radius: 13px 13px 0 0;
  }

  &__hint {
    margin: 0 !important;
    padding: 10px 16px 0;
    font-size: 12px;
    text-align: center;
    color: var(--ui-muted);
  }

  &__diagnostics {
    padding: 16px 20px 20px;
  }

  &__panel {
    min-width: 0;
    padding: 20px;
  }

  &__nav {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-top: 28px;

    a {
      color: inherit;
    }
  }
}
</style>
