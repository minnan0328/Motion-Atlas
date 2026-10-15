<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// 疊在場景左上角的時間與季節標籤（CSS 輔助）
const props = defineProps<{
  read: () => { hour: number; season: { name: string; en: string } }
}>()

const time = ref('06:00')
const season = ref('')
const isNight = ref(false)

let frame = 0
function tick() {
  frame = requestAnimationFrame(tick)
  const { hour, season: current } = props.read()
  const hours = Math.floor(hour)
  // 以 10 分鐘為單位顯示，避免數字跳動太快
  const minutes = Math.floor(((hour % 1) * 60) / 10) * 10
  time.value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  season.value = `${current.name} ${current.en}`
  isNight.value = hour < 6 || hour >= 18.5
}

onMounted(() => {
  frame = requestAnimationFrame(tick)
})
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <div class="scene-clock" :class="{ 'is-night': isNight }">
    <span class="scene-clock__icon">{{ isNight ? '☾' : '☀' }}</span>
    <span class="scene-clock__time">{{ time }}</span>
    <span class="scene-clock__season">{{ season }}</span>
  </div>
</template>

<style lang="scss" scoped>
.scene-clock {
  position: absolute;
  top: 6px;
  left: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--c4) 80%, transparent);
  color: var(--c3);
  font-family: 'Helvetica Neue', Arial, 'PingFang TC', sans-serif;
  font-size: 6px;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
  transition:
    background-color 0.6s,
    color 0.6s;

  &.is-night {
    background: color-mix(in srgb, var(--c3) 80%, transparent);
    color: var(--c4);
  }

  &__time {
    font-variant-numeric: tabular-nums;
  }

  &__season {
    opacity: 0.75;
  }
}
</style>
