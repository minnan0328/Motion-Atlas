<script setup lang="ts">
import SiteLogo from '../../components/site-logo.vue'
import { BRAND, BRAND_COLORS, BRAND_MOTION, BRAND_TYPE, LOGO_GRID as G, LOGO_MIN_SIZE } from '../../data/brand'

// 品牌識別頁：理念、標誌組合、構成、淨空區與最小尺寸、色彩、字體與動態規範
const units = Array.from({ length: G.size + 1 }, (_, i) => i)
const curve = (value: readonly number[]) => `cubic-bezier(${value.join(', ')})`
// 緩動曲線圖：0 ~ 1 映射到 100 × 100 的繪圖區（y 向上），彈簧曲線會超出上緣
const curvePath = ([x1, y1, x2, y2]: readonly number[]) =>
  `M0 100C${x1! * 100} ${100 - y1! * 100} ${x2! * 100} ${100 - y2! * 100} 100 0`
const easings = [BRAND_MOTION.ease, BRAND_MOTION.spring]
const rules = [
  '不可拉伸、壓扁或改變符號與標準字的比例。',
  '不可更改標誌顏色；淺色背景用正向版，深色背景用反白版。',
  '不可旋轉標誌，或改變軌道的傾斜角度。',
  '不可加上陰影、外框、漸層等額外效果。',
  '淨空區內不可放置文字或其他圖形。',
  '標誌動畫只用於網站介面；印刷與靜態圖片使用靜態版本（小星位於前方）。',
]
</script>

