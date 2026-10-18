<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { DocumentRecord } from '../../schemas/src/index'
import { api, canPublish, dateLabel, fail, notify, refreshDocuments, currentProject, changeProject, state } from './state'
interface Revision { revision:string; at:string; user:string; message:string }
const id = ref(''); const revisions = ref<Revision[]>([]); const drafts = ref<DocumentRecord[]>([]); const busy = ref(false); const diff = ref(''); const diffOpen = ref(false); const confirmation = ref<{ action:'restore'|'unpublish'; revision?:string; doc_id:string } | null>(null)
const candidates = computed(() => [...new Map([...state.documents,...drafts.value].map(d => [d.metadata.doc_id,d])).values()].filter(d => d.metadata.project_id === state.project).map(d => ({title:`${d.metadata.doc_id} · ${d.metadata.title}`,value:d.metadata.doc_id})))
const loading = ref(false); const loadError = ref(''); const diffBusy = ref(false); const diffIndex = ref(-1)
let loadSequence=0;let initializing=true
async function load() { const request=++loadSequence;const target=id.value;revisions.value=[];if(!target)return;loading.value=true;loadError.value='';try {const data=await api<Revision[]>(`/api/documents/${target}/history`);if(request===loadSequence && id.value===target)revisions.value=data}catch(e){if(request===loadSequence){loadError.value=(e as Error).message;fail(e)}}finally{if(request===loadSequence)loading.value=false} }
async function showDiff(index:number) { if(!revisions.value[index+1] || diffBusy.value) return; diffBusy.value=true; diffIndex.value=index; try { diff.value = await api(`/api/documents/${id.value}/diff?from=${revisions.value[index+1].revision}&to=${revisions.value[index].revision}`); diffOpen.value=true } catch(error) { fail(error) } finally {diffBusy.value=false;diffIndex.value=-1} }
async function confirm() {
  if(!confirmation.value || busy.value) return; busy.value=true
  try { const action=confirmation.value.action; const result=await api(`/api/documents/${confirmation.value.doc_id}/${action}`,{method:'POST',body:JSON.stringify(action === 'restore' ? {revision:confirmation.value.revision} : {})}); await refreshDocuments(); await load(); confirmation.value=null; notify(action === 'restore' ? result.status === 'draft' ? 'Đã khôi phục vào bản nháp. Gửi duyệt trước khi xuất bản lại.' : `Đã khôi phục bằng Git revision mới ${result.revision.slice(0,12)}.` : 'Đã gỡ tài liệu khỏi website, search và Knowledge API.') }
  catch(error) { fail(error) } finally { busy.value=false }
}
onMounted(async()=>{
  try {
    drafts.value=await api('/api/drafts')
    const requested=new URLSearchParams(window.location.search).get('doc')
    if(requested) {
      const doc=[...state.documents,...drafts.value].find(d=>d.metadata.doc_id===requested)
      if(doc) changeProject(doc.metadata.project_id)
      id.value=requested
    } else id.value=candidates.value[0]?.value || ''
    initializing=false;await load()
  } catch(e){fail(e)} finally {initializing=false}
})
watch(()=>state.project,()=>{if(initializing)return;confirmation.value=null;id.value=candidates.value[0]?.value||'';void load()},{flush:'sync'})
onUnmounted(()=>{++loadSequence})
</script>
<template><div class="breadcrumb-line"><a href="/">Knowledge Hub</a><v-icon icon="mdi-chevron-right" size="16" /><span>Lịch sử</span></div><header class="page-heading"><div><span class="eyebrow">MỖI CẬP NHẬT ĐỀU CÓ NGUỒN</span><h1>Lịch sử phiên bản</h1><p>Đối chiếu nội dung và khôi phục bằng một revision mới. Lịch sử Git được giữ nguyên.</p></div><v-btn v-if="canPublish && state.documents.some(d => d.metadata.doc_id === id)" variant="outlined" color="error" @click="confirmation={action:'unpublish',doc_id:id}">Gỡ xuất bản</v-btn></header><v-select v-model="id" :items="candidates" label="Tài liệu" style="max-width:650px" @update:model-value="load" /><v-skeleton-loader v-if="loading" type="list-item-three-line, list-item-three-line" aria-label="Đang tải lịch sử" /><v-alert v-if="loadError" type="error" variant="tonal">{{ loadError }}<v-btn variant="text" @click="load">Thử lại</v-btn></v-alert><div class="history-list" :aria-busy="loading"><article v-for="(revision,index) in revisions" :key="revision.revision" class="history-item"><span class="icon-box"><v-icon icon="mdi-source-commit" /></span><div><h3>{{ revision.message }}</h3><p>{{ revision.user }} · {{ dateLabel(revision.at) }}</p><code>{{ revision.revision }}</code></div><v-chip v-if="index===0" color="primary" variant="tonal">Mới nhất</v-chip><v-btn variant="text" size="small" :disabled="!revisions[index+1] || diffBusy" :loading="diffBusy && diffIndex===index" @click="showDiff(index)">Xem diff</v-btn><v-btn v-if="canPublish" variant="tonal" size="small" @click="confirmation={action:'restore',revision:revision.revision,doc_id:id}">Khôi phục</v-btn></article></div><div v-if="!loading && !loadError && !revisions.length" class="empty-state"><v-icon icon="mdi-history" size="48" /><h2>Chưa có lịch sử xuất bản</h2><p>Git revision được tạo khi tài liệu Published.</p></div><v-dialog v-model="diffOpen" max-width="1100"><div class="new-doc-form"><h2>Markdown diff</h2><pre class="diff-view mt-6">{{ diff || 'Không có thay đổi nội dung trong revision này.' }}</pre><div class="form-actions"><v-btn color="primary" @click="diffOpen=false">Đóng</v-btn></div></div></v-dialog><v-dialog :model-value="!!confirmation" max-width="520" @update:model-value="value => { if(!value) confirmation=null }"><div class="new-doc-form"><h2>{{ confirmation?.action==='restore' ? 'Khôi phục phiên bản?' : 'Gỡ xuất bản tài liệu?' }}</h2><p v-if="confirmation?.action==='restore'" class="mt-4">{{ currentProject?.require_review ? 'Nội dung, ảnh và sơ đồ được khôi phục vào bản nháp. Cần gửi duyệt trước khi xuất bản lại.' : 'Nội dung, ảnh và sơ đồ được khôi phục rồi xuất bản thành Git revision mới.' }}</p><p v-else class="mt-4">Tài liệu sẽ được gỡ khỏi site, search và Knowledge API. Nếu tài liệu khác còn tham chiếu ID này, hệ thống sẽ chặn thao tác.</p><div class="form-actions"><v-btn variant="text" @click="confirmation=null">Hủy</v-btn><v-btn color="primary" :loading="busy" @click="confirm">Xác nhận</v-btn></div></div></v-dialog></template>
