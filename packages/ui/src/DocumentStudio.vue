<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vitepress'
import MarkdownIt from 'markdown-it'
import { isActiveType, metadataSchema, types, typeLabels, reviewLabels, type Metadata, type DraftRecord, type PublishJob, type ReferenceCandidate } from '../../schemas/src/index'
import { documentRelations } from '../../schemas/src/relations'
import { documentLink } from '../../schemas/src/document-links'
import { api, ApiError, assetUrl, canPublish, download, fail, notify, refreshDocuments, currentProject, changeProject, state } from './state'
import { checkRoundTrip } from './markdown-editor'
import { reviewColors } from './theme'
import RichEditor from './RichEditor.vue'
import RelationEditor from './RelationEditor.vue'
import DocumentReferencePicker from './DocumentReferencePicker.vue'
import { mermaidPlaceholder } from './mermaid-theme'
import ManagedContent from './ManagedContent.vue'
import { imageAlt } from './markdown-media'
import DownloadButton from './DownloadButton.vue'
import { uploadImages, type UploadedImage } from './media'
const router = useRouter()
const showDrafts = ref(true)
const drafts = ref<DraftRecord[]>([]); const active = ref<DraftRecord | null>(null)
const body = ref(''); const metadata = ref<Metadata | null>(null); const tab = ref('rich'); const dirty = ref(false); const busy = ref(false)
const conflict = ref(false); const serverBody = ref(''); const compareOpen = ref(false); const errorDetails = ref(''); const lastSaved = ref('')
const createOpen = ref(false); const importOpen = ref(false); const importRaw = ref(''); const importWarnings = ref<string[]>([]); const importDuplicate = ref(false); const importMode = ref('new'); const importStep = ref(false)
const form = ref(newForm()); const importInput = ref<HTMLInputElement>(); const assetInput = ref<HTMLInputElement>(); const loadingDoc = ref(false)
const templateId = ref(''); const formError = ref(''); const opening = ref(false); const loadingError = ref(''); const reviewReason = ref(''); let editVersion = 0; let openSequence = 0; let disposed = false;
const sourceReferenceOpen=ref(false);let sourceReferenceRange={from:0,to:0}
function sourceMention(event:KeyboardEvent){if(event.isComposing)return;const input=event.target as HTMLTextAreaElement;if(event.key!=='@'||!metadata.value)return;const position=input.selectionStart;if(position>1&&!/\s/.test(input.value[position-2]))return;sourceReferenceRange={from:position-1,to:position};sourceReferenceOpen.value=true}
function insertSourceReference(items:ReferenceCandidate[]){const links=items.map(item=>`[${item.metadata.title.replace(/[[\]\\]/g,'\\$&')}](${documentLink(item.metadata.doc_id)})`).join(' ');body.value=body.value.slice(0,sourceReferenceRange.from)+links+' '+body.value.slice(sourceReferenceRange.to);void loadDrafts()}
const templates = computed(() => state.workspace?.templates.filter(t => t.type === form.value.type && (!t.project_id || t.project_id === form.value.project_id)) || [])
 const tagsText = ref(''); const sourceLinksText = ref(''); const fileBusy = ref(false)
