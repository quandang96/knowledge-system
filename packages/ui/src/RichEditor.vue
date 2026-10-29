<script setup lang="ts">
import { ref, watch } from 'vue'
import { Extension, Node as TiptapNode } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { EditorContent, useEditor, VueNodeViewRenderer } from '@tiptap/vue-3'
import { Markdown } from '@tiptap/markdown'
import type { ReferenceCandidate } from '../../schemas/src/index'
import { documentLink } from '../../schemas/src/document-links'
import { assetUrl } from './state'
import { editorExtensions, MarkdownImage } from './markdown-editor'
import type { UploadedImage } from './media'
import DocumentReferencePicker from './DocumentReferencePicker.vue'
import EditorImage from './EditorImage.vue'
import EditorCodeBlock from './EditorCodeBlock.vue'
import EditorRawBlock from './EditorRawBlock.vue'
import { confirmDialog } from './dialog'
import { findMention, mentionTrigger, useMention } from './mention'
import MentionMenu from './MentionMenu.vue'
type ImageLayout = Record<string,{align:'left'|'center'|'right';width:number}>
const props = defineProps<{ modelValue: string; docId: string; projectId: string; assets: { path: string; preview_url: string }[]; uploading: boolean; uploadImages: (files: File[]) => Promise<UploadedImage[]>; imageLayout: ImageLayout }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; 'update:imageLayout': [value: ImageLayout] }>()
const referencesOpen = ref(false); let referenceRange = { from: 0, to: 0 }
const imageInput = ref<HTMLInputElement>(); const libraryOpen = ref(false); const imagePosition = ref<number>(); const replacing = ref(false)
const uploadError = ref(''); const localBusy = ref(false); const retryReplace = ref(false); let retryFiles: File[] = []; let retryPosition = 0
const mention = useMention(() => ({ sourceId: props.docId, projectId: props.projectId }))
const placeholderKey = new PluginKey<DecorationSet>('atlas-upload-placeholder')
const placeholder = Extension.create({ name: 'uploadPlaceholder', addProseMirrorPlugins() { return [new Plugin({ key: placeholderKey, state: {
  init: () => DecorationSet.empty,
  apply(transaction, previous) {
    let next = previous.map(transaction.mapping, transaction.doc)
    const action = transaction.getMeta(placeholderKey)
    if (action?.add !== undefined) next = next.add(transaction.doc, [Decoration.widget(action.add, () => { const element = document.createElement('span'); element.className = 'image-upload-placeholder'; element.contentEditable = 'false'; element.setAttribute('role', 'status'); element.textContent = 'Đang tải ảnh… Bạn có thể tiếp tục soạn thảo.'; return element }, { id: 'upload', side: 1, ignoreSelection: true, stopEvent: () => true })])
    if (action?.remove) next = next.remove(next.find())
    return next
  }
}, props: { decorations: state => placeholderKey.getState(state) } })] } })
const draftImage = MarkdownImage.extend({
  addStorage() { return { docId: props.docId, imageLayout: () => props.imageLayout, setLayout: (src: string, layout: ImageLayout[string]) => emit('update:imageLayout', {...props.imageLayout,[src]:layout}) } },
  renderHTML({ HTMLAttributes }) { return ['img', { ...HTMLAttributes, src: assetUrl({ metadata: { doc_id: props.docId } } as Parameters<typeof assetUrl>[0], String(HTMLAttributes.src || ''), true) }] },
  addNodeView() { return VueNodeViewRenderer(EditorImage) }
})
const richExtensions = editorExtensions().filter(extension => extension.name !== 'image').map(extension => extension.name === 'starterKit' ? (extension as Extension).extend({ addExtensions() { return (this.parent?.() || []).map(child => child.name === 'codeBlock' ? (child as TiptapNode).extend({ addNodeView() { return VueNodeViewRenderer(EditorCodeBlock) } }) : child) } }) : extension)
  .map(extension => extension.name === 'atlasRawBlock' ? (extension as TiptapNode).extend({ addNodeView() { return VueNodeViewRenderer(EditorRawBlock) } }) : extension)
