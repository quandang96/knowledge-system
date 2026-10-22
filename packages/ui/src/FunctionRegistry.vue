<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import { type CatalogResult, type DocumentRecord, type DocumentSummary, type DraftRecord } from '../../schemas/src/index'
import { functionConventionBody } from '../../schemas/src/function-convention'
import { api, ApiError, assetUrl, canEdit, canManage, changeProject, currentProject, fail, notify, projectDocuments, state } from './state'
import { dateLabel } from './state'
import { useDelayedBusy } from './async-state'
import { openCreate, rememberCreated } from './create-document'
import { useRouter } from 'vitepress'
import ManagedContent from './ManagedContent.vue'
import { mermaidPlaceholder } from './mermaid-theme'
const router = useRouter()
const query = ref(''); const moduleId = ref(''); const screenId = ref(''); const grouped = ref(true); const page = ref(1)
const result = ref<CatalogResult>({ items: [], total: 0, page: 1, page_size: 25, facets: { modules: [], tags: [], roles: [] } })
const busy = ref(false); const error = ref(''); const showBusy = useDelayedBusy(busy)
const convention = ref<DocumentRecord>(); const conventionBusy = ref(false); const conventionError = ref(''); const section = ref(0); const creating = ref(false)
const conventionId = computed(() => state.workspace?.function_convention_id || state.documents.find(doc => doc.metadata.type === 'reference' && doc.metadata.doc_id === 'REF-FUNCTION-ID-CONVENTION')?.metadata.doc_id || currentProject.value?.function_id_rules?.convention_id)
const supplementId = computed(() => currentProject.value?.function_id_rules?.convention_id)
const supplements = computed(() => state.documents.filter(doc => doc.metadata.type === 'reference' && doc.metadata.doc_id !== conventionId.value && doc.metadata.doc_id === supplementId.value))
const screens = computed(() => projectDocuments.value.filter(doc => doc.metadata.type === 'screen' && (!moduleId.value || doc.metadata.module === moduleId.value)))
const groups = computed(() => {
  if (!grouped.value) return [{ key: 'all', title: '', items: result.value.items }]
  const groups = new Map<string,{key:string;title:string;items:DocumentSummary[]}>()
  for (const item of result.value.items) {
    const screens = [...item.business?.screens || []].sort((a,b) => a.doc_id.localeCompare(b.doc_id))
    const key = screens.map(screen => screen.doc_id).join(',') || 'unlinked'
    if (!groups.has(key)) groups.set(key, {key,title:screens.map(screen => `${screen.doc_id} · ${screen.title}`).join(' / ') || 'Chưa liên kết Screen',items:[]})
    groups.get(key)!.items.push(item)
  }
  return [...groups.values()]
})
const parser = new MarkdownIt({html:false,linkify:false})
const originalFence=parser.renderer.rules.fence!
parser.renderer.rules.fence=(tokens,index,options,env,self)=>tokens[index].info.trim()==='mermaid'?mermaidPlaceholder(tokens[index].content):originalFence(tokens,index,options,env,self)
parser.renderer.rules.image = (tokens,index,options,_env,self) => { const token=tokens[index];if(convention.value)token.attrSet('src',assetUrl(convention.value,token.attrGet('src')||''));return self.renderToken(tokens,index,options) }
const sections = computed(() => {
  const tokens = parser.parse(convention.value?.body || '', {})
  const starts = tokens.map((token,index) => token.type === 'heading_open' && token.tag === 'h2' ? index : -1).filter(index => index >= 0)
  return starts.map((start,index) => ({title:tokens[start+1].content,html:parser.renderer.render(tokens.slice(start,starts[index+1] ?? tokens.length),parser.options,{})}))
})
let controller: AbortController | undefined; let conventionController: AbortController | undefined; let timer: ReturnType<typeof setTimeout> | undefined
async function load() {
  clearTimeout(timer);controller?.abort();const abort=new AbortController();controller=abort;busy.value=true;error.value=''
  const params=new URLSearchParams({project_id:state.project,type:'function',q:query.value,module:moduleId.value,screen_id:screenId.value,page:String(page.value),page_size:'25',sort:'title'})
  try { const data=await api<CatalogResult>(`/api/catalog?${params}`,{signal:abort.signal});if(!abort.signal.aborted)result.value=data }
  catch(failure) {if(!abort.signal.aborted)error.value=(failure as Error).message} finally {if(!abort.signal.aborted)busy.value=false}
}
async function loadConvention() {
  conventionController?.abort();const abort=new AbortController();conventionController=abort;convention.value=undefined;conventionError.value='';section.value=0
  if(!conventionId.value){conventionBusy.value=false;return}
  conventionBusy.value=true
  try {const doc=await api<DocumentRecord>(`/api/documents/${conventionId.value}`,{signal:abort.signal});if(!abort.signal.aborted&&doc.metadata.type==='reference')convention.value=doc}
  catch(failure){if(!abort.signal.aborted)conventionError.value=(failure as Error).message} finally {if(!abort.signal.aborted)conventionBusy.value=false}
}
async function createConvention() {
  if(!state.project || !currentProject.value?.modules.length)return;creating.value=true;conventionError.value=''
  try {
    let doc:DocumentRecord
    try{doc=await api<DocumentRecord>('/api/documents/REF-FUNCTION-ID-CONVENTION/draft')}
    catch(failure){if(!(failure instanceof ApiError)||failure.status!==404)throw failure;doc=await api<DocumentRecord>('/api/documents',{method:'POST',body:JSON.stringify({metadata:{doc_id:'REF-FUNCTION-ID-CONVENTION',project_id:state.project,module:currentProject.value.modules[0].id,type:'reference',title:'Quy ước Function ID',owner:state.session?.user,summary:'Cấu trúc mã nghiệp vụ ổn định, bảng mã và quy trình cấp Function ID.'},body:functionConventionBody})})}
    // Open Studio in place with the draft preloaded instead of reloading the whole app.
    notify(`Đã chuẩn bị bản nháp ${doc.metadata.doc_id}.`); rememberCreated(doc as DraftRecord); await router.go(`/studio/?doc=${doc.metadata.doc_id}`)
  } catch(failure){fail(failure)} finally {creating.value=false}
}
function schedule(delay=0){clearTimeout(timer);controller?.abort();busy.value=true;timer=setTimeout(load,delay)}
watch(query,()=>{page.value=1;schedule(180)},{flush:'sync'})
watch([moduleId,screenId],()=>{if(screenId.value&&!screens.value.some(doc=>doc.metadata.doc_id===screenId.value))screenId.value='';page.value=1;schedule()},{flush:'sync'})
watch(page,()=>schedule(),{flush:'sync'})
watch(()=>state.project,()=>{controller?.abort();result.value.items=[];result.value.total=0;moduleId.value='';screenId.value='';page.value=1;void load()},{flush:'sync'})
watch(conventionId,loadConvention)
onMounted(()=>{void load();void loadConvention()})
onUnmounted(()=>{controller?.abort();conventionController?.abort();clearTimeout(timer)})
</script>
<template>
  <header class="page-heading"><div><span class="eyebrow">{{ currentProject?.name || 'Kho tri thức' }}</span><h1>Function ID &amp; Quy ước</h1><p>Một mã nghiệp vụ, một tài liệu nguồn, các màn hình cùng thực hiện.</p></div><v-btn v-if="canEdit && state.project" color="primary" prepend-icon="mdi-plus" @click="openCreate('function')">Tạo chức năng</v-btn></header>
  <section class="convention-panel" aria-label="Quy ước Function ID">
    <header class="section-heading"><div><span class="eyebrow">Tài liệu quy ước</span><h2>{{ convention?.metadata.title || 'Quy ước Function ID' }}</h2><p v-if="convention" class="field-help">v{{ convention.metadata.version }} · {{ convention.metadata.owner }} · {{ dateLabel(convention.metadata.updated_at) }}<span v-if="convention.metadata.effective_from"> · Hiệu lực {{ dateLabel(convention.metadata.effective_from) }}</span> · Đã xuất bản</p></div><div v-if="convention" class="studio-actions"><v-btn variant="text" :href="convention.url">Mở tài liệu quy ước</v-btn><v-btn v-if="canEdit" variant="text" :href="`/studio/?doc=${convention.metadata.doc_id}`">Sửa tài liệu quy ước</v-btn></div></header>
    <v-skeleton-loader v-if="conventionBusy" type="paragraph" />
    <v-alert v-if="conventionError" type="warning" variant="tonal">{{ conventionError }}<v-btn variant="text" @click="loadConvention">Thử lại</v-btn><v-btn v-if="canEdit" variant="text" href="/studio/?doc=REF-FUNCTION-ID-CONVENTION">Mở bản nháp quy ước</v-btn></v-alert>
    <template v-if="convention"><v-tabs v-model="section" color="primary" aria-label="Nội dung quy ước"><v-tab v-for="(item,index) in sections" :key="index" :value="index">{{ item.title }}</v-tab></v-tabs><ManagedContent v-if="sections[section]" class="prose convention-content" :html="sections[section].html" /></template>
    <div v-else-if="!conventionBusy && !conventionError" class="convention-empty"><p>Chưa chọn tài liệu quy ước đã xuất bản. Function ID cũ vẫn được tra cứu; mã mới chỉ được cấp từ bảng mã đã xác nhận.</p><div class="studio-actions mt-4"><v-btn v-if="canEdit" variant="tonal" color="primary" :loading="creating" :disabled="!currentProject?.modules.length" @click="createConvention">Chuẩn bị bản nháp quy ước</v-btn><v-btn v-if="canManage" variant="text" href="/settings/workspace/">Chọn tài liệu chuẩn</v-btn></div></div>
    <p v-for="doc in supplements" :key="doc.metadata.doc_id" class="field-help mt-4">Bổ sung cho {{ currentProject?.name }}: <a :href="doc.url" class="text-link">{{ doc.metadata.title }}</a></p>
  </section>
  <section class="function-registry" aria-label="Function Registry">
    <div class="section-heading"><div><span class="eyebrow">Registry từ tài liệu đã xuất bản</span><h2>Danh sách chức năng <span class="result-count">{{ result.total }}</span></h2></div><v-switch v-model="grouped" label="Nhóm theo màn hình" hide-details density="compact" color="primary" /></div>
    <div class="registry-filters"><v-text-field v-model="query" label="Function ID / tên chức năng / Screen ID" prepend-inner-icon="mdi-magnify" hide-details /><v-select :model-value="state.project" :items="state.workspace?.projects || []" item-title="name" item-value="id" label="Project" hide-details @update:model-value="changeProject" /><v-select v-model="moduleId" :items="[{id:'',name:'Mọi phân hệ'},...currentProject?.modules || []]" item-title="name" item-value="id" label="Module" hide-details /><v-select v-model="screenId" :items="[{id:'',name:'Mọi màn hình'},...screens.map(doc=>({id:doc.metadata.doc_id,name:`${doc.metadata.doc_id} · ${doc.metadata.title}`}))]" item-title="name" item-value="id" label="Screen" hide-details /></div>
    <v-alert v-if="error" type="error" variant="tonal" class="my-4">{{ error }}<v-btn variant="text" @click="load">Thử lại</v-btn></v-alert>
    <div class="catalog-content" :aria-busy="busy"><v-progress-linear v-if="showBusy" class="catalog-progress" indeterminate color="primary" /><div v-if="busy && !result.items.length" class="catalog-loading" role="status" aria-label="Đang tải Function Registry"><v-skeleton-loader v-if="showBusy" type="table" /></div>
      <template v-else><section v-for="group in groups" :key="group.key" class="registry-group"><h3 v-if="group.title" class="registry-group-title">{{ group.title }}</h3><div class="catalog-table"><table><thead><tr><th>Function ID</th><th>Tên chức năng</th><th>Screen liên kết</th><th>Module</th><th>Trạng thái</th><th>Document</th></tr></thead><tbody><tr v-for="doc in group.items" :key="doc.metadata.doc_id"><td><a :href="doc.url" class="document-key semantic-function-text">{{ doc.metadata.function_code || doc.metadata.doc_id }}</a><small v-if="doc.metadata.function_code" class="table-key-secondary">{{ doc.metadata.doc_id }}</small></td><td><a :href="doc.url">{{ doc.metadata.title }}</a></td><td><a v-for="screen in doc.business?.screens || []" :key="screen.doc_id" :href="screen.url" class="table-screen-link">{{ screen.doc_id }}</a><span v-if="!doc.business?.screens.length" class="field-help">Chưa liên kết Screen</span></td><td>{{ currentProject?.modules.find(item=>item.id===doc.metadata.module)?.name || doc.metadata.module }}</td><td><v-chip color="success" variant="tonal">Đã xuất bản</v-chip></td><td><a :href="doc.url" class="text-link">Xem document <v-icon icon="mdi-arrow-top-right" size="18" /></a></td></tr></tbody></table></div></section><div v-if="!result.items.length && !error" class="empty-state"><h3>Chưa có chức năng phù hợp</h3><p>Thử mã, tên hoặc màn hình khác. Chức năng xuất hiện tại đây sau khi được xuất bản.</p></div></template>
    </div><v-pagination v-if="result.total>25" v-model="page" :length="Math.ceil(result.total/25)" :total-visible="5" />
  </section>
</template>