const unsupported = ref(false)
const uploadProgress = ref<number | null>(null); const uploadFailure = ref(''); let uploadRetryFiles: File[] = []
const operation = ref('save'); const operationLabels: Record<string,string> = {save:'Đang lưu...',review:'Đang gửi duyệt…',publish:'Đang tạo đợt xuất bản…',create:'Đang tạo tài liệu…',import:'Đang import…'}
const publishJob = ref<PublishJob | null>(null); const publishTrackingError = ref(''); let publishTimer: ReturnType<typeof setTimeout> | undefined
const publishing = computed(() => !!publishJob.value && !['completed','failed'].includes(publishJob.value.status))
async function trackPublish() {
  if (!publishJob.value || disposed) return
  try { const job = await api<PublishJob>(`/api/publish-jobs/${publishJob.value.id}`); if(disposed) return; publishJob.value = job; publishTrackingError.value = ''; if(job.status === 'completed') { await refreshDocuments(); notify(`Đã xuất bản thành công · ${job.id.slice(0,8)}`) } else if(job.status === 'failed') notify(`Xuất bản thất bại: ${job.error || job.id}`, 'error') }
  catch(error) { if(!disposed) publishTrackingError.value = (error as Error).message }
  if (!disposed && publishing.value) publishTimer = setTimeout(() => void trackPublish(), 2000)
}
const documentTypeItems = types.map(entity => ({ title:typeLabels[entity], value:entity }))
const status = computed(() => conflict.value ? 'Xung đột phiên bản' : busy.value ? operationLabels[operation.value] : dirty.value ? 'Có thay đổi chưa lưu' : active.value ? `Đã lưu${lastSaved.value ? ` · ${lastSaved.value}` : ''}` : '')
const markdownParser = new MarkdownIt({ html: false, linkify: false })
markdownParser.renderer.rules.image = (tokens,index,options,_env,self) => { const token = tokens[index]; const src = token.attrGet('src') || ''; token.attrSet('data-asset-path',src); if (active.value) token.attrSet('src', assetUrl(active.value,src,true)); token.attrSet('alt', imageAlt(token)); return self.renderToken(tokens,index,options) }
const originalFence = markdownParser.renderer.rules.fence!
markdownParser.renderer.rules.fence = (tokens,index,options,env,self) => tokens[index].info.trim() === 'mermaid' ? mermaidPlaceholder(tokens[index].content) : originalFence(tokens,index,options,env,self)
const preview = computed(() => markdownParser.render(body.value))
const gallery = computed(() => metadata.value?.screen?.screenshot.gallery || [])
// Empty ID is entered by the user; schema validation occurs at submission.
function newForm(type: Metadata['type'] = 'screen'): Metadata { return { ...metadataSchema.parse({ doc_id: 'SCR-NEW-001', project_id: state.project || 'new-project', type, module: currentProject.value?.modules[0]?.id || 'general', title: 'Tài liệu mới', owner: state.session?.user || 'BA Team' }), doc_id: '', title: '', module:currentProject.value?.modules[0]?.id || '' } }
function apply(doc: DraftRecord) {
  loadingDoc.value = true
  active.value = doc; metadata.value = JSON.parse(JSON.stringify(doc.metadata)); body.value = doc.body
  metadata.value!.relations=documentRelations(doc.metadata);metadata.value!.related_ids=[]
  tagsText.value = doc.metadata.tags.join(', '); sourceLinksText.value = doc.metadata.source_links.map(s => `${s.label} | ${s.url}`).join('\n')
  try { unsupported.value = !checkRoundTrip(doc.body).safe } catch { unsupported.value = true }
  tab.value = unsupported.value ? 'source' : 'rich'
  editVersion++; dirty.value = false; conflict.value = false; errorDetails.value = ''; lastSaved.value = doc.metadata.updated_at ? new Date(doc.metadata.updated_at).toLocaleTimeString('vi-VN', { hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh' }) : ''
  loadingDoc.value = false
}
async function loadDrafts() { const project = state.project; const data = await api<DraftRecord[]>(`/api/drafts?project_id=${encodeURIComponent(project)}`); if(project === state.project && !disposed) drafts.value = data }
async function open(id: string, published = false) {
  if (busy.value || fileBusy.value) { notify('Chờ thao tác hiện tại hoàn tất trước khi chuyển tài liệu.', 'info'); return }
  if (dirty.value && !window.confirm('Có thay đổi chưa lưu. Rời bản nháp hiện tại?')) return
  const request = ++openSequence; opening.value = true; loadingError.value = ''
  try {
    const doc = published ? await api<DraftRecord>(`/api/documents/${id}/edit`, {method:'POST'}) : await api<DraftRecord>(`/api/documents/${id}/draft`)
    if(request !== openSequence || disposed) return
    if (state.project !== doc.metadata.project_id) { active.value = null; dirty.value = false; changeProject(doc.metadata.project_id) }
    apply(doc); await loadDrafts(); window.history.replaceState(window.history.state,'',`/studio/?doc=${id}`)
  } catch (error) { if(request === openSequence) { loadingError.value = (error as Error).message; fail(error) } }
  finally { if(request === openSequence) opening.value = false }
}
watch([body, metadata, tagsText, sourceLinksText], () => { if (active.value && !loadingDoc.value) { editVersion++; dirty.value = true } }, { deep:true, flush:'sync' })
watch(tab, value => { if (value === 'rich' && unsupported.value) { tab.value = 'source'; notify('Một số block chưa hỗ trợ round-trip. Dùng Markdown Source để giữ nguyên nội dung.', 'warning') } })
async function save() {
  if (!active.value || !metadata.value || busy.value || conflict.value || fileBusy.value) return false
  operation.value = 'save'; busy.value = true; errorDetails.value = ''
  const id = active.value.metadata.doc_id; const version = editVersion
  const meta: Metadata = JSON.parse(JSON.stringify(metadata.value))
  if (!meta.review_due_at) delete meta.review_due_at
  if (!meta.effective_from) delete meta.effective_from
  meta.related_ids = []
  meta.tags = tagsText.value.split(',').map(v => v.trim()).filter(Boolean)
  meta.source_links = sourceLinksText.value.split('\n').filter(v => v.trim()).map(line => { const at=line.indexOf('|'); return {label:line.slice(0,at).trim(),url:line.slice(at+1).trim()} })
  const payload = JSON.stringify({ metadata:meta, body:body.value, base_revision:active.value.revision })
  try {
    const doc = await api<DraftRecord>(`/api/documents/${id}/draft`, {method:'PUT',body:payload})
    if(disposed || active.value?.metadata.doc_id !== id) return false
    active.value = doc
    // Acknowledging an older buffer must never replace newer typing or metadata.
    dirty.value = editVersion !== version
    lastSaved.value = new Date(doc.metadata.updated_at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'})
    try { unsupported.value = !checkRoundTrip(body.value).safe } catch { unsupported.value = true }
    if (unsupported.value) tab.value = 'source'
    await loadDrafts(); return !dirty.value
  } catch (error) { if (!disposed && active.value?.metadata.doc_id === id && error instanceof ApiError && error.status === 409) conflict.value = true; fail(error); return false }
  finally { busy.value = false }
}
async function submitReview() {
  if (!active.value || busy.value || (dirty.value && !await save())) return
  operation.value = 'review'; busy.value = true
  try { active.value = await api<DraftRecord>(`/api/documents/${active.value.metadata.doc_id}/review`, {method:'POST',body:JSON.stringify({base_revision:active.value.revision,action:'submit',reason:reviewReason.value})}); await loadDrafts(); notify('Đã gửi phiên bản hiện tại cho người duyệt.') }
  catch(error) { fail(error) } finally { busy.value = false }
}
async function publish() {
  if (!active.value || !canPublish.value || busy.value || publishing.value) return
  if (dirty.value && !await save()) return
  operation.value = 'publish'; busy.value = true; errorDetails.value = ''
  try { const job = await api<PublishJob>('/api/publish-jobs', {method:'POST',body:JSON.stringify({documents:[{doc_id:active.value.metadata.doc_id,base_revision:active.value.revision}]})}); publishJob.value = job; notify(`Đã tạo đợt xuất bản ${job.id.slice(0,8)}.`); void trackPublish() }
  catch (error) { if (error instanceof ApiError && error.status === 409) conflict.value = true; if (error instanceof ApiError && error.details) errorDetails.value = typeof error.details === 'string' ? error.details : JSON.stringify(error.details,null,2); fail(error) }
  finally { busy.value = false }
}
async function create() {
  if (busy.value) return
  operation.value = 'create'; busy.value = true; formError.value = ''
  try {
    const meta = metadataSchema.parse({ ...form.value, doc_id:form.value.doc_id || 'AUTO-NEW', ...(form.value.type === 'screen' && !form.value.screen ? {screen:{}} : {}) })
    let doc: DraftRecord
    if(form.value.doc_id) doc = await api<DraftRecord>('/api/documents',{method:'POST',body:JSON.stringify({metadata:meta})})
    else { const input = {...meta} as Partial<Metadata>; delete input.doc_id; doc = await api<DraftRecord>('/api/documents/new',{method:'POST',body:JSON.stringify({metadata:input,template_id:templateId.value || undefined})}) }
    createOpen.value = false; apply(doc); await loadDrafts(); window.history.replaceState(window.history.state,'',`/studio/?doc=${doc.metadata.doc_id}`); notify('Đã tạo bản nháp dùng chung cho nhóm biên tập.')
  } catch (error) { formError.value = error instanceof Error ? error.message : 'Kiểm tra các trường của tài liệu.'; fail(error) } finally { busy.value = false }
}
function showCreate() { if (dirty.value && !window.confirm('Rời tài liệu còn thay đổi chưa lưu để tạo tài liệu khác?')) return; form.value = newForm(); templateId.value = ''; formError.value = ''; createOpen.value = true }
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
  operation.value = 'import'; busy.value = true
  try {
    let baseRevision: string | undefined
    if (importMode.value === 'update') {
      const existing = await api<DraftRecord>(`/api/documents/${form.value.doc_id}/edit`, {method:'POST'})
      baseRevision = existing.revision
      form.value = { ...form.value, doc_id:existing.metadata.doc_id, type:existing.metadata.type, module:existing.metadata.module, project_id:existing.metadata.project_id }
    }
    const meta = metadataSchema.parse(form.value)
    const doc = await api<DraftRecord>('/api/documents/import/confirm',{method:'POST',body:JSON.stringify({markdown:importRaw.value,metadata:meta,mode:importMode.value,base_revision:baseRevision})})
    importOpen.value = false; apply(doc); await loadDrafts(); notify('Đã import Markdown vào bản nháp.')
  } catch (error) { fail(error) } finally { busy.value = false }
}
async function uploadImageFiles(files: File[]): Promise<UploadedImage[]> {
  if (!active.value || !metadata.value || busy.value || opening.value || fileBusy.value) throw new Error('Chờ thao tác hiện tại hoàn tất trước khi tải ảnh.')
  if (!files.length || files.length > 20) throw new Error('Mỗi lần upload từ 1 đến 20 ảnh.')
  if (files.some(file => file.size > 10 * 1024 * 1024)) throw new Error('Mỗi ảnh tối đa 10 MB.')
  const id = active.value.metadata.doc_id; fileBusy.value = true; uploadFailure.value = ''; uploadProgress.value = null
  try {
    const assets = await uploadImages(id, files, value => { uploadProgress.value = value })
    if (disposed || active.value?.metadata.doc_id !== id) throw new Error('Tài liệu đã thay đổi. Ảnh vẫn được giữ trong kho tài liệu gốc.')
    for (const asset of assets) if (!active.value.assets.some(image => image.path === asset.relative_path)) active.value.assets.push({path:asset.relative_path,preview_url:asset.preview_url})
    for (const asset of assets) {
      if (metadata.value.type === 'screen') { metadata.value.screen ||= {route:'',menu_path:[],screenshot:{gallery:[]}}; metadata.value.screen.screenshot.gallery.push({ path:asset.relative_path,alt:'Ảnh màn hình',caption:'',category:'overview' }); metadata.value.screen.screenshot.cover ||= asset.relative_path }
    }
    notify(`Đã tải ${assets.length} ảnh. Lưu bản nháp để giữ nội dung và chú thích.`)
    return assets
  } catch (error) { uploadFailure.value = (error as Error).message; throw error } finally { fileBusy.value = false }
}
async function upload(files: File[]) {
  uploadRetryFiles = files
  const input = document.querySelector<HTMLTextAreaElement>('.markdown-textarea'); const at = input?.selectionStart ?? body.value.length
  try { const assets = await uploadImageFiles(files); if (metadata.value?.type !== 'screen') { const markdown = assets.map(image => `\n\n![Ảnh minh họa](${image.relative_path})\n`).join(''); body.value = body.value.slice(0,at) + markdown + body.value.slice(at) } } catch(error) { uploadFailure.value = (error as Error).message; fail(error) }
}
function moveImage(index: number, offset: number) { const list = gallery.value; if (index+offset < 0 || index+offset >= list.length) return; const [item] = list.splice(index,1); list.splice(index+offset,0,item) }
function removeImage(index: number) { if (!metadata.value?.screen) return; const [item] = metadata.value.screen.screenshot.gallery.splice(index,1); if (metadata.value.screen.screenshot.cover === item.path) metadata.value.screen.screenshot.cover = gallery.value[0]?.path; notify('Đã gỡ khỏi gallery. File gốc và các ảnh trong nội dung vẫn được giữ.') }
async function compare() { if (!active.value) return; try { serverBody.value = (await api<DraftRecord>(`/api/documents/${active.value.metadata.doc_id}/draft`)).body; compareOpen.value = true } catch(error) { fail(error) } }
function exportBuffer() { if (!active.value || !metadata.value) return; download(JSON.stringify({metadata:metadata.value,body:body.value,tags:tagsText.value,source_links:sourceLinksText.value},null,2), `${active.value.metadata.doc_id}-recovery.json`, 'application/json') }
async function reload() { if (!active.value || busy.value || fileBusy.value) return; if (dirty.value && !window.confirm('Tải lại sẽ bỏ thay đổi chưa lưu. Tiếp tục?')) return; dirty.value = false; await open(active.value.metadata.doc_id) }
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value || busy.value || fileBusy.value) { event.preventDefault(); event.returnValue = '' } }
function beforeProjectChange(event: Event) { if(busy.value || fileBusy.value) { event.preventDefault(); notify('Chờ lưu hoặc tải ảnh hoàn tất trước khi đổi project.', 'info') } else if(dirty.value && !window.confirm('Đổi project sẽ rời các thay đổi chưa lưu. Tiếp tục?')) event.preventDefault() }
watch(() => state.project, async () => { if(opening.value) return; ++openSequence; active.value = null; metadata.value = null; dirty.value = false; try {await loadDrafts()} catch(error) {fail(error)} })
let interval: ReturnType<typeof setInterval>; let priorRouteHook: typeof router.onBeforeRouteChange
onMounted(async () => {
  window.addEventListener('beforeunload',beforeUnload); window.addEventListener('atlas:before-project-change',beforeProjectChange)
  priorRouteHook = router.onBeforeRouteChange
  router.onBeforeRouteChange = to => { if ((busy.value || fileBusy.value)) { notify('Chờ thao tác hiện tại hoàn tất trước khi rời trang.', 'info'); return false }; if (dirty.value && !window.confirm('Có thay đổi chưa lưu. Rời Document Studio?')) return false; return priorRouteHook?.(to) }
  try { await loadDrafts(); const params = new URLSearchParams(window.location.search); const id = params.get('doc'); const type = params.get('new'); if (id) await open(id,true); else if (type && isActiveType(type)) { form.value = newForm(type as Metadata['type']); createOpen.value = true } else if (drafts.value.length) apply(drafts.value[0]) }
  catch (error) { fail(error) }
  interval = setInterval(() => { if (dirty.value && !busy.value && !fileBusy.value && !conflict.value) void save() },15000)
})
onUnmounted(() => { disposed = true; clearTimeout(publishTimer); ++openSequence; window.removeEventListener('atlas:before-project-change',beforeProjectChange); clearInterval(interval); window.removeEventListener('beforeunload',beforeUnload); router.onBeforeRouteChange = priorRouteHook })
</script>
<template>
  <input ref="importInput" type="file" accept=".md,text/markdown" hidden @change="analyze"><input ref="assetInput" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden @change="event => { upload([...(event.target as HTMLInputElement).files || []]); (event.target as HTMLInputElement).value = '' }">
  <div class="breadcrumb-line"><a href="/">Knowledge Hub</a><v-icon icon="mdi-chevron-right" size="16" /><span>Biên tập</span></div><header class="studio-heading"><div><span class="eyebrow">Đóng góp tri thức</span><h1>Biên tập tài liệu</h1></div><div class="studio-actions"><v-btn size="small" variant="text" prepend-icon="mdi-dock-left" :aria-expanded="showDrafts" @click="showDrafts = !showDrafts">{{ showDrafts ? 'Ẩn bản nháp' : 'Hiện bản nháp' }}</v-btn><v-btn size="small" variant="outlined" prepend-icon="mdi-upload-outline" :disabled="busy || fileBusy || opening" @click="importInput?.click()">Import Markdown</v-btn><v-btn size="small" color="primary" prepend-icon="mdi-plus" :disabled="busy || fileBusy || opening || !currentProject?.modules.length" @click="showCreate">Tạo tài liệu</v-btn></div></header>
  <v-alert v-if="loadingError" type="error" variant="tonal" class="mb-6">{{ loadingError }}</v-alert><v-progress-linear v-if="opening" indeterminate color="primary" /><div class="studio-layout" :class="{'drafts-collapsed':!showDrafts}"><aside class="draft-sidebar"><span class="eyebrow">Bản nháp của nhóm · {{ drafts.length }}</span><button v-for="draft in drafts" :key="draft.metadata.doc_id" :disabled="busy || fileBusy || opening" class="draft-item" :class="{active:active?.metadata.doc_id === draft.metadata.doc_id}" @click="open(draft.metadata.doc_id)"><strong>{{ draft.metadata.title }}</strong><small>{{ draft.metadata.doc_id }}</small></button><p v-if="!drafts.length" class="empty-text">Tạo hoặc import tài liệu để bắt đầu.</p></aside>
    <section v-if="active && metadata" class="editor-panel"><div class="section-heading" style="padding:18px 23px;margin:0"><span><code>{{ active.metadata.doc_id }}</code> · Draft</span><div class="studio-actions"><span class="studio-status" role="status">{{ status }}</span><DownloadButton :url="`/api/documents/${active.metadata.doc_id}/export.md?draft=true`" :filename="`${active.metadata.doc_id}.md`" icon-only label="Export Markdown đã lưu" /><v-btn size="small" variant="outlined" :disabled="busy || conflict || fileBusy" :loading="busy && operation === 'save'" @click="save">Lưu bản nháp</v-btn><v-btn size="small" variant="tonal" color="primary" :disabled="busy || conflict || fileBusy || dirty || active.review.status === 'in_review' || active.review.status === 'approved'" :loading="busy && operation === 'review'" @click="submitReview">Gửi duyệt</v-btn><v-btn v-if="canPublish" size="small" color="primary" :loading="busy && operation === 'publish'" :disabled="busy || publishing || conflict || fileBusy || (currentProject?.require_review && (active.review.status !== 'approved' || dirty))" @click="publish">Xuất bản</v-btn></div></div>
      <v-progress-linear v-if="busy" indeterminate color="primary" /><div class="review-inline"><v-chip size="small" :color="dirty ? 'info' : reviewColors[active.review.status]" variant="tonal">{{ dirty ? 'Có thay đổi chưa gửi' : reviewLabels[active.review.status] }}</v-chip><span v-if="active.review.reason">{{ active.review.reason }}</span><a href="/studio/reviews/" class="text-link">Duyệt và xuất bản</a></div><div class="editor-metadata"><v-text-field v-model="metadata.title" label="Tiêu đề tài liệu" /><v-text-field v-model="metadata.owner" label="Người phụ trách" /><v-text-field v-model="metadata.version" label="Phiên bản" /><v-text-field v-model="metadata.summary" label="Mô tả ngắn" class="full-width" /></div><details class="metadata-more"><summary>Thông tin, liên kết và nguồn</summary><div class="metadata-more-grid"><v-text-field v-model="metadata.review_due_at" type="date" clearable label="Ngày cần rà soát" @click:clear="delete metadata.review_due_at" /><v-text-field v-model="metadata.effective_from" type="date" clearable label="Ngày hiệu lực" @click:clear="delete metadata.effective_from" /><v-text-field v-model="tagsText" label="Tags (phân cách bằng dấu phẩy)" /><v-select v-model="metadata.language" :items="['vi','ja','en']" label="Ngôn ngữ" /><v-select v-model="metadata.classification" :items="['internal','confidential','restricted']" label="Classification" /><v-text-field v-if="metadata.screen" v-model="metadata.screen.route" label="Route của màn hình nghiệp vụ" /><v-text-field v-if="metadata.screen" :model-value="metadata.screen.menu_path.join(' > ')" label="Menu path (phân cách bằng >)" @update:model-value="value => { if(metadata?.screen) metadata.screen.menu_path = value.split('>').map((v:string) => v.trim()).filter(Boolean) }" /><v-textarea v-model="sourceLinksText" label="Nguồn: tên | https://url (mỗi nguồn một dòng)" rows="2" /></div></details>
      <div class="metadata-more"><RelationEditor :key="active!.metadata.doc_id" v-model="metadata!.relations" :source-id="active!.metadata.doc_id" :project-id="metadata!.project_id" /></div><DocumentReferencePicker v-model="sourceReferenceOpen" :source-id="active!.metadata.doc_id" :project-id="metadata!.project_id" @select="insertSourceReference" /><div v-if="conflict" class="conflict-panel"><p>Bản nháp đã được lưu từ tab hoặc người dùng khác. Thay đổi của bạn đang được giữ trong editor.</p><v-btn size="small" variant="text" @click="compare">Đối chiếu</v-btn><v-btn size="small" variant="text" @click="exportBuffer">Export thay đổi</v-btn><v-btn size="small" variant="text" @click="reload">Tải lại bản mới</v-btn></div><v-alert v-if="unsupported" type="warning" variant="tonal" class="mx-6 mb-4" density="compact">Nội dung có cấu trúc chưa bảo đảm round-trip. Markdown Source giữ nguyên các block; rich editor tạm khóa.</v-alert><pre v-if="errorDetails" class="api-error-details mx-6">{{ errorDetails }}</pre>
      <section v-if="publishJob" class="upload-status" role="status"><p>Đợt {{ publishJob.id.slice(0,8) }} · {{ {queued:'Đang chờ',validating:'Đang kiểm tra dữ liệu',building:'Đang dựng bản phát hành',activating:'Đang kích hoạt',completed:'Hoàn tất',failed:'Thất bại'}[publishJob.status] }}</p><v-progress-linear v-if="publishing" indeterminate color="primary" /><p v-if="publishJob.error" class="text-error">{{ publishJob.error }}</p><p v-if="publishTrackingError" class="text-error">{{ publishTrackingError }}<v-btn variant="text" @click="trackPublish">Kiểm tra lại</v-btn></p><a href="/studio/reviews/" class="text-link">Xem tiến trình xuất bản</a></section><section v-if="fileBusy" class="upload-status" role="status"><p>{{ uploadProgress === 100 ? 'Đã gửi ảnh · Đang kiểm tra và lưu tại máy chủ…' : `Đang tải ảnh${uploadProgress === null ? '…' : ` · ${uploadProgress}%`}` }}</p><v-progress-linear :indeterminate="uploadProgress === null || uploadProgress === 100" :model-value="uploadProgress || 0" color="primary" /></section><v-alert v-if="uploadFailure && tab !== 'rich'" type="error" variant="tonal">{{ uploadFailure }}<v-btn variant="text" @click="upload(uploadRetryFiles)">Thử tải lại</v-btn></v-alert><v-tabs v-model="tab" color="primary" class="editor-tabs" :disabled="fileBusy"><v-tab value="rich" :disabled="unsupported">Soạn thảo</v-tab><v-tab value="source">Markdown Source</v-tab><v-tab value="preview">Xem trước</v-tab></v-tabs><RichEditor v-if="tab === 'rich'" :key="active!.metadata.doc_id" v-model="body" :doc-id="active!.metadata.doc_id" :project-id="metadata!.project_id" :image-layout="metadata!.image_layout || {}" @update:image-layout="metadata!.image_layout = $event" :assets="active!.assets" :uploading="fileBusy" :upload-images="uploadImageFiles" /><div v-else-if="tab === 'source'" class="editor-area"><textarea v-model="body" class="markdown-textarea" aria-label="Markdown Source" spellcheck="false" @keyup="sourceMention"></textarea></div><div v-else class="editor-area"><!-- HTML is produced only by markdown-it with html:false and safe URLs. -->
