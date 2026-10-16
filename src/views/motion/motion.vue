<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
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
// 即時資訊與動態設定預設收合，需要時再展開；切換上一件、下一件時維持目前的展開狀態
const showInfo = ref(false)
const showSettings = ref(false)
// 動態設定在桌面版位於右側；窄螢幕接在預覽下方，展開後捲動到可見範圍
const settings = ref<HTMLElement>()
async function toggleSettings() {
  showSettings.value = !showSettings.value
  if (!showSettings.value) return
  // 桌面版設定與預覽並排，已在可見範圍內，只有窄螢幕需要捲動
  if (!window.matchMedia('(max-width: 900px)').matches) return
  await nextTick()
  settings.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

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
      <RouterLink :to="{ path: '/', query: { category: meta.category } }" class="motion__back reveal">← {{ categoryName(meta.category) }}</RouterLink>
      <!-- 標題與預覽是共用元素（由卡片連續變形而來），不加進場淡入 -->
      <h1>
        <span class="motion__index reveal">{{ String(number).padStart(3, '0') }}</span>
        <span class="motion__title">{{ meta.title }}</span>
      </h1>
      <p class="motion__en reveal" style="--i: 1">{{ meta.titleEn }}</p>
      <p class="reveal" style="--i: 2">{{ meta.description }}</p>
      <ul class="motion__tags reveal" style="--i: 3">
        <li class="is-strong">{{ categoryName(meta.category) }}</li>
        <li class="is-strong">{{ meta.technique }} · {{ meta.dimension.toUpperCase() }}</li>
        <li v-for="tag in meta.tags" :key="tag">{{ tag }}</li>
      </ul>
      <p class="motion__principles reveal" style="--i: 4">
        主要原則：<span v-for="id in meta.animationPrinciples" :key="id">{{ principleName(id) }}</span>
      </p>
    </header>

    <!-- 預覽上方：操作提示與展開按鈕 -->
    <div class="motion__toolbar reveal" style="--i: 3">
      <p v-if="meta.supportedControls.includes('camera')" class="motion__hint">拖曳旋轉、滾輪縮放、右鍵平移</p>
      <p v-else-if="meta.renderMode === 'webgl'" class="motion__hint">點擊預覽給予衝量，觀察剛性、阻尼與質量的反應</p>
      <div class="motion__toggles">
        <button
          type="button"
          :class="{ 'is-active': showInfo }"
          :aria-expanded="showInfo"
          aria-controls="motion-info"
          @click="showInfo = !showInfo"
        >
          即時資訊 <span aria-hidden="true">{{ showInfo ? '▴' : '▾' }}</span>
        </button>
        <button
          type="button"
          :class="{ 'is-active': showSettings }"
          :aria-expanded="showSettings"
          aria-controls="motion-settings"
          @click="toggleSettings"
        >
          動態設定
        </button>
      </div>
    </div>
    <div class="motion__body" :class="{ 'has-panel': showSettings }">
      <section class="motion__left">
        <div class="motion__stage" data-leave="shrink" :class="{ 'is-open': showInfo }" :style="{ aspectRatio: String(aspect), viewTransitionName: 'motion-stage' }">
          <MotionPreview :key="meta.id" ref="preview" :meta="meta" :params="params" :paused="paused" interactive />
        </div>
        <!-- 收合時不掛載，診斷數據的讀取迴圈也一併停止 -->
        <DiagnosticsPanel
          v-if="showInfo"
          id="motion-info"
          data-leave="shrink"
          class="motion__diagnostics"
          :read="readDiagnostics"
          :render-mode="meta.renderMode"
          :technique="meta.technique"
          :paused="paused"
          @toggle="paused = !paused"
          @reset="reset"
        />
      </section>

      <aside v-if="showSettings" id="motion-settings" ref="settings" class="motion__panel" data-leave="shrink">
        <ControlsPanel v-model="params" :meta="meta" :camera="camera" />
      </aside>
    </div>

    <nav v-if="sameCategory.length > 1 && prev && next" class="motion__nav reveal" style="--i: 5">
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

  // 共用元素需為單一的盒子
  &__title {
    display: inline-block;
    view-transition-name: motion-title;
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

  // 預覽滿版；展開動態設定後，桌面版設定在右側（左右 3:2），窄螢幕改為接在預覽下方
  &__body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
    align-items: start;

    &.has-panel {
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);

      @media (max-width: 900px) {
        grid-template-columns: minmax(0, 1fr);
      }
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
    border-radius: 13px;

    // 下方接著即時資訊時，只保留上方圓角
    &.is-open {
      border-radius: 13px 13px 0 0;
    }
  }

  // 預覽上方：操作提示與展開按鈕
  &__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin-bottom: 12px;
  }

  &__hint {
    margin: 0 !important;
    font-size: 12px;
    color: var(--ui-muted);
  }

  &__toggles {
    display: flex;
    gap: 6px;
    margin-left: auto;

    button {
      padding: 5px 14px;
      border-radius: 999px;

      &.is-active {
        border-color: var(--ui-accent);
        background: var(--ui-accent);
        color: var(--ui-surface);
      }
    }
  }

  &__diagnostics {
    padding: 16px 20px 20px;
    border-top: 1px solid var(--ui-border);
  }

  // 右側的設定面板在捲動時保持可見，內容過長時在面板內捲動
  &__panel {
    min-width: 0;
    padding: 20px;

    @media (min-width: 901px) {
      position: sticky;
      // 網站 Header 固定在上方（高 56px），面板停在其下方
      top: 72px;
      max-height: calc(100vh - 88px);
      overflow-y: auto;
    }
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
