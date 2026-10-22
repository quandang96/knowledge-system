<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vitepress'
import MarkdownIt from 'markdown-it'
import { isActiveType, metadataSchema, types, typeLabels, reviewLabels, type Metadata, type DraftRecord, type PublishJob, type ReferenceCandidate } from '../../schemas/src/index'
import { documentRelations } from '../../schemas/src/relations'
import { api, ApiError, assetUrl, canPublish, download, fail, notify, refreshDocuments, currentProject, changeProject, state, type GuardDetail } from './state'
import { checkRoundTrip } from './markdown-editor'
import { reviewColors } from './theme'
import RichEditor from './RichEditor.vue'
import RelationEditor from './RelationEditor.vue'
import TypedRelationEditor from './TypedRelationEditor.vue'
import { relationFields } from './relation-fields'
import DocumentReferencePicker from './DocumentReferencePicker.vue'
import { mermaidPlaceholder } from './mermaid-theme'
import ManagedContent from './ManagedContent.vue'
import { imageAlt } from './markdown-media'
import DownloadButton from './DownloadButton.vue'
import { uploadImages, type UploadedImage } from './media'
import { mapSourcePosition } from './source-selection'
import { usePresence } from './presence'
import { findMention, markdownLink, mentionTrigger, textareaCaret, useMention } from './mention'
import MentionMenu from './MentionMenu.vue'
import { openCreate, takeCreated } from './create-document'
import { alertDialog, confirmDialog, confirmDiscard } from './dialog'
const router = useRouter()
const showDrafts = ref(false)
const drafts = ref<DraftRecord[]>([]); const active = ref<DraftRecord | null>(null)
const concurrentEditors = usePresence(computed(() => active.value?.metadata.doc_id))
const body = ref(''); const metadata = ref<Metadata | null>(null); const tab = ref('rich'); const dirty = ref(false); const busy = ref(false)
const conflict = ref(false); const serverBody = ref(''); const compareOpen = ref(false); const errorDetails = ref(''); const lastSaved = ref('')
const importOpen = ref(false); const importRaw = ref(''); const importWarnings = ref<string[]>([]); const importDuplicate = ref(false); const importMode = ref('new'); const importStep = ref(false)
const form = ref(newForm()); const importInput = ref<HTMLInputElement>(); const loadingDoc = ref(false)
const functionGroup=ref('');const functionKind=ref('')
const functionRules=computed(()=>currentProject.value?.function_id_rules)
const functionCodeRequest=()=>functionGroup.value&&functionKind.value?{group:functionGroup.value,kind:functionKind.value}:undefined
const sourceAssetInput=ref<HTMLInputElement>();const sourceUploadFailed=ref(false);let sourceUploadAnchor:{from:number;to:number}|undefined
watch(body,(value,previous)=>{if(sourceUploadAnchor)sourceUploadAnchor={from:mapSourcePosition(sourceUploadAnchor.from,previous,value),to:mapSourcePosition(sourceUploadAnchor.to,previous,value)}},{flush:'sync'})
function prepareSourceUpload(){const input=document.querySelector<HTMLTextAreaElement>('.markdown-textarea');sourceUploadAnchor={from:input?.selectionStart??body.value.length,to:input?.selectionEnd??body.value.length};sourceAssetInput.value?.click()}
async function uploadSource(files:File[]){
  if(!files.length){sourceUploadAnchor=undefined;return}
  uploadRetryFiles=files;sourceUploadFailed.value=false
  try{const images=await uploadImageFiles(files);const at=sourceUploadAnchor||{from:body.value.length,to:body.value.length};sourceUploadAnchor=undefined;const markdown=images.map(image=>`\n\n![Ảnh minh họa](${image.relative_path})\n\n`).join('');body.value=body.value.slice(0,at.from)+markdown+body.value.slice(at.to)}catch(error){sourceUploadFailed.value=true;uploadFailure.value=(error as Error).message;void offerUploadRetry(uploadFailure.value)}
}
const opening = ref(false); const loadingError = ref(''); const reviewReason = ref(''); let editVersion = 0; let openSequence = 0; let disposed = false;
const sourceReferenceOpen=ref(false);let sourceReferenceRange={from:0,to:0}
// Markdown Source gets the same inline @ suggestions as the rich editor, positioned at the caret.
const sourceMention = useMention(() => ({ sourceId: active.value?.metadata.doc_id || '', projectId: metadata.value?.project_id || '' }))
function trackSourceMention(event: Event) {
  const input = event.target as HTMLTextAreaElement
  const caret = input.selectionStart
  const match = metadata.value && input.selectionEnd === caret && document.activeElement === input ? findMention(input.value.slice(0, caret)) : null
  sourceMention.update(match && { query: match.query, at: match.start, caret }, () => textareaCaret(input, match!.start))
}
function caretKey(event: KeyboardEvent) { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) trackSourceMention(event) }
function sourceMentionKey(event: KeyboardEvent) {
  if (event.isComposing) return
  const result = sourceMention.key(event)
  if (!result) return
  event.preventDefault()
  if (result !== 'handled') void insertSourceMention(result)
}
async function insertSourceMention(item: ReferenceCandidate) {
  const { from, to } = sourceMention.state
  sourceMention.close()
  const link = `${markdownLink(item)} `
  body.value = body.value.slice(0, from) + link + body.value.slice(to)
  await nextTick()
  const input = document.querySelector<HTMLTextAreaElement>('.markdown-textarea')
  input?.focus()
  input?.setSelectionRange(from + link.length, from + link.length)
}
// The source toolbar button types "@" at the caret, so it opens the same inline suggestions.
async function startSourceMention() {
  const input = document.querySelector<HTMLTextAreaElement>('.markdown-textarea')
  if (!input) return
  const at = input.selectionStart; const end = input.selectionEnd
  const trigger = mentionTrigger(body.value.slice(Math.max(0, at - 1), at))
  body.value = body.value.slice(0, at) + trigger + body.value.slice(end)
  await nextTick()
  input.focus(); input.setSelectionRange(at + trigger.length, at + trigger.length)
  trackSourceMention({ target: input } as unknown as Event)
}
function openSourceFullSearch() { sourceReferenceRange = { from: sourceMention.state.from, to: sourceMention.state.to }; sourceMention.close(); sourceReferenceOpen.value = true }
function insertSourceReference(items:ReferenceCandidate[]){const links=items.map(markdownLink).join(' ');body.value=body.value.slice(0,sourceReferenceRange.from)+links+' '+body.value.slice(sourceReferenceRange.to);void loadDrafts()}
 const tagsText = ref(''); const sourceLinksText = ref(''); const fileBusy = ref(false)
