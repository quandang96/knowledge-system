<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { ReferenceCandidate, ReferenceResults } from '../../schemas/src/index'
import { api } from './state'
import DocumentReferencePicker from './DocumentReferencePicker.vue'
const value=defineModel<string>();const ids=defineModel<string[]>('ids',{default:()=>[]})
const props=defineProps<{sourceId:string;projectId:string;type:string;label:string;multiple?:boolean}>()
const open=ref(false);const targets=ref<Record<string,ReferenceCandidate>>({});const error=ref('')
const selected=computed(()=>props.multiple?ids.value:value.value?[value.value]:[])
let controller:AbortController|undefined
watch(()=>[props.sourceId,selected.value.join(',')],async()=>{
  controller?.abort();controller=new AbortController();const signal=controller.signal;error.value='';if(!selected.value.length){targets.value={};return}
  try{const params=new URLSearchParams({source_id:props.sourceId,project_id:props.projectId,ids:selected.value.join(','),page_size:'50'});const data=await api<ReferenceResults>(`/api/knowledge/references?${params}`,{signal});if(!signal.aborted)targets.value=Object.fromEntries(data.items.map(item=>[item.metadata.doc_id,item]))}catch(e){if(!signal.aborted)error.value=(e as Error).message}
},{immediate:true})
function choose(items:ReferenceCandidate[]){for(const item of items)targets.value[item.metadata.doc_id]=item;if(props.multiple)ids.value=[...new Set([...ids.value,...items.map(item=>item.metadata.doc_id)])];else value.value=items[0]?.metadata.doc_id}
function remove(id:string){if(props.multiple)ids.value=ids.value.filter(item=>item!==id);else value.value=undefined}
onUnmounted(()=>controller?.abort())
</script>
<template><div class="reference-field"><span class="field-help">{{ label }}</span><div v-for="id in selected" :key="id" class="reference-field-item"><span>{{ targets[id]?.metadata.title||id }}</span><v-btn icon="mdi-close" size="small" variant="text" :aria-label="`Gỡ ${label}: ${targets[id]?.metadata.title||id}`" @click="remove(id)" /></div><p v-if="error" class="relation-warning">{{ error }}</p><v-btn variant="outlined" size="small" prepend-icon="mdi-link-variant" @click="open=true">Chọn {{ label.toLowerCase() }}</v-btn><DocumentReferencePicker v-model="open" :source-id="sourceId" :project-id="projectId" :allowed-types="[type]" :multiple="!!multiple" :exclude-ids="selected" :title="`Chọn ${label.toLowerCase()}`" @select="choose" /></div></template>
