<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
const props = defineProps<{ source: string }>()
const host = ref<HTMLElement>(); const error = ref('')
let generation = 0
async function render() {
  if (!host.value) return
  const current = ++generation; error.value = ''
  host.value.replaceChildren()
  try {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', suppressErrorRendering: true, flowchart: { htmlLabels: false }, maxTextSize: 50000 })
    const { svg } = await mermaid.render(`atlas-mermaid-${Math.random().toString(36).slice(2)}`, props.source)
    if (current === generation && host.value) { const template = document.createElement('template'); template.innerHTML = svg; host.value.replaceChildren(template.content) }
  } catch { error.value = 'Không thể render Mermaid. Source được giữ nguyên; kiểm tra cú pháp.' }
}
onMounted(render); watch(() => props.source, render)
</script>
<template><div class="mermaid-preview"><v-alert v-if="error" type="warning" variant="tonal">{{ error }}</v-alert><div ref="host" /></div></template>
