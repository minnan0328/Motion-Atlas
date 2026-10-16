<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
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

// 放大預覽：優先使用瀏覽器全螢幕；不支援元素全螢幕時（例如 iPhone Safari）改為覆蓋整個視窗。
// 以 Esc 或右上角按鈕結束；離開頁面時一併結束
const stage = ref<HTMLElement>()
const expanded = ref(false)
async function toggleExpand() {
  if (expanded.value) {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined)
    expanded.value = false
    return
  }
  expanded.value = true
  await stage.value?.requestFullscreen?.().catch(() => undefined)
}
const onFullscreenChange = () => {
  if (!document.fullscreenElement) expanded.value = false
}
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && expanded.value && !document.fullscreenElement) expanded.value = false
}
// 覆蓋視窗時鎖住頁面捲動
watch(expanded, (value) => {
  document.body.style.overflow = value && !document.fullscreenElement ? 'hidden' : ''
})
onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('keydown', onKeydown)
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
  document.body.style.overflow = ''
})

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

// 預覽依設計比例顯示，高度最多填滿視窗中扣除 Header 與標題列的空間
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
    <!-- 標題列：返回、標題與展開按鈕；說明與標籤移到預覽下方，讓預覽能放大顯示 -->
    <header class="motion__header">
      <div class="motion__heading">
        <RouterLink :to="{ path: '/', query: { category: meta.category } }" class="motion__back reveal">← {{ categoryName(meta.category) }}</RouterLink>
        <!-- 標題與預覽是共用元素（由卡片連續變形而來），不加進場淡入 -->
        <h1>
          <span class="motion__index reveal">{{ String(number).padStart(3, '0') }}</span>
          <span class="motion__title">{{ meta.title }}</span>
          <small class="motion__en reveal" style="--i: 1">{{ meta.titleEn }}</small>
        </h1>
      </div>
      <div class="motion__toggles reveal" style="--i: 2">
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
        <button type="button" :aria-pressed="expanded" aria-label="放大預覽" @click="toggleExpand">
          <span aria-hidden="true">⤢</span> 放大
        </button>
      </div>
    </header>

    <div class="motion__body" :class="{ 'has-panel': showSettings }">
      <section class="motion__left">
        <div
          ref="stage"
          class="motion__stage"
          data-leave="shrink"
          :class="{ 'is-open': showInfo, 'is-expanded': expanded }"
          :style="{ aspectRatio: String(aspect), viewTransitionName: 'motion-stage' }"
        >
          <MotionPreview :key="meta.id" ref="preview" :meta="meta" :params="params" :paused="paused" interactive />
          <button v-if="expanded" type="button" class="motion__close" @click="toggleExpand">✕ 結束放大</button>
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

    <!-- 動態下方：操作提示、說明、標籤與主要原則 -->
    <section class="motion__about reveal" style="--i: 3">
      <p v-if="meta.supportedControls.includes('camera')" class="motion__hint">拖曳旋轉、滾輪縮放、右鍵平移</p>
      <p v-else-if="meta.renderMode === 'webgl'" class="motion__hint">點擊預覽給予衝量，觀察剛性、阻尼與質量的反應</p>
      <p class="motion__description">{{ meta.description }}</p>
      <ul class="motion__tags">
        <li class="is-strong">{{ categoryName(meta.category) }}</li>
        <li class="is-strong">{{ meta.technique }} · {{ meta.dimension.toUpperCase() }}</li>
        <li v-for="tag in meta.tags" :key="tag">{{ tag }}</li>
      </ul>
      <p class="motion__principles">
        主要原則：<span v-for="id in meta.animationPrinciples" :key="id">{{ principleName(id) }}</span>
      </p>
    </section>

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

  // 標題列：左側返回與標題，右側展開按鈕；窄螢幕時按鈕換到下一行
  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px 16px;
    margin-bottom: 16px;

    h1 {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0 10px;
      margin: 8px 0 0;
      font-size: 26px;
    }
  }

  &__heading {
    min-width: 0;
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
    color: var(--ui-muted);
    font-weight: 400;
  }

  &__en {
    font-size: 15px;
    font-weight: 400;
    color: var(--ui-muted);
  }

  // 預覽下方的說明區
  &__about {
    margin-top: 24px;
    padding: 20px;
    border: 1px solid var(--ui-border);
    border-radius: 14px;
    background: var(--ui-surface);

    p {
      margin: 0;
    }
  }

  &__description {
    max-width: 48em;
    font-size: 15px;
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
    position: relative;
    width: 100%;
    // 扣除 Header（56px）、標題列與上下間距後填滿視窗高度，至少 320px
    max-height: max(320px, calc(100svh - 190px));
    overflow: hidden;
    border-radius: 13px;

    // 下方接著即時資訊時，只保留上方圓角
    &.is-open {
      border-radius: 13px 13px 0 0;
    }

    // 放大：全螢幕或覆蓋整個視窗，預覽依新尺寸重新縮放
    &:fullscreen,
    &.is-expanded {
      width: 100vw;
      height: 100vh;
      max-height: none;
      aspect-ratio: auto !important;
      border-radius: 0;
      background: var(--ui-bg);
    }

    &.is-expanded:not(:fullscreen) {
      position: fixed;
      inset: 0;
      z-index: 100;
      height: 100dvh;
    }
  }

  &__close {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 2;
    padding: 6px 14px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ui-surface) 85%, transparent);
    backdrop-filter: blur(6px);
  }

  &__hint {
    margin-bottom: 8px !important;
    font-size: 12px;
    color: var(--ui-muted);
  }

  &__toggles {
    display: flex;
    flex-wrap: wrap;
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
