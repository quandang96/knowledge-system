<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ZoomViewport from './ZoomViewport.vue'
const props = defineProps<{ src: string; alt?: string; caption?: string; zoomable?: boolean }>()
const loading = ref(true); const failed = ref(false); const attempt = ref(0); const open = ref(false)
const resolvedSrc = computed(() => attempt.value ? `${props.src}${props.src.includes('?') ? '&' : '?'}atlas_retry=${attempt.value}` : props.src)
watch(() => props.src, () => { loading.value = true; failed.value = false; attempt.value++ })
function retry() { failed.value = false; loading.value = true; attempt.value++ }
</script>
<template>
  <figure class="media-image" :aria-busy="loading">
    <div v-if="loading" class="media-skeleton" role="status"><v-skeleton-loader type="image" /><span>Đang tải ảnh…</span></div>
    <v-alert v-if="failed" type="warning" variant="tonal" class="media-error">Không tải được ảnh {{ alt || '' }}. Kiểm tra quyền truy cập hoặc báo người biên tập.<v-btn variant="text" @click="retry">Thử lại ảnh</v-btn></v-alert>
    <img v-else :key="`${src}:${attempt}`" :src="resolvedSrc" :alt="alt || 'Ảnh minh họa nghiệp vụ'" :title="zoomable ? 'Nhấn để xem ảnh lớn' : caption" :class="{ 'media-loading': loading, 'media-zoomable': zoomable }" :tabindex="zoomable ? 0 : undefined" :role="zoomable ? 'button' : undefined" @load="loading = false" @error="loading = false; failed = true" @click="zoomable && (open = true)" @keydown.enter="zoomable && (open = true)" @keydown.space.prevent="zoomable && (open = true)" />
    <figcaption v-if="caption">{{ caption }}</figcaption>
    <v-dialog v-model="open" max-width="1400"><section class="image-lightbox"><header class="viewer-toolbar"><strong>{{ alt || 'Ảnh minh họa' }}</strong><v-spacer /><v-btn icon="mdi-close" variant="text" aria-label="Đóng ảnh" @click="open = false" /></header><ZoomViewport :title="alt || 'Ảnh minh họa'"><img :src="resolvedSrc" :alt="alt || ''" draggable="false" /></ZoomViewport><p v-if="caption" class="media-caption">{{ caption }}</p></section></v-dialog>
  </figure>
</template>
