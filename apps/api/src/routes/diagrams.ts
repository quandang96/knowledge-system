import type { FastifyInstance } from 'fastify'
import { promises as fs } from 'node:fs'
import { z } from 'zod'
import { idSchema, graphSchema } from '../../../../packages/schemas/src/index'
import { requireRole, editors, readers } from '../services/permissions'
import type { DocumentStore } from '../services/document-store'
import { AppError, atomicWrite, safePath } from '../services/filesystem'
import { validateGraph, toMermaid } from '../services/graph-validation'
export async function diagramRoutes(app: FastifyInstance, store: DocumentStore) {
  app.get<{ Params: { diagramId: string } }>('/api/diagrams/:diagramId', async (req) => {
    requireRole(req, readers)
    const id = idSchema.parse(req.params.diagramId)
    for (const doc of await store.listPublished()) {
      const graph = doc.graphs.find((g) => g.diagram_id === id)
      if (graph) return { data: { graph, mermaid: toMermaid(graph), doc_id: doc.metadata.doc_id } }
    }
    throw new AppError(404, 'Diagram chưa được xuất bản.')
  })
  app.put<{ Params: { docId: string; diagramId: string } }>(
    '/api/documents/:docId/draft-diagrams/:diagramId',
    async (req) => {
      const user = requireRole(req, editors)
      const input = z.object({ graph: graphSchema, base_revision: z.string() }).strict().parse(req.body)
      return store.lock(req.params.docId, async () => {
        const doc = await store.draft(req.params.docId)
        if (doc.revision !== input.base_revision)
          throw new AppError(409, 'Bản nháp đã thay đổi. Tải lại trước khi lưu diagram.')
        const graph = validateGraph(input.graph)
        const id = idSchema.parse(req.params.diagramId)
        if (id !== graph.diagram_id) throw new AppError(400, 'Diagram ID không khớp.')
        await atomicWrite(
          await safePath(store.root, 'drafts', req.params.docId, 'diagrams', `${id}.graph.json`),
          JSON.stringify(graph, null, 2)
        )
        await store.writeDraft({ ...doc.metadata, updated_at: new Date().toISOString() }, doc.body, user.user)
        return { data: await store.draft(req.params.docId) }
      })
    }
  )
  app.delete<{ Params: { docId: string; diagramId: string } }>(
    '/api/documents/:docId/draft-diagrams/:diagramId',
    async (req) => {
      const user = requireRole(req, editors)
      return store.lock(req.params.docId, async () => {
        const doc = await store.draft(req.params.docId)
        const id = idSchema.parse(req.params.diagramId)
        await fs.rm(await safePath(store.root, 'drafts', req.params.docId, 'diagrams', `${id}.graph.json`))
        return {
          data: await store.writeDraft({ ...doc.metadata, updated_at: new Date().toISOString() }, doc.body, user.user)
        }
      })
    }
  )
}