const editor = useEditor({ extensions: [...richExtensions, draftImage, Markdown, placeholder], content: props.modelValue, contentType: 'markdown',
  editorProps: {
    attributes: { 'aria-label': 'Nội dung tài liệu', role: 'textbox', 'aria-multiline': 'true' },
    handleKeyDown(_view, event) { const result = mention.key(event); if (result && result !== 'handled') insertMention(result); return !!result },
    handleDrop(view, event, _slice, moved) { if (moved) return false; const files = [...(event.dataTransfer?.files || [])].filter(file => file.type.startsWith('image/')); if (!files.length) return false; event.preventDefault(); void insertUpload(files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos); return true },
    handlePaste(_view, event) { const files = [...(event.clipboardData?.files || [])].filter(file => file.type.startsWith('image/')); if (!files.length) return false; event.preventDefault(); void insertUpload(files); return true }
  },
  onTransaction({ transaction }) { if (retryFiles.length) retryPosition = transaction.mapping.map(retryPosition); trackMention() },
  onBlur() { mention.close() },
  onUpdate({ editor }) { emit('update:modelValue', editor.getMarkdown()) }
})
watch(() => props.modelValue, value => { if (editor.value && !editor.value.view.composing && editor.value.getMarkdown() !== value) editor.value.commands.setContent(value, { contentType: 'markdown', emitUpdate: false }) })
// Inline @ suggestions: follow the caret inside ordinary text (not code blocks or non-empty selections).
function trackMention() {
  const view = editor.value?.view
  if (!view) return
  const { selection } = view.state
  const { $from } = selection
  const match = selection.empty && view.hasFocus() && $from.parent.type.name !== 'codeBlock' ? findMention($from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')) : null
  mention.update(match && { query: match.query, at: $from.start() + match.start, caret: $from.pos }, () => { const box = view.coordsAtPos($from.pos); return { left: box.left, top: box.bottom } })
}
function insertMention(item: ReferenceCandidate) {
  const { from, to } = mention.state
  mention.close()
  editor.value?.chain().focus().insertContentAt({ from, to }, [{ type: 'text', text: item.metadata.title, marks: [{ type: 'link', attrs: { href: documentLink(item.metadata.doc_id) } }] }, { type: 'text', text: ' ' }]).run()
}
function startMention() {
  const current = editor.value
  if (!current) return
  const { from, $from } = current.state.selection
  current.chain().focus().insertContent(mentionTrigger($from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset))).run()
  if (from === current.state.selection.from) trackMention()
}
function openFullSearch() { referenceRange = { from: mention.state.from, to: mention.state.to }; mention.close(); referencesOpen.value = true }
function insertReferences(items: ReferenceCandidate[]) { editor.value?.chain().focus().insertContentAt(referenceRange, items.flatMap(item => [{ type: 'text', text: item.metadata.title, marks: [{ type: 'link', attrs: { href: documentLink(item.metadata.doc_id) } }] }, { type: 'text', text: ' ' }])).run() }
// A failed insert asks whether to retry at the same place instead of leaving a banner in the editor.
async function offerRetry(message: string) {
  const retry = await confirmDialog({ title: 'Không chèn được ảnh', message, tone: 'error', confirmText: 'Thử tải lại', cancelText: 'Bỏ qua' })
  uploadError.value = ''
  if (retry) void insertUpload(retryFiles, retryPosition, retryReplace.value)
  else retryFiles = []
}
async function insertUpload(files: File[], position = editor.value?.state.selection.from, replace = false) {
  if (!editor.value || position === undefined || localBusy.value || props.uploading) return
  localBusy.value = true; uploadError.value = ''; retryFiles = []
  editor.value.view.dispatch(editor.value.state.tr.setMeta(placeholderKey, { add: position }))
  try {
    const images = await props.uploadImages(files)
    const current = editor.value
    if (!current || current.isDestroyed) return
    const at = placeholderKey.getState(current.state)?.find()[0]?.from
    current.view.dispatch(current.state.tr.setMeta(placeholderKey, { remove: true }))
    if (at === undefined) return
    const existing = current.state.doc.nodeAt(at)
    // insertContentAt selects an inserted image by default. Restore the current
    // text caret through the transaction instead, so the next keystroke cannot
    // replace the image and typing during a slow upload keeps its own selection.
    const bookmark=current.state.selection.getBookmark()
    current.chain().insertContentAt({ from: at, to: replace && existing?.type.name === 'image' ? at + existing.nodeSize : at }, images.map((image,index) => ({ type: 'image', attrs: { src: image.relative_path, alt: files[index]?.name.replace(/\.[^.]+$/, '') || 'Ảnh minh họa', title: '' } }))).command(({tr})=>{tr.setSelection(bookmark.map(tr.mapping).resolve(tr.doc));return true}).run()
  } catch (error) {
    const current = editor.value
    retryPosition = current ? placeholderKey.getState(current.state)?.find()[0]?.from ?? position : position
    current?.view.dispatch(current.state.tr.setMeta(placeholderKey, { remove: true }))
    retryFiles = files; retryReplace.value = replace; uploadError.value = error instanceof Error ? error.message : 'Không thể chèn ảnh.'
    void offerRetry(uploadError.value)
  } finally { localBusy.value = false }
}
function pickImage(event?: Event) { imagePosition.value = (event as CustomEvent | undefined)?.detail?.position ?? editor.value?.state.selection.from; replacing.value = (event as CustomEvent | undefined)?.detail?.position !== undefined; imageInput.value?.click() }
function fromLibrary(path: string) { if (!editor.value) return;const bookmark=editor.value.state.selection.getBookmark();editor.value.chain().focus().insertContentAt(imagePosition.value ?? editor.value.state.selection.from, { type: 'image', attrs: { src: path, alt: 'Ảnh minh họa', title: '' } }).command(({tr})=>{tr.setSelection(bookmark.map(tr.mapping).resolve(tr.doc));return true}).run(); libraryOpen.value = false }
function link() { const url = window.prompt('URL HTTP/HTTPS hoặc đường dẫn nội bộ', editor.value?.getAttributes('link').href || ''); if (!url || !/^(https?:\/\/|\/[a-z])/i.test(url)) return; editor.value?.chain().focus().setLink({ href: url }).run() }
function mermaid() { editor.value?.chain().focus().insertContent({ type: 'codeBlock', attrs: { language: 'mermaid' }, content: [{ type: 'text', text: 'flowchart LR\n  A[Bắt đầu] --> B[Kết thúc]' }] }).run() }
</script>
<template>
  <div class="atlas-editor" @atlas-image-replace="pickImage">
    <input ref="imageInput" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden aria-label="Chọn ảnh chèn vào nội dung" @change="event => { insertUpload([...(event.target as HTMLInputElement).files || []],imagePosition,replacing); (event.target as HTMLInputElement).value = '' }" />
    <div v-if="editor" class="editor-toolbar" role="toolbar" aria-label="Định dạng nội dung">
      <v-btn variant="text" :color="editor.isActive('bold') ? 'primary' : undefined" icon="mdi-format-bold" aria-label="In đậm" title="In đậm" @click="editor.chain().focus().toggleBold().run()" /><v-btn variant="text" icon="mdi-format-italic" aria-label="In nghiêng" title="In nghiêng" @click="editor.chain().focus().toggleItalic().run()" /><v-divider vertical class="mx-2" />
      <v-btn v-for="level in [1,2,3] as const" :key="level" variant="text" :color="editor.isActive('heading',{level}) ? 'primary' : undefined" :aria-label="`Tiêu đề cấp ${level}`" @click="editor.chain().focus().toggleHeading({level}).run()">H{{ level }}</v-btn><v-divider vertical class="mx-2" />
      <v-btn icon="mdi-format-list-bulleted" variant="text" aria-label="Danh sách" title="Danh sách" @click="editor.chain().focus().toggleBulletList().run()" /><v-btn icon="mdi-format-list-numbered" variant="text" aria-label="Danh sách đánh số" title="Danh sách đánh số" @click="editor.chain().focus().toggleOrderedList().run()" /><v-btn icon="mdi-format-quote-close" variant="text" aria-label="Callout hoặc trích dẫn" title="Trích dẫn" @click="editor.chain().focus().toggleBlockquote().run()" /><v-btn icon="mdi-table" variant="text" aria-label="Chèn bảng" title="Chèn bảng" @click="editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run()" /><v-btn icon="mdi-code-braces" variant="text" aria-label="Code block" title="Code block" @click="editor.chain().focus().toggleCodeBlock().run()" /><v-btn icon="mdi-link-variant" variant="text" aria-label="Chèn liên kết" title="Chèn liên kết" @click="link" /><v-btn icon="mdi-vector-polyline" variant="text" aria-label="Chèn Mermaid" title="Chèn Mermaid" @click="mermaid" />
      <v-btn icon="mdi-image-plus-outline" variant="text" aria-label="Chèn ảnh" title="Chèn ảnh / kéo thả / dán ảnh" :disabled="uploading || localBusy" @click="pickImage()" /><v-btn icon="mdi-image-multiple-outline" variant="text" aria-label="Thư viện ảnh tài liệu" title="Thư viện ảnh tài liệu" @click="imagePosition = editor.state.selection.from; libraryOpen = true" /><v-spacer /><v-btn icon="mdi-undo" variant="text" aria-label="Hoàn tác" title="Hoàn tác" @click="editor.chain().focus().undo().run()" /><v-btn icon="mdi-redo" variant="text" aria-label="Làm lại" title="Làm lại" @click="editor.chain().focus().redo().run()" />
    </div>
    <div class="editor-reference-action"><v-btn variant="text" color="primary" prepend-icon="mdi-at" @click="startMention">Liên kết trong nội dung</v-btn><span class="field-help">Gõ @ ở bất kỳ đâu trong nội dung để hiện gợi ý tài liệu</span></div>
    
    <div class="editor-area"><EditorContent :editor="editor" /></div>
    <MentionMenu :state="mention.state" @select="index => insertMention(mention.state.items[index])" @hover="index => (mention.state.active = index)" @more="openFullSearch" />
    <DocumentReferencePicker v-model="referencesOpen" :source-id="docId" :project-id="projectId" title="Chèn liên kết trong nội dung" @select="insertReferences" />
    <v-dialog v-model="libraryOpen" max-width="720"><section class="new-doc-form"><h2>Thư viện ảnh tài liệu</h2><p class="field-help">Chọn ảnh đã tải lên tài liệu này để chèn tại con trỏ.</p><div class="image-library"><button v-for="image in assets" :key="image.path" type="button" @click="fromLibrary(image.path)"><img :src="image.preview_url" alt="Ảnh đã tải lên" /><span>{{ image.path.split('/').pop() }}</span></button></div><p v-if="!assets.length" class="field-help mt-4">Chưa có ảnh. Dùng nút Chèn ảnh để tải lên.</p><div class="form-actions"><v-btn variant="text" @click="libraryOpen = false">Đóng</v-btn></div></section></v-dialog>
  </div>
</template>
