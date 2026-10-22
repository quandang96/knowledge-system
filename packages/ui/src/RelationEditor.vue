<script setup lang="ts">
import { relationKinds, relationLabels, typeLabels, type Metadata, type ReferenceCandidate, type ReferenceResults, type Connections } from '../../schemas/src/index'
import { computed, onUnmounted, ref, watch } from 'vue'
import { api, notify } from './state'
const relations = defineModel<Metadata['relations']>({default:()=>[]})
const props=defineProps<{sourceId:string;projectId:string;handledKinds:string[]}>()
const targets=ref<Record<string,ReferenceCandidate>>({});const incoming=ref<Connections['incoming']>([]);const error=ref('');const loading=ref(false)
const rows=computed(()=>relations.value||[]);const entries=computed(()=>rows.value.map((item,index)=>({item,index})).filter(entry=>!props.handledKinds.includes(entry.item.kind)));const kindItems=relationKinds.map(value=>({value,title:relationLabels[value]}))
let controller:AbortController|undefined;let generation=0
async function resolve(){
  controller?.abort();controller=new AbortController();const signal=controller.signal;const request=++generation;loading.value=true;error.value=''
  try{
    const ids=[...new Set(entries.value.map(entry=>entry.item.target_id))];const found:ReferenceCandidate[]=[]
    for(let offset=0;offset<ids.length;offset+=50){const params=new URLSearchParams({source_id:props.sourceId,project_id:props.projectId,ids:ids.slice(offset,offset+50).join(','),page_size:'50'});const result=await api<ReferenceResults>(`/api/knowledge/references?${params}`,{signal});found.push(...result.items)}
    const connections=await api<Connections>(`/api/documents/${props.sourceId}/connections?draft=true`,{signal})
    if(request===generation){targets.value=Object.fromEntries(found.map(doc=>[doc.metadata.doc_id,doc]));incoming.value=connections.incoming}
  }catch(e){if(!signal.aborted)error.value=(e as Error).message}finally{if(request===generation)loading.value=false}
}
// A string key: a fresh array would count as a change on every edit of the draft and refetch.
watch(()=>`${props.sourceId}|${props.projectId}|${entries.value.map(entry=>entry.item.target_id).join(',')}`,resolve,{immediate:true})
function changeKind(index:number,kind:NonNullable<Metadata['relations']>[number]['kind']){const row=rows.value[index];if(rows.value.some((item,i)=>i!==index&&item.target_id===row.target_id&&item.kind===kind)){notify('Liên kết cùng loại đã tồn tại.','warning');return}relations.value=rows.value.map((item,i)=>i===index?{...item,kind}:item)}
function remove(index:number){relations.value=rows.value.filter((_,i)=>i!==index)}
onUnmounted(()=>controller?.abort())
</script>
<template>
  <section v-if="entries.length || incoming.length" class="relation-editor"><div class="section-heading"><div><h3>Liên kết khác</h3><p class="field-help">Liên kết tạo trước đây ngoài các mục trên. Liên kết mới: gõ @ trong nội dung. Có thể đổi loại hoặc gỡ.</p></div></div>
    <v-alert v-if="error" type="error" variant="tonal" class="my-4">{{ error }}<v-btn variant="text" @click="resolve">Thử lại</v-btn></v-alert><h4 v-if="entries.length" class="relation-direction">Liên kết đến</h4>
    <article v-for="{item,index} in entries" :key="`${item.target_id}:${item.kind}`" class="relation-item"><div class="relation-item-document"><strong>{{ targets[item.target_id]?.metadata.title||item.target_id }}</strong><small><code>{{ item.target_id }}</code> · {{ targets[item.target_id]?typeLabels[targets[item.target_id].metadata.type]:'Không khả dụng' }} · {{ targets[item.target_id]?.publication==='published'?'Đã xuất bản':targets[item.target_id]?'Chưa xuất bản':'Legacy, đã gỡ hoặc ngoài phạm vi' }}</small><p v-if="!loading&&(!targets[item.target_id]||item.kind==='verifies')" class="relation-warning"><v-icon icon="mdi-alert-circle-outline" size="18" />Cần thay hoặc gỡ liên kết trước khi xuất bản. Bản nháp vẫn lưu được.</p></div><v-select :model-value="item.kind" :items="kindItems" label="Loại liên kết" hide-details @update:model-value="value=>changeKind(index,value)" /><v-btn icon="mdi-close" variant="text" :aria-label="`Gỡ liên kết ${targets[item.target_id]?.metadata.title||item.target_id}`" @click="remove(index)" /></article>
    <details v-if="incoming.length" class="relation-backlinks"><summary>Được tham chiếu bởi · {{ incoming.length }}</summary><a v-for="edge in incoming.filter(item=>item.document)" :key="`${edge.source_id}:${edge.kind}`" :href="edge.document!.url" class="quality-doc"><span>{{ edge.document!.metadata.title }}<small>{{ edge.source_id }} · {{ relationLabels[edge.kind]||'Trong nội dung' }} · {{ edge.document!.metadata.status==='draft'?'Bản nháp':'Đã xuất bản' }}</small></span><v-icon icon="mdi-arrow-top-right" size="18" /></a><p class="field-help">Các liên kết này thuộc tài liệu nguồn và không sửa ở đây.</p></details>
  </section>
</template>
