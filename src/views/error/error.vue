<script setup lang="ts"></script>

<template>
  <main class="error">
    <h1>404</h1>
    <p>找不到此頁面</p>
    <RouterLink to="/">回到首頁</RouterLink>
  </main>
</template>

<style lang="scss" scoped>
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 16px;
  text-align: center;
}
</style>
