<script setup lang="ts">
import SiteLogo from './components/site-logo.vue'
import { CATEGORIES } from './motions/registry'
import { DEFAULT_COLORS } from './data/motion'
import { useTheme } from './stores/theme'

const { theme, toggle } = useTheme()
const year = new Date().getFullYear()

</script>

<template>
  <div class="app">
    <header class="app-header">
      <div class="app-header__inner">
        <RouterLink to="/" class="app-header__logo" aria-label="Motion Atlas 首頁">
          <SiteLogo variant="horizontal" class="app-header__mark" />
        </RouterLink>

        <nav class="app-header__nav">
          <RouterLink
            v-for="category in CATEGORIES"
            :key="category.id"
            :to="{ path: '/', query: { category: category.id } }"
            :class="{ 'is-active': $route.query.category === category.id }"
          >
            {{ category.name }}
          </RouterLink>
        </nav>

        <button
          type="button"
          class="app-header__theme"
          :aria-label="theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'"
          @click="toggle"
        >
          {{ theme === 'dark' ? '☀' : '☾' }}
        </button>
      </div>
    </header>

    <div class="app__content">
      <!-- 換頁過場由 router/transitions.ts 以 View Transitions 處理 -->
      <RouterView />
    </div>

    <footer class="app-footer">
      <div class="app-footer__inner">
        <RouterLink to="/brand" class="app-footer__brand" aria-label="品牌識別">
          <SiteLogo :animated="false" />
          <ul class="app-footer__palette" aria-label="品牌色票">
            <li v-for="color in DEFAULT_COLORS" :key="color" :style="{ background: color }" :title="color" />
          </ul>
          <span>品牌識別</span>
        </RouterLink>
        <p>© {{ year }} Motion Atlas · 依循動畫十二法則 · Vue 3、Web Animations API、Three.js</p>
      </div>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  &__content {
    flex: 1;
  }
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid var(--ui-border);
  background: color-mix(in srgb, var(--ui-bg) 85%, transparent);
  backdrop-filter: blur(10px);

  &__inner {
    display: flex;
    align-items: center;
    gap: 16px;
    max-width: 1120px;
    height: 56px;
    margin: 0 auto;
    padding: 0 16px;
  }

  &__logo {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    font-weight: 700;
    color: inherit;
    text-decoration: none;
  }

  // 標誌：橫式組合（site-logo.vue）；滑過時符號以彈簧緩動擠壓、回彈
  &__mark {
    font-size: 16px;

    :deep(.site-logo__symbol) {
      transition: transform 0.6s var(--spring);
    }
  }

  &__logo:hover &__mark :deep(.site-logo__symbol) {
    transform: scale(1.12, 0.9) rotate(-8deg);
  }

  &__nav {
    display: flex;
    gap: 4px;
    margin-left: auto;
    overflow-x: auto;

    a {
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 14px;
      white-space: nowrap;
      color: var(--ui-muted);
      text-decoration: none;

      &:hover {
        color: var(--ui-text);
      }

      &.is-active {
        background: var(--ui-surface);
        color: var(--ui-text);
      }
    }
  }

  &__theme {
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    padding: 0;
    border-radius: 50%;
    font-size: 15px;
  }

  // 窄螢幕只保留標誌符號
  @media (max-width: 480px) {
    &__mark :deep(.site-logo__wordmark) {
      display: none;
    }
  }
}

.app-footer {
  margin-top: 48px;
  border-top: 1px solid var(--ui-border);

  &__inner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    max-width: 1120px;
    margin: 0 auto;
    padding: 24px 16px;

    p {
      margin: 0;
      font-size: 13px;
      color: var(--ui-muted);
    }
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: var(--ui-muted);
    text-decoration: none;

    &:hover {
      color: var(--ui-text);
    }
  }

  &__palette {
    display: flex;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      width: 16px;
      height: 16px;
      border: 1px solid var(--ui-border);
      border-radius: 50%;
    }
  }
}
</style>
