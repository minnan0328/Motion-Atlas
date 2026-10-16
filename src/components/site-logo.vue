<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import { BRAND, BRAND_MOTION, LOGO_GRID as G } from '../data/brand'

/**
 * Motion Atlas 標誌（品牌識別見 src/data/brand.ts 與 /brand）。
 * 標誌符號：地球儀（Atlas）的兩條經線持續自轉，一顆小星沿傾斜軌道環繞（Motion）。
 * 經線以品牌緩動往返（正投影下的自轉，Slow In and Slow Out）；小星在軌道兩端減速，
 * 前方較大、繞到後方時被地球遮住（Solid Drawing）。
 *
 * variant：symbol 只有符號、horizontal 橫式組合、stacked 直式組合（含中文名稱）
 * tone：auto 隨主題、positive 正向版（淺底）、reversed 反白版（深底）
 */
const props = withDefaults(
  defineProps<{
    variant?: 'symbol' | 'horizontal' | 'stacked'
    tone?: 'auto' | 'positive' | 'reversed'
    animated?: boolean
  }>(),
  { variant: 'symbol', tone: 'auto', animated: true },
)

const id = useId()
const svg = ref<SVGSVGElement>()
const { center: c, globe, orbit, star, stroke } = G
// 軌道：由左端出發，先經過前方（下半）再繞到後方（上半）
const orbitPath = `M${c - orbit.rx} ${c}a${orbit.rx} ${orbit.ry} 0 1 0 ${orbit.rx * 2} 0a${orbit.rx} ${orbit.ry} 0 1 0 ${-orbit.rx * 2} 0`
const tilt = `rotate(${orbit.tilt} ${c} ${c})`
const spline = BRAND_MOTION.ease.value.join(' ')
const motion = computed(() => (props.animated ? 'is-animated' : ''))

// 系統要求減少動態、或指定靜態時，停在小星位於前方的畫面（SMIL 動畫無法以 CSS 暫停）
onMounted(() => {
  if (!props.animated || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    svg.value?.pauseAnimations()
    svg.value?.setCurrentTime(BRAND_MOTION.orbit * 0.22)
  }
})
</script>

<template>
  <span class="site-logo" :class="[`is-${variant}`, `is-${tone}`, motion]" :style="{ '--meridian': `${BRAND_MOTION.meridian}s` }">
    <svg ref="svg" class="site-logo__symbol" :viewBox="`0 0 ${G.size} ${G.size}`" aria-hidden="true">
      <defs>
        <path :id="`${id}-orbit`" :d="orbitPath" />
        <!-- 軌道座標中的前半部（下半） -->
        <clipPath :id="`${id}-front`">
          <rect x="0" :y="c" :width="G.size" :height="c" />
        </clipPath>
      </defs>

      <!-- 後方：完整軌道與後方的小星，與地球重疊的部分被地球遮住 -->
      <g :transform="tilt">
        <use :href="`#${id}-orbit`" class="site-logo__orbit" :stroke-width="stroke.orbit" />
        <circle :r="star.back" class="site-logo__star">
          <animateMotion :dur="`${BRAND_MOTION.orbit}s`" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keyPoints="0;0.5;1" :keySplines="`${spline};${spline}`">
            <mpath :href="`#${id}-orbit`" />
          </animateMotion>
        </circle>
      </g>

      <!-- 地球：底色、赤道與兩條自轉的經線 -->
      <circle :cx="c" :cy="c" :r="globe" class="site-logo__globe" />
      <ellipse :cx="c" :cy="c" :rx="globe" :ry="G.equator" class="site-logo__line" :stroke-width="stroke.line" />
      <ellipse :cx="c" :cy="c" :rx="globe" :ry="globe" class="site-logo__line site-logo__meridian" :stroke-width="stroke.line" />
      <ellipse :cx="c" :cy="c" :rx="globe" :ry="globe" class="site-logo__line site-logo__meridian is-late" :stroke-width="stroke.line" />
      <circle :cx="c" :cy="c" :r="globe" class="site-logo__rim" :stroke-width="stroke.rim" />

      <!-- 前方：軌道前半與前方的小星（較大），疊在地球之上 -->
      <g :transform="tilt" :clip-path="`url(#${id}-front)`">
        <use :href="`#${id}-orbit`" class="site-logo__orbit is-front" :stroke-width="stroke.orbit" />
        <circle :r="star.front" class="site-logo__star">
          <animateMotion :dur="`${BRAND_MOTION.orbit}s`" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keyPoints="0;0.5;1" :keySplines="`${spline};${spline}`">
            <mpath :href="`#${id}-orbit`" />
          </animateMotion>
        </circle>
      </g>
    </svg>

    <!-- 標準字：Motion（粗）與 Atlas（細）的字重對比 -->
    <span v-if="variant !== 'symbol'" class="site-logo__wordmark">
      <span class="site-logo__name"><b>Motion</b> Atlas</span>
      <span v-if="variant === 'stacked'" class="site-logo__zh">{{ BRAND.nameZh }}</span>
    </span>
  </span>
