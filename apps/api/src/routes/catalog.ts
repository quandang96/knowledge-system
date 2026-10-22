import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { DocumentStore } from '../services/document-store'
import { requireRole, readers, editors } from '../services/permissions'
import { searchDocuments, summary } from '../services/knowledge-index'
import { documentRelations, traceability } from '../../../../packages/schemas/src/relations'
import { idSchema, moduleSchema, types, type DocumentSummary } from '../../../../packages/schemas/src/index'
import { AppError } from '../services/filesystem'
import { businessIndex } from '../../../../packages/schemas/src/business-index'

export async function catalogRoutes(app: FastifyInstance, store: DocumentStore) {
  app.get<{ Querystring: Record<string, string> }>('/api/knowledge/references', async (req) => {
    requireRole(req, editors)
    const query = z
      .object({
        project_id: moduleSchema,
        source_id: idSchema,
        q: z.string().max(200).default(''),
        type: z.enum(types).optional(),
        module: moduleSchema.optional(),
        page: z.coerce.number().int().min(1).default(1),
        page_size: z.coerce.number().int().min(1).max(50).default(20),
        ids: z.string().max(8100).optional()
      })
      .parse(req.query)
    const source = await store.draft(query.source_id).catch(async (error) => {
      if (!(error instanceof AppError) || error.statusCode !== 404) throw error
      return store.published(query.source_id)
    })
    if (source.metadata.project_id !== query.project_id)
      throw new AppError(403, 'Bộ chọn chỉ tìm tài liệu trong project của tài liệu nguồn.')
    const published = await store.listPublished()
    const candidates = new Map(
      published.map((doc) => [doc.metadata.doc_id, { doc, publication: 'published' as 'published' | 'draft' }])
    )
    for (const draft of await store.listDrafts())
      if (!candidates.has(draft.metadata.doc_id))
        candidates.set(draft.metadata.doc_id, { doc: draft, publication: 'draft' })
    const requestedIds = query.ids ? z.array(idSchema).max(100).parse(query.ids.split(',')) : undefined
    const visible = [...candidates.values()].filter(
      ({ doc }) =>
        doc.metadata.doc_id !== query.source_id &&
        doc.metadata.project_id === query.project_id &&
        (!requestedIds || requestedIds.includes(doc.metadata.doc_id))
    )
    const found = searchDocuments(
      visible.map((item) => item.doc),
      { q: query.q, project_id: query.project_id, type: query.type, module: query.module }
    )
    return {
      data: {
        items: found
          .slice((query.page - 1) * query.page_size, query.page * query.page_size)
          .map((doc) => ({ ...summary(doc), publication: candidates.get(doc.metadata.doc_id)!.publication })),
        total: found.length,
        page: query.page,
        page_size: query.page_size
      }
    }
  })
  app.get<{ Querystring: Record<string, string> }>('/api/catalog', async (req) => {
    requireRole(req, readers)
    const { page, page_size, sort } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        page_size: z.coerce.number().int().min(1).max(100).default(25),
        sort: z.enum(['relevance', 'updated', 'title']).default('relevance')
      })
      .parse(req.query)
    const docs = await store.listPublished()
    const business = businessIndex(docs)
    const candidates = docs.filter(
      (d) =>
        (!req.query.project_id || d.metadata.project_id === req.query.project_id) &&
        (!req.query.type || d.metadata.type === req.query.type)
    )
    const found = searchDocuments(docs, req.query)
    if (req.query.q?.trim() && ['screen', 'function'].includes(req.query.type)) {
      const matches = new Set(
        searchDocuments(docs, { q: req.query.q, project_id: req.query.project_id }).map((doc) => doc.metadata.doc_id)
      )
      const seen = new Set(found.map((doc) => doc.metadata.doc_id))
      for (const doc of searchDocuments(docs, { ...req.query, q: '' })) {
        const links = business.get(doc.metadata.doc_id)
        const targets = req.query.type === 'screen' ? links?.functions : links?.screens
        if (!seen.has(doc.metadata.doc_id) && targets?.some((target) => matches.has(target.doc_id))) {
          found.push(doc)
          seen.add(doc.metadata.doc_id)
        }
      }
    }
    if (req.query.screen_id) {
      const allowed = found.filter((doc) =>
        business.get(doc.metadata.doc_id)?.screens.some((screen) => screen.doc_id === req.query.screen_id)
      )
      found.splice(0, found.length, ...allowed)
    }
    if (sort === 'updated') found.sort((a, b) => b.metadata.updated_at.localeCompare(a.metadata.updated_at))
    if (sort === 'title') found.sort((a, b) => a.metadata.title.localeCompare(b.metadata.title, 'vi'))
    return {
      data: {
        items: found
          .slice((page - 1) * page_size, page * page_size)
          .map((doc) => summary(doc, business.get(doc.metadata.doc_id))),
        total: found.length,
        page,
        page_size,
        facets: {
          modules: [...new Set(candidates.map((d) => d.metadata.module))],
          tags: [...new Set(candidates.flatMap((d) => d.metadata.tags))],
          roles: [
            ...new Set(
              candidates.flatMap((d) =>
                documentRelations(d.metadata)
                  .map((r) => r.target_id)
                  .filter((id) => id.startsWith('ROLE-'))
              )
            )
          ]
        }
      }
    }
  })
  app.get<{ Querystring: { project_id?: string } }>('/api/library', async (req) => {
    requireRole(req, readers)
    const docs = await store.listPublished()
    const business = businessIndex(docs)
    return {
      data: docs
        .filter((d) => !req.query.project_id || d.metadata.project_id === req.query.project_id)
        .map((doc) => summary(doc, business.get(doc.metadata.doc_id)))
    }
  })
  app.get<{ Querystring: { project_id?: string } }>('/api/quality', async (req) => {
    requireRole(req, editors)
    const snapshot = await store.listPublished(undefined, true)
    const all = snapshot.filter((doc) => doc.metadata.type !== 'test-scenario')
    const docs = all.filter((d) => !req.query.project_id || d.metadata.project_id === req.query.project_id)
    const ids = new Set(all.map((d) => d.metadata.doc_id))
    const edges = traceability(snapshot).filter((edge) => docs.some((doc) => doc.metadata.doc_id === edge.source_id))
    const inbound = new Set(edges.map((e) => e.target_id))
    return {
      data: {
        total: docs.length,
        edges,
        broken: edges.filter((e) => !ids.has(e.target_id)),
        orphans: docs
          .filter((d) => !inbound.has(d.metadata.doc_id) && !edges.some((e) => e.source_id === d.metadata.doc_id))
          .map((doc) => summary(doc)),
        overdue: docs
          .filter((d) => d.metadata.review_due_at && d.metadata.review_due_at < new Date().toISOString().slice(0, 10))
          .map((doc) => summary(doc)),
        drafts: (await store.listDrafts())
          .filter((d) => !req.query.project_id || d.metadata.project_id === req.query.project_id)
          .map((d) => ({ ...summary(d), review: d.review, editor: d.editor }))
      }
    }
  })
  app.get<{ Params: { docId: string }; Querystring: { draft?: string } }>(
    '/api/documents/:docId/connections',
    async (req) => {
      const draft = req.query.draft === 'true'
      requireRole(req, draft ? editors : readers)
      const doc = draft ? await store.draft(req.params.docId) : await store.published(req.params.docId)
      let snapshot = await store.listPublished(undefined, true)
      if (draft) {
        const merged = new Map(snapshot.map((item) => [item.metadata.doc_id, item]))
        for (const item of await store.listDrafts())
          merged.set(item.metadata.doc_id, { ...item, url: `/studio/?doc=${item.metadata.doc_id}` })
        snapshot = [...merged.values()]
      }
      const docs = snapshot.filter(
        (item) => item.metadata.type !== 'test-scenario' && item.metadata.project_id === doc.metadata.project_id
      )
      const business = businessIndex(docs)
      const edges = traceability(snapshot).filter((edge) =>
        docs.some((item) => item.metadata.doc_id === edge.source_id)
      )
      const resolve = (id: string): DocumentSummary | undefined => {
        const item = docs.find((d) => d.metadata.doc_id === id)
        return item && summary(item, business.get(id))
      }
      const impact = new Set<string>()
      let next = [doc.metadata.doc_id]
      while (next.length) {
        const following = edges
          .filter((e) => next.includes(e.target_id) && !impact.has(e.source_id) && e.source_id !== doc.metadata.doc_id)
          .map((e) => e.source_id)
        following.forEach((id) => impact.add(id))
        next = following
      }
      return {
        data: {
          outgoing: edges
            .filter((e) => e.source_id === doc.metadata.doc_id)
            .map((e) => ({ ...e, document: resolve(e.target_id) })),
          incoming: edges
            .filter((e) => e.target_id === doc.metadata.doc_id)
            .map((e) => ({ ...e, document: resolve(e.source_id) })),
          impact: [...impact].map(resolve).filter(Boolean)
        }
      }
    }
  )
}
