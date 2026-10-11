<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vitepress'
import MarkdownIt from 'markdown-it'
import { metadataSchema, types, typeLabels, type Metadata, type DocumentRecord } from '../../schemas/src/index'
import { api, ApiError, assetUrl, canPublish, download, fail, notify, refreshDocuments, state } from './state'
import { checkRoundTrip } from './markdown-editor'
import RichEditor from './RichEditor.vue'
import MermaidPreview from './MermaidPreview.vue'
const router = useRouter()
const drafts = ref<DocumentRecord[]>([]); const active = ref<DocumentRecord | null>(null)
const body = ref(''); const metadata = ref<Metadata | null>(null); const tab = ref('rich'); const dirty = ref(false); const busy = ref(false)
const conflict = ref(false); const serverBody = ref(''); const compareOpen = ref(false); const errorDetails = ref(''); const lastSaved = ref('')
const createOpen = ref(false); const importOpen = ref(false); const importRaw = ref(''); const importWarnings = ref<string[]>([]); const importDuplicate = ref(false); const importMode = ref('new'); const importStep = ref(false)
const form = ref(newForm()); const importInput = ref<HTMLInputElement>(); const assetInput = ref<HTMLInputElement>(); const loadingDoc = ref(false)
const relatedText = ref(''); const tagsText = ref(''); const sourceLinksText = ref(''); const fileBusy = ref(false)
const unsupported = ref(false)
const documentTypeItems = types.map(entity => ({ title:typeLabels[entity], value:entity }))
const status = computed(() => conflict.value ? 'Xung đột phiên bản' : busy.value ? 'Đang lưu...' : dirty.value ? 'Có thay đổi chưa lưu' : active.value ? `Đã lưu${lastSaved.value ? ` · ${lastSaved.value}` : ''}` : '')
const markdownParser = new MarkdownIt({ html: false, linkify: false })
markdownParser.renderer.rules.image = (tokens,index,options,_env,self) => { const token = tokens[index]; const src = token.attrGet('src') || ''; if (active.value) token.attrSet('src', assetUrl(active.value,src,true)); token.attrSet('alt', token.content); return self.renderToken(tokens,index,options) }
const preview = computed(() => markdownParser.render(body.value))
const mermaids = computed(() => [...body.value.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)].map(m => m[1]))
const gallery = computed(() => metadata.value?.screen?.screenshot.gallery || [])
// Empty ID is entered by the user; schema validation occurs at submission.
function newForm(type: Metadata['type'] = 'screen'): Metadata { return { ...metadataSchema.parse({ doc_id: 'SCR-NEW-001', project_id: state.project, type, module: 'approval', title: 'Tài liệu mới', owner: state.session?.user || 'BA Team' }), doc_id: '' } }
function apply(doc: DocumentRecord) {
  loadingDoc.value = true
  active.value = doc; metadata.value = JSON.parse(JSON.stringify(doc.metadata)); body.value = doc.body
  relatedText.value = doc.metadata.related_ids.join(', '); tagsText.value = doc.metadata.tags.join(', '); sourceLinksText.value = doc.metadata.source_links.map(s => `${s.label} | ${s.url}`).join('\n')
  try { unsupported.value = !checkRoundTrip(doc.body).safe } catch { unsupported.value = true }
  tab.value = unsupported.value ? 'source' : 'rich'
  dirty.value = false; conflict.value = false; errorDetails.value = ''; lastSaved.value = new Date().toLocaleTimeString('vi-VN', { hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh' })
  queueMicrotask(() => { loadingDoc.value = false })
}
async function loadDrafts() { drafts.value = await api<DocumentRecord[]>('/api/drafts') }
async function open(id: string, published = false) {
  if (dirty.value && !window.confirm('Có thay đổi chưa lưu. Rời bản nháp hiện tại?')) return
  try { const doc = published ? await api<DocumentRecord>(`/api/documents/${id}/edit`, {method:'POST'}) : await api<DocumentRecord>(`/api/documents/${id}/draft`); apply(doc); await loadDrafts(); window.history.replaceState(null,'',`/studio/?doc=${id}`) }
  catch (error) { fail(error) }
}
watch([body, metadata, relatedText, tagsText, sourceLinksText], () => { if (active.value && !loadingDoc.value) dirty.value = true }, { deep:true })
watch(tab, value => { if (value === 'rich' && unsupported.value) { tab.value = 'source'; notify('Một số block chưa hỗ trợ round-trip. Dùng Markdown Source để giữ nguyên nội dung.', 'warning') } })
async function save() {
  if (!active.value || !metadata.value || busy.value || conflict.value) return false
  busy.value = true; errorDetails.value = ''
  try {
    metadata.value.related_ids = relatedText.value.split(',').map(v => v.trim()).filter(Boolean)
    metadata.value.tags = tagsText.value.split(',').map(v => v.trim()).filter(Boolean)
    metadata.value.source_links = sourceLinksText.value.split('\n').filter(v => v.trim()).map(line => { const [label,url] = line.split('|').map(v => v.trim()); return { label, url } })
    const doc = await api<DocumentRecord>(`/api/documents/${active.value.metadata.doc_id}/draft`, { method:'PUT', body:JSON.stringify({ metadata:metadata.value, body:body.value, base_revision:active.value.revision }) })
    const oldTab = tab.value; apply(doc); if (!unsupported.value) tab.value = oldTab
    await loadDrafts(); return true
  } catch (error) { if (error instanceof ApiError && error.status === 409) conflict.value = true; fail(error); return false }
  finally { busy.value = false }
}
async function publish() {
  if (!active.value || !canPublish.value) return
  if (dirty.value && !await save()) return
  busy.value = true; errorDetails.value = ''
  try { const result = await api(`/api/documents/${active.value.metadata.doc_id}/publish`, {method:'POST',body:JSON.stringify({base_revision:active.value.revision})}); notify(`Đã xuất bản ${result.doc_id} · Git ${result.revision.slice(0,12)}`); await refreshDocuments() }
  catch (error) { if (error instanceof ApiError && error.status === 409) conflict.value = true; if (error instanceof ApiError && error.details) errorDetails.value = typeof error.details === 'string' ? error.details : JSON.stringify(error.details,null,2); fail(error) }
  finally { busy.value = false }
}
async function create() {
  busy.value = true
  try { const meta = metadataSchema.parse({ ...form.value, ...(form.value.type === 'screen' && !form.value.screen ? {screen:{}} : {}) }); const doc = await api<DocumentRecord>('/api/documents',{method:'POST',body:JSON.stringify({metadata:meta})}); createOpen.value = false; apply(doc); await loadDrafts(); notify('Đã tạo bản nháp trên filesystem.') }
  catch (error) { fail(error) } finally { busy.value = false }
}
function showCreate() { form.value = newForm(); createOpen.value = true }
async function analyze(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return
  try {
    if (!file.name.toLowerCase().endsWith('.md') || file.size > 2*1024*1024) throw new Error('Chọn file .md UTF-8, tối đa 2 MB.')
    importRaw.value = new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer())
    const data = await api('/api/documents/import',{method:'POST',body:JSON.stringify({markdown:importRaw.value})})
    form.value = { ...newForm(), ...Object.fromEntries(Object.entries(data.metadata).filter(([key]) => key in newForm())), ...(data.metadata.screen ? {screen:data.metadata.screen} : {}), status:'draft' }
    if (!data.metadata.title) form.value.title = file.name.replace(/\.md$/i,'')
    importWarnings.value = [...data.warnings, ...data.missing_fields.map((field:string) => `Cần điền metadata: ${field}`)]
    importDuplicate.value = data.duplicate; importMode.value = 'new'; importStep.value = false; importOpen.value = true
  } catch (error) { fail(error) } finally { (event.target as HTMLInputElement).value = '' }
}
async function importDocument() {
  busy.value = true
  try {
    let baseRevision: string | undefined
    if (importMode.value === 'update') {
      const existing = await api<DocumentRecord>(`/api/documents/${form.value.doc_id}/edit`, {method:'POST'})
      baseRevision = existing.revision
      form.value = { ...form.value, doc_id:existing.metadata.doc_id, type:existing.metadata.type, module:existing.metadata.module, project_id:existing.metadata.project_id }
    }
    const meta = metadataSchema.parse(form.value)
    const doc = await api<DocumentRecord>('/api/documents/import/confirm',{method:'POST',body:JSON.stringify({markdown:importRaw.value,metadata:meta,mode:importMode.value,base_revision:baseRevision})})
    importOpen.value = false; apply(doc); await loadDrafts(); notify('Đã import Markdown vào bản nháp.')
  } catch (error) { fail(error) } finally { busy.value = false }
}
async function upload(files: File[], insert = false) {
  if (!active.value || !metadata.value) return
  if (files.length > 20) { notify('Mỗi lần upload tối đa 20 ảnh.', 'error'); return }
  fileBusy.value = true
  try {
    const formData = new FormData(); for (const file of files) formData.append('files',file)
    const assets = await api(`/api/documents/${active.value.metadata.doc_id}/assets`,{method:'POST',body:formData})
    for (const asset of assets) {
      if (metadata.value.type === 'screen') { metadata.value.screen ||= {route:'',menu_path:[],screenshot:{gallery:[]}}; metadata.value.screen.screenshot.gallery.push({ path:asset.relative_path,alt:'Ảnh màn hình',caption:'',category:'overview' }); metadata.value.screen.screenshot.cover ||= asset.relative_path }
      if (insert || metadata.value.type !== 'screen') body.value += `\n\n![Ảnh minh họa](${asset.relative_path})\n`
    }
    notify(`Đã lưu ${assets.length} ảnh vào thư mục Draft. Lưu bản nháp để cập nhật gallery.`)
  } catch (error) { fail(error) } finally { fileBusy.value = false }
}
function moveImage(index: number, offset: number) { const list = gallery.value; if (index+offset < 0 || index+offset >= list.length) return; const [item] = list.splice(index,1); list.splice(index+offset,0,item) }
function removeImage(index: number) { if (!metadata.value?.screen) return; const [item] = metadata.value.screen.screenshot.gallery.splice(index,1); if (metadata.value.screen.screenshot.cover === item.path) metadata.value.screen.screenshot.cover = gallery.value[0]?.path; notify('Đã gỡ khỏi gallery. File gốc và các ảnh trong nội dung vẫn được giữ.') }
async function compare() { if (!active.value) return; try { serverBody.value = (await api<DocumentRecord>(`/api/documents/${active.value.metadata.doc_id}/draft`)).body; compareOpen.value = true } catch(error) { fail(error) } }
function exportBuffer() { if (!active.value) return; download(body.value, `${active.value.metadata.doc_id}-unsaved.md`, 'text/markdown') }
async function reload() { if (!active.value) return; if (dirty.value && !window.confirm('Tải lại sẽ bỏ thay đổi chưa lưu. Tiếp tục?')) return; dirty.value = false; await open(active.value.metadata.doc_id) }
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value) { event.preventDefault(); event.returnValue = '' } }
let interval: ReturnType<typeof setInterval>; let priorRouteHook: typeof router.onBeforeRouteChange
onMounted(async () => {
  window.addEventListener('beforeunload',beforeUnload)
  priorRouteHook = router.onBeforeRouteChange
  router.onBeforeRouteChange = to => { if (dirty.value && !window.confirm('Có thay đổi chưa lưu. Rời Document Studio?')) return false; return priorRouteHook?.(to) }
  try { await loadDrafts(); const params = new URLSearchParams(window.location.search); const id = params.get('doc'); const type = params.get('new'); if (id) await open(id,true); else if (type && types.includes(type as Metadata['type'])) { form.value = newForm(type as Metadata['type']); createOpen.value = true } else if (drafts.value.length) apply(drafts.value[0]) }
  catch (error) { fail(error) }
  interval = setInterval(() => { if (dirty.value && !busy.value && !fileBusy.value && !conflict.value) void save() },15000)
})
onUnmounted(() => { clearInterval(interval); window.removeEventListener('beforeunload',beforeUnload); router.onBeforeRouteChange = priorRouteHook })
</script>
<template>
  <input ref="importInput" type="file" accept=".md,text/markdown" hidden @change="analyze"><input ref="assetInput" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden @change="event => { upload([...(event.target as HTMLInputElement).files || []]); (event.target as HTMLInputElement).value = '' }">
  <div class="breadcrumb-line"><a href="/">Knowledge Hub</a><v-icon icon="mdi-chevron-right" size="16" /><span>Biên tập</span></div><header class="studio-heading"><div><span class="eyebrow">NƠI TRI THỨC ĐƯỢC HOÀN THIỆN</span><h1>Document Studio</h1></div><div class="studio-actions"><v-btn size="small" variant="outlined" prepend-icon="mdi-upload-outline" @click="importInput?.click()">Import Markdown</v-btn><v-btn size="small" color="primary" prepend-icon="mdi-plus" @click="showCreate">Tạo tài liệu</v-btn></div></header>
  <div class="studio-layout"><aside class="draft-sidebar"><span class="eyebrow">BẢN NHÁP RIÊNG TƯ · {{ drafts.length }}</span><button v-for="draft in drafts" :key="draft.metadata.doc_id" class="draft-item" :class="{active:active?.metadata.doc_id === draft.metadata.doc_id}" @click="open(draft.metadata.doc_id)"><strong>{{ draft.metadata.title }}</strong><small>{{ draft.metadata.doc_id }}</small></button><p v-if="!drafts.length" class="empty-text">Tạo hoặc import tài liệu để bắt đầu.</p></aside>
    <section v-if="active && metadata" class="editor-panel"><div class="section-heading" style="padding:18px 23px;margin:0"><span><code>{{ active.metadata.doc_id }}</code> · Draft</span><div class="studio-actions"><span class="studio-status" role="status">{{ status }}</span><v-btn size="small" variant="text" :href="`/api/documents/${active.metadata.doc_id}/export.md?draft=true`" icon="mdi-download-outline" aria-label="Export Markdown đã lưu" /><v-btn size="small" variant="outlined" :disabled="busy || conflict" :loading="busy" @click="save">Lưu bản nháp</v-btn><v-btn v-if="canPublish" size="small" color="primary" :disabled="busy || conflict" @click="publish">Xuất bản</v-btn></div></div>
      <v-progress-linear v-if="busy" indeterminate color="primary" /><div class="editor-metadata"><v-text-field v-model="metadata.title" label="Tiêu đề tài liệu" /><v-text-field v-model="metadata.owner" label="Owner" /><v-text-field v-model="metadata.version" label="Phiên bản" /><v-text-field v-model="metadata.summary" label="Mô tả ngắn" class="full-width" /></div><details class="metadata-more"><summary>Metadata, liên kết & nguồn</summary><div class="metadata-more-grid"><v-text-field v-model="relatedText" label="Related IDs (phân cách bằng dấu phẩy)" /><v-text-field v-model="tagsText" label="Tags (phân cách bằng dấu phẩy)" /><v-select v-model="metadata.language" :items="['vi','ja','en']" label="Ngôn ngữ" /><v-select v-model="metadata.classification" :items="['internal','confidential','restricted']" label="Classification" /><v-text-field v-if="metadata.screen" v-model="metadata.screen.route" label="Route của màn hình nghiệp vụ" /><v-text-field v-if="metadata.screen" :model-value="metadata.screen.menu_path.join(' > ')" label="Menu path (phân cách bằng >)" @update:model-value="value => { if(metadata?.screen) metadata.screen.menu_path = value.split('>').map((v:string) => v.trim()).filter(Boolean) }" /><v-textarea v-model="sourceLinksText" label="Nguồn: tên | https://url (mỗi nguồn một dòng)" rows="2" /></div></details>
      <div v-if="conflict" class="conflict-panel"><p>Bản nháp đã được lưu từ tab hoặc người dùng khác. Thay đổi của bạn đang được giữ trong editor.</p><v-btn size="small" variant="text" @click="compare">Đối chiếu</v-btn><v-btn size="small" variant="text" @click="exportBuffer">Export thay đổi</v-btn><v-btn size="small" variant="text" @click="reload">Tải lại bản mới</v-btn></div><v-alert v-if="unsupported" type="warning" variant="tonal" class="mx-6 mb-4" density="compact">Nội dung có cấu trúc chưa bảo đảm round-trip. Markdown Source giữ nguyên các block; rich editor tạm khóa.</v-alert><pre v-if="errorDetails" class="api-error-details mx-6">{{ errorDetails }}</pre>
      <v-tabs v-model="tab" color="primary" class="editor-tabs"><v-tab value="rich" :disabled="unsupported">Soạn thảo</v-tab><v-tab value="source">Markdown Source</v-tab><v-tab value="preview">Xem trước</v-tab></v-tabs><RichEditor v-if="tab === 'rich'" :key="active!.metadata.doc_id" v-model="body" :doc-id="active!.metadata.doc_id" @upload="files => upload(files,true)" /><div v-else-if="tab === 'source'" class="editor-area"><textarea v-model="body" class="markdown-textarea" aria-label="Markdown Source" spellcheck="false"></textarea></div><div v-else class="editor-area"><!-- HTML is produced only by markdown-it with html:false and safe URLs. -->
