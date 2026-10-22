<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useData, useRouter } from 'vitepress'
import { type Session } from '../../schemas/src/index'
import { api, canEdit, canManage, changeProject, currentProject, fail, guard, notify, refreshDocuments, refreshWorkspace, state } from './state'
import { lazyView, pendingViews, prefetch } from './loading'
import { useDelayedBusy } from './async-state'
import { openCreate } from './create-document'
import Dashboard from './Dashboard.vue'
import Catalog from './Catalog.vue'
import DocumentPage from './DocumentPage.vue'
import SearchDialog from './SearchDialog.vue'
import ViewSkeleton from './ViewSkeleton.vue'
import CreateDocumentDialog from './CreateDocumentDialog.vue'
import AppDialog from './AppDialog.vue'
const loadFunctionRegistry = () => import('./FunctionRegistry.vue')
const loadStudio = () => import('./DocumentStudio.vue')
const loadReviewQueue = () => import('./ReviewQueue.vue')
const loadHistory = () => import('./History.vue')
const FunctionRegistry = lazyView(loadFunctionRegistry)
const Studio = lazyView(loadStudio)
const DiagramStudio = lazyView(() => import('./DiagramStudio.vue'))
const History = lazyView(loadHistory)
const WorkspaceSettings = lazyView(() => import('./WorkspaceSettings.vue'))
const ReviewQueue = lazyView(loadReviewQueue)
const QualityPage = lazyView(() => import('./QualityPage.vue'))
const LegacyArchive = lazyView(() => import('./LegacyArchive.vue'))
const HelpPage = lazyView(() => import('./HelpPage.vue'))
const { frontmatter, page } = useData()
const router = useRouter()
const drawer = ref(true); const searchOpen = ref(false)
const username = ref(''); const password = ref(''); const loginBusy = ref(false)
const view = computed(() => frontmatter.value.type==='test-scenario'||frontmatter.value.entity_type==='test-scenario'?'legacy':frontmatter.value.atlas_view || 'document')
const title = computed(() => frontmatter.value.title || state.workspace?.name || 'Knowledge Hub')
const editorViews = ['studio','diagrams','history','health','reviews']
const isType = (type: string) => frontmatter.value.entity_type === type || frontmatter.value.type === type
const routeLoading = ref(false)
const progressVisible = useDelayedBusy(computed(() => routeLoading.value || pendingViews.value > 0), 150)
async function initialize() {
  await refreshWorkspace(); await refreshDocuments()
  // Warm the screens people open next so the first visit does not wait for a download.
  prefetch(canEdit.value ? [loadFunctionRegistry, loadStudio, loadReviewQueue, loadHistory] : [loadFunctionRegistry])
}
async function login() {
  if (loginBusy.value) return
  loginBusy.value = true
  try {
    const session = await api<Session>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: username.value, password: password.value }) })
    // Leave the login form only once the credentials are accepted; a typo keeps the form in place.
    password.value = ''; state.initialized = false; state.session = session
    try { await initialize() } catch (e) { fail(e) } finally { state.initialized = true }
  } catch (e) { notify((e as Error).message, 'error') } finally { loginBusy.value = false }
}
async function logout() { try { if (!guard('atlas:before-project-change', () => void logout())) return; await api('/api/auth/logout', {method:'POST'}); state.session = null; state.documents = []; state.workspace = null; state.project = '' } catch(e) { fail(e) } }
function shortcut(event: KeyboardEvent) { if (!event.defaultPrevented && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && state.session) { event.preventDefault(); searchOpen.value = !searchOpen.value } }
function snackbarChanged(visible: boolean) { if (!visible) state.notice = '' }
function create() { if (window.innerWidth < 1100) drawer.value = false; openCreate() }
let priorBeforePageLoad: typeof router.onBeforePageLoad
let priorAfterRouteChange: typeof router.onAfterRouteChange
onMounted(async () => {
  drawer.value = window.innerWidth >= 1100
  document.addEventListener('keydown', shortcut)
  // Router hooks are single slots; chain to whatever was registered before (Studio adds its own).
  priorBeforePageLoad = router.onBeforePageLoad
  router.onBeforePageLoad = async href => {
    if ((await priorBeforePageLoad?.(href)) === false) return false
    routeLoading.value = true
    if (window.innerWidth < 1100) drawer.value = false
  }
  priorAfterRouteChange = router.onAfterRouteChange
  router.onAfterRouteChange = async href => { routeLoading.value = false; await priorAfterRouteChange?.(href) }
  try { state.session = await api<Session>('/api/auth/session'); await initialize() }
  catch (e) { if ((e as {status?:number}).status !== 401) fail(e) } finally { state.initialized = true }
})
onUnmounted(() => { document.removeEventListener('keydown', shortcut); router.onBeforePageLoad = priorBeforePageLoad; router.onAfterRouteChange = priorAfterRouteChange })
</script>
<template>
  <v-app>
    <a href="#main" class="skip-link">Đến nội dung chính</a>
    <div class="route-progress" :class="{ visible: progressVisible }" aria-hidden="true"><span /></div>
    <div v-if="state.initialized && !state.session" class="login-page">
      <div class="login-intro"><span class="brand-word">atlas<span>.</span></span><span class="eyebrow">Business Knowledge Hub</span><h1>Hiểu nghiệp vụ.<br>Cùng một nguồn tri thức.</h1><p>Quy trình, màn hình, quy tắc và kiểm thử được kết nối trong không gian của đội ngũ.</p><div class="login-note"><v-icon icon="mdi-book-open-page-variant-outline" /> Có nguồn tham chiếu. Có lịch sử thay đổi.</div></div>
      <form class="login-card" @submit.prevent="login"><div class="icon-box"><v-icon icon="mdi-account-outline" /></div><h2>Đăng nhập Atlas</h2><p>Truy cập kho tri thức nội bộ của đội ngũ.</p><v-text-field v-model="username" label="Tài khoản" autocomplete="username" autofocus required :readonly="loginBusy" /><v-text-field v-model="password" label="Mật khẩu" type="password" autocomplete="current-password" required :readonly="loginBusy" /><v-btn type="submit" color="primary" block size="large" :loading="loginBusy">Đăng nhập <v-icon end icon="mdi-arrow-right" /></v-btn></form>
    </div>
    <template v-else>
      <v-navigation-drawer v-model="drawer" :permanent="false" width="256" class="atlas-sidebar">
        <a class="brand" href="/"><span class="brand-mark"><v-icon icon="mdi-layers-triple-outline" size="24" /></span><span class="brand-word">atlas<span>.</span></span><span class="brand-label">Knowledge Hub</span></a>
        <div class="project-switch"><span class="eyebrow">Không gian làm việc</span><v-select :model-value="state.project" :loading="state.projectLoading" :items="state.workspace?.projects || []" item-title="name" item-value="id" hide-details aria-label="Chọn project" placeholder="Chưa có project" prepend-inner-icon="mdi-cube-outline" @update:model-value="changeProject" /></div>
        <div v-if="canEdit" class="sidebar-create"><v-btn color="primary" block prepend-icon="mdi-plus" :disabled="!state.project" @click="create">Tạo tài liệu</v-btn></div>
        <nav aria-labelledby="nav-browse">
          <span id="nav-browse" class="nav-section">Tra cứu</span>
          <a class="nav-link" :class="{active:view === 'dashboard'}" href="/"><span class="nav-icon semantic-primary"><v-icon icon="mdi-home-outline" size="18" /></span><span>Tổng quan</span></a>
          <a class="nav-link" :class="{active:isType('screen')}" href="/screens/"><span class="nav-icon semantic-screen"><v-icon icon="mdi-monitor" size="18" /></span><span>Màn hình nghiệp vụ</span></a>
          <a class="nav-link" :class="{active:view === 'function-ids' || isType('function')}" href="/function-ids/"><span class="nav-icon semantic-function"><v-icon icon="mdi-identifier" size="18" /></span><span>Function ID &amp; Quy ước</span></a>
          <a class="nav-link" :class="{active:view === 'library' || (view === 'document' && !isType('screen') && !isType('function'))}" href="/library/"><span class="nav-icon semantic-info"><v-icon icon="mdi-bookshelf" size="18" /></span><span>Thư viện tài liệu</span></a>
        </nav>
        <nav v-if="canEdit" aria-labelledby="nav-edit">
          <span id="nav-edit" class="nav-section">Biên tập</span>
          <a class="nav-link" :class="{active:view === 'studio'}" href="/studio/"><span class="nav-icon semantic-media"><v-icon icon="mdi-file-document-edit-outline" size="18" /></span><span>Bản nháp của nhóm</span></a>
          <a class="nav-link" :class="{active:view === 'reviews'}" href="/studio/reviews/"><span class="nav-icon semantic-success"><v-icon icon="mdi-check-decagram-outline" size="18" /></span><span>Duyệt và xuất bản</span></a>
          <a class="nav-link" :class="{active:view === 'history'}" href="/studio/history/"><span class="nav-icon semantic-warning"><v-icon icon="mdi-history" size="18" /></span><span>Lịch sử phiên bản</span></a>
        </nav>
        <nav v-if="canEdit" aria-labelledby="nav-manage">
          <span id="nav-manage" class="nav-section">Quản lý</span>
          <a class="nav-link" :class="{active:view === 'health'}" href="/health/"><span class="nav-icon semantic-rule"><v-icon icon="mdi-heart-pulse" size="18" /></span><span>Chất lượng và truy vết</span></a>
          <a class="nav-link" :class="{active:view === 'diagrams'}" href="/studio/diagrams/"><span class="nav-icon semantic-diagram"><v-icon icon="mdi-vector-polyline" size="18" /></span><span>Sơ đồ nâng cao</span></a>
          <a v-if="canManage" class="nav-link" :class="{active:view === 'workspace'}" href="/settings/workspace/"><span class="nav-icon semantic-primary"><v-icon icon="mdi-tune-variant" size="18" /></span><span>Cấu hình không gian</span></a>
        </nav>
        <template #append><div class="sidebar-footer"><a class="nav-link" :class="{active:view === 'help'}" href="/help/"><span class="nav-icon semantic-info"><v-icon icon="mdi-help-circle-outline" size="18" /></span><span>Hướng dẫn sử dụng</span></a></div></template>
      </v-navigation-drawer>
      <v-app-bar flat height="72" class="atlas-topbar"><v-btn icon="mdi-menu" variant="text" aria-label="Đóng mở sidebar" :aria-expanded="drawer" @click="drawer = !drawer" /><span class="topbar-title">{{ title }}</span><v-spacer /><button class="search-trigger" aria-label="Tìm kiếm tri thức" @click="searchOpen = true"><v-icon icon="mdi-magnify" size="21" /><span>Tìm trong tri thức…</span><kbd>Ctrl K</kbd></button><v-divider vertical inset class="mx-5" /><v-menu><template #activator="{props}"><button v-bind="props" class="user-trigger"><span class="user-avatar">{{ state.session?.user.slice(0,2).toUpperCase() || 'AT' }}</span><span class="user-name">{{ state.session?.user || 'Atlas' }}<small>{{ state.session?.role }}</small></span><v-icon icon="mdi-chevron-down" size="18" /></button></template><v-list><v-list-item title="Hướng dẫn sử dụng" prepend-icon="mdi-help-circle-outline" href="/help/" /><v-list-item title="Đăng xuất" prepend-icon="mdi-logout" @click="logout" /></v-list></v-menu></v-app-bar>
      <v-main><div id="main" class="main-content">
        <div class="view-area" :aria-busy="!state.initialized || progressVisible">
        <ViewSkeleton v-if="!state.initialized" />
        <template v-else-if="state.session">
          <v-alert v-if="editorViews.includes(view) && !canEdit" type="info" variant="tonal">Trang này dành cho nhóm biên tập.</v-alert>
          <Dashboard v-else-if="view === 'dashboard'" @search="searchOpen = true" />
          <FunctionRegistry v-else-if="view === 'function-ids' || (view === 'catalog' && frontmatter.entity_type === 'function')" />
          <Catalog v-else-if="view === 'catalog' || view === 'library'" :type="frontmatter.entity_type || ''" :title="view === 'library' ? 'Thư viện tài liệu' : frontmatter.entity_type === 'screen' ? 'Màn hình nghiệp vụ' : title" />
          <ClientOnly v-else-if="editorViews.includes(view) || view === 'workspace'"><Studio v-if="view === 'studio'" /><DiagramStudio v-else-if="view === 'diagrams'" /><History v-else-if="view === 'history'" /><QualityPage v-else-if="view === 'health'" /><ReviewQueue v-else-if="view === 'reviews'" /><WorkspaceSettings v-else-if="view === 'workspace'" /></ClientOnly>
          <section v-else-if="view === 'integrations'" class="narrow-page"><h1>Kết nối tri thức</h1><p class="lead">API tra cứu có nguồn tham chiếu. MCP, Dify và RAGFlow đang trong lộ trình phát triển.</p><a href="/library/" class="text-link">Về thư viện tài liệu</a></section>
          <ClientOnly v-else-if="view === 'legacy'"><LegacyArchive /></ClientOnly>
          <ClientOnly v-else-if="view === 'help'"><HelpPage /></ClientOnly>
          <DocumentPage v-else-if="view === 'document' && !page.isNotFound" />
          <div v-else class="empty-state"><v-icon icon="mdi-file-search-outline" size="48" /><h1>Không tìm thấy trang</h1><p>Tài liệu có thể đã được gỡ xuất bản.</p><v-btn color="primary" href="/library/">Mở thư viện</v-btn></div>
          <div v-if="state.workspace && !state.workspace.projects.length && view !== 'workspace'" class="panel mt-6"><h2>Bắt đầu không gian tri thức</h2><p class="mt-3">{{ canManage ? 'Tạo project và phân hệ đầu tiên để đội ngũ bắt đầu đóng góp.' : 'Admin cần tạo project đầu tiên cho đội ngũ.' }}</p><v-btn v-if="canManage" href="/settings/workspace/" color="primary" class="mt-4">Tạo project</v-btn></div>
        </template>
        </div>
        <footer class="page-footer"><span>atlas. {{ state.workspace?.name || 'Knowledge Hub' }}</span><span>{{ currentProject?.demo ? 'Project minh họa' : 'Tri thức có nguồn · Cập nhật có lịch sử' }}</span></footer>
      </div></v-main>
      <CreateDocumentDialog v-if="canEdit" />
    </template>
    <SearchDialog v-model="searchOpen" />
    <AppDialog />
    <v-snackbar role="status" aria-live="polite" :model-value="!!state.notice" :color="state.noticeColor" :timeout="4000" @update:model-value="snackbarChanged"><v-icon start icon="mdi-check-circle-outline" />{{ state.notice }}<template #actions><v-btn variant="text" @click="state.notice = ''">Đóng</v-btn></template></v-snackbar>
  </v-app>
</template>
