<script setup lang="ts">
import { createVNode, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, render, watch } from 'vue'
import MediaImage from './MediaImage.vue'
import MermaidPreview from './MermaidPreview.vue'
const props = defineProps<{ html: string; imageLayout?: Record<string,{align:'left'|'center'|'right';width:number}> }>()
const host = ref<HTMLElement>(); const context = getCurrentInstance()!.appContext
let mounts: HTMLElement[] = []; let generation = 0
function clear() { for (const target of mounts) render(null, target); mounts = [] }
async function enhance() {
  const current = ++generation; clear(); await nextTick()
  if (current !== generation || !host.value) return
  // Rebuild only from the same HTML-disabled Markdown renderer, including layout-only updates.
  host.value.innerHTML = props.html
  for (const image of host.value.querySelectorAll('img')) {
    const target = document.createElement('div'); target.className = 'atlas-wide-block'
    const layout = props.imageLayout?.[image.getAttribute('data-asset-path') || '']
    if(layout) { target.style.width = `${layout.width}%`; target.style.marginInlineStart = layout.align === 'left' ? '0' : 'auto'; target.style.marginInlineEnd = layout.align === 'right' ? '0' : 'auto' }
    const node = createVNode(MediaImage, { src: image.getAttribute('src') || '', alt: image.getAttribute('alt') || '', caption: image.getAttribute('title') || '', zoomable: true }); node.appContext = context
    const parent = image.parentElement
    if (parent?.tagName === 'P' && parent.textContent?.trim() === '' && parent.children.length === 1) parent.replaceWith(target)
    else image.replaceWith(target)
    render(node, target); mounts.push(target)
  }
  for (const target of host.value.querySelectorAll<HTMLElement>('[data-atlas-mermaid]')) {
    const node = createVNode(MermaidPreview, { source: decodeURIComponent(target.dataset.atlasMermaid || '') }); node.appContext = context
    render(node,target); mounts.push(target)
  }
}
watch(() => [props.html,props.imageLayout], enhance, { flush: 'pre', deep:true }); onMounted(enhance)
onBeforeUnmount(() => { ++generation; clear() })
</script>
<template><!-- HTML originates only from markdown-it with HTML disabled. -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div ref="host" v-html="html"></div>
</template>
