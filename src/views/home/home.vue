<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MotionCard from '../../components/motion-card.vue'
import type { Category, Dimension } from '../../motions/core/types'
import { CATEGORIES, MOTIONS, TECHNIQUES } from '../../motions/registry'

const route = useRoute()
const router = useRouter()

// 搜尋與篩選狀態同步到網址：?q=&category=&tech=&dim=&tags=
const keyword = ref('')
const category = ref<Category | ''>('')
const technique = ref('')
const dimension = ref<Dimension | ''>('')
const tags = ref<string[]>([])

const single = (value: unknown) => (typeof value === 'string' ? value : '')
watch(
  () => route.query,
  (query) => {
    keyword.value = single(query.q)
    category.value = single(query.category) as Category | ''
    technique.value = single(query.tech)
    dimension.value = single(query.dim) as Dimension | ''
    tags.value = single(query.tags) ? single(query.tags).split(',') : []
  },
  { immediate: true },
)
watch([keyword, category, technique, dimension, tags], () => {
  const query: Record<string, string> = {}
  if (keyword.value.trim()) query.q = keyword.value.trim()
  if (category.value) query.category = category.value
  if (technique.value) query.tech = technique.value
  if (dimension.value) query.dim = dimension.value
  if (tags.value.length) query.tags = tags.value.join(',')
  const current = route.query
  const same = ['q', 'category', 'tech', 'dim', 'tags'].every((key) => (current[key] ?? '') === (query[key] ?? ''))
  if (!same) router.replace({ query })
})

// 編號依 Metadata 的順序固定，篩選後不變
const numbered = MOTIONS.map((meta, i) => ({ meta, index: i + 1 }))

const matchesBase = (meta: (typeof MOTIONS)[number]) => {
  const term = keyword.value.trim().toLowerCase()
  const text = !term || [meta.title, meta.titleEn, meta.description].some((value) => value.toLowerCase().includes(term))
  return (
    text &&
    (!category.value || meta.category === category.value) &&
    (!technique.value || meta.technique === technique.value) &&
    (!dimension.value || meta.dimension === dimension.value)
  )
}

const results = computed(() =>
  numbered.filter(({ meta }) => matchesBase(meta) && (!tags.value.length || tags.value.some((tag) => meta.tags.includes(tag)))),
)

// 標籤選項：目前其他條件下仍有作品的標籤，依數量排序
const tagOptions = computed(() => {
  const counts = new Map<string, number>()
  for (const { meta } of numbered) {
    if (!matchesBase(meta)) continue
    for (const tag of meta.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  for (const tag of tags.value) if (!counts.has(tag)) counts.set(tag, 0)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }))
})
const showAllTags = ref(false)
const visibleTags = computed(() => (showAllTags.value ? tagOptions.value : tagOptions.value.slice(0, 18)))

const toggleTag = (tag: string) => {
  tags.value = tags.value.includes(tag) ? tags.value.filter((t) => t !== tag) : [...tags.value, tag]
}
// 篩選條件預設收合，只保留搜尋；展開按鈕上顯示已套用的條件數量（搜尋文字不計）
const showFilters = ref(false)
const filterCount = computed(
  () => Number(Boolean(category.value)) + Number(Boolean(technique.value)) + Number(Boolean(dimension.value)) + tags.value.length,
)
const hasFilters = computed(() => Boolean(keyword.value || category.value || technique.value || dimension.value || tags.value.length))
const clear = () => {
  keyword.value = ''
  category.value = ''
  technique.value = ''
  dimension.value = ''
  tags.value = []
}
const countOf = (id: Category) => MOTIONS.filter((meta) => meta.category === id).length
</script>