<!-- eslint-disable-next-line vue/no-v-html -->
<ManagedContent class="prose" :html="preview" :image-layout="metadata!.image_layout" /></div>
      <section class="publish-checklist"><details><summary>Checklist trước khi gửi duyệt</summary><ul class="review-checklist"><li v-for="item in active?.checklist" :key="item.key"><v-icon :icon="item.passed ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline'" :color="item.passed ? 'success' : 'warning'" size="18" />{{ item.label }}</li></ul><p class="field-help">Checklist được cập nhật sau khi lưu bản nháp. Người duyệt xác nhận nội dung nghiệp vụ.</p></details></section><section class="gallery-editor"><div class="section-heading"><h2>{{ metadata!.type === 'screen' ? 'Screenshot Gallery' : 'Ảnh trong tài liệu' }}</h2><v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-image-plus-outline" :loading="fileBusy" :disabled="busy" @click="assetInput?.click()">Upload ảnh</v-btn></div><small>PNG, JPEG, WebP · 10 MB/ảnh · Tối đa 20 ảnh/lần · Preview Draft có xác thực</small><div v-for="(image,index) in gallery" :key="image.path" class="gallery-edit-item"><img :src="assetUrl(active!,image.path,true)" :alt="image.alt"><div class="gallery-edit-fields"><v-text-field v-model="image.alt" label="Alt text" /><v-text-field v-model="image.caption" label="Caption" /></div><v-btn icon="mdi-star-outline" :color="metadata!.screen?.screenshot.cover === image.path ? 'primary' : undefined" size="small" variant="text" aria-label="Chọn làm cover" @click="metadata!.screen!.screenshot.cover = image.path" /><v-btn icon="mdi-arrow-up" size="small" variant="text" :disabled="index === 0" aria-label="Đưa ảnh lên" @click="moveImage(index,-1)" /><v-btn icon="mdi-arrow-down" size="small" variant="text" :disabled="index === gallery.length-1" aria-label="Đưa ảnh xuống" @click="moveImage(index,1)" /><v-btn icon="mdi-close" size="small" variant="text" aria-label="Gỡ ảnh khỏi gallery" @click="removeImage(index)" /></div><v-btn class="mt-4" variant="text" size="small" prepend-icon="mdi-vector-polyline" :href="`/studio/diagrams/?doc=${active!.metadata.doc_id}`">Chỉnh sửa sơ đồ trong Diagram Studio</v-btn></section>
    </section><div v-else class="studio-empty"><v-icon icon="mdi-file-document-edit-outline" size="52" /><h2>Từ ý tưởng đến tri thức chung</h2><p>Tạo tài liệu mới hoặc import Markdown.<br>Nhóm biên tập cùng làm việc trên bản nháp; người đọc xem bản đã xuất bản.</p><v-btn v-if="currentProject?.modules.length" class="mt-6" color="primary" variant="tonal" @click="showCreate">Tạo tài liệu đầu tiên</v-btn><v-btn v-else class="mt-6" color="primary" variant="tonal" href="/settings/workspace/">Thiết lập project và phân hệ</v-btn></div></div>
  <v-dialog v-model="createOpen" max-width="620"><form class="new-doc-form" @submit.prevent="create"><span class="eyebrow">TÀI LIỆU MỚI</span><h2>Bắt đầu một bản nháp</h2><v-alert v-if="formError" type="error" variant="tonal" class="mb-4">{{ formError }}</v-alert><div class="form-grid"><v-text-field v-model="form.doc_id" label="ID (để trống để tự tạo)" /><v-select v-model="form.type" :items="documentTypeItems" label="Loại tài liệu" /><v-text-field v-model="form.title" label="Tiêu đề" class="full-width" required /><v-text-field :model-value="currentProject?.name" label="Project" readonly /><v-select v-model="form.module" :items="currentProject?.modules || []" item-title="name" item-value="id" label="Phân hệ" required /><v-select v-model="templateId" :items="[{id:'',name:'Mẫu mặc định'},...templates]" item-title="name" item-value="id" label="Mẫu tài liệu" :disabled="!!form.doc_id" /><v-text-field v-model="form.owner" label="Người phụ trách" required /><v-select v-model="form.language" label="Ngôn ngữ" :items="['vi','ja','en']" /></div><div class="form-actions"><v-btn variant="text" @click="createOpen = false">Hủy</v-btn><v-btn type="submit" color="primary" :loading="busy">Tạo bản nháp</v-btn></div></form></v-dialog>
  <v-dialog v-model="importOpen" max-width="720"><div class="new-doc-form"><span class="eyebrow">IMPORT MARKDOWN</span><h2>{{ importStep ? 'Kiểm tra trước khi import' : 'Ánh xạ metadata' }}</h2><template v-if="!importStep"><v-alert v-if="importDuplicate" type="warning" variant="tonal" class="mb-4">ID đã tồn tại. Chọn cập nhật rõ ràng hoặc nhập một ID mới.</v-alert><v-radio-group v-if="importDuplicate" v-model="importMode" inline><v-radio label="Import với ID mới" value="new" /><v-radio label="Cập nhật Draft hiện tại" value="update" /></v-radio-group><div class="form-grid"><v-text-field v-model="form.doc_id" label="Document ID" /><v-select v-model="form.type" :items="documentTypeItems" label="Loại tài liệu" /><v-text-field v-model="form.title" label="Tiêu đề" class="full-width" /><v-text-field v-model="form.project_id" label="Project ID" /><v-text-field v-model="form.module" label="Module" /><v-text-field v-model="form.owner" label="Người phụ trách" /><v-select v-model="form.language" :items="['vi','ja','en']" label="Ngôn ngữ" /></div><p v-for="warning in importWarnings" :key="warning" class="relation-warning">{{ warning }}</p></template><template v-else><p>{{ form.doc_id }} · {{ form.title }} · {{ typeLabels[form.type] }}</p><pre class="import-preview">{{ importRaw }}</pre><p class="field-help">Relative assets cần upload vào Draft trước khi Publish.</p></template><div class="form-actions"><v-btn variant="text" @click="importOpen = false">Hủy</v-btn><v-btn v-if="importStep" variant="text" @click="importStep = false">Quay lại</v-btn><v-btn v-if="!importStep" color="primary" @click="importStep = true">Xem trước</v-btn><v-btn v-else color="primary" :loading="busy" @click="importDocument">Import vào Draft</v-btn></div></div></v-dialog>
  <v-dialog v-model="compareOpen" max-width="1000"><div class="new-doc-form"><h2>Đối chiếu nội dung</h2><div class="metadata-more-grid mt-6"><div><h3>Thay đổi của bạn</h3><pre class="diff-view">{{ body }}</pre></div><div><h3>Bản trên server</h3><pre class="diff-view">{{ serverBody }}</pre></div></div><div class="form-actions"><v-btn color="primary" @click="compareOpen = false">Đóng</v-btn></div></div></v-dialog>
</template>
