<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import { types, typeLabels, typeIcons, type Session, type DocumentRecord } from '../../schemas/src/index'
import { api, canEdit, fail, projectDocuments, refreshDocuments, state } from './state'
import Dashboard from './Dashboard.vue'
import Catalog from './Catalog.vue'
import DocumentPage from './DocumentPage.vue'
const Studio = defineAsyncComponent(() => import('./DocumentStudio.vue'))
const DiagramStudio = defineAsyncComponent(() => import('./DiagramStudio.vue'))
const History = defineAsyncComponent(() => import('./History.vue'))
const { frontmatter, page } = useData()
const drawer = ref(true)
const searchOpen = ref(false)
const query = ref('')
const results = ref<DocumentRecord[]>([])
const searchBusy = ref(false)
const searchError = ref('')
const username = ref('admin')
const password = ref('')
const loginBusy = ref(false)
const loginError = ref('')
const health = ref<{total:number; broken:any[]; orphans:any[]} | null>(null)
const view = computed(() => frontmatter.value.atlas_view || 'document')
const routes: Record<string,string> = { overview: 'overview', 'business-flow': 'business-flows', module: 'modules', screen: 'screens', function: 'functions', role: 'roles', permission: 'permissions', 'business-rule': 'business-rules', 'test-scenario': 'test-scenarios', reference: 'references' }
const projects = computed(() => [...new Set(state.documents.map(d => d.metadata.project_id))])
const title = computed(() => frontmatter.value.title || 'Knowledge Hub')
const grouped = computed(() => types.map(type => { const docs = projectDocuments.value.filter(d => d.metadata.type === type).sort((a,b) => (a.metadata.order || 0) - (b.metadata.order || 0) || a.metadata.title.localeCompare(b.metadata.title,'vi')); return { type, docs, modules: [...new Set(docs.map(d => d.metadata.module))].map(name => ({ name, docs:docs.filter(d => d.metadata.module === name) })) } }))
async function login() {
  loginBusy.value = true; loginError.value = ''
  try { state.session = await api<Session>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: username.value, password: password.value }) }); password.value = ''; await refreshDocuments() }
  catch (error) { loginError.value = (error as Error).message }
  finally { loginBusy.value = false }
}
async function logout() { try { await api('/api/auth/logout', { method: 'POST' }); state.session = null; state.documents = [] } catch (error) { fail(error) } }
function snackbarChanged(value: boolean) { if (!value) state.notice = '' }
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchSequence = 0
watch([query, searchOpen], () => {
  clearTimeout(searchTimer)
  if (!searchOpen.value) return
  const sequence = ++searchSequence
  searchTimer = setTimeout(async () => {
    searchBusy.value = true; searchError.value = ''
    try { const data = await api<DocumentRecord[]>(`/api/documents?q=${encodeURIComponent(query.value)}&project_id=${state.project}`); if (sequence === searchSequence) results.value = data }
    catch (error) { searchError.value = (error as Error).message }
    finally { if (sequence === searchSequence) searchBusy.value = false }
  }, 180)
})
function shortcut(event: KeyboardEvent) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && state.session) { event.preventDefault(); searchOpen.value = !searchOpen.value } }
async function loadHealth() { if (view.value === 'health' && canEdit.value) try { health.value = await api('/api/knowledge/health') } catch (error) { fail(error) } }
watch(view, loadHealth)
onMounted(async () => {
  drawer.value = window.innerWidth >= 1000
  document.addEventListener('keydown', shortcut)
  try { state.session = await api<Session>('/api/auth/session'); await refreshDocuments(); await loadHealth() }
  catch (error) { if ((error as {status?:number}).status !== 401) fail(error) }
  finally { state.initialized = true }
})
onUnmounted(() => { document.removeEventListener('keydown', shortcut); clearTimeout(searchTimer) })
</script>

