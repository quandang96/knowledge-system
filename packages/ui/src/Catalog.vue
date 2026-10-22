<script setup lang="ts">
import { useDelayedBusy } from './async-state'
import { iconGroup } from './theme'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { isActiveType, typeIcons, typeLabels, type CatalogResult } from '../../schemas/src/index'
import { openCreate } from './create-document'
import { api, assetUrl, canEdit, changeProject, currentProject, dateLabel, state } from './state'
const props = defineProps<{ type: string; title: string }>()
const query = ref(''); const module = ref(''); const tag = ref(''); const role = ref(''); const sort = ref('updated'); const mode = ref('table'); const page = ref(1); const busy = ref(false); const error = ref('')
const result = ref<CatalogResult>({items:[],total:0,page:1,page_size:24,facets:{modules:[],tags:[],roles:[]}})
const showBusy = useDelayedBusy(busy)
const pages = computed(() => Math.ceil(result.value.total / 24))
const moduleItems = computed(() => [{title:'Mọi phân hệ',value:''}, ...result.value.facets.modules.map(id => ({value:id,title:currentProject.value?.modules.find(m=>m.id===id)?.name || id}))])
let mounted = false; let timer: ReturnType<typeof setTimeout>; let controller: AbortController | undefined
async function load() {
  clearTimeout(timer)
  controller?.abort(); const abort=new AbortController(); controller=abort; busy.value=true; error.value=''
  const params=new URLSearchParams({project_id:state.project,q:query.value,type:props.type,module:module.value,tag:tag.value,role:role.value,sort:sort.value,page:String(page.value),page_size:'24'})
  window.history.replaceState(window.history.state,'',`${window.location.pathname}?${params}`)
  try { const data=await api<CatalogResult>(`/api/catalog?${params}`,{signal:abort.signal}); if(!abort.signal.aborted) result.value=data }
  catch(e) { if(!abort.signal.aborted) error.value=(e as Error).message } finally { if(!abort.signal.aborted) busy.value=false }
}
function schedule() { if(!mounted) return; clearTimeout(timer); timer=setTimeout(load,180) }
// Debounce filter controls only. Route/project changes must cancel the old request and
// start loading immediately; synchronous watchers keep resets from queuing a
// second request after load() has already cleared the debounce timer.
watch([query,module,tag,role,sort],()=>{page.value=1;schedule()},{flush:'sync'})
watch(page,schedule,{flush:'sync'})
watch(()=>props.type,()=>{result.value.items=[];result.value.total=0;query.value='';module.value='';tag.value='';role.value='';page.value=1;if(mounted)void load()},{flush:'sync'})
watch(()=>state.project,()=>{result.value.items=[];result.value.total=0;module.value='';tag.value='';role.value='';page.value=1;if(mounted)void load()},{flush:'sync'})
watch(mode,value=>{if(mounted) localStorage.setItem(`atlas:catalog:${state.session?.user}`,value)})
onMounted(()=>{
  const params=new URLSearchParams(window.location.search); query.value=params.get('q')||'';module.value=params.get('module')||'';tag.value=params.get('tag')||'';role.value=params.get('role')||'';sort.value=['updated','title','relevance'].includes(params.get('sort')||'')?params.get('sort')!:'updated';page.value=Math.max(1,Number(params.get('page'))||1)
  mode.value=props.type==='screen'?'table':localStorage.getItem(`atlas:catalog:${state.session?.user}`)||'table'; mounted=true;void load()
})
onUnmounted(()=>{clearTimeout(timer);controller?.abort()})
function clear() {query.value='';module.value='';tag.value='';role.value=''}
</script>
<template>
  <header class="page-heading"><div><span class="eyebrow">{{ currentProject?.name || 'Kho tri thức' }}</span><h1>{{ title }}</h1><p>Tra cứu nội dung đã xuất bản và kiểm tra nguồn nghiệp vụ.</p></div><v-btn v-if="canEdit && state.project" color="primary" prepend-icon="mdi-plus" @click="openCreate(isActiveType(type) ? type : undefined)">Tạo tài liệu</v-btn></header>
  <div class="catalog-toolbar"><v-text-field v-model="query" prepend-inner-icon="mdi-magnify" :placeholder="type==='screen'?'Tìm tên màn hình, Screen ID, Function ID…':'Tìm theo key, tên hoặc nội dung…'" :loading="showBusy" hide-details aria-label="Lọc tài liệu" /><v-select v-if="type==='screen'" :model-value="state.project" :items="state.workspace?.projects || []" item-title="name" item-value="id" hide-details label="Project" @update:model-value="changeProject" /><v-select v-model="module" :items="moduleItems" hide-details label="Phân hệ" /></div>
  <details class="catalog-advanced"><summary>Bộ lọc khác</summary><div class="form-grid mt-4"><v-select v-model="tag" :items="[{title:'Mọi nhãn',value:''},...result.facets.tags.map(value=>({title:value,value}))]" hide-details aria-label="Lọc nhãn" /><v-select v-if="type==='screen'" v-model="role" :items="[{title:'Mọi vai trò',value:''},...result.facets.roles.map(value=>({title:value,value}))]" hide-details aria-label="Lọc business role" /></div></details>
  <div class="catalog-results-bar"><p>{{ busy && !result.items.length ? 'Đang tải…' : `${result.total} tài liệu` }} <span class="status-dot"></span> Đã xuất bản</p><div><v-select v-model="sort" :items="[{title:'Mới cập nhật',value:'updated'},{title:'Tên A–Z',value:'title'},{title:'Phù hợp nhất',value:'relevance'}]" hide-details label="Sắp xếp" /><v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable"><v-btn value="table" icon="mdi-format-list-bulleted" aria-label="Dạng danh sách" /><v-btn value="cards" icon="mdi-view-grid-outline" aria-label="Dạng thẻ" /></v-btn-toggle></div></div>
  <v-alert v-if="error" type="error" variant="tonal" class="mb-6">{{ error }}<v-btn variant="text" @click="load">Thử lại</v-btn></v-alert>
  <div class="catalog-content" :aria-busy="busy">
  <v-progress-linear v-if="showBusy" class="catalog-progress" indeterminate color="primary" />
  <div v-if="busy && !result.items.length" class="catalog-loading" role="status" aria-label="Đang tải danh sách tài liệu"><v-skeleton-loader v-if="showBusy" :type="mode==='cards'?'image, article':'table'" /></div>
  <div v-else-if="mode==='cards'" class="catalog-grid" :aria-busy="busy"><a v-for="doc in result.items" :key="doc.metadata.doc_id" :href="doc.url" class="catalog-card"><div v-if="doc.cover" class="catalog-image"><img :src="assetUrl(doc,doc.cover)" :alt="doc.metadata.title" loading="lazy" /></div><div class="catalog-card-body"><div class="catalog-card-meta"><code>{{ doc.metadata.doc_id }}</code><v-chip size="small" variant="tonal">{{ typeLabels[doc.metadata.type] }}</v-chip></div><h2>{{ doc.metadata.title }}</h2><p>{{ doc.metadata.summary }}</p><div class="catalog-tags"><span>{{ currentProject?.modules.find(m=>m.id===doc.metadata.module)?.name || doc.metadata.module }}</span><span v-for="item in doc.metadata.tags" :key="item">{{ item }}</span></div><div class="catalog-card-foot"><span>{{ doc.metadata.owner }}</span><span>{{ dateLabel(doc.metadata.updated_at) }}</span></div></div></a></div>
  <div v-else-if="type==='screen'" class="panel catalog-table screen-catalog" :aria-busy="busy"><table><thead><tr><th>Screen ID</th><th>Tên màn hình</th><th>Module</th><th>Số chức năng</th><th>Cập nhật</th><th>Trạng thái</th></tr></thead><tbody><tr v-for="doc in result.items" :key="doc.metadata.doc_id"><td><a :href="doc.url" class="document-key semantic-screen-text">{{ doc.metadata.doc_id }}</a></td><td><a :href="doc.url" class="table-document"><span><strong>{{ doc.metadata.title }}</strong><small>{{ doc.metadata.summary }}</small></span></a></td><td>{{ currentProject?.modules.find(m=>m.id===doc.metadata.module)?.name || doc.metadata.module }}</td><td>{{ doc.business?.functions.length || 0 }}</td><td>{{ dateLabel(doc.metadata.updated_at) }}</td><td><v-chip color="success" variant="tonal">Đã xuất bản</v-chip></td></tr></tbody></table></div>
  <div v-else class="panel catalog-table" :aria-busy="busy"><table><thead><tr><th>Tài liệu</th><th>Phân hệ</th><th>Người phụ trách</th><th>Phiên bản</th><th>Cập nhật</th></tr></thead><tbody><tr v-for="doc in result.items" :key="doc.metadata.doc_id"><td><a :href="doc.url" class="table-document"><v-icon :icon="typeIcons[doc.metadata.type]" :class="['semantic-icon',`semantic-${iconGroup(doc.metadata.type)}`]" size="20" /><span><strong>{{ doc.metadata.title }}</strong><small>{{ doc.metadata.function_code || doc.metadata.doc_id }} · {{ typeLabels[doc.metadata.type] }}</small></span></a></td><td>{{ currentProject?.modules.find(m=>m.id===doc.metadata.module)?.name || doc.metadata.module }}</td><td>{{ doc.metadata.owner }}</td><td>{{ doc.metadata.version }}</td><td>{{ dateLabel(doc.metadata.updated_at) }}</td></tr></tbody></table></div>
  <div v-if="!busy && !result.items.length && !error" class="empty-state"><v-icon icon="mdi-file-search-outline" size="45" /><h2>Chưa có tài liệu phù hợp</h2><p>Thử từ khóa khác hoặc bỏ bớt bộ lọc.</p><v-btn variant="tonal" color="primary" @click="clear">Xóa bộ lọc</v-btn></div>
  </div><v-pagination v-if="pages>1" v-model="page" :length="pages" :total-visible="5" class="mt-6" />
</template>
