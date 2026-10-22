import 'dotenv/config'
import path from 'node:path'
import { DocumentStore } from '../apps/api/src/services/document-store'
import { acquireWriter } from '../apps/api/src/services/writer-lease'
import { functionConventionBody } from '../packages/schemas/src/function-convention'
import {
  metadataSchema,
  type DocumentRecord,
  type Session,
  type WorkspaceResponse
} from '../packages/schemas/src/index'
import { AppError } from '../apps/api/src/services/filesystem'

// Offline, idempotent preparation. Publication remains the normal reviewed flow.
const root = path.resolve(process.env.KNOWLEDGE_ROOT || 'knowledge')
const apply = process.argv.includes('--apply')
const apiTarget = process.argv.find((arg) => arg.startsWith('--api='))?.slice(6)
if (apiTarget) {
  const target = new URL(apiTarget)
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(target.hostname))
    throw new Error('API preparation supports the local development server only.')
  const response = await fetch(new URL('/api/auth/login', target), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: process.env.LOCAL_ADMIN_PASSWORD || 'atlas-demo-2026' })
  })
  if (!response.ok) throw new Error('Không đăng nhập được API local bằng cấu hình Admin hiện tại.')
  const session = ((await response.json()) as { data: Session }).data
  const cookie = response.headers.get('set-cookie')?.split(';')[0] || ''
  async function api<T>(url: string, payload?: unknown): Promise<T> {
    const result = await fetch(new URL(url, target), {
      method: payload ? 'POST' : 'GET',
      headers: { cookie, 'X-CSRF-Token': session.csrf, 'Content-Type': 'application/json' },
      ...(payload ? { body: JSON.stringify(payload) } : {})
    })
    const json = (await result.json()) as { data: T; error?: { message: string } }
    if (!result.ok) throw new Error(json.error?.message || 'API preparation failed')
    return json.data
  }
  const docs = [...(await api<DocumentRecord[]>('/api/library')), ...(await api<DocumentRecord[]>('/api/drafts'))]
  const existing = docs.find((doc) => doc.metadata.doc_id === 'REF-FUNCTION-ID-CONVENTION')
  if (existing) console.log(`Dùng lại ${existing.metadata.doc_id}.`)
  else {
    const project = (await api<WorkspaceResponse>('/api/workspace')).projects.find((project) => project.modules.length)
    if (!project) throw new Error('Tạo project/phân hệ trước khi chuẩn bị quy ước.')
    console.log(
      `${apply ? 'Tạo Draft qua API' : 'Dry-run: sẽ tạo Draft'} REF-FUNCTION-ID-CONVENTION. Release active giữ nguyên.`
    )
    if (apply)
      await api('/api/documents', {
        metadata: {
          doc_id: 'REF-FUNCTION-ID-CONVENTION',
          type: 'reference',
          project_id: project.id,
          module: project.modules[0].id,
          title: 'Quy ước Function ID — bản minh họa',
          owner: 'Workspace Admin',
          summary: 'Cấu trúc 4–3–3 và ví dụ TRAN/BILL. Cần cập nhật, xác nhận trước khi dùng chính thức.',
          tags: ['function-id-convention', 'example']
        },
        body: functionConventionBody
      })
  }
  process.exit(0)
}
const release = await acquireWriter(root)
try {
  const store = new DocumentStore(root)
  const published = await store.listPublished()
  const drafts = await store.listDrafts()
  const existing = [...published, ...drafts].find((doc) => doc.metadata.doc_id === 'REF-FUNCTION-ID-CONVENTION')
  if (existing) {
    console.log(`Dùng lại ${existing.metadata.doc_id}: ${existing.url}`)
  } else {
    const workspace = await store.workspace.read()
    const project = workspace.projects.find((project) => project.modules.length)
    if (!project) throw new AppError(400, 'Tạo project/phân hệ trước khi chuẩn bị quy ước.')
    const metadata = metadataSchema.parse({
      doc_id: 'REF-FUNCTION-ID-CONVENTION',
      type: 'reference',
      project_id: project.id,
      module: project.modules[0].id,
      title: 'Quy ước Function ID — bản minh họa',
      owner: 'Workspace Admin',
      summary: 'Cấu trúc 4–3–3 và ví dụ TRAN/BILL. Cần cập nhật, xác nhận trước khi dùng chính thức.',
      tags: ['function-id-convention', 'example']
    })
    console.log(
      `${apply ? 'Tạo Draft' : 'Dry-run: sẽ tạo Draft'} ${metadata.doc_id} trong ${project.id}. Release active giữ nguyên.`
    )
    if (apply) await store.create(metadata, functionConventionBody, 'V4 preparation')
  }
} finally {
  await release()
}