<template>
  <main class="home">
    <header class="home__header">
      <h1>Motion Atlas</h1>
      <p>基礎動態、文字動態與 3D 建築動態，依循動畫十二法則。進入作品可即時調整參數並查看診斷資訊。</p>
    </header>

    <div class="home__toolbar">
      <div class="home__search-row">
        <label class="home__search">
          <span aria-hidden="true">⌕</span>
          <input v-model="keyword" type="search" placeholder="搜尋名稱或描述" aria-label="搜尋動畫" />
        </label>
        <button
          type="button"
          class="home__filter-toggle"
          :class="{ 'is-active': showFilters }"
          :aria-expanded="showFilters"
          aria-controls="home-filters"
          @click="showFilters = !showFilters"
        >
          篩選
          <span v-if="filterCount" class="home__badge" :aria-label="`已套用 ${filterCount} 個條件`">{{ filterCount }}</span>
          <span aria-hidden="true">{{ showFilters ? '▴' : '▾' }}</span>
        </button>
      </div>

      <div v-show="showFilters" id="home-filters" class="home__panel">
        <div class="home__filters" role="group" aria-label="分類">
          <span class="home__label">分類</span>
          <button type="button" class="chip" :class="{ 'is-active': !category }" @click="category = ''">全部 <small>{{ MOTIONS.length }}</small></button>
          <button
            v-for="item in CATEGORIES"
            :key="item.id"
            type="button"
            class="chip"
            :class="{ 'is-active': category === item.id }"
            @click="category = category === item.id ? '' : item.id"
          >
            {{ item.name }} <small>{{ countOf(item.id) }}</small>
          </button>
        </div>

        <div class="home__filters" role="group" aria-label="技術與維度">
          <span class="home__label">技術</span>
          <button
            v-for="item in TECHNIQUES"
            :key="item"
            type="button"
            class="chip"
            :class="{ 'is-active': technique === item }"
            @click="technique = technique === item ? '' : item"
          >
            {{ item }}
          </button>
          <span class="home__divider" />
          <button
            v-for="item in ['2d', '3d'] as const"
            :key="item"
            type="button"
            class="chip"
            :class="{ 'is-active': dimension === item }"
            @click="dimension = dimension === item ? '' : item"
          >
            {{ item.toUpperCase() }}
          </button>
        </div>

        <div class="home__filters" role="group" aria-label="標籤">
          <span class="home__label">標籤</span>
          <button
            v-for="{ tag, count } in visibleTags"
            :key="tag"
            type="button"
            class="chip chip--small"
            :class="{ 'is-active': tags.includes(tag) }"
            :aria-pressed="tags.includes(tag)"
            @click="toggleTag(tag)"
          >
            {{ tag }} <small>{{ count }}</small>
          </button>
          <button v-if="tagOptions.length > 18" type="button" class="home__more" @click="showAllTags = !showAllTags">
            {{ showAllTags ? '收合' : `更多標籤（${tagOptions.length - 18}）` }}
          </button>
        </div>
      </div>

      <p class="home__count">
        顯示 {{ results.length }} / {{ MOTIONS.length }} 個作品
        <button v-if="hasFilters" type="button" @click="clear">清除條件</button>
      </p>
    </div>

    <ul v-if="results.length" class="home__grid">
      <li v-for="{ meta, index } in results" :key="meta.id">
        <MotionCard :index="index" :meta="meta" />
      </li>
    </ul>
    <div v-else class="home__empty">
      <p>找不到符合條件的作品</p>
      <button type="button" @click="clear">清除條件</button>
    </div>
  </main>
</template>

<style lang="scss" scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 16px 16px;

  &__header {
    margin-bottom: 28px;

    h1 {
      margin: 0 0 10px;
      font-size: clamp(30px, 5vw, 44px);
      letter-spacing: -0.02em;
    }

    p {
      margin: 0;
      color: var(--ui-muted);
    }
  }

  &__toolbar {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 24px;
  }

  &__search-row {
    display: flex;
    align-items: stretch;
    gap: 8px;
    max-width: 560px;
  }

  // 篩選展開按鈕：已套用條件時顯示數量
  &__filter-toggle {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 6px;
    padding: 0 14px;
    border-radius: 10px;
    font-size: 14px;

    &.is-active {
      border-color: var(--ui-muted);
    }
  }

  &__badge {
    min-width: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--ui-accent);
    color: var(--ui-surface);
    font-size: 11px;
    line-height: 18px;
    text-align: center;
  }

  &__panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__search {
    position: relative;
    flex: 1;
    min-width: 0;

    span {
      position: absolute;
      left: 12px;
      top: 50%;
      font-size: 18px;
      color: var(--ui-muted);
      transform: translateY(-50%);
    }

    input {
      width: 100%;
      padding: 10px 12px 10px 36px;
      border: 1px solid var(--ui-border);
      border-radius: 10px;
      background: var(--ui-surface);
      color: inherit;
      font: inherit;
      font-size: 14px;

      &:focus {
        border-color: var(--ui-muted);
        outline: none;
      }
    }
  }

  // 窄螢幕時篩選列橫向捲動
  &__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;

    @media (max-width: 600px) {
      flex-wrap: nowrap;
      margin: 0 -16px;
      padding: 0 16px 4px;
      overflow-x: auto;
    }
  }

  &__label {
    flex-shrink: 0;
    min-width: 2.6em;
    font-size: 12px;
    color: var(--ui-muted);
  }

  &__divider {
    width: 1px;
    height: 18px;
    margin: 0 4px;
    background: var(--ui-border);
  }

  &__more {
    flex-shrink: 0;
    border-style: dashed;
    font-size: 12px;
  }

  &__count {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--ui-muted);

    button {
      padding: 2px 10px;
      font-size: 12px;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
    gap: 16px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 64px 16px;
    border: 1px dashed var(--ui-border);
    border-radius: 16px;
    color: var(--ui-muted);

    p {
      margin: 0;
    }
  }
}

.chip {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  color: var(--ui-muted);

  small {
    font-size: 11px;
    opacity: 0.7;
  }

  &--small {
    padding: 3px 10px;
    font-size: 12px;
  }

  &.is-active {
    border-color: var(--ui-accent);
    background: var(--ui-accent);
    color: var(--ui-bg);
  }
}
</style>
