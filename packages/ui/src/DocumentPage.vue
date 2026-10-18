<script setup lang="ts">
import { iconGroup } from './theme'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, useRoute, useRouter } from 'vitepress'
import { linkedDocumentId } from '../../schemas/src/document-links'
import { useLocationQuery } from './location-query'
import { businessContent } from './document-presentation'
import MarkdownIt from 'markdown-it'
import { type DocumentRecord, type Connections, typeIcons, typeLabels, relationLabels } from '../../schemas/src/index'
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
const connections = ref<Connections>({outgoing:[],incoming:[],impact:[]}); const error = ref(''); const feedbackOpen = ref(false); const feedbackText = ref(''); const feedbackBusy = ref(false)
const images = computed(() => doc.value?.metadata.screen?.screenshot.gallery || [])
const parser = new MarkdownIt({html:false,linkify:false})
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
  return {html:parser.renderer.render(tokens,parser.options,{}),headings,retired:content.retired}
})
function scrollHeading(index:number) { document.getElementById(parsed.value.headings[index].id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}) }
let sequence=0; let controller: AbortController | undefined
async function load() {
  const id=frontmatter.value.doc_id || new URLSearchParams(window.location.search).get('id')
  if(!id) return
  controller?.abort(); const abort = new AbortController(); controller = abort
  const request=++sequence;loading.value=true;selected.value=0;error.value='';doc.value=null;connections.value={outgoing:[],incoming:[],impact:[]}
  try {
    const data=await api<DocumentRecord>(`/api/documents/${id}`,{signal:abort.signal})
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
  <div v-if="loading" class="document-loading" role="status" aria-label="Đang tải tài liệu"><v-progress-linear indeterminate color="primary" /><v-skeleton-loader type="heading, paragraph, image, paragraph" /></div>
  <template v-if="doc"><div class="breadcrumb-line"><a href="/">Knowledge Hub</a><v-icon size="16" icon="mdi-chevron-right" /><a :href="`/${doc.relative_path.split('/')[0]}/`">{{ typeLabels[doc.metadata.type] }}</a><v-icon size="16" icon="mdi-chevron-right" /><span>{{ currentProject?.modules.find(m=>m.id === doc?.metadata.module)?.name || doc.metadata.module }}</span><v-icon size="16" icon="mdi-chevron-right" /><strong>{{ doc.metadata.doc_id }}</strong></div>
    <div class="document-layout"><article class="document-article"><header class="document-header"><div class="document-kicker"><code>{{ doc.metadata.doc_id }}</code><v-chip color="success" variant="tonal">Đã xuất bản</v-chip><span>{{ typeLabels[doc.metadata.type] }}</span></div><h1>{{ doc.metadata.title }}</h1><p class="document-summary">{{ doc.metadata.summary }}</p><div class="document-meta"><span><v-icon icon="mdi-account-outline" size="16" />{{ doc.metadata.owner }}</span><span><v-icon icon="mdi-clock-outline" size="16" />{{ dateLabel(doc.metadata.updated_at) }}</span><span>v{{ doc.metadata.version }}</span><span>{{ doc.metadata.language.toUpperCase() }}</span><span v-if="doc.metadata.effective_from">Hiệu lực {{ dateLabel(doc.metadata.effective_from) }}</span><span v-if="doc.metadata.review_due_at">Rà soát trước {{ dateLabel(doc.metadata.review_due_at) }}</span></div><div v-if="doc.metadata.verification" class="verification-note"><v-icon icon="mdi-check-decagram-outline" color="success" size="20" /><span>Đã được {{ doc.metadata.verification.reviewer }} xác nhận · {{ dateLabel(doc.metadata.verification.reviewed_at) }}</span></div><p v-else class="field-help mt-4">Bản đã xuất bản · Chưa có xác nhận qua quy trình duyệt</p><div class="document-actions"><v-btn v-if="canEdit" size="small" color="primary" variant="tonal" prepend-icon="mdi-pencil-outline" :href="`/studio/?doc=${doc.metadata.doc_id}`">Chỉnh sửa</v-btn><v-btn v-if="canEdit" size="small" variant="text" prepend-icon="mdi-history" :href="`/studio/history/?doc=${doc.metadata.doc_id}`">Lịch sử</v-btn><DownloadButton :url="`/api/documents/${doc.metadata.doc_id}/export.md`" :filename="`${doc.metadata.doc_id}.md`" label="Export Markdown">Export Markdown</DownloadButton><DownloadButton :url="`/api/documents/${doc.metadata.doc_id}/export.zip`" :filename="`${doc.metadata.doc_id}.zip`" icon="mdi-folder-zip-outline" label="Export đầy đủ">Export đầy đủ</DownloadButton><v-btn size="small" variant="text" prepend-icon="mdi-message-alert-outline" @click="feedbackOpen = true">Góp ý nội dung</v-btn></div></header>
      <p v-if="parsed.retired" class="field-help my-4">Nội dung kiểm thử cũ được giữ trong Markdown export và lịch sử; không còn là phân hệ của kho nghiệp vụ.</p><section v-if="doc.metadata.screen" class="navigation-info"><v-icon icon="mdi-routes" color="primary" /><div><span class="eyebrow">CÁCH VÀO MÀN HÌNH</span><p>{{ doc.metadata.screen.menu_path.join(' → ') }}</p><code>{{ doc.metadata.screen.route }}</code></div></section>
      <section v-if="images.length" class="screenshot-gallery"><div class="section-heading"><h2>Hình ảnh màn hình</h2><v-btn variant="text" size="small" prepend-icon="mdi-magnify-plus-outline" @click="zoom = true">Phóng to</v-btn></div><MediaImage class="gallery-main" :src="assetUrl(doc, images[selected].path)" :alt="images[selected].alt" zoomable /><p class="gallery-caption">{{ images[selected].caption }}</p><div class="gallery-thumbnails"><button v-for="(image,index) in images" :key="image.path" :class="{selected:index === selected}" :aria-label="image.alt" @click="selected = index"><img :src="assetUrl(doc, image.path)" :alt="image.alt" /><span>{{ image.category }}</span></button></div></section>
      <details class="mobile-toc"><summary>Mục lục · {{ parsed.headings.length }} mục</summary><a v-for="(heading,index) in parsed.headings" :key="heading.id" :href="`#${heading.id}`" @click.prevent="scrollHeading(index)">{{ heading.title }}</a></details><!-- Markdown is rendered as data with HTML disabled, from the same API snapshot as metadata. -->
<!-- eslint-disable-next-line vue/no-v-html -->
<ManagedContent class="prose document-body" :html="parsed.html" :image-layout="doc.metadata.image_layout" />
      <section v-if="doc.graphs.length" class="doc-diagrams"><div v-for="graph in doc.graphs" :key="graph.diagram_id" class="panel"><div class="section-heading"><h2>{{ graph.title }}</h2><a v-if="canEdit" :href="`/studio/diagrams/?doc=${doc.metadata.doc_id}&diagram=${graph.diagram_id}`" class="text-link">Mở Diagram Studio <v-icon icon="mdi-arrow-top-right" size="16" /></a></div><MermaidPreview :source="toMermaid(graph)" /><p>{{ graph.summary }}</p><code>{{ graph.diagram_id }} · Semantic JSON</code></div></section>
      <section class="related-section"><span class="eyebrow">Kết nối tri thức</span><h2>Quan hệ và tác động</h2><h3 v-if="connections.outgoing.length" class="mb-4">Liên kết đến</h3><div class="related-grid"><a v-for="edge in connections.outgoing.filter(e=>e.document)" :key="edge.kind + edge.target_id" :href="edge.document!.url" class="related-card"><v-icon :icon="typeIcons[edge.document!.metadata.type]" :class="['semantic-icon',`semantic-${iconGroup(edge.document!.metadata.type)}`]" /><div><small>{{ relationLabels[edge.kind] || edge.kind }} · {{ edge.target_id }}</small><strong>{{ edge.document!.metadata.title }}</strong></div></a></div><h3 v-if="connections.incoming.length" class="mt-6 mb-4">Được tham chiếu bởi</h3><div class="related-grid"><a v-for="edge in connections.incoming.filter(e=>e.document)" :key="edge.kind + edge.source_id" :href="edge.document!.url" class="related-card"><div><small>{{ relationLabels[edge.kind] || edge.kind }} · {{ edge.source_id }}</small><strong>{{ edge.document!.metadata.title }}</strong></div></a></div><details v-if="connections.impact.length" class="impact-panel"><summary>{{ connections.impact.length }} tài liệu có thể bị ảnh hưởng khi nội dung này thay đổi</summary><a v-for="item in connections.impact" :key="item.metadata.doc_id" :href="item.url" class="quality-doc"><span>{{ item.metadata.doc_id }} · {{ item.metadata.title }}</span><v-icon icon="mdi-arrow-top-right" size="18" /></a></details><p v-if="!connections.outgoing.length && !connections.incoming.length" class="field-help">Tài liệu chưa có liên kết nghiệp vụ.</p></section>
      <div v-if="doc.metadata.source_links.length" class="source-links"><h3>Nguồn tham chiếu</h3><a v-for="source in doc.metadata.source_links" :key="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.label }} <v-icon icon="mdi-open-in-new" size="15" /></a></div>
    </article><aside class="document-toc"><span class="eyebrow">TRONG TÀI LIỆU NÀY</span><a v-for="(heading,index) in parsed.headings" :key="heading.id" :href="`#${heading.id}`" @click.prevent="scrollHeading(index)">{{ heading.title }}</a><div class="toc-note"><v-icon icon="mdi-source-commit" size="20" /><span>Phiên bản có nguồn</span><code>{{ doc.published_revision?.slice(0,12) }}</code><p>Nội dung đã được xuất bản. Draft chỉ dành cho người biên tập.</p></div></aside></div>
    <v-dialog v-model="zoom" max-width="1400"><div class="lightbox"><v-btn icon="mdi-close" variant="text" aria-label="Đóng ảnh" @click="zoom = false" /><img v-if="images[selected]" :src="assetUrl(doc, images[selected].path)" :alt="images[selected].alt" /><p>{{ images[selected]?.caption }}</p></div></v-dialog>
  </template>
  <div v-else-if="!loading" class="empty-state"><h2>Không thể mở tài liệu</h2><p>{{ error || 'Kiểm tra quyền truy cập hoặc trạng thái xuất bản.' }}</p><v-btn variant="tonal" color="primary" @click="load">Thử lại</v-btn><a href="/library/" class="text-link ml-4">Về thư viện</a></div><v-dialog v-model="feedbackOpen" max-width="600"><form class="new-doc-form" @submit.prevent="sendFeedback"><h2>Góp ý nội dung</h2><p class="field-help mt-3">Mô tả thông tin chưa rõ, lỗi nghiệp vụ hoặc phần cần cập nhật. Nhóm biên tập sẽ xem góp ý này.</p><v-textarea v-model="feedbackText" label="Nội dung góp ý" maxlength="2000" required rows="5" class="mt-6" /><div class="form-actions"><v-btn variant="text" @click="feedbackOpen=false">Hủy</v-btn><v-btn type="submit" color="primary" :loading="feedbackBusy">Gửi góp ý</v-btn></div></form></v-dialog>
</template>