<!-- eslint-disable-next-line vue/no-v-html -->
<div class="prose" v-html="preview"></div><MermaidPreview v-for="(source,index) in mermaids" :key="index" :source="source" /></div>
      <section class="gallery-editor"><div class="section-heading"><h2>{{ metadata!.type === 'screen' ? 'Screenshot Gallery' : 'Ảnh trong tài liệu' }}</h2><v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-image-plus-outline" :loading="fileBusy" :disabled="busy" @click="assetInput?.click()">Upload ảnh</v-btn></div><small>PNG, JPEG, WebP · 10 MB/ảnh · Tối đa 20 ảnh/lần · Preview Draft có xác thực</small><div v-for="(image,index) in gallery" :key="image.path" class="gallery-edit-item"><img :src="assetUrl(active!,image.path,true)" :alt="image.alt"><div class="gallery-edit-fields"><v-text-field v-model="image.alt" label="Alt text" /><v-text-field v-model="image.caption" label="Caption" /></div><v-btn icon="mdi-star-outline" :color="metadata!.screen?.screenshot.cover === image.path ? 'primary' : undefined" size="small" variant="text" aria-label="Chọn làm cover" @click="metadata!.screen!.screenshot.cover = image.path" /><v-btn icon="mdi-arrow-up" size="small" variant="text" :disabled="index === 0" aria-label="Đưa ảnh lên" @click="moveImage(index,-1)" /><v-btn icon="mdi-arrow-down" size="small" variant="text" :disabled="index === gallery.length-1" aria-label="Đưa ảnh xuống" @click="moveImage(index,1)" /><v-btn icon="mdi-close" size="small" variant="text" aria-label="Gỡ ảnh khỏi gallery" @click="removeImage(index)" /></div><v-btn class="mt-4" variant="text" size="small" prepend-icon="mdi-vector-polyline" :href="`/studio/diagrams/?doc=${active!.metadata.doc_id}`">Chỉnh sửa sơ đồ trong Diagram Studio</v-btn></section>
    </section><div v-else class="studio-empty"><v-icon icon="mdi-file-document-edit-outline" size="52" /><h2>Từ ý tưởng đến tri thức chung</h2><p>Tạo tài liệu mới hoặc import Markdown.<br>Bản nháp được lưu riêng cho đến khi xuất bản.</p><v-btn class="mt-6" color="primary" variant="tonal" @click="showCreate">Tạo tài liệu đầu tiên</v-btn></div></div>
  <v-dialog v-model="createOpen" max-width="620"><form class="new-doc-form" @submit.prevent="create"><span class="eyebrow">TÀI LIỆU MỚI</span><h2>Bắt đầu một bản nháp</h2><div class="form-grid"><v-text-field v-model="form.doc_id" label="ID bất biến, ví dụ SCR-APP-002" required /><v-select v-model="form.type" :items="documentTypeItems" label="Loại tài liệu" /><v-text-field v-model="form.title" label="Tiêu đề" class="full-width" required /><v-text-field v-model="form.project_id" label="Project ID" required /><v-text-field v-model="form.module" label="Module (kebab-case)" required /><v-text-field v-model="form.owner" label="Owner" required /><v-select v-model="form.language" label="Ngôn ngữ" :items="['vi','ja','en']" /></div><div class="form-actions"><v-btn variant="text" @click="createOpen = false">Hủy</v-btn><v-btn type="submit" color="primary" :loading="busy">Tạo bản nháp</v-btn></div></form></v-dialog>
  <v-dialog v-model="importOpen" max-width="720"><div class="new-doc-form"><span class="eyebrow">IMPORT MARKDOWN</span><h2>{{ importStep ? 'Kiểm tra trước khi import' : 'Ánh xạ metadata' }}</h2><template v-if="!importStep"><v-alert v-if="importDuplicate" type="warning" variant="tonal" class="mb-4">ID đã tồn tại. Chọn cập nhật rõ ràng hoặc nhập một ID mới.</v-alert><v-radio-group v-if="importDuplicate" v-model="importMode" inline><v-radio label="Import với ID mới" value="new" /><v-radio label="Cập nhật Draft hiện tại" value="update" /></v-radio-group><div class="form-grid"><v-text-field v-model="form.doc_id" label="Document ID" /><v-select v-model="form.type" :items="documentTypeItems" label="Loại tài liệu" /><v-text-field v-model="form.title" label="Tiêu đề" class="full-width" /><v-text-field v-model="form.project_id" label="Project ID" /><v-text-field v-model="form.module" label="Module" /><v-text-field v-model="form.owner" label="Owner" /><v-select v-model="form.language" :items="['vi','ja','en']" label="Ngôn ngữ" /></div><p v-for="warning in importWarnings" :key="warning" style="font-size:11px;color:#9c854b">{{ warning }}</p></template><template v-else><p>{{ form.doc_id }} · {{ form.title }} · {{ typeLabels[form.type] }}</p><pre class="import-preview">{{ importRaw }}</pre><p style="font-size:12px;color:#8b9cb0">Relative assets cần upload vào Draft trước khi Publish.</p></template><div class="form-actions"><v-btn variant="text" @click="importOpen = false">Hủy</v-btn><v-btn v-if="importStep" variant="text" @click="importStep = false">Quay lại</v-btn><v-btn v-if="!importStep" color="primary" @click="importStep = true">Xem trước</v-btn><v-btn v-else color="primary" :loading="busy" @click="importDocument">Import vào Draft</v-btn></div></div></v-dialog>
  <v-dialog v-model="compareOpen" max-width="1000"><div class="new-doc-form"><h2>Đối chiếu nội dung</h2><div class="metadata-more-grid mt-6"><div><h3>Thay đổi của bạn</h3><pre class="diff-view">{{ body }}</pre></div><div><h3>Bản trên server</h3><pre class="diff-view">{{ serverBody }}</pre></div></div><div class="form-actions"><v-btn color="primary" @click="compareOpen = false">Đóng</v-btn></div></div></v-dialog>
</template>
