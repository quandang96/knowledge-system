<script setup lang="ts">
import { computed, ref } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { createAtlasMarkdown, sanitizeHtml } from './atlas-markdown'
const props = defineProps(nodeViewProps)
const markdown = createAtlasMarkdown()
// Tiptap node views have their own Vue render roots; explicit IDs avoid collisions.
const fieldId = `raw-${crypto.randomUUID()}`
const raw = computed(() => String(props.node.attrs.raw || ''))
const label = computed(() => (/^\s*:{3,}/.test(raw.value) ? 'Khối Atlas' : 'Khối HTML'))
const preview = computed(() => sanitizeHtml(markdown.render(raw.value)))
const editing = ref(false); const source = ref('')
function edit() { source.value = raw.value; editing.value = true }
function apply() { props.updateAttributes({ raw: source.value.replace(/\n+$/, '') }); editing.value = false }
</script>
<template>
  <NodeViewWrapper class="editor-raw-node" :class="{ 'raw-selected': selected }" :contenteditable="false">
    <div class="image-node-actions"><span class="raw-node-label">{{ label }} · giữ nguyên khi lưu</span><v-spacer /><v-btn variant="text" size="small" prepend-icon="mdi-code-tags" @click="edit">Sửa mã</v-btn><v-btn variant="text" size="small" color="error" icon="mdi-delete-outline" :aria-label="`Xóa ${label.toLowerCase()}`" :title="`Xóa ${label.toLowerCase()}`" @click="deleteNode" /></div>
    <!-- eslint-disable-next-line vue/no-v-html -- rendered through createAtlasMarkdown and sanitizeHtml -->
    <div class="prose raw-node-preview" v-html="preview" />
    <v-dialog v-model="editing" max-width="760"><form class="new-doc-form" @submit.prevent="apply"><h2>Sửa mã {{ label.toLowerCase() }}</h2><v-textarea :id="fieldId" v-model="source" class="raw-node-source" label="Markdown / HTML" rows="14" auto-grow spellcheck="false" /><p class="field-help">Mã được lưu nguyên văn. HTML có thể chạy mã (script, sự kiện on…) sẽ bị từ chối khi lưu bản nháp.</p><div class="form-actions"><v-btn variant="text" @click="editing = false">Hủy</v-btn><v-btn type="submit" color="primary">Áp dụng</v-btn></div></form></v-dialog>
  </NodeViewWrapper>
</template>
