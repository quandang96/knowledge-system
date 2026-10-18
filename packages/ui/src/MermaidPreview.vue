<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { mermaidRenderer } from './mermaid-theme'
import ZoomViewport from './ZoomViewport.vue'
const props = withDefaults(defineProps<{ source: string; title?: string }>(), { title: 'Sơ đồ nghiệp vụ' })
const svg = ref(''); const error = ref(''); const loading = ref(true); const copied = ref(false)
let generation = 0; let copyTimer: ReturnType<typeof setTimeout> | undefined
async function renderDiagram() {
  const current = ++generation; loading.value = true; error.value = ''; svg.value = ''
  try {
    if (props.source.length > 50000) throw new Error('Sơ đồ vượt quá 50.000 ký tự. Tách sơ đồ thành các luồng nhỏ hơn.')
    const mermaid = await mermaidRenderer()
    if (current !== generation) return
    const rendered = await mermaid.render(`atlas-mermaid-${crypto.randomUUID()}`, props.source)
    if (current === generation) svg.value = rendered.svg
  } catch (failure) { if (current === generation) error.value = (failure instanceof Error ? failure.message : 'Không thể vẽ sơ đồ.').slice(0,2000) }
  finally { if (current === generation) loading.value = false }
}
async function copy() { try { await navigator.clipboard.writeText(props.source); copied.value = true; clearTimeout(copyTimer); copyTimer = setTimeout(() => { copied.value = false }, 2000) } catch { error.value = 'Không thể sao chép tự động. Mở Source bên dưới để sao chép.' } }
onMounted(renderDiagram); watch(() => props.source, renderDiagram)
onBeforeUnmount(() => { ++generation; clearTimeout(copyTimer) })
</script>
<template>
  <section class="mermaid-preview" :aria-label="title" :aria-busy="loading">
    <div v-if="loading" class="diagram-loading" role="status"><v-skeleton-loader type="image" /><span>Đang vẽ sơ đồ…</span></div>
    <v-alert v-if="error" type="warning" variant="tonal"><strong>Không thể hiển thị sơ đồ.</strong><p class="mermaid-error">{{ error }}</p><v-btn variant="text" @click="renderDiagram">Thử vẽ lại</v-btn></v-alert>
    <ZoomViewport v-if="svg" :title="title"><template #actions><v-btn :icon="copied ? 'mdi-check' : 'mdi-content-copy'" variant="text" :aria-label="copied ? 'Đã sao chép source' : 'Sao chép source'" :title="copied ? 'Đã sao chép' : 'Sao chép source'" @click="copy" /></template><!-- SVG comes only from Mermaid's strict renderer and its sanitizer. -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="mermaid-svg" role="img" :aria-label="title" v-html="svg"></div>
    </ZoomViewport>
    <details class="diagram-source" :open="!!error"><summary>Source Mermaid · Được giữ nguyên</summary><pre>{{ source }}</pre></details>
  </section>
</template>
