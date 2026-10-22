import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { metadataSchema } from '../../../../packages/schemas/src/index'
import type { DocumentStore } from '../services/document-store'
import { requireRole, editors } from '../services/permissions'
import { inspectImport } from '../services/markdown'
export async function importRoutes(app: FastifyInstance, store: DocumentStore) {
  app.post('/api/documents/import', async (req) => {
    requireRole(req, editors)
    const { markdown } = z.object({ markdown: z.string() }).strict().parse(req.body)
    const preview = inspectImport(markdown)
    return {
      data: {
        ...preview,
        duplicate:
          (await store.listPublished()).some((d) => d.metadata.doc_id === preview.metadata.doc_id) ||
          (await store.listDrafts()).some((d) => d.metadata.doc_id === preview.metadata.doc_id)
      }
    }
  })
  app.post('/api/documents/import/confirm', async (req) => {
    const user = requireRole(req, editors)
    const input = z
      .object({
        markdown: z.string(),
        metadata: metadataSchema,
        mode: z.enum(['new', 'update']),
        base_revision: z.string().optional()
      })
      .strict()
      .parse(req.body)
    const preview = inspectImport(input.markdown)
    if (input.mode === 'new') return { data: await store.create(input.metadata, preview.body, user.user) }
    return {
      data: await store.save(input.metadata.doc_id, input.metadata, preview.body, input.base_revision || '', user.user)
    }
  })
}
