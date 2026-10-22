<template>
  <div class="view-skeleton" role="status" aria-live="polite">
    <span class="visually-hidden">Đang tải nội dung…</span>
    <div class="skeleton-bone skeleton-eyebrow" />
    <div class="skeleton-bone skeleton-title" />
    <div class="skeleton-bone skeleton-line" />
    <div class="skeleton-grid">
      <div v-for="item in 3" :key="item" class="skeleton-bone skeleton-card" />
    </div>
  </div>
</template>
