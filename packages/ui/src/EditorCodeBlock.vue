<script setup lang="ts">
import { computed, ref } from 'vue'
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import MermaidPreview from './MermaidPreview.vue'
const props = defineProps(nodeViewProps)
const editing = ref(false)
const diagram = computed(() => props.node.attrs.language === 'mermaid')
</script>
<template>
  <NodeViewWrapper class="editor-code-node">
    <div v-if="diagram" class="viewer-toolbar" contenteditable="false"><span>Mermaid · Source Markdown</span><v-spacer /><v-btn size="small" variant="text" :prepend-icon="editing ? 'mdi-eye-outline' : 'mdi-code-braces'" @click="editing = !editing">{{ editing ? 'Xem sơ đồ' : 'Sửa source Mermaid' }}</v-btn></div>
    <div v-if="diagram && !editing" contenteditable="false"><MermaidPreview :source="node.textContent" /></div>
    <pre v-show="!diagram || editing"><NodeViewContent as="code" :class="node.attrs.language ? `language-${node.attrs.language}` : undefined" /></pre>
  </NodeViewWrapper>
</template>
