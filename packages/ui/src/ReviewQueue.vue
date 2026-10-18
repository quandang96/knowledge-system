<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { reviewLabels, type DraftRecord, type DocumentRecord, type PublishJob } from '../../schemas/src/index'
import { reviewColors } from './theme'
import { api, canPublish, currentProject, fail, notify, refreshDocuments, state } from './state'
const loading = ref(false); const pendingAction = ref(''); const drafts = ref<DraftRecord[]>([]); const jobs = ref<PublishJob[]>([]); const selected = ref<string[]>([]); const busy = ref(false); const error = ref('')
const inspecting = ref<DraftRecord | null>(null); const previous = ref<DocumentRecord | null>(null); const reason = ref(''); const comment = ref(''); const statusFilter = ref('all')
const filtered = computed(() => drafts.value.filter(d => statusFilter.value === 'all' || d.review.status === statusFilter.value))
const visibleJobs = computed(() => jobs.value.filter(j => j.doc_ids.some(id => drafts.value.some(d => d.metadata.doc_id === id))))
const phaseLabels: Record<string, string> = { queued: 'Đang chờ', validating: 'Kiểm tra dữ liệu', building: 'Đang dựng bản phát hành', activating: 'Đang kích hoạt', completed: 'Hoàn tất', failed: 'Thất bại' }
let loadSequence = 0
function isPublished(doc: DraftRecord) { return state.documents.some(d => d.metadata.doc_id === doc.metadata.doc_id && d.metadata.verification?.source_revision === doc.revision) }
async function load() {
  const request = ++loadSequence; const project = state.project; error.value = ''; loading.value = true
  try {
    const [documents, progress] = await Promise.all([api<DraftRecord[]>(`/api/drafts?project_id=${encodeURIComponent(project)}`), api<PublishJob[]>('/api/publish-jobs')])
    if (request !== loadSequence || project !== state.project || disposed) return
    drafts.value = documents; jobs.value = progress; selected.value = selected.value.filter(id => documents.some(d => d.metadata.doc_id === id))
  } catch (e) { if (request === loadSequence && !disposed) error.value = (e as Error).message } finally { if(request === loadSequence) loading.value = false }
}
async function inspect(draft: DraftRecord) {
  inspecting.value = draft; previous.value = null; reason.value = ''
  try { previous.value = await api(`/api/documents/${draft.metadata.doc_id}`) } catch (e) { if ((e as {status?:number}).status !== 404) fail(e) }
}
async function decide(action: 'approve' | 'request_changes') {
  if (!inspecting.value) return
  if(busy.value) return; pendingAction.value = action; busy.value = true
  try { await api(`/api/documents/${inspecting.value.metadata.doc_id}/review`, { method: 'POST', body: JSON.stringify({ base_revision: inspecting.value.revision, action, reason: reason.value }) }); inspecting.value = null; await load(); notify(action === 'approve' ? 'Đã duyệt phiên bản được gửi.' : 'Đã gửi yêu cầu chỉnh sửa.') }
  catch (e) { fail(e) } finally { busy.value = false }
}
async function publish() {
  if(busy.value) return; pendingAction.value = 'publish'; busy.value = true
  try {
    const documents = selected.value.map(id => ({ doc_id: id, base_revision: drafts.value.find(d => d.metadata.doc_id === id)!.revision }))
    await api('/api/publish-jobs', { method: 'POST', body: JSON.stringify({ documents, comment: comment.value }) })
    selected.value = []; comment.value = ''; await load(); notify('Đã tạo đợt xuất bản. Theo dõi tiến trình bên dưới.')
  } catch (e) { fail(e) } finally { busy.value = false }
}
let interval: ReturnType<typeof setInterval>; let polling = false; let disposed = false
watch(() => state.project, () => { selected.value = []; inspecting.value = null; drafts.value=[]; void load() })
onMounted(async () => {
  await load()
  interval = setInterval(async () => {
    if (polling || !jobs.value.some(j => !['completed','failed'].includes(j.status))) return
    polling = true
    try { const fresh = await api<PublishJob[]>('/api/publish-jobs'); if (disposed) return; const completed = fresh.some(j => j.status === 'completed' && jobs.value.find(old => old.id === j.id)?.status !== 'completed'); jobs.value = fresh; if (completed) { await refreshDocuments(); await load() } }
    catch (e) { if (!disposed) fail(e) } finally { polling = false }
  }, 2000)
})
onUnmounted(() => { disposed = true; ++loadSequence; clearInterval(interval) })
</script>
<template>
  <header class="page-heading"><div><span class="eyebrow">{{ currentProject?.name }}</span><h1>Duyệt và xuất bản</h1><p>Đối chiếu thay đổi, xác nhận nội dung và phát hành các tài liệu liên quan cùng lúc.</p></div><v-btn variant="outlined" prepend-icon="mdi-refresh" @click="load">Làm mới</v-btn></header>
  <v-skeleton-loader v-if="loading && !drafts.length" type="table" aria-label="Đang tải hàng đợi duyệt" /><v-progress-linear v-else-if="loading" indeterminate color="primary" /><v-alert v-if="error" type="error" variant="tonal" class="mb-6">{{ error }}</v-alert>
  <v-alert v-if="!currentProject?.require_review" type="info" variant="tonal" class="mb-6">Project đang cho phép xuất bản trực tiếp. Admin có thể bật yêu cầu duyệt trong Cấu hình không gian.</v-alert>
  <div class="review-toolbar"><v-select v-model="statusFilter" :items="[{title:'Mọi trạng thái',value:'all'}, ...Object.entries(reviewLabels).map(([value,title]) => ({title,value}))]" label="Trạng thái" hide-details /><span class="field-help">{{ drafts.length }} bản nháp dùng chung</span></div>
  <div class="panel catalog-table"><table><thead><tr><th v-if="canPublish">Chọn</th><th>Tài liệu</th><th>Trạng thái</th><th>Người gửi</th><th>Thao tác</th></tr></thead><tbody><tr v-for="draft in filtered" :key="draft.metadata.doc_id" :aria-selected="selected.includes(draft.metadata.doc_id)"><td v-if="canPublish"><v-checkbox v-model="selected" :value="draft.metadata.doc_id" :disabled="currentProject?.require_review && draft.review.status !== 'approved'" :aria-label="`Chọn ${draft.metadata.title}`" hide-details density="compact" /></td><td><a :href="`/studio/?doc=${draft.metadata.doc_id}`"><strong>{{ draft.metadata.title }}</strong><small>{{ draft.metadata.doc_id }}</small></a></td><td><v-chip :color="reviewColors[draft.review.status]" variant="tonal">{{ reviewLabels[draft.review.status] }}{{ isPublished(draft) ? ' · Đã phát hành' : '' }}</v-chip></td><td>{{ draft.review.submitted_by || '—' }}</td><td><v-btn variant="text" size="small" @click="inspect(draft)">Đối chiếu</v-btn></td></tr></tbody></table><div v-if="!loading && !filtered.length" class="empty-state"><h2>Không có bản nháp ở trạng thái này</h2><p>Gửi tài liệu từ Studio để bắt đầu duyệt.</p><v-btn href="/studio/" color="primary" variant="tonal">Mở Studio</v-btn></div></div>
  <section v-if="canPublish" class="publish-selection panel"><div><h2>{{ selected.length }} tài liệu trong đợt xuất bản</h2><p class="field-help">Các tham chiếu được kiểm tra trên toàn bộ nhóm. Nếu có lỗi, bản đang phục vụ được giữ nguyên.</p></div><v-text-field v-model="comment" label="Lý do thay đổi" maxlength="200" hide-details /><v-btn color="primary" :loading="busy && pendingAction==='publish'" :disabled="!selected.length || busy" @click="publish">Xuất bản nhóm</v-btn></section>
  <section class="panel mt-8"><div class="section-heading"><h2>Tiến trình xuất bản</h2><span>{{ visibleJobs.length }} đợt gần đây</span></div><p v-if="!visibleJobs.length" class="field-help">Các đợt xuất bản của project sẽ xuất hiện tại đây.</p><article v-for="job in visibleJobs" :key="job.id" class="job-row"><div><strong>{{ job.doc_ids.join(', ') }}</strong><small>Đợt {{ job.id.slice(0,8) }} · {{ job.user }} · {{ new Date(job.created_at).toLocaleString('vi-VN') }}</small><p v-if="job.error" class="text-error">{{ job.error }}</p></div><v-chip :color="job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : 'primary'" variant="tonal">{{ phaseLabels[job.status] }}</v-chip></article></section>
  <v-dialog :model-value="!!inspecting" max-width="1100" @update:model-value="v => { if (!v) inspecting = null }"><section v-if="inspecting" class="new-doc-form review-dialog"><h2>{{ inspecting.metadata.title }}</h2><p class="field-help mt-2">{{ inspecting.metadata.doc_id }} · {{ reviewLabels[inspecting.review.status] }} · Người gửi: {{ inspecting.review.submitted_by || '—' }}</p><p class="mt-4">{{ inspecting.metadata.summary }}</p><div class="review-compare mt-6"><div><h3>Bản đã xuất bản</h3><pre class="diff-view">{{ previous?.body || 'Chưa có bản đã xuất bản.' }}</pre></div><div><h3>Bản gửi duyệt</h3><pre class="diff-view">{{ inspecting.body }}</pre></div></div><details class="mt-4"><summary>Metadata và sơ đồ của bản gửi duyệt</summary><pre class="diff-view">{{ JSON.stringify({metadata:inspecting.metadata,graphs:inspecting.graphs},null,2) }}</pre></details><ul class="review-checklist"><li v-for="item in inspecting.checklist" :key="item.key"><v-icon :icon="item.passed ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline'" :color="item.passed ? 'success' : 'warning'" size="18" />{{ item.label }}</li></ul><v-textarea v-if="canPublish" v-model="reason" label="Nhận xét / nội dung cần chỉnh sửa" rows="2" /><div class="form-actions"><v-btn variant="text" @click="inspecting = null">Đóng</v-btn><template v-if="canPublish && inspecting.review.status === 'in_review'"><v-btn variant="outlined" :loading="busy && pendingAction==='request_changes'" :disabled="busy" @click="decide('request_changes')">Yêu cầu sửa</v-btn><v-btn color="primary" :loading="busy && pendingAction==='approve'" :disabled="busy" @click="decide('approve')">Duyệt phiên bản này</v-btn></template></div></section></v-dialog>
</template>
