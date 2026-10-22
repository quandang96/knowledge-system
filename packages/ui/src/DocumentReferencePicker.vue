<script setup lang="ts">
import { iconGroup } from './theme'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { types, typeLabels, typeIcons, type ReferenceCandidate, type ReferenceResults, type Metadata } from '../../schemas/src/index'
import { api, canEdit, fail, notify, state } from './state'
const open = defineModel<boolean>({default:false})
const props = withDefaults(defineProps<{sourceId:string;projectId:string;excludeIds?:string[];allowedTypes?:string[];multiple?:boolean;title?:string}>(), {multiple:true,title:'Liên kết tài liệu',excludeIds:()=>[],allowedTypes:()=>[]})
const emit = defineEmits<{select:[documents:ReferenceCandidate[]]}>()
const query=ref('');const moduleId=ref('');const type=ref('');const advanced=ref(false);const page=ref(1)
const result=ref<ReferenceResults>({items:[],total:0,page:1,page_size:20});const selected=ref<ReferenceCandidate[]>([])
const busy=ref(false);const error=ref('');const activeIndex=ref(0);const search=ref<{focus:()=>void}>()
const creating=ref(false);const createBusy=ref(false);const newTitle=ref('');const newType=ref<Metadata['type']>('reference');const newModule=ref('')
let controller:AbortController|undefined;let timer:ReturnType<typeof setTimeout>;let generation=0
const project=computed(()=>state.workspace?.projects.find(item=>item.id===props.projectId))
const typeItems=computed(()=>types.filter(value=>!props.allowedTypes.length||props.allowedTypes.includes(value)).map(value=>({title:typeLabels[value],value})))
const visible=computed(()=>result.value.items.filter(item=>!props.excludeIds.includes(item.metadata.doc_id)))
const picked=(id:string)=>selected.value.some(item=>item.metadata.doc_id===id)
async function load(){
  controller?.abort();const abort=new AbortController();controller=abort;const request=++generation;busy.value=true;error.value=''
  const params=new URLSearchParams({source_id:props.sourceId,project_id:props.projectId,q:query.value,page:String(page.value),page_size:'20'})
  if(moduleId.value)params.set('module',moduleId.value);if(type.value)params.set('type',type.value)
  try{const data=await api<ReferenceResults>(`/api/knowledge/references?${params}`,{signal:abort.signal});if(request===generation&&open.value){result.value=data;activeIndex.value=0}}
  catch(e){if(!abort.signal.aborted&&request===generation)error.value=(e as Error).message}finally{if(request===generation)busy.value=false}
}
function schedule(){if(!open.value)return;clearTimeout(timer);controller?.abort();++generation;busy.value=true;timer=setTimeout(load,180)}
watch([query,moduleId,type],()=>{page.value=1;activeIndex.value=0;schedule()});watch(page,schedule)
watch(open,async value=>{
  clearTimeout(timer);controller?.abort();++generation;if(!value){busy.value=false;return}
  selected.value=[];query.value='';moduleId.value='';type.value=props.allowedTypes.length===1?props.allowedTypes[0]:'';page.value=1;result.value={items:[],total:0,page:1,page_size:20};creating.value=false;error.value=''
  await nextTick();search.value?.focus();clearTimeout(timer);void load()
})
function toggle(item:ReferenceCandidate){if(busy.value)return;if(picked(item.metadata.doc_id))selected.value=selected.value.filter(doc=>doc.metadata.doc_id!==item.metadata.doc_id);else selected.value=props.multiple?[...selected.value,item]:[item]}
function move(offset:number){if(busy.value)return;if(visible.value.length)activeIndex.value=(activeIndex.value+offset+visible.value.length)%visible.value.length;document.getElementById(`reference-result-${activeIndex.value}`)?.scrollIntoView({block:'nearest'})}
function confirm(){if(!selected.value.length)return;emit('select',selected.value);open.value=false}
function shortcut(event:KeyboardEvent){if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();event.stopPropagation();search.value?.focus()}}
function showCreate(){newTitle.value=query.value;newModule.value=moduleId.value||project.value?.modules[0]?.id||'';newType.value=(type.value||props.allowedTypes[0]||'reference') as Metadata['type'];creating.value=true}
async function create(){
  if(!newTitle.value.trim()||!newModule.value)return;createBusy.value=true;error.value=''
  try{const doc=await api<ReferenceCandidate>('/api/documents/new',{method:'POST',body:JSON.stringify({metadata:{project_id:props.projectId,module:newModule.value,type:newType.value,title:newTitle.value.trim(),owner:state.session?.user||'Editor'}})});emit('select',[{...doc,excerpt:doc.metadata.summary,graph_count:0,publication:'draft'}]);open.value=false;notify(`Đã tạo bản nháp ${doc.metadata.doc_id} và thêm vào liên kết.`)}
  catch(e){fail(e)}finally{createBusy.value=false}
}
onUnmounted(()=>{clearTimeout(timer);controller?.abort()})
</script>
<template>
  <v-dialog v-model="open" max-width="820" :persistent="createBusy"><section class="reference-picker" aria-labelledby="reference-picker-title" @keydown="shortcut">
    <header class="reference-picker-heading"><div><span class="eyebrow">{{ project?.name||projectId }}</span><h2 id="reference-picker-title">{{ title }}</h2></div><v-btn icon="mdi-close" variant="text" aria-label="Đóng bộ chọn tài liệu" :disabled="createBusy" @click="open=false" /></header>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}<v-btn variant="text" @click="load">Thử lại</v-btn></v-alert>
    <form v-if="creating" @submit.prevent="create"><h3 class="mb-4">Tạo tài liệu mới và liên kết</h3><v-text-field v-model="newTitle" label="Tiêu đề tài liệu mới" required /><v-select v-model="newModule" :items="project?.modules||[]" item-title="name" item-value="id" label="Phân hệ" required /><v-select v-model="newType" :items="typeItems" label="Loại tài liệu" /><p class="field-help">Tài liệu được tạo ở trạng thái bản nháp. Hoàn thiện nội dung trước khi gửi duyệt.</p><div class="form-actions"><v-btn variant="text" :disabled="createBusy" @click="creating=false">Quay lại</v-btn><v-btn type="submit" color="primary" :loading="createBusy">Tạo và liên kết</v-btn></div></form>
    <template v-else>
      <v-text-field ref="search" v-model="query" :loading="busy" variant="solo" flat prepend-inner-icon="mdi-magnify" placeholder="Tìm tài liệu theo tên hoặc mã…" aria-label="Tìm tài liệu để liên kết" role="combobox" aria-controls="reference-results" :aria-expanded="open" :aria-activedescendant="visible.length?`reference-result-${activeIndex}`:undefined" hide-details @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.enter.prevent="visible[activeIndex]&&toggle(visible[activeIndex])"><template #append-inner><kbd>Ctrl/Cmd K</kbd></template></v-text-field>
      <details class="reference-filters" :open="advanced" @toggle="advanced=($event.target as HTMLDetailsElement).open"><summary>Bộ lọc nâng cao · Cùng project</summary><div class="form-grid mt-4"><v-select :model-value="projectId" :items="[{title:project?.name||projectId,value:projectId}]" label="Project" readonly hide-details /><v-select v-model="moduleId" :items="[{id:'',name:'Mọi phân hệ'},...project?.modules||[]]" item-title="name" item-value="id" label="Phân hệ" hide-details /><v-select v-model="type" :items="allowedTypes.length===1?typeItems:[{title:'Mọi loại tài liệu',value:''},...typeItems]" label="Loại tài liệu" :readonly="allowedTypes.length===1" hide-details /></div></details>
      <div class="reference-result-status" role="status" aria-live="polite">{{ busy?'Đang tìm tài liệu…':`${result.total} kết quả · ${selected.length} đã chọn` }}</div><v-progress-linear v-if="busy" indeterminate color="primary" />
      <div id="reference-results" class="reference-results" role="listbox" :aria-multiselectable="multiple" :aria-busy="busy"><button v-for="(item,index) in visible" :id="`reference-result-${index}`" :key="item.metadata.doc_id" type="button" role="option" :aria-selected="picked(item.metadata.doc_id)" :disabled="busy" class="reference-result" :class="{'is-focused':index===activeIndex,'is-selected':picked(item.metadata.doc_id)}" @click="toggle(item)"><v-icon :icon="picked(item.metadata.doc_id)?'mdi-checkbox-marked-outline':typeIcons[item.metadata.type]" :class="['semantic-icon',`semantic-${iconGroup(item.metadata.type)}`]" /><span><strong>{{ item.metadata.title }}</strong><small><code>{{ item.metadata.doc_id }}</code><code v-if="item.metadata.function_code"> / {{ item.metadata.function_code }}</code> · {{ typeLabels[item.metadata.type] }} · {{ project?.name }} / {{ project?.modules.find(m=>m.id===item.metadata.module)?.name||item.metadata.module }}</small><span class="reference-preview">{{ item.metadata.summary||item.excerpt||'Chưa có mô tả ngắn.' }}</span></span><span class="reference-publication" :class="{'is-draft':item.publication==='draft'}">{{ item.publication==='published'?'Đã xuất bản':'Chưa xuất bản' }}</span></button></div>
      <div v-if="!busy&&!visible.length&&!error" class="reference-empty"><v-icon icon="mdi-file-search-outline" size="32" /><h3>Không có tài liệu phù hợp</h3><p class="field-help">Thử tên, mã hoặc phân hệ khác trong project này.</p><v-btn v-if="canEdit&&project?.modules.length" variant="tonal" color="primary" class="mt-4" @click="showCreate">Tạo tài liệu mới</v-btn></div>
      <v-pagination v-if="result.total>result.page_size" v-model="page" :length="Math.ceil(result.total/result.page_size)" :total-visible="4" density="compact" />
      <footer class="reference-picker-footer"><span class="field-help">↑ ↓ để di chuyển · Enter để chọn · Esc để đóng</span><div class="studio-actions"><v-btn variant="text" @click="open=false">Hủy</v-btn><v-btn color="primary" :disabled="!selected.length" @click="confirm">Thêm liên kết<span v-if="selected.length"> ({{ selected.length }})</span></v-btn></div></footer>
    </template>
  </section></v-dialog>
</template>
