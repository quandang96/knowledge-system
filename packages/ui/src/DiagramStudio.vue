<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vitepress'
import { VueFlow, Handle, Position, MarkerType, type Connection, type VueFlowStore } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import { graphSchema, type Graph, type DocumentRecord } from '../../schemas/src/index'
import { toMermaid } from '../../schemas/src/graph-utils'
import { api, ApiError, canPublish, download, fail, notify, refreshDocuments, state } from './state'
import MermaidPreview from './MermaidPreview.vue'
const router = useRouter()
interface FlowNode { id:string; type:string; position:{x:number;y:number}; data:{type:Graph['nodes'][number]['type'];label:string;ruleText:string;description:string;role_id?:string;screen_id?:string;function_id?:string} }
interface FlowEdge { id:string; source:string; target:string; label:string; type?:string; markerEnd?:MarkerType; style?:Record<string,string|number>; labelStyle?:Record<string,string|number>; labelBgStyle?:Record<string,string|number> }
const documentId = ref(''); const draft = ref<DocumentRecord | null>(null); const draftList = ref<DocumentRecord[]>([])
const diagramId = ref(''); const nodes = ref<FlowNode[]>([]); const edges = ref<FlowEdge[]>([]); const summary = ref(''); const title = ref(''); const graphType = ref<Graph['type']>('business-flow')
const selectedNode = ref<FlowNode | null>(null); const selectedEdge = ref<FlowEdge | null>(null); const busy = ref(false); const dirty = ref(false); const conflict = ref(false); const previewOpen = ref(false)
const nodeType = ref<Graph['nodes'][number]['type']>('action'); const savedSignature = ref(''); const instance = shallowRef<VueFlowStore | null>(null)
const nodeTypes = ['start','end','action','decision','system','screen','role']
const candidates = computed(() => [...new Map([...state.documents,...draftList.value].map(d => [d.metadata.doc_id,d])).values()].filter(d => d.metadata.project_id === state.project).map(d => ({ title:`${d.metadata.doc_id} · ${d.metadata.title}`, value:d.metadata.doc_id })))
const graph = computed<Graph>(() => ({ schema_version:1,diagram_id:diagramId.value,type:graphType.value,title:title.value,summary:summary.value,nodes:nodes.value.map(n => ({id:n.id,type:n.data.type,label:n.data.label,position:n.position,rule_ids:(n.data.ruleText || '').split(',').map((v:string) => v.trim()).filter(Boolean),description:n.data.description || '',...(n.data.role_id ? {role_id:n.data.role_id} : {}),...(n.data.screen_id ? {screen_id:n.data.screen_id} : {}),...(n.data.function_id ? {function_id:n.data.function_id} : {})})),edges:edges.value.map(e => ({id:e.id,source:e.source,target:e.target,label:String(e.label || '')})) }))
const mermaid = computed(() => toMermaid(graph.value))
watch(graph, value => { dirty.value = JSON.stringify(value) !== savedSignature.value }, { deep:true })
function apply(value: Graph) {
  diagramId.value = value.diagram_id; graphType.value = value.type; title.value = value.title; summary.value = value.summary
  nodes.value = value.nodes.map(n => ({id:n.id,type:'atlas',position:{...n.position},data:{...n,ruleText:n.rule_ids.join(', ')}}))
  edges.value = value.edges.map(e => ({...e,type:'smoothstep',markerEnd:MarkerType.ArrowClosed,style:{stroke:'#91accb',strokeWidth:1.5},labelStyle:{fill:'#6b88aa',fontSize:10},labelBgStyle:{fill:'#fafcfe'}}))
  selectedNode.value = null; selectedEdge.value = null; savedSignature.value = JSON.stringify(graph.value); dirty.value = false; conflict.value = false
  void instance.value?.fitView({padding:.2})
}
async function openDocument() {
  if (!documentId.value) return
  if (dirty.value && !window.confirm('Có diagram chưa lưu. Chuyển tài liệu?')) return
  busy.value = true
  try { draft.value = await api<DocumentRecord>(`/api/documents/${documentId.value}/edit`,{method:'POST'}); const preferred = new URLSearchParams(window.location.search).get('diagram'); const first = draft.value.graphs.find(g => g.diagram_id === preferred) || draft.value.graphs[0]; if (first) apply(first); else newGraph(); window.history.replaceState(null,'',`/studio/diagrams/?doc=${documentId.value}`) }
  catch(error) { fail(error) } finally { busy.value = false }
}
function newGraph() {
  const type: Graph['type'] = draft.value?.metadata.type === 'role' ? 'role-hierarchy' : draft.value?.metadata.type === 'screen' ? 'screen-navigation' : 'business-flow'
  const id = `DIA-${draft.value?.metadata.doc_id || 'NEW'}-${Date.now().toString(36).toUpperCase()}`
  const defaultNodes: Graph['nodes'] = type === 'role-hierarchy' ? [{id:'role',type:'role',label:'Vai trò',position:{x:90,y:120},rule_ids:[],description:''},{id:'scope',type:'system',label:'Phạm vi dữ liệu',position:{x:400,y:120},rule_ids:[],description:''}] : type === 'screen-navigation' ? [{id:'list',type:'screen',label:'Màn hình nguồn',position:{x:90,y:120},rule_ids:[],description:''},{id:'detail',type:'screen',label:'Màn hình đích',position:{x:400,y:120},rule_ids:[],description:''}] : [{id:'start',type:'start',label:'Bắt đầu',position:{x:40,y:180},rule_ids:[],description:''},{id:'decision',type:'decision',label:'Kiểm tra điều kiện',position:{x:310,y:180},rule_ids:[],description:''},{id:'end',type:'end',label:'Kết thúc',position:{x:580,y:180},rule_ids:[],description:''}]
  apply({schema_version:1,diagram_id:id,type,title:'Sơ đồ mới',summary:'Tác nhân: cần điền. Trigger: cần điền. Điều kiện, chuyển tiếp, kết quả và ngoại lệ: cần xác nhận.',nodes:defaultNodes,edges:defaultNodes.slice(1).map((n,i) => ({id:`e${i}`,source:defaultNodes[i].id,target:n.id,label:type === 'business-flow' ? 'Tiếp tục' : 'Quan hệ'}))})
  savedSignature.value = ''; dirty.value = true
}
function addNode() { const id = `node-${Date.now().toString(36)}`; nodes.value.push({id,type:'atlas',position:{x:150+(nodes.value.length%3)*220,y:90+Math.floor(nodes.value.length/3)*140},data:{type:nodeType.value,label:'Node mới',ruleText:'',description:''}}) }
function selectDiagram(id: string) { if (!dirty.value || window.confirm('Bỏ thay đổi chưa lưu?')) { const value = draft.value?.graphs.find(g => g.diagram_id === id); if(value) apply(value) } }
function connect(connection: Connection) { if (!connection.source || !connection.target) return; edges.value.push({id:`edge-${Date.now().toString(36)}`,source:connection.source,target:connection.target,label:'Điều kiện',type:'smoothstep',markerEnd:MarkerType.ArrowClosed}) }
function deleteSelected() { if (selectedNode.value) { const id = selectedNode.value.id; nodes.value = nodes.value.filter(n => n.id !== id); edges.value = edges.value.filter(e => e.source !== id && e.target !== id); selectedNode.value = null } else if (selectedEdge.value) { edges.value = edges.value.filter(e => e.id !== selectedEdge.value!.id); selectedEdge.value = null } }
async function save() {
  if (!draft.value || busy.value || conflict.value) return false
  busy.value = true
  try { const value = graphSchema.parse(graph.value); draft.value = await api<DocumentRecord>(`/api/documents/${draft.value.metadata.doc_id}/draft-diagrams/${value.diagram_id}`,{method:'PUT',body:JSON.stringify({graph:value,base_revision:draft.value.revision})}); savedSignature.value = JSON.stringify(graph.value); dirty.value = false; notify('Đã lưu semantic graph JSON vào Draft.'); return true }
  catch(error) { if(error instanceof ApiError && error.status === 409) conflict.value = true; fail(error); return false } finally { busy.value = false }
}
async function publish() { if (!draft.value) return; if (dirty.value && !await save()) return; busy.value = true; try { const result = await api(`/api/documents/${draft.value.metadata.doc_id}/publish`,{method:'POST',body:JSON.stringify({base_revision:draft.value.revision})}); await refreshDocuments(); notify(`Đã xuất bản diagram · Git ${result.revision.slice(0,12)}`) } catch(error) { fail(error) } finally { busy.value = false } }
function beforeUnload(event: BeforeUnloadEvent) { if(dirty.value) { event.preventDefault(); event.returnValue='' } }
let priorRouteHook: typeof router.onBeforeRouteChange
onMounted(async () => {
  priorRouteHook = router.onBeforeRouteChange; router.onBeforeRouteChange = to => { if (dirty.value && !window.confirm('Diagram chưa lưu. Rời trang?')) return false; return priorRouteHook?.(to) }; window.addEventListener('beforeunload',beforeUnload)
  try { draftList.value = await api('/api/drafts'); documentId.value = new URLSearchParams(window.location.search).get('doc') || candidates.value.find(c => c.value.startsWith('BF-'))?.value || candidates.value[0]?.value || ''; await openDocument() } catch(error) { fail(error) }
})
onUnmounted(() => { router.onBeforeRouteChange = priorRouteHook; window.removeEventListener('beforeunload',beforeUnload) })
</script>
<template>
  <div class="breadcrumb-line"><a href="/">Knowledge Hub</a><v-icon icon="mdi-chevron-right" size="16" /><span>Biên tập sơ đồ</span></div><header class="studio-heading"><div><span class="eyebrow">LUỒNG NGHIỆP VỤ, TRỰC QUAN</span><h1>Diagram Studio</h1></div><div class="studio-actions"><span class="studio-status">{{ conflict ? 'Xung đột · cần tải lại' : dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu' }}</span><v-btn size="small" variant="outlined" :disabled="busy || conflict" :loading="busy" @click="save">Lưu bản nháp</v-btn><v-btn v-if="canPublish" size="small" color="primary" :disabled="busy || conflict" @click="publish">Xuất bản</v-btn></div></header>
  <div class="catalog-toolbar mb-5"><v-select v-model="documentId" :items="candidates" label="Tài liệu" hide-details @update:model-value="openDocument" /><v-select v-if="draft?.graphs.length" :model-value="diagramId" :items="draft.graphs.map(g => ({title:g.title,value:g.diagram_id}))" label="Diagram" hide-details @update:model-value="selectDiagram" /><v-btn variant="outlined" prepend-icon="mdi-plus" :disabled="!draft" @click="newGraph">Sơ đồ mới</v-btn></div>
  <v-alert v-if="conflict" type="warning" variant="tonal" class="mb-4">Bản nháp đã thay đổi. Export JSON để giữ thay đổi trước khi tải lại.<v-btn size="small" variant="text" @click="download(JSON.stringify(graph,null,2),`${diagramId}.graph.json`,'application/json')">Export JSON</v-btn><v-btn size="small" variant="text" @click="dirty=false;openDocument()">Tải lại</v-btn></v-alert>
  <template v-if="draft"><div class="diagram-toolbar"><v-select v-model="nodeType" :items="nodeTypes" hide-details style="max-width:160px" aria-label="Loại node" /><v-btn variant="tonal" color="primary" prepend-icon="mdi-plus" @click="addNode">Thêm node</v-btn><v-btn variant="text" prepend-icon="mdi-fit-to-screen-outline" @click="instance?.fitView({padding:.2})">Fit view</v-btn><v-spacer /><v-btn variant="text" size="small" @click="previewOpen = true">Mermaid preview</v-btn><v-btn variant="text" size="small" @click="download(mermaid,`${diagramId}.mmd`)">Export Mermaid</v-btn><v-btn variant="text" size="small" @click="download(JSON.stringify(graph,null,2),`${diagramId}.graph.json`,'application/json')">Export JSON</v-btn></div>
    <div class="diagram-layout"><div class="graph-canvas"><VueFlow v-model:nodes="nodes" v-model:edges="edges" :min-zoom=".2" :max-zoom="2" fit-view-on-init @init="value => instance = value" @connect="connect" @node-click="event => {selectedNode = nodes.find(n => n.id === event.node.id) || null;selectedEdge = null}" @edge-click="event => {selectedEdge = edges.find(e => e.id === event.edge.id) || null;selectedNode = null}" @pane-click="selectedNode = null;selectedEdge = null"><Background :gap="24" pattern-color="#dfe8f4" /><Controls /><MiniMap :pannable="true" :zoomable="true" /><template #node-atlas="{ data }"><div class="flow-node" :class="data.type"><Handle type="target" :position="Position.Left" /><span class="node-kind">{{ data.type.toUpperCase() }}</span><strong>{{ data.label }}</strong><small v-if="data.role_id || data.screen_id">{{ data.role_id || data.screen_id }}</small><Handle type="source" :position="Position.Right" /></div></template></VueFlow></div>
      <aside class="diagram-inspector"><h3>{{ selectedNode ? 'Node inspector' : selectedEdge ? 'Edge inspector' : 'Chi tiết sơ đồ' }}</h3><template v-if="selectedNode"><v-text-field v-model="selectedNode.data.label" label="Nhãn node" /><v-select v-model="selectedNode.data.type" :items="nodeTypes" label="Loại node" /><v-text-field v-model="selectedNode.data.role_id" label="Role ID" /><v-text-field v-model="selectedNode.data.screen_id" label="Screen ID" /><v-text-field v-model="selectedNode.data.function_id" label="Function ID" /><v-text-field v-model="selectedNode.data.ruleText" label="Rule IDs (dấu phẩy)" /><v-textarea v-model="selectedNode.data.description" label="Mô tả" rows="2" /><v-btn color="error" variant="tonal" size="small" @click="deleteSelected">Xóa node và edges</v-btn></template><template v-else-if="selectedEdge"><v-text-field v-model="selectedEdge.label" label="Điều kiện / nhãn nhánh" /><p>{{ selectedEdge.source }} → {{ selectedEdge.target }}</p><v-btn color="error" variant="tonal" size="small" class="mt-4" @click="deleteSelected">Xóa edge</v-btn></template><template v-else><v-text-field v-model="title" label="Tiêu đề" /><v-select v-model="graphType" :items="['business-flow','role-hierarchy','screen-navigation']" label="Loại sơ đồ" /><p>{{ diagramId }}</p><p class="mt-4">Kéo node để bố trí. Nối hai điểm kết nối để tạo nhánh. Chọn node hoặc edge để chỉnh semantic metadata.</p><p class="mt-4">{{ nodes.length }} nodes · {{ edges.length }} edges</p></template></aside></div><section class="diagram-summary"><span class="eyebrow">TÓM TẮT LUỒNG BẰNG CHỮ · BẮT BUỘC</span><v-textarea v-model="summary" label="Tác nhân, trigger, điều kiện, chuyển tiếp, kết quả và ngoại lệ" rows="3" hide-details /><div class="form-actions"><v-btn variant="text" size="small" :href="`/studio/?doc=${draft.metadata.doc_id}`">Về Document Studio <v-icon end icon="mdi-arrow-right" /></v-btn></div></section>
  </template><div v-else class="empty-state"><p>Tạo hoặc chọn một tài liệu để bắt đầu sơ đồ.</p><v-btn color="primary" href="/studio/">Document Studio</v-btn></div>
  <v-dialog v-model="previewOpen" max-width="1000"><div class="new-doc-form"><h2>{{ title }}</h2><MermaidPreview :source="mermaid" /><p>{{ summary }}</p><div class="form-actions"><v-btn color="primary" @click="previewOpen=false">Đóng</v-btn></div></div></v-dialog>
</template>
