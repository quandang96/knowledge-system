<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import { useData } from 'vitepress'
import { types, typeLabels, typeIcons, type Session } from '../../schemas/src/index'
import { api, canEdit, canManage, changeProject, currentProject, fail, projectDocuments, refreshDocuments, refreshWorkspace, state } from './state'
import Dashboard from './Dashboard.vue'
import Catalog from './Catalog.vue'
import DocumentPage from './DocumentPage.vue'
import SearchDialog from './SearchDialog.vue'
import { iconGroup } from './theme'
const Studio = defineAsyncComponent(() => import('./DocumentStudio.vue'))
const DiagramStudio = defineAsyncComponent(() => import('./DiagramStudio.vue'))
const History = defineAsyncComponent(() => import('./History.vue'))
const WorkspaceSettings = defineAsyncComponent(() => import('./WorkspaceSettings.vue'))
const ReviewQueue = defineAsyncComponent(() => import('./ReviewQueue.vue'))
const QualityPage = defineAsyncComponent(() => import('./QualityPage.vue'))
const LegacyArchive = defineAsyncComponent(() => import('./LegacyArchive.vue'))
const { frontmatter, page } = useData()
const drawer = ref(true); const searchOpen = ref(false)
const username = ref(''); const password = ref(''); const loginBusy = ref(false); const loginError = ref('')
const view = computed(() => frontmatter.value.type==='test-scenario'||frontmatter.value.entity_type==='test-scenario'?'legacy':frontmatter.value.atlas_view || 'document')
const routes: Record<string,string> = { overview: 'overview', 'business-flow': 'business-flows', module: 'modules', screen: 'screens', function: 'functions', role: 'roles', permission: 'permissions', 'business-rule': 'business-rules', reference: 'references' }
const title = computed(() => frontmatter.value.title || state.workspace?.name || 'Knowledge Hub')
const editorViews = ['studio','diagrams','history','health','reviews']
const grouped = computed(() => types.map(type => ({ type, count: projectDocuments.value.filter(d => d.metadata.type === type).length })))
async function initialize() { await refreshWorkspace(); await refreshDocuments() }
async function login() {
  loginBusy.value = true; loginError.value = ''; state.initialized = false
  try { state.session = await api<Session>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: username.value, password: password.value }) }); password.value = ''; await initialize() }
  catch (e) { loginError.value = (e as Error).message } finally { loginBusy.value = false; state.initialized = true }
}
async function logout() { try { const event = new Event('atlas:before-project-change', {cancelable:true}); if (!window.dispatchEvent(event)) return; await api('/api/auth/logout', {method:'POST'}); state.session = null; state.documents = []; state.workspace = null; state.project = '' } catch(e) { fail(e) } }
function shortcut(event: KeyboardEvent) { if (!event.defaultPrevented && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && state.session) { event.preventDefault(); searchOpen.value = !searchOpen.value } }
function snackbarChanged(visible: boolean) { if (!visible) state.notice = '' }
onMounted(async () => {
  drawer.value = window.innerWidth >= 1100
  document.addEventListener('keydown', shortcut)
  try { state.session = await api<Session>('/api/auth/session'); await initialize() }
  catch (e) { if ((e as {status?:number}).status !== 401) fail(e) } finally { state.initialized = true }
})
onUnmounted(() => document.removeEventListener('keydown', shortcut))
</script>
<template>
  <v-app>
    <a href="#main" class="skip-link">Đến nội dung chính</a>
    <div v-if="state.initialized && !state.session" class="login-page">
      <div class="login-intro"><span class="brand-word">atlas<span>.</span></span><span class="eyebrow">Business Knowledge Hub</span><h1>Hiểu nghiệp vụ.<br>Cùng một nguồn tri thức.</h1><p>Quy trình, màn hình, quy tắc và kiểm thử được kết nối trong không gian của đội ngũ.</p><div class="login-note"><v-icon icon="mdi-book-open-page-variant-outline" /> Có nguồn tham chiếu. Có lịch sử thay đổi.</div></div>
      <form class="login-card" @submit.prevent="login"><div class="icon-box"><v-icon icon="mdi-account-outline" /></div><h2>Đăng nhập Atlas</h2><p>Truy cập kho tri thức nội bộ của đội ngũ.</p><v-text-field v-model="username" label="Tài khoản" autocomplete="username" required /><v-text-field v-model="password" label="Mật khẩu" type="password" autocomplete="current-password" required /><v-alert v-if="loginError" type="error" variant="tonal" class="mb-4">{{ loginError }}</v-alert><v-btn type="submit" color="primary" block size="large" :loading="loginBusy">Đăng nhập <v-icon end icon="mdi-arrow-right" /></v-btn></form>
    </div>
    <template v-else>
      <v-navigation-drawer v-model="drawer" :permanent="false" width="248" class="atlas-sidebar">
        <a class="brand" href="/"><span class="brand-mark"><v-icon icon="mdi-layers-triple-outline" size="24" /></span><span class="brand-word">atlas<span>.</span></span><span class="brand-label">Knowledge Hub</span></a>
        <div class="project-switch"><span class="eyebrow">Không gian làm việc</span><v-select :model-value="state.project" :loading="state.projectLoading" :items="state.workspace?.projects || []" item-title="name" item-value="id" hide-details aria-label="Chọn project" placeholder="Chưa có project" prepend-inner-icon="mdi-cube-outline" @update:model-value="changeProject" /></div>
        <nav aria-label="Điều hướng tri thức">
          <a class="nav-link" :class="{active:view === 'dashboard'}" href="/"><v-icon icon="mdi-view-dashboard-outline" size="21" class="semantic-icon semantic-primary" />Không gian của bạn</a>
          <a class="nav-link" :class="{active:view === 'library'}" href="/library/"><v-icon icon="mdi-bookshelf" size="21" class="semantic-icon semantic-info" />Thư viện tài liệu</a>
          <div class="nav-label">Theo nghiệp vụ</div>
          <a v-for="group in grouped" :key="group.type" class="nav-link" :class="{active:frontmatter.entity_type === group.type || frontmatter.type === group.type}" :href="`/${routes[group.type]}/`"><v-icon :icon="typeIcons[group.type]" size="21" :class="['semantic-icon',`semantic-${iconGroup(group.type)}`]" /><span>{{ typeLabels[group.type] }}</span><small>{{ group.count }}</small></a>
          <template v-if="canEdit"><div class="nav-label">Đóng góp và quản lý</div><a class="nav-link" :class="{active:view === 'studio'}" href="/studio/"><v-icon icon="mdi-file-document-edit-outline" size="21" class="semantic-icon semantic-info" />Biên tập tài liệu</a><a class="nav-link" :class="{active:view === 'diagrams'}" href="/studio/diagrams/"><v-icon icon="mdi-vector-polyline" size="21" class="semantic-icon semantic-diagram" />Biên tập sơ đồ</a><a class="nav-link" :class="{active:view === 'reviews'}" href="/studio/reviews/"><v-icon icon="mdi-check-decagram-outline" size="21" class="semantic-icon semantic-success" />Duyệt và xuất bản</a><a class="nav-link" :class="{active:view === 'history'}" href="/studio/history/"><v-icon icon="mdi-history" size="21" class="semantic-icon semantic-utility" />Lịch sử phiên bản</a><a class="nav-link" :class="{active:view === 'health'}" href="/health/"><v-icon icon="mdi-heart-pulse" size="21" class="semantic-icon semantic-success" />Chất lượng và truy vết</a></template>
          <div class="nav-label">Không gian</div><a class="nav-link" :class="{active:view === 'workspace'}" href="/settings/workspace/"><v-icon icon="mdi-tune-variant" size="21" class="semantic-icon semantic-utility" />Cấu hình không gian</a>
        </nav>
        <template #append><div class="sidebar-footer"><span class="status-dot"></span>{{ currentProject?.name || 'Atlas Knowledge Hub' }}<small>{{ currentProject?.demo ? 'Dữ liệu minh họa' : 'Tri thức nội bộ của đội ngũ' }}</small></div></template>
      </v-navigation-drawer>
      <v-app-bar flat height="72" class="atlas-topbar"><v-btn icon="mdi-menu" variant="text" aria-label="Đóng mở sidebar" :aria-expanded="drawer" @click="drawer = !drawer" /><span class="topbar-title">{{ title }}</span><v-spacer /><button class="search-trigger" aria-label="Tìm kiếm tri thức" @click="searchOpen = true"><v-icon icon="mdi-magnify" size="21" /><span>Tìm trong tri thức…</span><kbd>Ctrl K</kbd></button><v-divider vertical inset class="mx-5" /><v-menu><template #activator="{props}"><button v-bind="props" class="user-trigger"><span class="user-avatar">{{ state.session?.user.slice(0,2).toUpperCase() || 'AT' }}</span><span class="user-name">{{ state.session?.user || 'Atlas' }}<small>{{ state.session?.role }}</small></span><v-icon icon="mdi-chevron-down" size="18" /></button></template><v-list><v-list-item title="Đăng xuất" prepend-icon="mdi-logout" @click="logout" /></v-list></v-menu></v-app-bar>
      <v-main><div id="main" class="main-content">
        <v-skeleton-loader v-if="!state.initialized" type="heading, paragraph, image" />
        <template v-else-if="state.session">
          <v-alert v-if="editorViews.includes(view) && !canEdit" type="info" variant="tonal">Trang này dành cho nhóm biên tập.</v-alert>
          <Dashboard v-else-if="view === 'dashboard'" @search="searchOpen = true" />
          <Catalog v-else-if="view === 'catalog' || view === 'library'" :type="frontmatter.entity_type || ''" :title="view === 'library' ? 'Thư viện tài liệu' : title" />
          <ClientOnly v-else-if="editorViews.includes(view) || view === 'workspace'"><Studio v-if="view === 'studio'" /><DiagramStudio v-else-if="view === 'diagrams'" /><History v-else-if="view === 'history'" /><QualityPage v-else-if="view === 'health'" /><ReviewQueue v-else-if="view === 'reviews'" /><WorkspaceSettings v-else-if="view === 'workspace'" /></ClientOnly>
          <section v-else-if="view === 'integrations'" class="narrow-page"><h1>Kết nối tri thức</h1><p class="lead">API tra cứu có nguồn tham chiếu. MCP, Dify và RAGFlow đang trong lộ trình phát triển.</p><a href="/library/" class="text-link">Về thư viện tài liệu</a></section>
          <ClientOnly v-else-if="view === 'legacy'"><LegacyArchive /></ClientOnly>
          <DocumentPage v-else-if="view === 'document' && !page.isNotFound" />
          <div v-else class="empty-state"><v-icon icon="mdi-file-search-outline" size="48" /><h1>Không tìm thấy trang</h1><p>Tài liệu có thể đã được gỡ xuất bản.</p><v-btn color="primary" href="/library/">Mở thư viện</v-btn></div>
          <div v-if="!state.workspace?.projects.length && view !== 'workspace'" class="panel mt-6"><h2>Bắt đầu không gian tri thức</h2><p class="mt-3">{{ canManage ? 'Tạo project và phân hệ đầu tiên để đội ngũ bắt đầu đóng góp.' : 'Admin cần tạo project đầu tiên cho đội ngũ.' }}</p><v-btn v-if="canManage" href="/settings/workspace/" color="primary" class="mt-4">Tạo project</v-btn></div>
        </template>
        <footer class="page-footer"><span>atlas. {{ state.workspace?.name || 'Knowledge Hub' }}</span><span>{{ currentProject?.demo ? 'Project minh họa' : 'Tri thức có nguồn · Cập nhật có lịch sử' }}</span></footer>
      </div></v-main>
    </template>
    <SearchDialog v-model="searchOpen" />
    <v-snackbar role="status" aria-live="polite" :model-value="!!state.notice" :color="state.noticeColor" :timeout="7000" @update:model-value="snackbarChanged">{{ state.notice }}<template #actions><v-btn variant="text" @click="state.notice = ''">Đóng</v-btn></template></v-snackbar>
  </v-app>
</template>
