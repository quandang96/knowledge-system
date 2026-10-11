import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { idSchema, metadataSchema } from '../../../../packages/schemas/src/index'
import type { DocumentStore } from '../services/document-store'
import { requireRole, readers, editors } from '../services/permissions'
import { searchDocuments } from '../services/knowledge-index'
import { serialize } from '../services/markdown'
import { exportBundle } from '../services/export'
const saveSchema = z.object({ metadata: metadataSchema, body: z.string(), base_revision: z.string() }).strict()
export async function documentRoutes(app: FastifyInstance, store: DocumentStore) {
  app.get('/api/projects', async req => { requireRole(req, readers); return { data: [...new Set((await store.listPublished()).map(d => d.metadata.project_id))].map(id => ({ id, name: id === 'demo-project' ? 'Demo Workflow System' : id })) } })
  app.get<{ Querystring: Record<string,string> }>('/api/documents', async req => { requireRole(req, readers); return { data: searchDocuments(await store.listPublished(), req.query) } })
  app.get('/api/drafts', async req => { requireRole(req, editors); return { data: await store.listDrafts() } })
  app.post('/api/documents', async (req, reply) => { const user = requireRole(req, editors); const input = z.object({ metadata: metadataSchema, body: z.string().optional() }).strict().parse(req.body); reply.code(201); return { data: await store.create(input.metadata, input.body, user.user) } })
  app.get<{ Params: { docId: string } }>('/api/documents/:docId', async req => { requireRole(req, readers); return { data: await store.published(req.params.docId) } })
  app.get<{ Params: { docId: string } }>('/api/documents/:docId/draft', async req => { requireRole(req, editors); return { data: await store.draft(req.params.docId) } })
  app.post<{ Params: { docId: string } }>('/api/documents/:docId/edit', async req => { const user = requireRole(req, editors); return { data: await store.ensureDraft(req.params.docId, user.user) } })
  app.put<{ Params: { docId: string } }>('/api/documents/:docId/draft', async req => { const user = requireRole(req, editors); const input = saveSchema.parse(req.body); return { data: await store.save(req.params.docId, input.metadata, input.body, input.base_revision, user.user) } })
  app.get<{ Params: { docId: string } }>('/api/documents/:docId/related', async req => { requireRole(req, readers); const doc = await store.published(req.params.docId); return { data: (await store.listPublished()).filter(d => doc.metadata.related_ids.includes(d.metadata.doc_id)) } })
  app.get<{ Params: { docId: string }; Querystring: { draft?: string } }>('/api/documents/:docId/export.md', async (req, reply) => { requireRole(req, req.query.draft === 'true' ? editors : readers); const doc = await (req.query.draft === 'true' ? store.draft(req.params.docId) : store.published(req.params.docId)); return reply.type('text/markdown; charset=utf-8').header('Content-Disposition', `attachment; filename="${idSchema.parse(req.params.docId)}.md"`).send(serialize(doc.metadata, doc.body)) })
  app.get<{ Params: { docId: string }; Querystring: { draft?: string } }>('/api/documents/:docId/export.zip', async (req, reply) => { const draft = req.query.draft === 'true'; requireRole(req,draft?editors:readers); const id=idSchema.parse(req.params.docId); return reply.type('application/zip').header('Content-Disposition',`attachment; filename="${id}.zip"`).send(Buffer.from(await exportBundle(store,id,draft))) })
  app.get('/api/knowledge/health', async req => {
    requireRole(req, editors)
    const docs = await store.listPublished(); const ids = new Set(docs.map(d => d.metadata.doc_id)); const inbound = new Set(docs.flatMap(d => d.metadata.related_ids))
    return { data: { total: docs.length, broken: docs.flatMap(d => d.metadata.related_ids.filter(id => !ids.has(id)).map(id => ({ doc_id: d.metadata.doc_id, missing_id: id }))), orphans: docs.filter(d => !inbound.has(d.metadata.doc_id) && !d.metadata.related_ids.length).map(d => ({ doc_id: d.metadata.doc_id, title: d.metadata.title })) } }
  })
}