<template>
  <main class="brand">
    <header class="brand__hero reveal">
      <SiteLogo variant="stacked" class="brand__hero-logo" />
      <p class="brand__mission">{{ BRAND.mission }}</p>
    </header>

    <section class="brand__section reveal" style="--i: 1">
      <h2>品牌理念 <small>Mission Identity</small></h2>
      <p>Motion Atlas（{{ BRAND.nameZh }}）以「地圖」整理網頁上的動態：地球儀代表收納與索引知識的圖鑑（Atlas），環繞的小星代表持續運行的動態（Motion）。</p>
      <ul class="brand__keywords">
        <li v-for="item in BRAND.keywords" :key="item.en">
          <strong>{{ item.name }}</strong>
          <span>{{ item.en }}</span>
          <p>{{ item.description }}</p>
        </li>
      </ul>
    </section>

    <section class="brand__section reveal" style="--i: 2">
      <h2>標誌組合 <small>Logo Lockups</small></h2>
      <div class="brand__lockups">
        <figure class="is-light" data-leave="shrink">
          <SiteLogo variant="horizontal" tone="positive" class="brand__lockup" />
          <figcaption>橫式 · 正向版</figcaption>
        </figure>
        <figure class="is-dark" data-leave="shrink">
          <SiteLogo variant="horizontal" tone="reversed" class="brand__lockup" />
          <figcaption>橫式 · 反白版</figcaption>
        </figure>
        <figure class="is-light" data-leave="shrink">
          <SiteLogo variant="stacked" tone="positive" class="brand__lockup" />
          <figcaption>直式 · 正向版</figcaption>
        </figure>
        <figure class="is-dark" data-leave="shrink">
          <SiteLogo variant="stacked" tone="reversed" class="brand__lockup" />
          <figcaption>直式 · 反白版</figcaption>
        </figure>
        <figure class="is-light" data-leave="shrink">
          <SiteLogo tone="positive" class="brand__lockup is-symbol" />
          <figcaption>標誌符號 · 網站圖示、頭像</figcaption>
        </figure>
        <figure class="is-dark" data-leave="shrink">
          <SiteLogo tone="reversed" class="brand__lockup is-symbol" />
          <figcaption>標誌符號 · 反白版</figcaption>
        </figure>
      </div>
    </section>

    <section class="brand__section reveal" style="--i: 3">
      <h2>標誌構成 <small>Construction</small></h2>
      <div class="brand__construction">
        <div class="brand__grid">
          <SiteLogo tone="positive" :animated="false" class="brand__grid-logo" />
          <svg :viewBox="`0 0 ${G.size} ${G.size}`" class="brand__grid-lines" aria-hidden="true">
            <g class="is-grid">
              <line v-for="i in units" :key="`x${i}`" :x1="i" y1="0" :x2="i" :y2="G.size" />
              <line v-for="i in units" :key="`y${i}`" x1="0" :y1="i" :x2="G.size" :y2="i" />
            </g>
            <g class="is-guide">
              <line :x1="G.center" y1="0" :x2="G.center" :y2="G.size" />
              <line x1="0" :y1="G.center" :x2="G.size" :y2="G.center" />
              <circle :cx="G.center" :cy="G.center" :r="G.globe" />
              <ellipse :cx="G.center" :cy="G.center" :rx="G.orbit.rx" :ry="G.orbit.ry" :transform="`rotate(${G.orbit.tilt} ${G.center} ${G.center})`" />
            </g>
          </svg>
        </div>
        <dl class="brand__specs">
          <div><dt>方格</dt><dd>{{ G.size }} × {{ G.size }} 單位，中心 ({{ G.center }}, {{ G.center }})</dd></div>
          <div><dt>地球</dt><dd>半徑 {{ G.globe }}；赤道短半徑 {{ G.equator }}（0.3 倍）</dd></div>
          <div><dt>軌道</dt><dd>{{ G.orbit.rx }} × {{ G.orbit.ry }}（地球的 1.5 倍與 0.5 倍），傾斜 {{ G.orbit.tilt }}°</dd></div>
          <div><dt>小星</dt><dd>前方半徑 {{ G.star.front }}、後方 {{ G.star.back }}；繞到地球後方時被遮住</dd></div>
          <div><dt>線寬</dt><dd>輪廓 {{ G.stroke.rim }}、經線與赤道 {{ G.stroke.line }}、軌道 {{ G.stroke.orbit }}</dd></div>
          <div><dt>標準字</dt><dd>Motion {{ BRAND_TYPE.wordmark.motion }}、Atlas {{ BRAND_TYPE.wordmark.atlas }}，字距 {{ BRAND_TYPE.wordmark.tracking }}；符號高度為字級的 1.75 倍</dd></div>
        </dl>
      </div>
    </section>

    <section class="brand__section reveal" style="--i: 4">
      <h2>淨空區與最小尺寸 <small>Clear Space &amp; Minimum Size</small></h2>
      <div class="brand__space">
        <figure>
          <div class="brand__clear">
            <SiteLogo variant="horizontal" tone="positive" :animated="false" class="brand__lockup" />
          </div>
          <figcaption>標誌四周保留小星直徑（{{ G.clearSpace }} 單位）的淨空區</figcaption>
        </figure>
        <figure class="brand__minimum">
          <div>
            <SiteLogo tone="positive" :animated="false" :style="{ fontSize: `${LOGO_MIN_SIZE.symbol / 1.75}px` }" />
            <SiteLogo variant="horizontal" tone="positive" :animated="false" :style="{ fontSize: `${LOGO_MIN_SIZE.horizontal / 7.85}px` }" />
          </div>
          <figcaption>最小尺寸：符號 {{ LOGO_MIN_SIZE.symbol }}px、橫式 {{ LOGO_MIN_SIZE.horizontal }}px 寬</figcaption>
        </figure>
      </div>
    </section>

    <section class="brand__section reveal" style="--i: 4">
      <h2>品牌色彩 <small>Colors</small></h2>
      <ul class="brand__colors">
        <li v-for="color in BRAND_COLORS" :key="color.id">
          <span class="brand__swatch" :style="{ background: color.hex }" />
          <strong>{{ color.name }} <small>{{ color.en }}</small></strong>
          <code>{{ color.hex.toUpperCase() }}</code>
          <p>{{ color.role }}</p>
        </li>
      </ul>
    </section>

    <section class="brand__section reveal" style="--i: 4">
      <h2>字體 <small>Typography</small></h2>
      <div class="brand__type">
        <p class="brand__type-sample"><b>Motion</b> Atlas</p>
        <p class="brand__type-zh">{{ BRAND.nameZh }}</p>
        <code>{{ BRAND_TYPE.family }}</code>
      </div>
    </section>

    <section class="brand__section reveal" style="--i: 4">
      <h2>動態規範 <small>Motion</small></h2>
      <ul class="brand__motion">
        <li v-for="item in easings" :key="item.name">
          <svg viewBox="-10 -30 120 150" class="brand__curve" aria-hidden="true">
            <rect x="0" y="0" width="100" height="100" class="is-frame" />
            <path :d="curvePath(item.value)" class="is-curve" />
          </svg>
          <div class="brand__track">
            <span :style="{ animationTimingFunction: curve(item.value) }" />
          </div>
          <strong>{{ item.name }}</strong>
          <code>{{ curve(item.value) }}</code>
          <p>{{ item.use }}</p>
        </li>
      </ul>
      <p class="brand__note">標誌節奏：經線往返 {{ BRAND_MOTION.meridian }} 秒、小星環繞 {{ BRAND_MOTION.orbit }} 秒（5 : 6），兩者錯落而不同步，使標誌持續有變化；系統要求減少動態時，標誌停在靜止畫面。</p>
    </section>

    <section class="brand__section reveal" style="--i: 4">
      <h2>使用規範 <small>Usage</small></h2>
      <ul class="brand__rules">
        <li v-for="rule in rules" :key="rule">{{ rule }}</li>
      </ul>
    </section>
  </main>
