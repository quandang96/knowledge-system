<script setup lang="ts">
import { iconGroup } from './theme'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, useRoute, useRouter } from 'vitepress'
import { linkedDocumentId } from '../../schemas/src/document-links'
import { useLocationQuery } from './location-query'
import { businessContent, splitScreenContent } from './document-presentation'
import { useDelayedBusy } from './async-state'
import { createAtlasMarkdown } from './atlas-markdown'
import { type DocumentRecord, type DocumentSummary, type Connections, typeIcons, typeLabels } from '../../schemas/src/index'
import { api, assetUrl, canEdit, dateLabel, fail, notify, state, currentProject, changeProject } from './state'
import MermaidPreview from './MermaidPreview.vue'
import ManagedContent from './ManagedContent.vue'
import { imageAlt } from './markdown-media'
import DownloadButton from './DownloadButton.vue'
import MediaImage from './MediaImage.vue'
import { mermaidPlaceholder } from './mermaid-theme'
import { toMermaid } from '../../schemas/src/graph-utils'
const { frontmatter } = useData()
const doc = ref<DocumentRecord | null>(null); const loading = ref(false); const selected = ref(0); const zoom = ref(false)
const showBusy = useDelayedBusy(loading)
const connections = ref<Connections>({outgoing:[],incoming:[],impact:[]}); const error = ref(''); const feedbackOpen = ref(false); const feedbackText = ref(''); const feedbackBusy = ref(false)
const images = computed(() => doc.value?.metadata.screen?.screenshot.gallery || [])
const isScreen = computed(() => doc.value?.metadata.type === 'screen')
const business = computed(() => state.documents.find(item => item.metadata.doc_id === doc.value?.metadata.doc_id)?.business)
const relatedGroups = computed(() => {
  const items = new Map<string,DocumentSummary>()
  for (const edge of [...connections.value.outgoing,...connections.value.incoming]) {
    if (!edge.document || (edge.origin === 'metadata' && edge.kind === 'implements' && ['screen','function'].includes(edge.document.metadata.type))) continue
    items.set(edge.document.metadata.doc_id,edge.document)
  }
  return [...new Set([...items.values()].map(item=>item.metadata.type))].map(type=>({type,items:[...items.values()].filter(item=>item.metadata.type===type)}))
})
const parser = createAtlasMarkdown()
const route=useRoute();const router=useRouter();const query=useLocationQuery()
parser.renderer.rules.link_open=(tokens,index,options,_env,self)=>{const token=tokens[index];const id=linkedDocumentId(token.attrGet('href')||'');const target=connections.value.outgoing.find(edge=>edge.target_id===id)?.document;if(target)token.attrSet('href',target.url);return self.renderToken(tokens,index,options)}
const originalFence = parser.renderer.rules.fence!
parser.renderer.rules.fence = (tokens,index,options,env,self) => tokens[index].info.trim() === 'mermaid' ? mermaidPlaceholder(tokens[index].content) : originalFence(tokens,index,options,env,self)
parser.renderer.rules.image = (tokens,index,options,_env,self) => { const token=tokens[index]; token.attrSet('data-asset-path',token.attrGet('src') || ''); token.attrSet('alt',imageAlt(token)); if(doc.value) token.attrSet('src',assetUrl(doc.value,token.attrGet('src') || '')); token.attrSet('loading','lazy'); return self.renderToken(tokens,index,options) }
const parsed = computed(() => {
  const rawTokens=parser.parse(doc.value?.body || '',{});const content=['screen','function','business-rule','business-flow'].includes(doc.value?.metadata.type||'')?businessContent(rawTokens):{tokens:rawTokens,retired:false};const tokens=content.tokens; const headings:{title:string;id:string}[]=[]
  for(let i=0;i<tokens.length;i++) if(tokens[i].type==='heading_open') {
    if(tokens[i].tag === 'h1') { tokens[i].hidden=true; tokens[i+1].hidden=true; tokens[i+1].content=''; tokens[i+1].children=[]; tokens[i+2].hidden=true }
    else if(tokens[i].tag==='h2' || tokens[i].tag==='h3') { const id=`section-${headings.length}`;tokens[i].attrSet('id',id);headings.push({id,title:tokens[i+1].content}) }
  }
  const parts=isScreen.value?splitScreenContent(tokens):{intro:tokens,behavior:[]}
  const introIds=new Set(parts.intro.map(token=>token.attrGet('id')).filter(Boolean))
  const toc=[...headings.filter(heading=>introIds.has(heading.id)),...(isScreen.value?[{id:'screen-functions',title:'Chức năng trên màn hình'}]:[]),...headings.filter(heading=>!introIds.has(heading.id))]
  return {intro:parser.renderer.render(parts.intro,parser.options,{}),behavior:parser.renderer.render(parts.behavior,parser.options,{}),headings:toc,retired:content.retired}
})
const toc = computed(()=>[...parsed.value.headings,...(relatedGroups.value.length?[{id:'document-related',title:'Tài liệu liên quan'}]:[]),{id:'document-sources',title:'Nguồn và lịch sử'}])
function scrollHeading(id:string) { document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}) }
let sequence=0; let controller: AbortController | undefined
async function load() {
  const id=frontmatter.value.doc_id || new URLSearchParams(window.location.search).get('id')
  if(!id) return
  controller?.abort(); const abort = new AbortController(); controller = abort
  const request=++sequence;loading.value=true;selected.value=0;error.value='';doc.value=null;connections.value={outgoing:[],incoming:[],impact:[]}
  try {
    const project=new URLSearchParams(window.location.search).get('project_id')
    const data=await api<DocumentRecord>(`/api/documents/${id}${project?`?project_id=${encodeURIComponent(project)}`:''}`,{signal:abort.signal})
    if(request!==sequence) return
    if(!frontmatter.value.doc_id && route.path!==data.url){await router.go(data.url);return}
    doc.value=data
    if(state.project!==data.metadata.project_id) changeProject(data.metadata.project_id)
    const related=await api<Connections>(`/api/documents/${id}/connections`,{signal:abort.signal})
    if(request===sequence) connections.value=related
  } catch(e) { if(request===sequence && !abort.signal.aborted) {error.value=(e as Error).message;fail(e)} } finally {if(request===sequence) loading.value=false}
}
async function sendFeedback() {
  if(!doc.value || !feedbackText.value.trim()) return
  feedbackBusy.value=true
  try {await api(`/api/documents/${doc.value.metadata.doc_id}/feedback`,{method:'POST',body:JSON.stringify({message:feedbackText.value})});feedbackOpen.value=false;feedbackText.value='';notify('Đã gửi góp ý cho nhóm biên tập.')} catch(e) {fail(e)} finally {feedbackBusy.value=false}
}
onBeforeUnmount(() => {++sequence;controller?.abort()}); onMounted(load); watch(() => [frontmatter.value.doc_id,route.path,query.value], load)
</script>
<template>
  <div v-if="loading && !doc" class="document-loading" role="status" aria-label="Đang tải tài liệu"><v-skeleton-loader v-if="showBusy" type="heading, paragraph, image, paragraph" /></div>
  <template v-if="doc">
    <div class="breadcrumb-line"><a href="/screens/">Màn hình nghiệp vụ</a><v-icon size="16" icon="mdi-chevron-right" /><span>{{ currentProject?.name }} / {{ currentProject?.modules.find(item=>item.id===doc?.metadata.module)?.name || doc.metadata.module }}</span><v-icon size="16" icon="mdi-chevron-right" /><strong>{{ doc.metadata.doc_id }}</strong></div>
    <div class="document-layout"><article class="document-article">
      <header class="document-header">
        <div class="document-kicker"><code :class="isScreen?'semantic-screen-text':doc.metadata.type==='function'?'semantic-function-text':''">{{ doc.metadata.function_code || doc.metadata.doc_id }}</code><v-chip color="success" variant="tonal">Đã xuất bản</v-chip><span>{{ typeLabels[doc.metadata.type] }}</span></div>
        <h1>{{ doc.metadata.title }}</h1><p class="document-summary">{{ doc.metadata.summary }}</p>
        <div class="document-meta"><span><v-icon icon="mdi-account-outline" size="18" />{{ doc.metadata.owner }}</span><span><v-icon icon="mdi-clock-outline" size="18" />{{ dateLabel(doc.metadata.updated_at) }}</span><span>v{{ doc.metadata.version }}</span><span v-if="doc.metadata.function_code">Document {{ doc.metadata.doc_id }}</span><span v-if="doc.metadata.effective_from">Hiệu lực {{ dateLabel(doc.metadata.effective_from) }}</span><span v-if="doc.metadata.review_due_at">Rà soát {{ dateLabel(doc.metadata.review_due_at) }}</span></div>
        <div v-if="doc.metadata.verification" class="verification-note"><v-icon icon="mdi-check-decagram-outline" color="success" size="20" /><span>{{ doc.metadata.verification.reviewer }} xác nhận · {{ dateLabel(doc.metadata.verification.reviewed_at) }}</span></div>
        <div class="document-actions"><v-btn v-if="canEdit" size="small" color="primary" prepend-icon="mdi-pencil-outline" :href="'/studio/?doc='+doc.metadata.doc_id">Chỉnh sửa</v-btn><v-menu><template #activator="{props}"><v-btn v-bind="props" size="small" icon="mdi-dots-horizontal" variant="text" aria-label="Thao tác tài liệu" /></template><v-list class="document-more-menu"><v-list-item v-if="canEdit" title="Lịch sử phiên bản" prepend-icon="mdi-history" :href="'/studio/history/?doc='+doc.metadata.doc_id" /><v-list-item v-if="canEdit" title="Sơ đồ nâng cao" prepend-icon="mdi-vector-polyline" :href="'/studio/diagrams/?doc='+doc.metadata.doc_id" /><v-list-item><DownloadButton :url="'/api/documents/'+doc.metadata.doc_id+'/export.md'" :filename="doc.metadata.doc_id+'.md'" label="Export Markdown">Export Markdown</DownloadButton></v-list-item><v-list-item><DownloadButton :url="'/api/documents/'+doc.metadata.doc_id+'/export.zip'" :filename="doc.metadata.doc_id+'.zip'" icon="mdi-folder-zip-outline" label="Export đầy đủ">Export đầy đủ</DownloadButton></v-list-item><v-list-item title="Góp ý nội dung" prepend-icon="mdi-message-alert-outline" @click="feedbackOpen=true" /></v-list></v-menu></div>
      </header>
      <section v-if="doc.metadata.type==='function'" class="linked-screens"><span class="eyebrow">Được thực hiện trên màn hình</span><a v-for="screen in business?.screens || []" :key="screen.doc_id" :href="screen.url" class="text-link semantic-screen-text">{{ screen.doc_id }} · {{ screen.title }}</a><p v-if="!business?.screens.length" class="field-help">Chưa liên kết Screen</p></section>
      <details class="mobile-toc"><summary>Mục lục · {{ toc.length }} mục</summary><a v-for="heading in toc" :key="heading.id" :href="'#'+heading.id" @click.prevent="scrollHeading(heading.id)">{{ heading.title }}</a></details>
      <section v-if="doc.metadata.screen?.menu_path.length || doc.metadata.screen?.route" class="navigation-info"><v-icon icon="mdi-routes" size="20" /><div><span class="eyebrow">Cách truy cập</span><p>{{ doc.metadata.screen?.menu_path.join(' → ') }}</p><code>{{ doc.metadata.screen?.route }}</code></div></section>
      <p v-if="parsed.retired" class="field-help my-4">Các phần kiểm thử cũ được giữ trong Markdown export và lịch sử.</p>
      <ManagedContent class="prose document-body document-intro" :html="parsed.intro" :image-layout="doc.metadata.image_layout" />
      <section v-if="isScreen" id="screen-functions" class="screen-functions"><div class="section-heading"><div><span class="eyebrow">Screen → Function</span><h2>Chức năng trên màn hình</h2></div><a v-if="canEdit" :href="'/studio/?doc='+doc.metadata.doc_id" class="text-link">Liên kết chức năng <v-icon icon="mdi-plus" size="18" /></a></div><div v-if="business?.functions.length" class="catalog-table"><table><thead><tr><th>Function ID</th><th>Tên chức năng</th><th>Trigger</th><th>Điều kiện / Rule</th><th>Chi tiết</th></tr></thead><tbody><tr v-for="fn in business.functions" :key="fn.doc_id"><td><a :href="fn.url" class="document-key semantic-function-text">{{ fn.function_code || fn.doc_id }}</a></td><td>{{ fn.title }}</td><td>{{ fn.trigger || 'Chưa mô tả' }}</td><td><a v-for="rule in fn.rules" :key="rule.doc_id" :href="rule.url" class="text-link">{{ rule.doc_id }} · {{ rule.title }}</a><span v-if="!fn.rules.length" class="field-help">—</span></td><td><a :href="fn.url" class="text-link">Mở chi tiết <v-icon icon="mdi-arrow-top-right" size="18" /></a></td></tr></tbody></table></div><p v-else class="field-help">Chưa liên kết chức năng. Nhóm biên tập có thể chọn Function đã có hoặc tạo bản nháp mới.</p></section>
      <ManagedContent v-if="parsed.behavior" class="prose document-body document-behavior" :html="parsed.behavior" :image-layout="doc.metadata.image_layout" />
      <details v-if="images.length" class="screenshot-gallery"><summary>Ảnh bổ sung · {{ images.length }}</summary><div class="section-heading mt-4"><h2>Screenshot Gallery</h2><v-btn variant="text" size="small" prepend-icon="mdi-magnify-plus-outline" @click="zoom=true">Phóng to</v-btn></div><MediaImage class="gallery-main" :src="assetUrl(doc,images[selected].path)" :alt="images[selected].alt" zoomable /><p class="gallery-caption">{{ images[selected].caption }}</p><div class="gallery-thumbnails"><button v-for="(image,index) in images" :key="image.path" :class="{selected:index===selected}" :aria-label="image.alt" @click="selected=index"><img :src="assetUrl(doc,image.path)" :alt="image.alt" /><span>{{ image.category }}</span></button></div></details>
      <section v-if="doc.graphs.length" class="doc-diagrams"><details v-for="graph in doc.graphs" :key="graph.diagram_id"><summary>{{ graph.title }} · Sơ đồ nâng cao</summary><MermaidPreview :source="toMermaid(graph)" /><p>{{ graph.summary }}</p><a v-if="canEdit" :href="'/studio/diagrams/?doc='+doc.metadata.doc_id+'&diagram='+graph.diagram_id" class="text-link">Chỉnh sửa sơ đồ</a></details></section>
      <section v-if="relatedGroups.length" id="document-related" class="related-section"><span class="eyebrow">Kết nối tri thức</span><h2>Tài liệu liên quan</h2><div v-for="group in relatedGroups" :key="group.type" class="related-type-group"><h3>{{ typeLabels[group.type] }}</h3><div class="related-grid"><a v-for="item in group.items" :key="item.metadata.doc_id" :href="item.url" class="related-card"><span :class="['icon-tile','semantic-'+iconGroup(item.metadata.type)]"><v-icon :icon="typeIcons[item.metadata.type]" size="20" /></span><div><small>{{ item.metadata.function_code || item.metadata.doc_id }}</small><strong>{{ item.metadata.title }}</strong></div></a></div></div><details v-if="connections.impact.length" class="impact-panel"><summary>{{ connections.impact.length }} tài liệu có thể bị ảnh hưởng</summary><a v-for="item in connections.impact" :key="item.metadata.doc_id" :href="item.url" class="quality-doc"><span>{{ item.metadata.doc_id }} · {{ item.metadata.title }}</span><v-icon icon="mdi-arrow-top-right" size="18" /></a></details></section>
      <section id="document-sources" class="document-sources"><h2>Nguồn và lịch sử</h2><div v-if="doc.metadata.source_links.length" class="source-links"><a v-for="source in doc.metadata.source_links" :key="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.label }} <v-icon icon="mdi-open-in-new" size="18" /></a></div><p class="field-help">Revision <code>{{ doc.published_revision?.slice(0,12) }}</code> · {{ doc.metadata.language.toUpperCase() }}</p><a v-if="canEdit" :href="'/studio/history/?doc='+doc.metadata.doc_id" class="text-link">Xem lịch sử phiên bản</a></section>
    </article><aside class="document-toc"><span class="eyebrow">Trong tài liệu</span><a v-for="heading in toc" :key="heading.id" :href="'#'+heading.id" @click.prevent="scrollHeading(heading.id)">{{ heading.title }}</a></aside></div>
    <v-dialog v-model="zoom" max-width="1400"><div class="lightbox"><v-btn icon="mdi-close" variant="text" aria-label="Đóng ảnh" @click="zoom=false" /><img v-if="images[selected]" :src="assetUrl(doc,images[selected].path)" :alt="images[selected].alt" /><p>{{ images[selected]?.caption }}</p></div></v-dialog>
  </template>
  <div v-else-if="!loading" class="empty-state"><h2>Không thể mở tài liệu</h2><p>{{ error || 'Kiểm tra quyền truy cập hoặc trạng thái xuất bản.' }}</p><v-btn variant="tonal" color="primary" @click="load">Thử lại</v-btn><a href="/library/" class="text-link ml-4">Về thư viện</a></div>
  <v-dialog v-model="feedbackOpen" max-width="600"><form class="new-doc-form" @submit.prevent="sendFeedback"><h2>Góp ý nội dung</h2><p class="field-help mt-3">Mô tả thông tin chưa rõ hoặc phần cần cập nhật.</p><v-textarea v-model="feedbackText" label="Nội dung góp ý" maxlength="2000" required rows="5" class="mt-6" /><div class="form-actions"><v-btn variant="text" @click="feedbackOpen=false">Hủy</v-btn><v-btn type="submit" color="primary" :loading="feedbackBusy">Gửi góp ý</v-btn></div></form></v-dialog>
</template>
