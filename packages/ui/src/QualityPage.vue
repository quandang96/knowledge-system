<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { relationLabels, type QualityReport, type FeedbackItem } from '../../schemas/src/index'
import { api, currentProject, fail, notify, state } from './state'
const feedback = ref<FeedbackItem[]>([]); const report = ref<QualityReport | null>(null); const busy = ref(false); const error = ref(''); const tab = ref('matrix')
const items = computed(() => tab.value === 'overdue' ? report.value?.overdue : report.value?.orphans)
let sequence = 0
async function load() {
  const request = ++sequence; busy.value = true; error.value = ''; report.value = null
  try { const [data, comments] = await Promise.all([api<QualityReport>(`/api/quality?project_id=${encodeURIComponent(state.project)}`),api<FeedbackItem[]>(`/api/feedback?project_id=${encodeURIComponent(state.project)}`)]); if (request === sequence) {report.value = data;feedback.value=comments} }
  catch (e) { if (request === sequence) error.value = (e as Error).message } finally { if (request === sequence) busy.value = false }
}
async function resolve(id:string) { try {await api(`/api/feedback/${id}/resolve`,{method:'POST'});notify('Đã đánh dấu góp ý là đã xử lý.');await load()} catch(e) {fail(e)} }
onMounted(load); watch(() => state.project, load)
</script>
<template>
  <header class="page-heading"><div><span class="eyebrow">{{ currentProject?.name }}</span><h1>Chất lượng và truy vết</h1><p>Kiểm tra nguồn tri thức và những phần cần BA/Dev/QA đối chiếu.</p></div><v-btn variant="outlined" @click="load">Làm mới</v-btn></header>
  <v-alert v-if="error" type="error" variant="tonal">{{ error }}</v-alert><v-skeleton-loader v-if="busy" type="heading, paragraph, table" />
  <template v-if="report"><div class="metric-grid"><article class="metric-card"><strong>{{ report.total }}</strong><span>Tài liệu đã xuất bản</span></article><article class="metric-card"><strong>{{ report.orphans.length }}</strong><span>Chưa kết nối</span></article><article class="metric-card"><strong>{{ report.overdue.length }}</strong><span>Quá hạn rà soát</span></article><article class="metric-card"><strong>{{ report.broken.length }}</strong><span>Tham chiếu chưa tồn tại</span></article></div>
    <section class="panel mt-8"><v-tabs v-model="tab" color="primary"><v-tab value="matrix">Ma trận liên kết</v-tab><v-tab value="overdue">Cần rà soát</v-tab><v-tab value="orphans">Chưa kết nối</v-tab></v-tabs>
      <div v-if="tab === 'matrix'" class="catalog-table mt-6"><table><thead><tr><th>Nguồn</th><th>Quan hệ</th><th>Đích</th><th>Nguồn khai báo</th></tr></thead><tbody><tr v-for="edge in report.edges" :key="`${edge.source_id}:${edge.kind}:${edge.target_id}`"><td>{{ edge.source_id }}</td><td>{{ relationLabels[edge.kind] || edge.kind }}</td><td>{{ edge.target_id }}</td><td>{{ edge.origin === 'metadata' ? 'Tài liệu' : edge.origin === 'content' ? 'Trong nội dung' : edge.origin }}</td></tr></tbody></table><p v-if="!report.edges.length" class="empty-text">Chưa có liên kết nghiệp vụ.</p></div>
      <template v-else><p class="field-help mt-6">{{ tab === 'overdue' ? 'Owner cần đối chiếu nội dung và đặt lại ngày rà soát sau khi xác nhận.' : 'Các tài liệu chưa có liên kết đi hoặc đến.' }}</p><a v-for="doc in items" :key="doc.metadata.doc_id" :href="doc.url" class="quality-doc"><div><strong>{{ doc.metadata.title }}</strong><small>{{ doc.metadata.doc_id }} · {{ doc.metadata.owner }}</small></div><v-icon icon="mdi-arrow-top-right" /></a><p v-if="!items?.length" class="empty-text">Không có tài liệu cần xử lý ở mục này.</p></template>
    </section><section v-if="report.broken.length" class="panel mt-6"><h2>Tham chiếu cần sửa</h2><p v-for="edge in report.broken" :key="`${edge.source_id}:${edge.target_id}`" class="mt-4">{{ edge.source_id }} → {{ edge.target_id }}</p></section>
    <section class="panel mt-6"><div class="section-heading"><h2>Góp ý nội dung</h2><span>{{ feedback.filter(i=>i.status === 'open').length }} chưa xử lý</span></div><p v-if="!feedback.length" class="field-help">Góp ý từ trang đọc tài liệu sẽ xuất hiện tại đây.</p><article v-for="item in feedback" :key="item.id" class="feedback-row"><div><strong>{{ item.doc_id }} · {{ item.title }}</strong><p>{{ item.message }}</p><small>{{ item.user }} · {{ new Date(item.created_at).toLocaleString('vi-VN') }}</small></div><v-btn v-if="item.status === 'open'" variant="tonal" color="primary" size="small" @click="resolve(item.id)">Đã xử lý</v-btn><span v-else class="field-help">Đã xử lý bởi {{ item.resolved_by }}</span></article></section>
  </template>
</template>
