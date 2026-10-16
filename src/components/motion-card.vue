<script setup lang="ts">
import { computed } from 'vue'
import { categoryName } from '../motions/registry'
import { sharedMotion } from '../router/transitions'
import type { MotionMeta } from '../motions/core/types'
import MotionPreview from './motion-preview.vue'

// 全站共用的卡片：整體 3:2，預覽區填滿，左上角為順序編號，下方為標題、分類與標籤
const props = defineProps<{
  index: number
  meta: MotionMeta
}>()

// 換頁過場時，被點選的卡片預覽與標題連續變形為詳細頁的預覽與標題
const shared = computed(() => sharedMotion.value === props.meta.id)
</script>

<template>
  <RouterLink :to="meta.route" class="motion-card" :data-motion-id="meta.id">
    <div class="motion-card__preview" :style="shared ? { viewTransitionName: 'motion-stage' } : undefined">
      <MotionPreview :meta="meta" :params="meta.defaults" />
    </div>
    <span class="motion-card__index">{{ String(index).padStart(3, '0') }}</span>
    <div class="motion-card__info">
      <h2 class="motion-card__title" :style="shared ? { viewTransitionName: 'motion-title' } : undefined">{{ meta.title }}</h2>
      <ul class="motion-card__tags">
        <li class="motion-card__category">{{ categoryName(meta.category) }}</li>
        <li v-for="tag in meta.tags.slice(0, 3)" :key="tag">{{ tag }}</li>
      </ul>
    </div>
  </RouterLink>
</template>

<style lang="scss" scoped>
.motion-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) auto;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: 14px;
  background: var(--ui-surface);
  color: inherit;
  text-decoration: none;
  transition:
    transform 0.6s var(--spring),
    border-color 0.2s;

  &:hover {
    border-color: var(--ui-muted);
    transform: translateY(-3px);
  }

  &:active {
    transform: scale(0.98);
    transition-duration: 0.1s;
  }

  &__preview {
    min-height: 0;
    pointer-events: none;
  }

  &__index {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--ui-surface);
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--ui-text);
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 14px 12px;
    border-top: 1px solid var(--ui-border);
  }

  &__title {
    margin: 0;
    overflow: hidden;
    font-size: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // 標籤單行，超出時在右側淡出
  &__tags {
    display: flex;
    gap: 4px;
    margin: 0;
    padding: 0;
    overflow: hidden;
    list-style: none;
    mask-image: linear-gradient(to right, #000 85%, transparent);

    li {
      padding: 1px 8px;
      border: 1px solid var(--ui-border);
      border-radius: 999px;
      font-size: 11px;
      white-space: nowrap;
      color: var(--ui-muted);
    }
  }

  &__category {
    border-color: var(--ui-muted) !important;
    color: var(--ui-text) !important;
  }
}
</style>
