<script setup lang="ts">
import { relationKinds, relationLabels, typeLabels, type Metadata, type ReferenceCandidate, type ReferenceResults, type Connections } from '../../schemas/src/index'
import { computed, onUnmounted, ref, watch } from 'vue'
import { api, notify } from './state'
import DocumentReferencePicker from './DocumentReferencePicker.vue'
const relations = defineModel<Metadata['relations']>({default:()=>[]})
const props=defineProps<{sourceId:string;projectId:string}>()
const open=ref(false);const targets=ref<Record<string,ReferenceCandidate>>({});const incoming=ref<Connections['incoming']>([]);const error=ref('');const loading=ref(false)
const rows=computed(()=>relations.value||[]);const kindItems=relationKinds.map(value=>({value,title:relationLabels[value]}))
let controller:AbortController|undefined;let generation=0
async function resolve(){
  controller?.abort();controller=new AbortController();const signal=controller.signal;const request=++generation;loading.value=true;error.value=''
  try{
    const ids=[...new Set(rows.value.map(row=>row.target_id))];const found:ReferenceCandidate[]=[]
    for(let offset=0;offset<ids.length;offset+=50){const params=new URLSearchParams({source_id:props.sourceId,project_id:props.projectId,ids:ids.slice(offset,offset+50).join(','),page_size:'50'});const result=await api<ReferenceResults>(`/api/knowledge/references?${params}`,{signal});found.push(...result.items)}
    const connections=await api<Connections>(`/api/documents/${props.sourceId}/connections?draft=true`,{signal})
    if(request===generation){targets.value=Object.fromEntries(found.map(doc=>[doc.metadata.doc_id,doc]));incoming.value=connections.incoming}
  }catch(e){if(!signal.aborted)error.value=(e as Error).message}finally{if(request===generation)loading.value=false}
}
watch(()=>[props.sourceId,props.projectId,rows.value.map(row=>row.target_id).join(',')],resolve,{immediate:true})
function add(items:ReferenceCandidate[]){const next=[...rows.value];for(const item of items)if(item.metadata.doc_id!==props.sourceId&&!next.some(row=>row.target_id===item.metadata.doc_id&&row.kind==='related')){next.push({target_id:item.metadata.doc_id,kind:'related'});targets.value[item.metadata.doc_id]=item}relations.value=next}
function changeKind(index:number,kind:NonNullable<Metadata['relations']>[number]['kind']){const row=rows.value[index];if(rows.value.some((item,i)=>i!==index&&item.target_id===row.target_id&&item.kind===kind)){notify('Liên kết cùng loại đã tồn tại.','warning');return}relations.value=rows.value.map((item,i)=>i===index?{...item,kind}:item)}
function remove(index:number){relations.value=rows.value.filter((_,i)=>i!==index)}
onUnmounted(()=>controller?.abort())
</script>
<template>
  <section class="relation-editor"><div class="section-heading"><div><h3>Tài liệu liên quan</h3><p class="field-help">Tìm → Chọn → Lưu nháp. Backlink được tính tự động.</p></div><v-btn variant="tonal" color="primary" size="small" prepend-icon="mdi-plus" @click="open=true">Liên kết tài liệu</v-btn></div>
    <v-alert v-if="error" type="error" variant="tonal" class="my-4">{{ error }}<v-btn variant="text" @click="resolve">Thử lại</v-btn></v-alert><h4 v-if="rows.length" class="relation-direction">Liên kết đến</h4>
    <article v-for="(item,index) in rows" :key="`${item.target_id}:${item.kind}`" class="relation-item"><div class="relation-item-document"><strong>{{ targets[item.target_id]?.metadata.title||item.target_id }}</strong><small><code>{{ item.target_id }}</code> · {{ targets[item.target_id]?typeLabels[targets[item.target_id].metadata.type]:'Không khả dụng' }} · {{ targets[item.target_id]?.publication==='published'?'Đã xuất bản':targets[item.target_id]?'Chưa xuất bản':'Legacy, đã gỡ hoặc ngoài phạm vi' }}</small><p v-if="!loading&&(!targets[item.target_id]||item.kind==='verifies')" class="relation-warning"><v-icon icon="mdi-alert-circle-outline" size="18" />Cần thay hoặc gỡ liên kết trước khi xuất bản. Bản nháp vẫn lưu được.</p></div><v-select :model-value="item.kind" :items="kindItems" label="Loại liên kết" hide-details @update:model-value="value=>changeKind(index,value)" /><v-btn icon="mdi-close" variant="text" :aria-label="`Gỡ liên kết ${targets[item.target_id]?.metadata.title||item.target_id}`" @click="remove(index)" /></article>
    <p v-if="!rows.length" class="field-help mt-4">Chưa có liên kết đến. Có thể chọn nhiều tài liệu trong một lần.</p>
    <details v-if="incoming.length" class="relation-backlinks"><summary>Được tham chiếu bởi · {{ incoming.length }}</summary><a v-for="edge in incoming.filter(item=>item.document)" :key="`${edge.source_id}:${edge.kind}`" :href="edge.document!.url" class="quality-doc"><span>{{ edge.document!.metadata.title }}<small>{{ edge.source_id }} · {{ relationLabels[edge.kind]||'Trong nội dung' }} · {{ edge.document!.metadata.status==='draft'?'Bản nháp':'Đã xuất bản' }}</small></span><v-icon icon="mdi-arrow-top-right" size="18" /></a><p class="field-help">Các liên kết này thuộc tài liệu nguồn và không sửa ở đây.</p></details>
    <DocumentReferencePicker v-model="open" :source-id="sourceId" :project-id="projectId" :exclude-ids="rows.filter(row=>row.kind==='related').map(row=>row.target_id)" @select="add" />
  </section>
</template>
