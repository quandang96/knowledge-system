import { computed, reactive } from 'vue'
import type { DocumentRecord, Session } from '../../schemas/src/index'
export const state = reactive({ session: null as Session | null, initialized: false, documents: [] as DocumentRecord[], project: 'demo-project', notice: '', noticeColor: 'success', loading: false })
export const canEdit = computed(() => !!state.session && ['Editor','Publisher','Admin'].includes(state.session.role))
export const canPublish = computed(() => !!state.session && ['Publisher','Admin'].includes(state.session.role))
export const projectDocuments = computed(() => state.documents.filter(d => d.metadata.project_id === state.project))
export class ApiError extends Error { constructor(public status: number, message: string, public details?: unknown) { super(message) } }
export async function api<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (state.session) headers.set('X-CSRF-Token', state.session.csrf)
  const response = await fetch(url, { ...options, headers, credentials: 'same-origin' })
  const payload = await response.json()
  if (!response.ok) { if (response.status === 401) state.session = null; throw new ApiError(response.status, payload.error?.message || 'Không thể hoàn tất thao tác.', payload.error?.details) }
  return payload.data
}
export async function refreshDocuments() { state.documents = await api<DocumentRecord[]>('/api/documents') }
export function notify(message: string, color = 'success') { state.notice = message; state.noticeColor = color }
export function fail(error: unknown) { notify(error instanceof Error ? error.message : 'Không thể hoàn tất thao tác.', 'error') }
export function assetUrl(doc: DocumentRecord, relative: string, draft = false) { return relative.startsWith('./assets/') ? `/api/documents/${doc.metadata.doc_id}/${draft ? 'draft-assets' : 'published-assets'}/${encodeURIComponent(relative.split('/').pop()!)}` : relative }
export function dateLabel(value: string) { return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : '—' }
export function download(content: string, filename: string, type = 'text/plain') { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
