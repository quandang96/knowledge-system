<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import type { DocumentRecord, DocumentSummary } from '../../schemas/src/index'
import { api, canEdit } from './state'
import { useLocationQuery } from './location-query'
const {frontmatter}=useData();const items=ref<DocumentSummary[]>([]);const doc=ref<DocumentRecord|null>(null);const error=ref('');const busy=ref(false);const draft=ref(false)
let sequence=0
async function load(){
  const request=++sequence;busy.value=true;error.value='';doc.value=null;items.value=[]
  try{const params=new URLSearchParams(window.location.search);draft.value=params.get('draft')==='true';const suffix=draft.value?'?draft=true':'';const id=frontmatter.value.legacy_doc_id||params.get('id')
    if(id){const data=await api<DocumentRecord>(`/api/legacy/documents/${encodeURIComponent(id)}${suffix}`);if(request===sequence)doc.value=data}
    else{const data=await api<DocumentSummary[]>(`/api/legacy/documents${suffix}`);if(request===sequence)items.value=data}
  }catch(e){if(request===sequence)error.value=(e as Error).message}finally{if(request===sequence)busy.value=false}
}
const route=useRoute();const query=useLocationQuery();onMounted(load);watch(()=>[route.path,query.value],load)
</script>
<template><header class="page-heading"><div><span class="eyebrow">Kho lưu trữ · Chỉ đọc</span><h1>{{ doc?.metadata.title||'Tài liệu legacy' }}</h1><p>Phân hệ kiểm thử đã ngừng sử dụng. Nội dung và lịch sử cũ được giữ để tra cứu, export và phục hồi theo chính sách quản trị.</p></div><v-btn href="/library/" variant="outlined">Về thư viện</v-btn></header><v-progress-linear v-if="busy" indeterminate color="primary" /><v-alert v-if="error" type="error" variant="tonal">{{ error }}</v-alert><section v-if="doc" class="panel"><p class="field-help">{{ doc.metadata.doc_id }} · {{ doc.metadata.project_id }} · {{ draft?'Bản nháp legacy':'Đã lưu trữ' }}</p><div class="studio-actions my-4"><v-btn color="primary" :href="`/api/documents/${doc.metadata.doc_id}/export.md${draft?'?draft=true':''}`">Export Markdown</v-btn><v-btn variant="outlined" :href="`/api/documents/${doc.metadata.doc_id}/export.zip${draft?'?draft=true':''}`">Export đầy đủ</v-btn></div><pre class="legacy-source">{{ doc.body }}</pre></section><section v-else-if="!busy&&!error" class="panel"><a v-for="item in items" :key="item.metadata.doc_id" :href="`/legacy/?id=${item.metadata.doc_id}${draft?'&draft=true':''}`" class="quality-doc"><span>{{ item.metadata.title }}<small>{{ item.metadata.doc_id }} · {{ item.metadata.project_id }}</small></span><v-icon icon="mdi-arrow-top-right" /></a><p v-if="!items.length" class="field-help">Không có tài liệu legacy trong phạm vi truy cập.</p><a v-if="canEdit&&!draft" href="/legacy/?draft=true" class="text-link mt-4">Xem bản nháp legacy</a></section></template>
