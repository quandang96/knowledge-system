<script setup lang="ts">
import { watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import Image from '@tiptap/extension-image'
import { Markdown } from '@tiptap/markdown'
import { editorExtensions } from './markdown-editor'
const props = defineProps<{ modelValue: string; docId: string }>()
const emit = defineEmits<{ 'update:modelValue': [value:string]; upload: [files: File[]] }>()
const extensions = editorExtensions().filter(e => e.name !== 'image')
const draftImage = Image.extend({ renderHTML({ HTMLAttributes }) { const src = String(HTMLAttributes.src || ''); return ['img', { ...HTMLAttributes, src: src.startsWith('./assets/') ? `/api/documents/${props.docId}/draft-assets/${src.split('/').pop()}` : src }] } })
const editor = useEditor({ extensions: [...extensions, draftImage, Markdown], content: props.modelValue, contentType: 'markdown',
  editorProps: { attributes: { 'aria-label': 'Nội dung tài liệu', role: 'textbox', 'aria-multiline': 'true' }, handleDrop(_view,event) { const files = [...(event.dataTransfer?.files || [])].filter(f => f.type.startsWith('image/')); if (!files.length) return false; event.preventDefault(); emit('upload', files); return true } },
  onUpdate({ editor }) { emit('update:modelValue', editor.getMarkdown()) }
})
watch(() => props.modelValue, value => { if (editor.value && editor.value.getMarkdown() !== value) editor.value.commands.setContent(value, { contentType: 'markdown', emitUpdate: false }) })
function link() { const url = window.prompt('URL HTTP/HTTPS hoặc đường dẫn nội bộ', editor.value?.getAttributes('link').href || ''); if (!url) return; if (!/^(https?:\/\/|\/[a-z])/i.test(url)) return; editor.value?.chain().focus().setLink({ href: url }).run() }
function mermaid() { editor.value?.chain().focus().insertContent({ type: 'codeBlock', attrs: { language: 'mermaid' }, content: [{ type: 'text', text: 'flowchart LR\n  A[Bắt đầu] --> B[Kết thúc]' }] }).run() }
</script>
<template>
  <div v-if="editor" class="editor-toolbar"><v-btn variant="text" :color="editor.isActive('bold') ? 'primary' : undefined" icon="mdi-format-bold" aria-label="In đậm" @click="editor.chain().focus().toggleBold().run()" /><v-btn variant="text" icon="mdi-format-italic" aria-label="In nghiêng" @click="editor.chain().focus().toggleItalic().run()" /><v-divider vertical class="mx-2" /><v-btn v-for="level in [1,2,3] as const" :key="level" variant="text" :color="editor.isActive('heading',{level}) ? 'primary' : undefined" @click="editor.chain().focus().toggleHeading({level}).run()">H{{ level }}</v-btn><v-divider vertical class="mx-2" /><v-btn icon="mdi-format-list-bulleted" variant="text" aria-label="Danh sách" @click="editor.chain().focus().toggleBulletList().run()" /><v-btn icon="mdi-format-list-numbered" variant="text" aria-label="Danh sách đánh số" @click="editor.chain().focus().toggleOrderedList().run()" /><v-btn icon="mdi-format-quote-close" variant="text" aria-label="Callout hoặc trích dẫn" @click="editor.chain().focus().toggleBlockquote().run()" /><v-btn icon="mdi-table" variant="text" aria-label="Chèn bảng" @click="editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run()" /><v-btn icon="mdi-code-braces" variant="text" aria-label="Code block" @click="editor.chain().focus().toggleCodeBlock().run()" /><v-btn icon="mdi-link-variant" variant="text" aria-label="Chèn liên kết" @click="link" /><v-btn icon="mdi-vector-polyline" variant="text" aria-label="Chèn Mermaid" @click="mermaid" /><v-spacer /><v-btn icon="mdi-undo" variant="text" aria-label="Hoàn tác" @click="editor.chain().focus().undo().run()" /><v-btn icon="mdi-redo" variant="text" aria-label="Làm lại" @click="editor.chain().focus().redo().run()" /></div>
  <div class="editor-area prose"><EditorContent :editor="editor" /></div>
</template>
