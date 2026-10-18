import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { idSchema, editableMetadataSchema } from '../../../../packages/schemas/src/index'
import { documentRelations } from '../../../../packages/schemas/src/relations'
import type { DocumentStore } from '../services/document-store'
import { requireRole, readers, editors } from '../services/permissions'
import { searchDocuments, summary } from '../services/knowledge-index'
import { AppError } from '../services/filesystem'
import { serialize } from '../services/markdown'
import { exportBundle } from '../services/export'
const saveSchema = z.object({ metadata: editableMetadataSchema, body: z.string(), base_revision: z.string() }).strict()
export async function documentRoutes(app: FastifyInstance, store: DocumentStore) {
  app.get<{ Querystring: {draft?: string} }>('/api/legacy/documents', async req => {
    const draft = req.query.draft === 'true'; requireRole(req, draft ? editors : readers)
    const docs = draft ? await store.listDrafts(true) : await store.listPublished(undefined, true)
    return {data:docs.filter(doc => doc.metadata.type === 'test-scenario').map(summary)}
  })
  app.get<{ Params: {docId:string}; Querystring: {draft?: string} }>('/api/legacy/documents/:docId', async req => {
    const draft = req.query.draft === 'true'; requireRole(req, draft ? editors : readers)
    const doc = draft ? await store.draft(req.params.docId, true) : await store.published(req.params.docId, undefined, true)
    if (doc.metadata.type !== 'test-scenario') throw new AppError(404, 'Không có tài liệu legacy này.')
    return {data:doc}
  })
  app.get('/api/projects', async req => { requireRole(req, readers); return { data: (await store.workspace.read()).projects } })
  app.get<{ Querystring: Record<string,string> }>('/api/documents', async req => { requireRole(req, readers); return { data: searchDocuments(await store.listPublished(), req.query) } })
  app.get<{ Querystring: { project_id?: string } }>('/api/drafts', async req => { requireRole(req, editors); return { data: (await store.listDrafts()).filter(d => !req.query.project_id || d.metadata.project_id === req.query.project_id) } })
  app.post('/api/documents', async (req, reply) => { const user = requireRole(req, editors); const input = z.object({ metadata: editableMetadataSchema, body: z.string().optional() }).strict().parse(req.body); reply.code(201); return { data: await store.create(input.metadata, input.body, user.user) } })
  app.get<{ Params: { docId: string } }>('/api/documents/:docId', async req => { requireRole(req, readers); return { data: await store.published(req.params.docId) } })
  app.get<{ Params: { docId: string } }>('/api/documents/:docId/draft', async req => { requireRole(req, editors); return { data: await store.draft(req.params.docId) } })
  app.post<{ Params: { docId: string } }>('/api/documents/:docId/edit', async req => { const user = requireRole(req, editors); return { data: await store.ensureDraft(req.params.docId, user.user) } })
  app.put<{ Params: { docId: string } }>('/api/documents/:docId/draft', async req => { const user = requireRole(req, editors); const input = saveSchema.parse(req.body); return { data: await store.save(req.params.docId, input.metadata, input.body, input.base_revision, user.user) } })
  app.get<{ Params: { docId: string } }>('/api/documents/:docId/related', async req => { requireRole(req, readers); const doc = await store.published(req.params.docId); return { data: (await store.listPublished()).filter(d => d.metadata.project_id === doc.metadata.project_id && documentRelations(doc.metadata).some(edge => edge.target_id === d.metadata.doc_id)) } })
  app.get<{ Params: { docId: string }; Querystring: { draft?: string } }>('/api/documents/:docId/export.md', async (req, reply) => { requireRole(req, req.query.draft === 'true' ? editors : readers); const doc = await (req.query.draft === 'true' ? store.draft(req.params.docId, true) : store.published(req.params.docId, undefined, true)); return reply.type('text/markdown; charset=utf-8').header('Content-Disposition', `attachment; filename="${idSchema.parse(req.params.docId)}.md"`).send(serialize(doc.metadata, doc.body)) })
  app.get<{ Params: { docId: string }; Querystring: { draft?: string } }>('/api/documents/:docId/export.zip', async (req, reply) => { const draft = req.query.draft === 'true'; requireRole(req,draft?editors:readers); const id=idSchema.parse(req.params.docId); return reply.type('application/zip').header('Content-Disposition',`attachment; filename="${id}.zip"`).send(Buffer.from(await exportBundle(store,id,draft))) })
  app.get('/api/knowledge/health', async req => {
    requireRole(req, editors)
    const all = await store.listPublished(undefined, true); const docs = all.filter(doc => doc.metadata.type !== 'test-scenario'); const ids = new Set(docs.map(d => d.metadata.doc_id))
    const { traceability } = await import('../../../../packages/schemas/src/relations')
    const edges = traceability(all); const inbound = new Set(edges.map(edge => edge.target_id))
    return { data: { total: docs.length, broken: edges.filter(edge => !ids.has(edge.target_id)).map(edge => ({doc_id:edge.source_id,missing_id:edge.target_id})), orphans: docs.filter(d => !inbound.has(d.metadata.doc_id) && !edges.some(edge => edge.source_id === d.metadata.doc_id)).map(d => ({ doc_id: d.metadata.doc_id, title: d.metadata.title })) } }
  })
}