</template>

<style lang="scss" scoped>
.brand {
  max-width: 1120px;
  margin: 0 auto;
  padding: 48px 16px 16px;

  &__hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 32px 0 48px;
    text-align: center;
  }

  &__hero-logo {
    font-size: clamp(28px, 6vw, 44px);
  }

  &__mission {
    max-width: 36em;
    margin: 0;
    color: var(--ui-muted);
  }

  &__section {
    padding: 32px 0;
    border-top: 1px solid var(--ui-border);

    h2 {
      margin: 0 0 16px;
      font-size: 20px;

      small {
        margin-left: 8px;
        font-size: 13px;
        font-weight: 400;
        color: var(--ui-muted);
      }
    }

    > p {
      max-width: 44em;
      margin: 0 0 16px;
    }
  }

  &__keywords,
  &__colors,
  &__motion,
  &__rules {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__keywords {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;

    li {
      padding: 16px;
      border: 1px solid var(--ui-border);
      border-radius: 12px;
      background: var(--ui-surface);
    }

    strong {
      font-size: 18px;
    }

    span {
      margin-left: 8px;
      font-size: 12px;
      color: var(--ui-muted);
    }

    p {
      margin: 8px 0 0;
      font-size: 14px;
      color: var(--ui-muted);
    }
  }

  // 標誌組合：正向版放在象牙底、反白版放在墨青底
  &__lockups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 12px;

    figure {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      min-height: 180px;
      margin: 0;
      padding: 24px;
      border-radius: 12px;

      &.is-light {
        background: var(--brand-ivory);
        color: var(--brand-graphite);
      }

      &.is-dark {
        background: var(--brand-ink);
        color: var(--brand-clay);
      }
    }

    figcaption {
      font-size: 12px;
    }
  }

  &__lockup {
    font-size: 24px;

    &.is-symbol {
      font-size: 32px;
    }
  }

  &__construction {
    display: grid;
    grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
    gap: 24px;
    align-items: start;

    @media (max-width: 720px) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  // 構成圖：靜態標誌上疊加單位方格與輔助線
  &__grid {
    position: relative;
    width: 100%;
    max-width: 320px;
    aspect-ratio: 1;
    border-radius: 12px;
    background: var(--brand-ivory);
  }

  // 構成圖的標誌符號填滿整個方格
  &__grid-logo {
    position: absolute;
    inset: 0;
    display: block;

    :deep(.site-logo__symbol) {
      width: 100%;
      height: 100%;
    }
  }

  &__grid-lines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;

    .is-grid line {
      stroke: rgba(53, 68, 73, 0.12);
      stroke-width: 0.04;
    }

    .is-guide {
      fill: none;
      stroke: #b71f24;
      stroke-dasharray: 0.4 0.3;
      stroke-width: 0.08;
    }
  }

  &__specs {
    display: grid;
    gap: 8px;
    margin: 0;

    div {
      display: grid;
      grid-template-columns: 5em minmax(0, 1fr);
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      background: var(--ui-surface);
    }

    dt {
      font-size: 13px;
      color: var(--ui-muted);
    }

    dd {
      margin: 0;
      font-size: 14px;
    }
  }

  &__space {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 12px;

    figure {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      margin: 0;
      padding: 24px;
      border-radius: 12px;
      background: var(--brand-ivory);
      color: var(--brand-graphite);
    }

    figcaption {
      font-size: 12px;
      text-align: center;
    }
  }

  // 淨空區：以虛線框標示，框與標誌之間的距離為小星直徑（符號高 1.75em 的 4/32）
  &__clear {
    padding: calc(1.75em * 4 / 32);
    outline: 1px dashed #b71f24;
    font-size: 24px;

    .brand__lockup {
      font-size: inherit;
    }
  }

  &__minimum div {
    display: flex;
    align-items: center;
    gap: 24px;
    min-height: 60px;
  }

  &__colors {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 12px;

    li {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      border: 1px solid var(--ui-border);
      border-radius: 12px;
      background: var(--ui-surface);
    }

    small {
      margin-left: 4px;
      font-weight: 400;
      color: var(--ui-muted);
    }

    code {
      font-size: 12px;
      color: var(--ui-muted);
    }

    p {
      margin: 4px 0 0;
      font-size: 13px;
    }
  }

  &__swatch {
    height: 64px;
    margin-bottom: 8px;
    border: 1px solid var(--ui-border);
    border-radius: 8px;
  }

  &__type {
    padding: 24px;
    border: 1px solid var(--ui-border);
    border-radius: 12px;
    background: var(--ui-surface);

    code {
      font-size: 12px;
      color: var(--ui-muted);
      word-break: break-word;
    }
  }

  &__type-sample {
    margin: 0;
    font-size: clamp(32px, 7vw, 56px);
    font-weight: 400;
    letter-spacing: -0.01em;
    line-height: 1.1;
  }

  &__type-zh {
    margin: 8px 0 16px;
    font-size: 18px;
    letter-spacing: 0.4em;
    color: var(--ui-muted);
  }

  &__motion {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;

    li {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 16px;
      border: 1px solid var(--ui-border);
      border-radius: 12px;
      background: var(--ui-surface);
    }

    code {
      font-size: 12px;
      color: var(--ui-muted);
    }

    p {
      margin: 0;
      font-size: 13px;
      color: var(--ui-muted);
    }
  }

  &__curve {
    width: 120px;
    overflow: visible;

    .is-frame {
      fill: none;
      stroke: var(--ui-border);
      stroke-width: 1;
    }

    .is-curve {
      fill: none;
      stroke: var(--ui-accent);
      stroke-width: 3;
      stroke-linecap: round;
    }
  }

  // 以實際的緩動曲線來回移動的圓點
  &__track {
    position: relative;
    height: 16px;
    margin: 4px 0;
    border-radius: 999px;
    background: var(--ui-bg);

    span {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--ui-accent);
      animation: brand-track 1.6s infinite alternate;
    }
  }

  &__note {
    margin-top: 12px !important;
    font-size: 13px;
    color: var(--ui-muted);
  }

  &__rules {
    display: grid;
    gap: 8px;

    li {
      padding: 10px 14px 10px 36px;
      border-radius: 8px;
      background: var(--ui-surface);
      position: relative;
      font-size: 14px;

      &::before {
        content: '✕';
        position: absolute;
        left: 14px;
        color: #b71f24;
      }

      &:last-child::before {
        content: '✓';
        color: var(--ui-muted);
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &__track span {
      animation: none;
    }
  }
}

@keyframes brand-track {
  from {
    left: 2px;
  }

  // 終點留出彈簧回彈超出的空間
  to {
    left: calc(78% - 12px);
  }
}
</style>