const unsupported = ref(false)
const uploadProgress = ref<number | null>(null); const uploadFailure = ref(''); let uploadRetryFiles: File[] = []
const operation = ref('save'); const operationLabels: Record<string,string> = {save:'Đang lưu...',review:'Đang gửi duyệt…',publish:'Đang tạo đợt xuất bản…',import:'Đang import…'}
const publishJob = ref<PublishJob | null>(null); const publishTrackingError = ref(''); let publishTimer: ReturnType<typeof setTimeout> | undefined
const publishing = computed(() => !!publishJob.value && !['completed','failed'].includes(publishJob.value.status))
async function trackPublish() {
  if (!publishJob.value || disposed) return
  try { const job = await api<PublishJob>(`/api/publish-jobs/${publishJob.value.id}`); if(disposed) return; publishJob.value = job; publishTrackingError.value = ''; if(job.status === 'completed') { await refreshDocuments(); notify(`Đã xuất bản thành công · ${job.id.slice(0,8)}`) } else if(job.status === 'failed') notify(`Xuất bản thất bại: ${job.error || job.id}`, 'error') }
  catch(error) { if(!disposed) publishTrackingError.value = (error as Error).message }
  if (!disposed && publishing.value) publishTimer = setTimeout(() => void trackPublish(), 2000)
}
const focusedTypes=['screen','function','business-rule','reference']
const documentTypeItems = [...types].sort((a,b)=>(focusedTypes.includes(a)?focusedTypes.indexOf(a):99)-(focusedTypes.includes(b)?focusedTypes.indexOf(b):99)).map(entity => ({ title:typeLabels[entity], value:entity }))
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
  sourceUploadAnchor=undefined
  functionGroup.value='';functionKind.value=''
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
  if (dirty.value && !(await confirmDiscard('Bản nháp đang mở có thay đổi chưa lưu. Rời bản nháp này để mở tài liệu khác?'))) return
  const request = ++openSequence; opening.value = true; loadingError.value = ''
  try {
    const doc = published ? await api<DraftRecord>(`/api/documents/${id}/edit`, {method:'POST'}) : await api<DraftRecord>(`/api/documents/${id}/draft`)
    if(request !== openSequence || disposed) return
    if (state.project !== doc.metadata.project_id) { active.value = null; dirty.value = false; changeProject(doc.metadata.project_id) }
    apply(doc); await loadDrafts(); window.history.replaceState(window.history.state,'',`/studio/?doc=${id}`)
  } catch (error) { if(request === openSequence) { loadingError.value = (error as Error).message; fail(error) } }
  finally { if(request === openSequence) opening.value = false }
}
watch([body, metadata, tagsText, sourceLinksText,functionGroup,functionKind], () => { if (active.value && !loadingDoc.value) { editVersion++; dirty.value = true } }, { deep:true, flush:'sync' })
watch(tab, value => { if (value === 'rich' && unsupported.value) { tab.value = 'source'; notify('Một số block chưa hỗ trợ round-trip. Dùng Markdown Source để giữ nguyên nội dung.', 'warning') } })
async function save(manual = false) {
  if (!active.value || !metadata.value || busy.value || conflict.value || fileBusy.value) return false
  if(metadata.value.type==='function' && !metadata.value.function_code && !!functionGroup.value!==!!functionKind.value){notify('Chọn đủ nhóm nghiệp vụ và loại chức năng để cấp mã.','warning');return false}
  operation.value = 'save'; busy.value = true; errorDetails.value = ''
  const id = active.value.metadata.doc_id; const version = editVersion
  const meta: Metadata = JSON.parse(JSON.stringify(metadata.value))
  if (!meta.review_due_at) delete meta.review_due_at
  if (!meta.effective_from) delete meta.effective_from
  meta.related_ids = []
  meta.tags = tagsText.value.split(',').map(v => v.trim()).filter(Boolean)
  meta.source_links = sourceLinksText.value.split('\n').filter(v => v.trim()).map(line => { const at=line.indexOf('|'); return {label:line.slice(0,at).trim(),url:line.slice(at+1).trim()} })
  const payload = JSON.stringify({ metadata:meta, body:body.value, base_revision:active.value.revision, function_code_request:meta.type==='function'&&!meta.function_code?functionCodeRequest():undefined })
  try {
    const doc = await api<DraftRecord>(`/api/documents/${id}/draft`, {method:'PUT',body:payload})
    if(disposed || active.value?.metadata.doc_id !== id) return false
    active.value = doc
    if(doc.metadata.function_code && !metadata.value.function_code){loadingDoc.value=true;metadata.value.function_code=doc.metadata.function_code;functionGroup.value='';functionKind.value='';loadingDoc.value=false}
    // Acknowledging an older buffer must never replace newer typing or metadata.
    dirty.value = editVersion !== version
    lastSaved.value = new Date(doc.metadata.updated_at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'})
    try { unsupported.value = !checkRoundTrip(body.value).safe } catch { unsupported.value = true }
    if (unsupported.value) tab.value = 'source'
    await loadDrafts(); if (manual) notify('Đã lưu bản nháp.'); return !dirty.value
  } catch (error) { if (!disposed && active.value?.metadata.doc_id === id && error instanceof ApiError && error.status === 409) conflict.value = true; fail(error); return false }
  finally { busy.value = false }
}
// The review checklist is enforced by the server; here it only explains what is missing, at the moment it matters.
const missingChecklist = computed(() => active.value?.checklist.filter(item => !item.passed) ?? [])
async function submitReview() {
  if (!active.value || busy.value || (dirty.value && !await save())) return
  if (missingChecklist.value.length) { void alertDialog({ title: 'Chưa thể gửi duyệt', tone: 'warning', message: `Hoàn thiện các mục sau rồi gửi lại:\n${missingChecklist.value.map(item => `• ${item.label}`).join('\n')}` }); return }
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
    notify(`Đã tải ${assets.length} ảnh. Lưu bản nháp để giữ nội dung và chú thích.`)
    return assets
  } finally { fileBusy.value = false }
}
// A failed upload asks whether to try again (same files, same position) instead of leaving a banner.
async function offerUploadRetry(message: string) {
  const retry = await confirmDialog({ title: 'Không tải được ảnh', message, tone: 'error', confirmText: 'Thử tải lại', cancelText: 'Bỏ qua' })
  uploadFailure.value = ''
  if (retry) void uploadSource(uploadRetryFiles)
  else sourceUploadAnchor = undefined
}
// Gallery images from before inline insertion become ordinary content images (caption kept as title).
function moveGalleryIntoBody() {
  const screen = metadata.value?.screen
  if (!screen?.screenshot.gallery.length) return
  const quote = (value: string) => value.replace(/["\\]/g, '\\$&')
  const images = screen.screenshot.gallery
    .filter(image => !body.value.includes(`](${image.path}`))
    .map(image => `![${image.alt.replace(/[[\]\\]/g, '\\$&')}](${image.path}${image.caption ? ` "${quote(image.caption)}"` : ''})`)
  if (images.length) body.value = `${body.value.trimEnd()}\n\n## Ảnh bổ sung\n\n${images.join('\n\n')}\n`
  screen.screenshot.gallery = []
  notify('Đã chuyển ảnh Gallery vào cuối nội dung. Lưu bản nháp để giữ thay đổi.')
}
async function compare() { if (!active.value) return; try { serverBody.value = (await api<DraftRecord>(`/api/documents/${active.value.metadata.doc_id}/draft`)).body; compareOpen.value = true } catch(error) { fail(error) } }
function exportBuffer() { if (!active.value || !metadata.value) return; download(JSON.stringify({metadata:metadata.value,body:body.value,tags:tagsText.value,source_links:sourceLinksText.value},null,2), `${active.value.metadata.doc_id}-recovery.json`, 'application/json') }
async function reload() { if (!active.value || busy.value || fileBusy.value) return; if (dirty.value && !(await confirmDiscard('Tải lại sẽ bỏ các thay đổi chưa lưu và mở bản mới nhất trên máy chủ.'))) return; dirty.value = false; await open(active.value.metadata.doc_id) }
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value || busy.value || fileBusy.value) { event.preventDefault(); event.returnValue = '' } }
// Guard events are vetoed synchronously; the question is asked afterwards and the action repeated if accepted.
async function discardThenRetry(event: Event, message: string) { if (!(await confirmDiscard(message))) return; dirty.value = false; (event as CustomEvent<GuardDetail>).detail?.retry() }
// The shared create dialog asks before replacing work in progress, then hands the new draft back here.
function beforeCreate(event: Event) { if (busy.value || fileBusy.value) { event.preventDefault(); notify('Chờ thao tác hiện tại hoàn tất trước khi tạo tài liệu khác.', 'info') } else if (dirty.value) { event.preventDefault(); void discardThenRetry(event, 'Bản nháp đang mở có thay đổi chưa lưu. Bỏ thay đổi để tạo tài liệu khác?') } }
async function documentCreated(event: Event) { const doc = (event as CustomEvent<DraftRecord>).detail; if (doc.metadata.project_id !== state.project) return; event.preventDefault(); ++openSequence; dirty.value = false; apply(doc); window.history.replaceState(window.history.state,'',`/studio/?doc=${doc.metadata.doc_id}`); try { await loadDrafts() } catch (error) { fail(error) } }
function beforeProjectChange(event: Event) { if(busy.value || fileBusy.value) { event.preventDefault(); notify('Chờ lưu hoặc tải ảnh hoàn tất trước khi đổi project.', 'info') } else if(dirty.value) { event.preventDefault(); void discardThenRetry(event, 'Đổi project sẽ rời bản nháp đang có thay đổi chưa lưu.') } }
watch(() => state.project, async () => { if(opening.value) return; ++openSequence; active.value = null; metadata.value = null; dirty.value = false; try {await loadDrafts()} catch(error) {fail(error)} })
let interval: ReturnType<typeof setInterval>; let priorRouteHook: typeof router.onBeforeRouteChange
onMounted(async () => {
  window.addEventListener('beforeunload',beforeUnload); window.addEventListener('atlas:before-project-change',beforeProjectChange); window.addEventListener('atlas:before-create',beforeCreate); window.addEventListener('atlas:document-created',documentCreated)
  priorRouteHook = router.onBeforeRouteChange
  router.onBeforeRouteChange = async to => { if ((busy.value || fileBusy.value)) { notify('Chờ thao tác hiện tại hoàn tất trước khi rời trang.', 'info'); return false }; if (dirty.value && !(await confirmDiscard('Bản nháp có thay đổi chưa lưu. Rời trang biên tập?'))) return false; return priorRouteHook?.(to) }
  try { await loadDrafts(); const params = new URLSearchParams(window.location.search); const id = params.get('doc'); const type = params.get('new'); if (id) { const created = takeCreated(id); if (created) apply(created); else await open(id,true) } else if (type && isActiveType(type)) { window.history.replaceState(window.history.state,'','/studio/'); openCreate(type) } else if (drafts.value.length) apply(drafts.value[0]) }
  catch (error) { fail(error) }
  interval = setInterval(() => { if (dirty.value && !busy.value && !fileBusy.value && !conflict.value) void save() },15000)
})
onUnmounted(() => { disposed = true; clearTimeout(publishTimer); ++openSequence; window.removeEventListener('atlas:before-project-change',beforeProjectChange); window.removeEventListener('atlas:before-create',beforeCreate); window.removeEventListener('atlas:document-created',documentCreated); clearInterval(interval); window.removeEventListener('beforeunload',beforeUnload); router.onBeforeRouteChange = priorRouteHook })
</script>
<template>
  <input ref="sourceAssetInput" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden aria-label="Chọn ảnh chèn vào Markdown Source" @cancel="sourceUploadAnchor=undefined" @change="event => { uploadSource([...(event.target as HTMLInputElement).files || []]); (event.target as HTMLInputElement).value = '' }"><input ref="importInput" type="file" accept=".md,text/markdown" hidden @change="analyze"><div class="breadcrumb-line"><a href="/">Knowledge Hub</a><v-icon icon="mdi-chevron-right" size="16" /><span>Biên tập</span></div><header class="studio-heading"><div><span class="eyebrow">Đóng góp tri thức</span><h1>Biên tập tài liệu</h1></div><div class="studio-actions"><v-btn size="small" variant="text" prepend-icon="mdi-dock-left" :aria-expanded="showDrafts" @click="showDrafts = !showDrafts">{{ showDrafts ? 'Ẩn bản nháp' : 'Hiện bản nháp' }}</v-btn><v-btn size="small" variant="outlined" prepend-icon="mdi-upload-outline" :disabled="busy || fileBusy || opening" @click="importInput?.click()">Import Markdown</v-btn><v-btn size="small" color="primary" prepend-icon="mdi-plus" :disabled="busy || fileBusy || opening || !currentProject?.modules.length" @click="openCreate()">Tạo tài liệu</v-btn></div></header>
  <v-progress-linear v-if="opening" indeterminate color="primary" /><div class="studio-layout" :class="{'drafts-collapsed':!showDrafts}"><aside class="draft-sidebar"><span class="eyebrow">Bản nháp của nhóm · {{ drafts.length }}</span><button v-for="draft in drafts" :key="draft.metadata.doc_id" :disabled="busy || fileBusy || opening" class="draft-item" :class="{active:active?.metadata.doc_id === draft.metadata.doc_id}" @click="open(draft.metadata.doc_id)"><strong>{{ draft.metadata.title }}</strong><small>{{ draft.metadata.doc_id }}</small></button><p v-if="!drafts.length" class="empty-text">Tạo hoặc import tài liệu để bắt đầu.</p></aside>
    <section v-if="active && metadata" class="editor-panel"><div class="section-heading" style="padding:18px 23px;margin:0"><span><code>{{ active.metadata.doc_id }}</code> · Draft</span><div class="studio-actions"><span class="studio-status" role="status">{{ status }}</span><span v-if="concurrentEditors.length" class="studio-status" role="status"><v-icon icon="mdi-account-multiple-outline" size="16" /> {{ concurrentEditors.join(', ') }} cũng đang mở bản nháp này</span><DownloadButton :url="`/api/documents/${active.metadata.doc_id}/export.md?draft=true`" :filename="`${active.metadata.doc_id}.md`" icon-only label="Export Markdown đã lưu" /><v-btn size="small" variant="outlined" :disabled="busy || conflict || fileBusy" :loading="busy && operation === 'save'" @click="save(true)">Lưu bản nháp</v-btn><v-btn size="small" variant="tonal" color="primary" :disabled="busy || conflict || fileBusy || dirty || active.review.status === 'in_review' || active.review.status === 'approved'" :loading="busy && operation === 'review'" :title="missingChecklist.length ? `Còn ${missingChecklist.length} mục cần hoàn thiện trước khi gửi duyệt` : undefined" @click="submitReview">Gửi duyệt<span v-if="missingChecklist.length" class="checklist-badge" :aria-label="`còn ${missingChecklist.length} mục`">{{ missingChecklist.length }}</span></v-btn><v-btn v-if="canPublish" size="small" color="primary" :loading="busy && operation === 'publish'" :disabled="busy || publishing || conflict || fileBusy || (currentProject?.require_review && (active.review.status !== 'approved' || dirty))" @click="publish">Xuất bản</v-btn></div></div>
      <v-progress-linear v-if="busy" indeterminate color="primary" /><div class="review-inline"><v-chip size="small" :color="dirty ? 'info' : reviewColors[active.review.status]" variant="tonal">{{ dirty ? 'Có thay đổi chưa gửi' : reviewLabels[active.review.status] }}</v-chip><span v-if="active.review.reason">{{ active.review.reason }}</span><a href="/studio/reviews/" class="text-link">Duyệt và xuất bản</a></div><div class="editor-metadata"><v-text-field v-model="metadata.title" label="Tiêu đề tài liệu" /><v-text-field v-model="metadata.owner" label="Người phụ trách" /><v-text-field v-model="metadata.version" label="Phiên bản" /><v-text-field v-model="metadata.summary" label="Mô tả ngắn" class="full-width" /><template v-if="metadata.type==='function'"><v-text-field v-if="metadata.function_code" :model-value="metadata.function_code" label="Function ID ổn định" readonly /><template v-else-if="functionRules?.enabled"><v-select v-model="functionGroup" :items="functionRules.groups" item-title="name" item-value="code" label="Nhóm nghiệp vụ" clearable /><v-select v-model="functionKind" :items="functionRules.kinds" item-title="name" item-value="code" label="Loại chức năng" clearable /><p class="field-help full-width">Backend cấp Function ID khi lưu. Để trống để giữ ID legacy.</p></template></template></div><details class="metadata-more"><summary>Thông tin, liên kết và nguồn</summary><div class="metadata-more-grid"><v-text-field v-model="metadata.review_due_at" type="date" clearable label="Ngày cần rà soát" @click:clear="delete metadata.review_due_at" /><v-text-field v-model="metadata.effective_from" type="date" clearable label="Ngày hiệu lực" @click:clear="delete metadata.effective_from" /><v-text-field v-model="tagsText" label="Tags (phân cách bằng dấu phẩy)" /><v-select v-model="metadata.language" :items="['vi','ja','en']" label="Ngôn ngữ" /><v-select v-model="metadata.classification" :items="['internal','confidential','restricted']" label="Classification" /><v-text-field v-if="metadata.screen" v-model="metadata.screen.route" label="Route của màn hình nghiệp vụ" /><v-text-field v-if="metadata.screen" :model-value="metadata.screen.menu_path.join(' > ')" label="Menu path (phân cách bằng >)" @update:model-value="value => { if(metadata?.screen) metadata.screen.menu_path = value.split('>').map((v:string) => v.trim()).filter(Boolean) }" /><v-textarea v-model="sourceLinksText" label="Nguồn: tên | https://url (mỗi nguồn một dòng)" rows="2" /></div></details>
      <TypedRelationEditor v-for="field in relationFields(metadata?.type)" :key="`${active!.metadata.doc_id}:${field.kind}`" v-model="metadata!.relations" :field="field" :source-id="active!.metadata.doc_id" :project-id="metadata!.project_id" /><RelationEditor :key="active!.metadata.doc_id" v-model="metadata!.relations" :handled-kinds="relationFields(metadata?.type).map(field => field.kind)" :source-id="active!.metadata.doc_id" :project-id="metadata!.project_id" /><DocumentReferencePicker v-model="sourceReferenceOpen" :source-id="active!.metadata.doc_id" :project-id="metadata!.project_id" @select="insertSourceReference" /><div v-if="conflict" class="conflict-panel"><p>Bản nháp đã được lưu từ tab hoặc người dùng khác. Thay đổi của bạn đang được giữ trong editor.</p><v-btn size="small" variant="text" @click="compare">Đối chiếu</v-btn><v-btn size="small" variant="text" @click="exportBuffer">Export thay đổi</v-btn><v-btn size="small" variant="text" @click="reload">Tải lại bản mới</v-btn></div><v-alert v-if="unsupported" type="warning" variant="tonal" class="mx-6 mb-4" density="compact">Nội dung có cấu trúc chưa bảo đảm round-trip. Markdown Source giữ nguyên các block; rich editor tạm khóa.</v-alert><pre v-if="errorDetails" class="api-error-details mx-6">{{ errorDetails }}</pre>
      <section v-if="publishJob" class="upload-status" role="status"><p>Đợt {{ publishJob.id.slice(0,8) }} · {{ {queued:'Đang chờ',validating:'Đang kiểm tra dữ liệu',building:'Đang dựng bản phát hành',activating:'Đang kích hoạt',completed:'Hoàn tất',failed:'Thất bại'}[publishJob.status] }}</p><v-progress-linear v-if="publishing" indeterminate color="primary" /><p v-if="publishJob.error" class="text-error">{{ publishJob.error }}</p><p v-if="publishTrackingError" class="text-error">{{ publishTrackingError }}<v-btn variant="text" @click="trackPublish">Kiểm tra lại</v-btn></p><a href="/studio/reviews/" class="text-link">Xem tiến trình xuất bản</a></section><section v-if="fileBusy" class="upload-status" role="status"><p>{{ uploadProgress === 100 ? 'Đã gửi ảnh · Đang kiểm tra và lưu tại máy chủ…' : `Đang tải ảnh${uploadProgress === null ? '…' : ` · ${uploadProgress}%`}` }}</p><v-progress-linear :indeterminate="uploadProgress === null || uploadProgress === 100" :model-value="uploadProgress || 0" color="primary" /></section><v-tabs v-model="tab" color="primary" class="editor-tabs" :disabled="fileBusy"><v-tab value="rich" :disabled="unsupported">Soạn thảo</v-tab><v-tab value="source">Markdown Source</v-tab><v-tab value="preview">Xem trước</v-tab></v-tabs><RichEditor v-if="tab === 'rich'" :key="active!.metadata.doc_id" v-model="body" :doc-id="active!.metadata.doc_id" :project-id="metadata!.project_id" :image-layout="metadata!.image_layout || {}" @update:image-layout="metadata!.image_layout = $event" :assets="active!.assets" :uploading="fileBusy" :upload-images="uploadImageFiles" /><div v-else-if="tab === 'source'" class="editor-area"><v-btn variant="text" prepend-icon="mdi-image-plus-outline" :disabled="fileBusy" @click="prepareSourceUpload">Chèn ảnh tại con trỏ</v-btn><v-btn size="small" variant="text" color="primary" prepend-icon="mdi-at" @click="startSourceMention">Liên kết tài liệu</v-btn><textarea v-model="body" class="markdown-textarea" aria-label="Markdown Source" spellcheck="false" @input="trackSourceMention" @click="trackSourceMention" @keyup="caretKey" @keydown="sourceMentionKey" @blur="sourceMention.close()"></textarea><MentionMenu :state="sourceMention.state" @select="index => insertSourceMention(sourceMention.state.items[index])" @hover="index => (sourceMention.state.active = index)" @more="openSourceFullSearch" /></div><div v-else class="editor-area"><!-- HTML is produced only by markdown-it with html:false and safe URLs. -->