</template>

<style lang="scss" scoped>
.site-logo {
  display: inline-flex;
  align-items: center;
  gap: 0.36em;
  color: var(--logo-rim);
  line-height: 1;

  // 正向版與反白版：不受目前主題影響，用於品牌頁與固定底色的場合
  &.is-positive {
    --logo-rim: var(--brand-ink);
    --logo-fill: var(--brand-ivory);
    --logo-line: var(--brand-graphite);
    --logo-orbit: var(--brand-clay);
    --logo-star: var(--brand-ink);
  }

  &.is-reversed {
    --logo-rim: var(--brand-ivory);
    --logo-fill: #263033;
    --logo-line: var(--brand-clay);
    --logo-orbit: var(--brand-clay);
    --logo-star: var(--brand-sandstone);
  }

  // 直式：符號在上、標準字與中文名稱置中
  &.is-stacked {
    flex-direction: column;
    gap: 0.5em;
    text-align: center;
  }

  &__symbol {
    display: block;
    flex-shrink: 0;
    width: 1.75em;
    height: 1.75em;
    overflow: visible;
  }

  &.is-stacked &__symbol {
    width: 3.2em;
    height: 3.2em;
  }

  &__wordmark {
    display: flex;
    flex-direction: column;
    gap: 0.35em;
  }

  &__name {
    font-weight: 400;
    letter-spacing: -0.01em;
    white-space: nowrap;

    b {
      font-weight: 700;
    }
  }

  &__zh {
    font-size: 0.5em;
    font-weight: 500;
    letter-spacing: 0.4em;
    // 字距加在右側，置中時往左補回
    margin-right: -0.4em;
    color: var(--logo-line);
  }

  &__globe {
    fill: var(--logo-fill);
  }

  &__rim {
    fill: none;
    stroke: var(--logo-rim);
  }

  &__line {
    fill: none;
    stroke: var(--logo-line);
  }

  &__orbit {
    fill: none;
    stroke: var(--logo-orbit);
    opacity: 0.55;

    &.is-front {
      opacity: 1;
    }
  }

  &__star {
    fill: var(--logo-star);
  }

  // 經線：寬度在 1 與 -1 之間以品牌緩動往返，兩條相差四分之一圈；靜態時停在固定角度
  &__meridian {
    transform-box: fill-box;
    transform-origin: center;
    transform: scaleX(0.45);

    &.is-late {
      transform: scaleX(-0.45);
    }
  }

  &.is-animated &__meridian {
    animation: site-logo-meridian var(--meridian) var(--brand-ease) infinite alternate;

    &.is-late {
      animation-delay: calc(var(--meridian) / -2);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &.is-animated &__meridian {
      animation: none;
    }
  }
}

@keyframes site-logo-meridian {
  from {
    transform: scaleX(1);
  }

  to {
    transform: scaleX(-1);
  }
}
</style>
