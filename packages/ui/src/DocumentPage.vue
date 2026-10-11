<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Content, useData } from 'vitepress'
import { type DocumentRecord, typeIcons, typeLabels } from '../../schemas/src/index'
import { api, assetUrl, canEdit, dateLabel, fail, projectDocuments } from './state'
import MermaidPreview from './MermaidPreview.vue'
import { toMermaid } from '../../schemas/src/graph-utils'
const { frontmatter } = useData()
const doc = ref<DocumentRecord | null>(null); const loading = ref(false); const selected = ref(0); const zoom = ref(false); const mermaidSources = ref<string[]>([])
const contentHost = ref<HTMLElement>()
const related = computed(() => projectDocuments.value.filter(d => doc.value?.metadata.related_ids.includes(d.metadata.doc_id)))
const images = computed(() => doc.value?.metadata.screen?.screenshot.gallery || [])
const toc = computed(() => [...(doc.value?.body.matchAll(/^##\s+(.+)$/gm) || [])].map(m => m[1]))
function scrollHeading(index: number) { const headings = contentHost.value?.querySelectorAll('h2'); headings?.[index]?.scrollIntoView({ behavior:'smooth', block:'start' }) }
async function load() {
  const id = frontmatter.value.doc_id
  if (!id) return
  loading.value = true; selected.value = 0
  try { doc.value = await api<DocumentRecord>(`/api/documents/${id}`); mermaidSources.value = [...doc.value.body.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)].map(m => m[1]) }
  catch (error) { doc.value = null; fail(error) }
  finally { loading.value = false }
}
onMounted(load); watch(() => frontmatter.value.doc_id, load)
</script>
<template>
  <v-progress-linear v-if="loading" indeterminate color="primary" />
  <template v-if="doc"><div class="breadcrumb-line"><a href="/">Knowledge Hub</a><v-icon size="16" icon="mdi-chevron-right" /><a :href="`/${doc.relative_path.split('/')[0]}/`">{{ typeLabels[doc.metadata.type] }}</a><v-icon size="16" icon="mdi-chevron-right" /><span>{{ doc.metadata.module }}</span><v-icon size="16" icon="mdi-chevron-right" /><strong>{{ doc.metadata.doc_id }}</strong></div>
    <div class="document-layout"><article class="document-article"><header class="document-header"><div class="document-kicker"><code>{{ doc.metadata.doc_id }}</code><v-chip color="success" variant="tonal"><span class="status-dot"></span>Published</v-chip><span>{{ typeLabels[doc.metadata.type] }}</span></div><h1>{{ doc.metadata.title }}</h1><p class="document-summary">{{ doc.metadata.summary }}</p><div class="document-meta"><span><v-icon icon="mdi-account-outline" size="16" />{{ doc.metadata.owner }}</span><span><v-icon icon="mdi-clock-outline" size="16" />{{ dateLabel(doc.metadata.updated_at) }}</span><span>v{{ doc.metadata.version }}</span><span>{{ doc.metadata.language.toUpperCase() }}</span></div><div class="document-actions"><v-btn v-if="canEdit" size="small" color="primary" variant="tonal" prepend-icon="mdi-pencil-outline" :href="`/studio/?doc=${doc.metadata.doc_id}`">Chỉnh sửa</v-btn><v-btn v-if="canEdit" size="small" variant="text" prepend-icon="mdi-history" :href="`/studio/history/?doc=${doc.metadata.doc_id}`">Lịch sử</v-btn><v-btn size="small" variant="text" prepend-icon="mdi-download-outline" :href="`/api/documents/${doc.metadata.doc_id}/export.md`">Export Markdown</v-btn><v-btn size="small" variant="text" prepend-icon="mdi-folder-zip-outline" :href="`/api/documents/${doc.metadata.doc_id}/export.zip`">Export đầy đủ</v-btn></div></header>
      <section v-if="doc.metadata.screen" class="navigation-info"><v-icon icon="mdi-routes" color="primary" /><div><span class="eyebrow">CÁCH VÀO MÀN HÌNH</span><p>{{ doc.metadata.screen.menu_path.join(' → ') }}</p><code>{{ doc.metadata.screen.route }}</code></div></section>
      <section v-if="images.length" class="screenshot-gallery"><div class="section-heading"><h2>Hình ảnh màn hình</h2><v-btn variant="text" size="small" prepend-icon="mdi-magnify-plus-outline" @click="zoom = true">Phóng to</v-btn></div><button class="gallery-main" aria-label="Phóng to ảnh màn hình" @click="zoom = true"><img :src="assetUrl(doc, images[selected].path)" :alt="images[selected].alt" /></button><p class="gallery-caption">{{ images[selected].caption }}</p><div class="gallery-thumbnails"><button v-for="(image,index) in images" :key="image.path" :class="{selected:index === selected}" :aria-label="image.alt" @click="selected = index"><img :src="assetUrl(doc, image.path)" :alt="image.alt" /><span>{{ image.category }}</span></button></div></section>
      <div ref="contentHost" class="prose document-body"><Content /></div>
      <section v-if="doc.graphs.length" class="doc-diagrams"><div v-for="graph in doc.graphs" :key="graph.diagram_id" class="panel"><div class="section-heading"><h2>{{ graph.title }}</h2><a v-if="canEdit" :href="`/studio/diagrams/?doc=${doc.metadata.doc_id}&diagram=${graph.diagram_id}`" class="text-link">Mở Diagram Studio <v-icon icon="mdi-arrow-top-right" size="16" /></a></div><MermaidPreview :source="toMermaid(graph)" /><p>{{ graph.summary }}</p><code>{{ graph.diagram_id }} · Semantic JSON</code></div></section>
      <MermaidPreview v-for="(source,index) in mermaidSources" :key="index" :source="source" />
      <section class="related-section"><span class="eyebrow">KẾT NỐI TRI THỨC</span><h2>Tài liệu liên quan</h2><div class="related-grid"><a v-for="item in related" :key="item.metadata.doc_id" :href="item.url" class="related-card"><v-icon :icon="typeIcons[item.metadata.type]" color="primary" /><div><small>{{ typeLabels[item.metadata.type] }} · {{ item.metadata.doc_id }}</small><strong>{{ item.metadata.title }}</strong></div><v-icon icon="mdi-arrow-top-right" size="18" /></a></div></section>
      <div v-if="doc.metadata.source_links.length" class="source-links"><h3>Nguồn tham chiếu</h3><a v-for="source in doc.metadata.source_links" :key="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.label }} <v-icon icon="mdi-open-in-new" size="15" /></a></div>
    </article><aside class="document-toc"><span class="eyebrow">TRONG TÀI LIỆU NÀY</span><a v-for="(heading,index) in toc" :key="heading" href="#" @click.prevent="scrollHeading(index)">{{ heading }}</a><div class="toc-note"><v-icon icon="mdi-source-commit" size="20" /><span>Phiên bản có nguồn</span><code>{{ doc.published_revision?.slice(0,12) }}</code><p>Nội dung đã được xuất bản. Draft chỉ dành cho người biên tập.</p></div></aside></div>
    <v-dialog v-model="zoom" max-width="1400"><div class="lightbox"><v-btn icon="mdi-close" variant="text" aria-label="Đóng ảnh" @click="zoom = false" /><img v-if="images[selected]" :src="assetUrl(doc, images[selected].path)" :alt="images[selected].alt" /><p>{{ images[selected]?.caption }}</p></div></v-dialog>
  </template>
  <div v-else-if="!loading" class="empty-state"><h2>Tài liệu chưa được xuất bản</h2><p>Kiểm tra quyền truy cập hoặc trạng thái xuất bản.</p><a href="/">Về tổng quan</a></div>
</template>
