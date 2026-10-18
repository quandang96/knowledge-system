<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { isActiveType, types, projectSchema, typeLabels, type WorkspaceResponse } from '../../schemas/src/index'
import { api, canManage, changeProject, fail, notify, refreshWorkspace, state } from './state'
const loading = ref(false); const operationsLoading = ref(false); const operationsError = ref('')
async function loadOperations() { if(!canManage.value)return;operationsLoading.value=true;operationsError.value='';try{operations.value=await api('/api/operations')}catch(error){operationsError.value=(error as Error).message}finally{operationsLoading.value=false} }
const operations = ref<{disk:{free_bytes:number;total_bytes:number;low_space:boolean};release_count:number;search:{samples:number;p95_ms:number|null}} | null>(null);
const config = ref<WorkspaceResponse | null>(null); const busy = ref(false); const error = ref('')
const selected = ref(''); const newId = ref(''); const newName = ref(''); const moduleId = ref(''); const moduleName = ref('')
const project = computed(() => config.value?.projects.find(p => p.id === selected.value))
const documentTypeItems=types.map(value=>({title:typeLabels[value],value}))
const activeTemplates=computed(()=>config.value?.templates.filter(item=>isActiveType(item.type))||[])
async function load() {loading.value=true;error.value='';try{await refreshWorkspace();config.value = structuredClone(JSON.parse(JSON.stringify(state.workspace))); selected.value = state.project || config.value?.projects[0]?.id || ''}catch(failure){error.value=(failure as Error).message}finally{loading.value=false}}
function addProject() {
  try {
    const item = projectSchema.parse({ id: newId.value, name: newName.value })
    if (config.value?.projects.some(p => p.id === item.id)) throw new Error('Project ID đã tồn tại.')
    config.value?.projects.push(item); selected.value = item.id; newId.value = ''; newName.value = ''; error.value = ''
  } catch { error.value = 'Nhập tên project và ID dạng chữ thường, số, dấu gạch nối; ID không được trùng.' }
}
function addModule() {
  if (!project.value || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(moduleId.value) || !moduleName.value.trim() || project.value.modules.some(m => m.id === moduleId.value)) { error.value = 'Module cần ID hợp lệ, không trùng và tên hiển thị.'; return }
  project.value.modules.push({ id: moduleId.value, name: moduleName.value.trim() }); moduleId.value = ''; moduleName.value = ''; error.value = ''
}
function addTemplate() {
  config.value?.templates.push({ id: `mau-${Date.now().toString(36)}`, name: 'Mẫu tài liệu mới', type: 'reference', project_id: selected.value || undefined, version: 1, body: '# Tiêu đề\n\n## Nội dung\n\nĐiền nội dung đã được xác nhận tại đây.\n\n## Nguồn quyết định\n\nĐiền nội dung đã được xác nhận tại đây.\n' })
}
async function save() {
  if (!config.value || busy.value || loading.value) return
  busy.value = true; error.value = ''
  try {
    const { revision, ...value } = config.value
    config.value = await api<WorkspaceResponse>('/api/workspace', { method: 'PUT', body: JSON.stringify({ config: value, base_revision: revision }) })
    await refreshWorkspace(); if (selected.value) changeProject(selected.value)
    notify('Đã lưu cấu hình không gian làm việc.')
  } catch (e) { error.value = (e as Error).message; fail(e) } finally { busy.value = false }
}
onMounted(() => {void load();void loadOperations()})
</script>
<template>
  <header class="page-heading"><div><span class="eyebrow">Không gian làm việc</span><h1>Cấu hình tri thức</h1><p>Project, phân hệ và mẫu tài liệu của đội ngũ.</p></div><div class="studio-actions"><v-btn variant="text" :disabled="busy || loading" :loading="loading" @click="load">Tải lại</v-btn><v-btn v-if="canManage" color="primary" :loading="busy" :disabled="loading || busy" @click="save">Lưu cấu hình</v-btn></div></header>
  <v-skeleton-loader v-if="loading && !config" type="heading, paragraph, article" aria-label="Đang tải cấu hình" /><v-progress-linear v-else-if="loading" indeterminate color="primary" /><v-progress-linear v-if="operationsLoading" indeterminate color="primary" /><v-alert v-if="operationsError" type="warning" variant="tonal">{{ operationsError }}<v-btn variant="text" @click="loadOperations">Thử lại thông tin vận hành</v-btn></v-alert><v-alert v-if="error" type="error" variant="tonal" class="mb-6">{{ error }}</v-alert>
  <v-alert v-if="!canManage" type="info" variant="tonal" class="mb-6">Admin quản lý cấu hình. Các project dùng chung quyền truy cập nội bộ; bộ chọn project là bộ lọc ngữ cảnh.</v-alert>
  <div v-if="config" class="settings-layout">
    <section class="panel"><h2>Không gian và project</h2><v-text-field v-model="config.name" label="Tên không gian" :readonly="!canManage" class="mt-6" /><v-select v-model="selected" :items="config.projects" item-title="name" item-value="id" label="Project" />
      <template v-if="project"><code>{{ project.id }}</code><v-text-field v-model="project.name" label="Tên hiển thị" :readonly="!canManage" class="mt-4" /><v-textarea v-model="project.description" label="Mô tả" rows="2" :readonly="!canManage" /><v-switch v-model="project.demo" label="Project chứa dữ liệu minh họa" color="primary" :disabled="!canManage" hide-details /><v-switch v-model="project.require_review" label="Yêu cầu người khác duyệt trước khi xuất bản" color="primary" :disabled="!canManage" hide-details /><p class="field-help mt-4">Bản nháp dùng chung cho nhóm biên tập. Project mới mặc định yêu cầu duyệt. Bản đã xuất bản vẫn phục vụ trong khi chỉnh sửa.</p>
        <h3 class="mt-8 mb-4">Phân hệ</h3><div v-for="item in project.modules" :key="item.id" class="module-row"><code>{{ item.id }}</code><v-text-field v-model="item.name" label="Tên phân hệ" hide-details :readonly="!canManage" /></div><div v-if="canManage" class="form-grid mt-6"><v-text-field v-model="moduleId" label="ID phân hệ mới" placeholder="thanh-toan" /><v-text-field v-model="moduleName" label="Tên phân hệ mới" /><v-btn variant="tonal" color="primary" @click="addModule">Thêm phân hệ</v-btn></div>
      </template>
      <details v-if="canManage" class="settings-add"><summary>Tạo project mới</summary><v-text-field v-model="newId" label="Project ID" placeholder="san-pham-noi-bo" class="mt-4" /><v-text-field v-model="newName" label="Tên project" /><v-btn variant="tonal" color="primary" @click="addProject">Thêm project</v-btn><p class="field-help mt-4">Thêm ít nhất một phân hệ rồi lưu cấu hình để bắt đầu tạo tài liệu.</p></details>
    </section>
    <section class="panel"><div class="section-heading"><h2>Mẫu tài liệu</h2><v-btn v-if="canManage" variant="text" prepend-icon="mdi-plus" @click="addTemplate">Thêm mẫu</v-btn></div><p class="field-help">Mẫu có thể dùng chung hoặc chỉ trong một project. Nội dung thay đổi sẽ tăng phiên bản khi lưu.</p>
      <div v-if="!config.templates.length" class="empty-state"><v-icon icon="mdi-file-document-outline" size="36" /><h3>Đang dùng mẫu mặc định</h3><p>Thêm mẫu để thống nhất cấu trúc tài liệu của đội ngũ.</p></div>
      <details v-for="item in activeTemplates" :key="item.id" class="template-item"><summary>{{ item.name }} <small>v{{ item.version }}</small></summary><div class="form-grid mt-6"><v-text-field v-model="item.name" label="Tên mẫu" :readonly="!canManage" /><v-select v-model="item.type" :items="documentTypeItems" label="Loại tài liệu" :readonly="!canManage" /><v-select v-model="item.project_id" :items="[{id:undefined,name:'Dùng chung'}, ...config.projects]" item-title="name" item-value="id" label="Phạm vi" :readonly="!canManage" /></div><v-textarea v-model="item.body" label="Nội dung Markdown" rows="10" :readonly="!canManage" class="template-source" /></details>
    </section>
  </div><section v-if="operations && canManage" class="panel mt-6"><h2>Vận hành kho tri thức</h2><v-alert v-if="operations.disk.low_space" type="warning" variant="tonal" class="mt-4">Dung lượng trống thấp. Kiểm tra backup và chính sách giữ bản phát hành.</v-alert><div class="operations-grid mt-6"><p><strong>{{ (operations.disk.free_bytes / 1024**3).toFixed(1) }} GB</strong><span>Dung lượng trống</span></p><p><strong>{{ operations.release_count }}</strong><span>Bản phát hành đang giữ</span></p><p><strong>{{ operations.search.p95_ms === null ? '—' : operations.search.p95_ms.toFixed(1) + ' ms' }}</strong><span>Search p95 · {{ operations.search.samples }} request gần đây</span></p></div><p class="field-help mt-6">Kho hoạt động với một API writer. Theo dõi thời gian publish trong trang Duyệt và xuất bản; backup và dọn bản cũ theo hướng dẫn vận hành trong README.</p></section>
</template>
