import type { FastifyInstance } from 'fastify'
import type { DocumentStore } from '../services/document-store'
import { requireRole, readers } from '../services/permissions'
import { citation, searchDocuments } from '../services/knowledge-index'
export async function knowledgeRoutes(app: FastifyInstance, store: DocumentStore) {
  app.get<{ Querystring: Record<string,string> }>('/api/knowledge/search', async req => { requireRole(req, readers); return { data: searchDocuments(await store.listPublished(), req.query).map(d => ({ metadata: d.metadata, excerpt: d.excerpt, score: d.score, citation: citation(d) })) } })
  app.get<{ Params: { docId: string } }>('/api/knowledge/documents/:docId', async req => { requireRole(req, readers); const doc = await store.published(req.params.docId); return { data: { ...doc, citation: citation(doc), related: (await store.listPublished()).filter(d => doc.metadata.related_ids.includes(d.metadata.doc_id)).map(d => ({ metadata: d.metadata, citation: citation(d) })) } } })
}
