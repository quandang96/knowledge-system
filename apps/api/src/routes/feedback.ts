import type { FastifyInstance } from 'fastify'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { DocumentStore } from '../services/document-store'
import { requireRole, readers, editors } from '../services/permissions'
import { AppError, atomicWrite, exists, safePath, SerialQueue } from '../services/filesystem'
import type { FeedbackItem } from '../../../../packages/schemas/src/index'

export async function feedbackRoutes(app: FastifyInstance, store: DocumentStore) {
  const queue = new SerialQueue()
  const file = await safePath(store.root, '.knowledge-state/feedback.json')
  const read = async (): Promise<FeedbackItem[]> => await exists(file) ? JSON.parse(await fs.readFile(file, 'utf8')) : []
  app.post<{ Params: { docId: string } }>('/api/documents/:docId/feedback', async req => {
    const user = requireRole(req, readers)
    const { message } = z.object({ message: z.string().trim().min(1).max(2000) }).strict().parse(req.body)
    const doc = await store.published(req.params.docId)
    return queue.run(async () => {
      const items = await read()
      if (items.length >= 10000) throw new AppError(400, 'Kho góp ý đã đầy. Liên hệ Admin để lưu trữ góp ý cũ.')
      const item: FeedbackItem = { id: randomUUID(), doc_id: doc.metadata.doc_id, project_id: doc.metadata.project_id, title: doc.metadata.title, revision: doc.published_revision || doc.revision, user: user.user, message, created_at: new Date().toISOString(), status: 'open' }
      items.push(item); await atomicWrite(file, JSON.stringify(items, null, 2)); return { data: item }
    })
  })
  app.get<{ Querystring: { project_id?: string } }>('/api/feedback', async req => { requireRole(req, editors); return { data: (await read()).filter(i => !req.query.project_id || i.project_id === req.query.project_id).reverse() } })
  app.post<{ Params: { feedbackId: string } }>('/api/feedback/:feedbackId/resolve', async req => {
    const user = requireRole(req, editors)
    return queue.run(async () => {
      const items = await read(); const item = items.find(i => i.id === req.params.feedbackId)
      if (!item) throw new AppError(404, 'Không tìm thấy góp ý.')
      item.status = 'resolved'; item.resolved_by = user.user; item.resolved_at = new Date().toISOString()
      await atomicWrite(file, JSON.stringify(items, null, 2)); await store.audit(user.user, 'resolve-feedback', item.doc_id); return { data: item }
    })
  })
}
