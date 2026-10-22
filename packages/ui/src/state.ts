import { computed, reactive } from 'vue'
import type { DocumentSummary, Session, WorkspaceResponse } from '../../schemas/src/index'
import { alertDialog, type DialogTone } from './dialog'
export const state = reactive({
  session: null as Session | null,
  initialized: false,
  documents: [] as DocumentSummary[],
  workspace: null as WorkspaceResponse | null,
  project: '',
  notice: '',
  noticeColor: 'success',
  loading: false,
  projectLoading: false
})
export const canEdit = computed(() => !!state.session && ['Editor', 'Publisher', 'Admin'].includes(state.session.role))
export const canPublish = computed(() => !!state.session && ['Publisher', 'Admin'].includes(state.session.role))
export const canManage = computed(() => state.session?.role === 'Admin')
export const currentProject = computed(() => state.workspace?.projects.find((p) => p.id === state.project))
export const projectDocuments = computed(() => state.documents.filter((d) => d.metadata.project_id === state.project))
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}
export async function api<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (state.session) headers.set('X-CSRF-Token', state.session.csrf)
  let response: Response
  try {
    response = await fetch(url, { ...options, headers, credentials: 'same-origin' })
  } catch (error) {
    if (options.signal?.aborted || (error as Error).name === 'AbortError') throw error
    throw new ApiError(0, 'Mất kết nối với máy chủ. Kiểm tra mạng rồi thử lại.')
  }
  const payload = await response.json().catch(() => ({
    error: { message: `Máy chủ trả phản hồi không hợp lệ (${response.status}). Thử lại hoặc liên hệ quản trị viên.` }
  }))
  if (!response.ok) {
    if (response.status === 401) state.session = null
    throw new ApiError(
      response.status,
      payload.error?.message || 'Không thể hoàn tất thao tác.',
      payload.error?.details
    )
  }
  return payload.data
}
let librarySequence = 0
let projectChangeSequence = 0
export async function refreshDocuments() {
  const request = ++librarySequence
  const data = await api<DocumentSummary[]>('/api/library')
  if (request === librarySequence) state.documents = data
}
export async function refreshWorkspace() {
  state.workspace = await api<WorkspaceResponse>('/api/workspace')
  if (!state.workspace.projects.some((p) => p.id === state.project)) {
    const saved = localStorage.getItem(`atlas:project:${state.session?.user}`)
    state.project = state.workspace.projects.find((p) => p.id === saved)?.id || state.workspace.projects[0]?.id || ''
  }
}
/**
 * Cancelable app event a page with unsaved work can veto. Because the in-app confirmation is
 * asynchronous, a page vetoes first, asks, and calls `retry` if the user agrees to continue.
 */
export interface GuardDetail {
  retry(): void
}
export function guard(name: string, retry: () => void) {
  return window.dispatchEvent(new CustomEvent<GuardDetail>(name, { cancelable: true, detail: { retry } }))
}
export function changeProject(id: string) {
  if (id === state.project) return
  if (!guard('atlas:before-project-change', () => changeProject(id))) return
  state.project = id
  localStorage.setItem(`atlas:project:${state.session?.user}`, id)
  state.projectLoading = true
  const request = ++projectChangeSequence
  void refreshDocuments()
    .catch(fail)
    .finally(() => {
      if (request === projectChangeSequence) state.projectLoading = false
    })
}
/**
 * Completed actions show a snackbar. Anything the user has to read or act on (info, warning,
 * error) opens the in-app dialog instead, so it cannot time out unnoticed.
 */
export function notify(message: string, color: 'success' | Exclude<DialogTone, 'success'> = 'success') {
  if (color !== 'success') {
    void alertDialog({ message, tone: color })
    return
  }
  state.notice = message
  state.noticeColor = color
}
export function fail(error: unknown) {
  const items =
    error instanceof ApiError && Array.isArray(error.details) ? (error.details as { label?: unknown }[]) : []
  const labels = items.map((item) => item?.label).filter((label): label is string => typeof label === 'string')
  const message = error instanceof Error ? error.message : 'Không thể hoàn tất thao tác.'
  notify(labels.length ? `${message}\n${labels.map((label) => `• ${label}`).join('\n')}` : message, 'error')
}
export function assetUrl(doc: { metadata: { doc_id: string } }, relative: string, draft = false) {
  return relative.startsWith('./assets/')
    ? `/api/documents/${doc.metadata.doc_id}/${draft ? 'draft-assets' : 'published-assets'}/${encodeURIComponent(relative.split('/').pop()!)}`
    : relative
}
export function dateLabel(value: string) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))
    : '—'
}
export function download(content: string, filename: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