<template>
  <v-app>
    <a href="#main" class="skip-link">Đến nội dung chính</a>
    <div v-if="state.initialized && !state.session" class="login-page">
      <div class="login-intro"><span class="brand-word">atlas<span>.</span></span><span class="eyebrow">BUSINESS KNOWLEDGE HUB</span><h1>Mỗi câu hỏi.<br>Một nơi để bắt đầu.</h1><p>Kết nối kiến thức nghiệp vụ, màn hình và quy tắc để cả đội cùng hiểu đúng.</p><div class="login-note"><v-icon icon="mdi-book-open-page-variant-outline" /> Tri thức có nguồn. Cập nhật có lịch sử.</div></div>
      <form class="login-card" @submit.prevent="login"><div class="icon-box"><v-icon icon="mdi-shield-account-outline" /></div><h2>Chào mừng trở lại</h2><p>Đăng nhập để truy cập tri thức của đội ngũ.</p><v-text-field v-model="username" label="Tài khoản" autocomplete="username" required /><v-text-field v-model="password" label="Mật khẩu" type="password" autocomplete="current-password" required /><v-alert v-if="loginError" type="error" variant="tonal" class="mb-4">{{ loginError }}</v-alert><v-btn type="submit" color="primary" block size="large" :loading="loginBusy">Đăng nhập <v-icon end icon="mdi-arrow-right" /></v-btn><small>Trong môi trường Coder, dùng gateway xác thực của tổ chức.</small></form>
    </div>
    <template v-else>
      <v-navigation-drawer v-model="drawer" :permanent="false" width="256" class="atlas-sidebar">
        <a class="brand" href="/"><span class="brand-mark"><v-icon icon="mdi-layers-triple-outline" size="24" /></span><span class="brand-word">atlas<span>.</span></span><span class="brand-label">KNOWLEDGE HUB</span></a>
        <div class="project-switch"><span class="eyebrow">KHÔNG GIAN LÀM VIỆC</span><v-select v-model="state.project" :items="projects.length ? projects : ['demo-project']" hide-details aria-label="Chọn project" prepend-inner-icon="mdi-cube-outline" /></div>
        <nav aria-label="Điều hướng tri thức"><a class="nav-link" :class="{active: view === 'dashboard'}" href="/"><v-icon icon="mdi-view-dashboard-outline" size="20" />Tổng quan</a><div class="nav-label">KHÁM PHÁ TRI THỨC</div>
          <div v-for="group in grouped" :key="group.type" class="nav-group"><a class="nav-link" :class="{active: frontmatter.entity_type === group.type || frontmatter.type === group.type}" :href="`/${routes[group.type]}/`"><v-icon :icon="typeIcons[group.type]" size="20" /><span>{{ typeLabels[group.type] }}</span><small>{{ group.docs.length }}</small></a><template v-if="frontmatter.entity_type === group.type || frontmatter.type === group.type"><details v-for="branch in group.modules" :key="branch.name" class="tree-details"><summary :aria-label="`Mở cây ${typeLabels[group.type]} ${branch.name}`"><span>{{ branch.name }}</span><v-icon size="14" icon="mdi-chevron-down" /></summary><a v-for="doc in branch.docs" :key="doc.metadata.doc_id" :href="doc.url" class="tree-doc" :title="doc.metadata.title">{{ doc.metadata.doc_id }}</a></details></template></div>
          <template v-if="canEdit"><div class="nav-label">BIÊN TẬP & QUẢN LÝ</div><a class="nav-link" :class="{active:view === 'studio'}" href="/studio/"><v-icon icon="mdi-file-document-edit-outline" size="20" />Document Studio</a><a class="nav-link" :class="{active:view === 'diagrams'}" href="/studio/diagrams/"><v-icon icon="mdi-vector-polyline" size="20" />Diagram Studio</a><a class="nav-link" :class="{active:view === 'history'}" href="/studio/history/"><v-icon icon="mdi-history" size="20" />Lịch sử phiên bản</a><a class="nav-link" :class="{active:view === 'health'}" href="/health/"><v-icon icon="mdi-heart-pulse" size="20" />Sức khỏe tri thức</a></template>
          <a class="nav-link" href="/settings/integrations/"><v-icon icon="mdi-connection" size="20" />Tích hợp <span class="nav-soon">Sắp tới</span></a>
        </nav>
        <template #append><div class="sidebar-footer"><span class="status-dot" :class="{'muted-dot':!state.session}"></span>{{ state.session ? 'Đã xác thực · Filesystem' : 'Đang kết nối' }}<small>Atlas Knowledge Hub · v1.0</small></div></template>
      </v-navigation-drawer>
      <v-app-bar flat height="76" class="atlas-topbar"><v-btn icon="mdi-menu" variant="text" aria-label="Đóng mở sidebar" @click="drawer = !drawer" /><span class="topbar-title">{{ title }}</span><v-spacer /><button class="search-trigger" @click="searchOpen = true"><v-icon icon="mdi-magnify" size="20" /><span>Tìm kiếm tri thức...</span><kbd>Ctrl K</kbd></button><v-divider vertical inset class="mx-5" /><v-menu><template #activator="{ props }"><button v-bind="props" class="user-trigger"><span class="user-avatar">{{ state.session?.user.slice(0,2).toUpperCase() || 'AT' }}</span><span class="user-name">{{ state.session?.user || 'Atlas' }}<small>{{ state.session?.role || 'Knowledge Hub' }}</small></span><v-icon icon="mdi-chevron-down" size="18" /></button></template><v-list><v-list-item title="Đăng xuất" prepend-icon="mdi-logout" @click="logout" /></v-list></v-menu></v-app-bar>
      <v-main><main id="main" class="main-content">
        <template v-if="!state.initialized"><v-skeleton-loader type="heading, paragraph, image" /></template>
        <template v-else-if="state.session">
          <Dashboard v-if="view === 'dashboard'" @search="searchOpen = true" />
          <Catalog v-else-if="view === 'catalog'" :type="frontmatter.entity_type" :title="title" />
          <ClientOnly><Studio v-if="view === 'studio' && canEdit" /><DiagramStudio v-else-if="view === 'diagrams' && canEdit" /><History v-else-if="view === 'history' && canEdit" /></ClientOnly>
          <template v-if="['studio','diagrams','history','health'].includes(view) && !canEdit"><v-alert type="info" variant="tonal">Trang này dành cho Editor, Publisher hoặc Admin.</v-alert></template>
          <section v-else-if="view === 'integrations'" class="narrow-page"><span class="eyebrow">KẾT NỐI TRI THỨC</span><h1>Tri thức hôm nay.<br>Sẵn sàng cho ngày mai.</h1><p class="lead">Nguồn Published đã có API xác thực và citations. Các tích hợp dưới đây nằm trong roadmap.</p><div class="integration-grid"><article v-for="integration in ['MCP · VS Code','Dify','RAGFlow']" :key="integration" class="panel"><v-icon icon="mdi-connection" size="30" color="primary" /><h3>{{ integration }}</h3><v-chip variant="tonal">Chưa triển khai</v-chip><p>Chỉ kết nối sau khi tổ chức phê duyệt danh tính, phạm vi truy cập và chính sách dữ liệu.</p></article></div><div class="panel mt-6"><h3>Knowledge API đã sẵn sàng</h3><code>/api/knowledge/search</code><br><code>/api/knowledge/documents/:docId</code><p>Đọc bản Published/Internal theo cùng quyền với website. Không có chatbot hoặc kết nối AI giả lập.</p></div></section>
          <section v-else-if="view === 'health' && canEdit" class="narrow-page"><span class="eyebrow">CHẤT LƯỢNG NỘI DUNG</span><h1>Sức khỏe tri thức</h1><p class="lead">Kiểm tra liên kết và các tài liệu chưa có kết nối.</p><template v-if="health"><div class="metric-grid"><div class="metric-card"><strong>{{ health.total }}</strong><span>Tài liệu Published</span></div><div class="metric-card"><strong>{{ health.broken.length }}</strong><span>Liên kết ID lỗi</span></div><div class="metric-card"><strong>{{ health.orphans.length }}</strong><span>Tài liệu chưa kết nối</span></div></div><div class="panel mt-6"><h3>Kết quả kiểm tra</h3><p v-if="!health.broken.length && !health.orphans.length">Tất cả tài liệu đều có liên kết hợp lệ.</p><p v-for="item in health.broken" :key="item.doc_id + item.missing_id">{{ item.doc_id }} → {{ item.missing_id }}: chưa tồn tại</p><p v-for="item in health.orphans" :key="item.doc_id">{{ item.doc_id }} · {{ item.title }}</p></div></template></section>
          <DocumentPage v-else-if="view === 'document' && !page.isNotFound" />
          <div v-else-if="page.isNotFound" class="empty-state"><v-icon icon="mdi-file-search-outline" size="48" /><h1>Không tìm thấy trang</h1><p>Tài liệu có thể đã được gỡ xuất bản.</p><v-btn color="primary" href="/">Về tổng quan</v-btn></div>
        </template>
        <footer class="page-footer"><span>atlas<span class="brand-dot">.</span> Một nguồn tri thức, cùng một cách hiểu.</span><span>Demo Workflow System · Dữ liệu minh họa</span></footer>
      </main></v-main>
    </template>
    <v-dialog v-model="searchOpen" max-width="700"><div class="search-dialog"><v-text-field v-model="query" autofocus prepend-inner-icon="mdi-magnify" placeholder="Tìm theo ID, từ khóa, module hoặc nội dung..." hide-details variant="solo" flat aria-label="Tìm kiếm tri thức" /><div class="search-results"><p class="eyebrow">{{ searchBusy ? 'ĐANG TÌM KIẾM...' : `${results.length} KẾT QUẢ · PUBLISHED` }}</p><v-alert v-if="searchError" type="error" variant="tonal">{{ searchError }}</v-alert><a v-for="doc in results" :key="doc.metadata.doc_id" :href="doc.url" class="search-result" @click="searchOpen = false"><span class="icon-box"><v-icon :icon="typeIcons[doc.metadata.type]" /></span><span><strong>{{ doc.metadata.title }}</strong><small>{{ doc.metadata.doc_id }} · {{ typeLabels[doc.metadata.type] }}</small></span><v-icon icon="mdi-arrow-top-right" size="19" /></a><p v-if="!searchBusy && !results.length && !searchError" class="empty-text">Không tìm thấy tài liệu phù hợp. Thử ID hoặc từ khóa khác.</p></div><div class="search-footer">ID chính xác được ưu tiên · <kbd>Esc</kbd> để đóng</div></div></v-dialog>
    <v-snackbar :model-value="!!state.notice" :color="state.noticeColor" :timeout="7000" @update:model-value="snackbarChanged">{{ state.notice }}<template #actions><v-btn variant="text" aria-label="Đóng thông báo" @click="state.notice = ''">Đóng</v-btn></template></v-snackbar>
  </v-app>
</template>