<!-- eslint-disable-next-line vue/no-v-html -->
<ManagedContent class="prose" :html="preview" :image-layout="metadata!.image_layout" /></div>
      <section v-if="gallery.length" class="gallery-legacy"><div class="section-heading"><div><h2>Ảnh bổ sung (cũ)</h2><p class="field-help">Tài liệu còn {{ gallery.length }} ảnh trong Gallery cũ. Ảnh giờ được chèn trực tiếp vào nội dung; chuyển chúng vào cuối nội dung để sửa chú thích và vị trí ở một chỗ.</p></div><v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-image-move" :disabled="busy || fileBusy || unsupported" @click="moveGalleryIntoBody">Chèn vào nội dung</v-btn></div><div class="gallery-legacy-thumbs"><img v-for="image in gallery" :key="image.path" :src="assetUrl(active!,image.path,true)" :alt="image.alt" :title="image.caption || image.alt"></div></section>
    </section><div v-else class="studio-empty"><v-icon icon="mdi-file-document-edit-outline" size="52" /><h2>Từ ý tưởng đến tri thức chung</h2><p>Tạo tài liệu mới hoặc import Markdown.<br>Nhóm biên tập cùng làm việc trên bản nháp; người đọc xem bản đã xuất bản.</p><v-btn v-if="currentProject?.modules.length" class="mt-6" color="primary" variant="tonal" @click="openCreate()">Tạo tài liệu đầu tiên</v-btn><v-btn v-else class="mt-6" color="primary" variant="tonal" href="/settings/workspace/">Thiết lập project và phân hệ</v-btn></div></div>
  
  <v-dialog v-model="importOpen" max-width="720"><div class="new-doc-form"><span class="eyebrow">Import Markdown</span><h2>{{ importStep ? 'Kiểm tra trước khi import' : 'Ánh xạ metadata' }}</h2><template v-if="!importStep"><v-alert v-if="importDuplicate" type="warning" variant="tonal" class="mb-4">ID đã tồn tại. Chọn cập nhật rõ ràng hoặc nhập một ID mới.</v-alert><v-radio-group v-if="importDuplicate" v-model="importMode" inline><v-radio label="Import với ID mới" value="new" /><v-radio label="Cập nhật Draft hiện tại" value="update" /></v-radio-group><div class="form-grid"><v-text-field v-model="form.doc_id" label="Document ID" /><v-select v-model="form.type" :items="documentTypeItems" label="Loại tài liệu" /><template v-if="form.type==='function' && functionRules?.enabled"><v-select v-model="functionGroup" :items="functionRules.groups" item-title="name" item-value="code" label="Nhóm nghiệp vụ" clearable /><v-select v-model="functionKind" :items="functionRules.kinds" item-title="name" item-value="code" label="Loại chức năng" clearable /><p class="field-help full-width">Chọn nhóm/loại để backend cấp mã theo quy ước đã xác nhận.</p></template><v-text-field v-model="form.title" label="Tiêu đề" class="full-width" /><v-text-field v-model="form.project_id" label="Project ID" /><v-text-field v-model="form.module" label="Module" /><v-text-field v-model="form.owner" label="Người phụ trách" /><v-select v-model="form.language" :items="['vi','ja','en']" label="Ngôn ngữ" /></div><p v-for="warning in importWarnings" :key="warning" class="relation-warning">{{ warning }}</p></template><template v-else><p>{{ form.doc_id }} · {{ form.title }} · {{ typeLabels[form.type] }}</p><pre class="import-preview">{{ importRaw }}</pre><p class="field-help">Relative assets cần upload vào Draft trước khi Publish.</p></template><div class="form-actions"><v-btn variant="text" @click="importOpen = false">Hủy</v-btn><v-btn v-if="importStep" variant="text" @click="importStep = false">Quay lại</v-btn><v-btn v-if="!importStep" color="primary" @click="importStep = true">Xem trước</v-btn><v-btn v-else color="primary" :loading="busy" @click="importDocument">Import vào Draft</v-btn></div></div></v-dialog>
  <v-dialog v-model="compareOpen" max-width="1000"><div class="new-doc-form"><h2>Đối chiếu nội dung</h2><div class="metadata-more-grid mt-6"><div><h3>Thay đổi của bạn</h3><pre class="diff-view">{{ body }}</pre></div><div><h3>Bản trên server</h3><pre class="diff-view">{{ serverBody }}</pre></div></div><div class="form-actions"><v-btn color="primary" @click="compareOpen = false">Đóng</v-btn></div></div></v-dialog>
</template>
