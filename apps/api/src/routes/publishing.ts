import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireRole, editors, publishers } from '../services/permissions'
import type { Publisher } from '../services/publisher'
import { AppError } from '../services/filesystem'
export async function publishingRoutes(app: FastifyInstance, publisher: Publisher) {
  app.post('/api/publish-jobs', async (req, reply) => {
    const user = requireRole(req, publishers)
    const input = z
      .object({
        documents: z
          .array(z.object({ doc_id: z.string(), base_revision: z.string() }).strict())
          .min(1)
          .max(50),
        comment: z.string().max(200).default('')
      })
      .strict()
      .parse(req.body)
    reply.code(202)
    return { data: await publisher.enqueue(input.documents, user.user, input.comment) }
  })
  app.get('/api/publish-jobs', async (req) => {
    requireRole(req, editors)
    return { data: [...publisher.jobs.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50) }
  })
  app.get<{ Params: { jobId: string } }>('/api/publish-jobs/:jobId', async (req) => {
    requireRole(req, editors)
    const job = publisher.jobs.get(req.params.jobId)
    if (!job) throw new AppError(404, 'Không tìm thấy đợt xuất bản.')
    return { data: job }
  })
  app.post<{ Params: { docId: string } }>('/api/documents/:docId/publish', async (req) => {
    const user = requireRole(req, publishers)
    const input = z
      .object({ base_revision: z.string(), comment: z.string().max(200).optional() })
      .strict()
      .parse(req.body)
    return { data: await publisher.publish(req.params.docId, input.base_revision, user.user, input.comment) }
  })
  app.post<{ Params: { docId: string } }>('/api/documents/:docId/unpublish', async (req) => {
    const user = requireRole(req, publishers)
    return { data: await publisher.unpublish(req.params.docId, user.user) }
  })
  app.post<{ Params: { docId: string } }>('/api/documents/:docId/restore', async (req) => {
    const user = requireRole(req, publishers)
    const { revision } = z.object({ revision: z.string() }).strict().parse(req.body)
    return { data: await publisher.restore(req.params.docId, revision, user.user) }
  })
  app.get<{ Params: { docId: string } }>('/api/documents/:docId/history', async (req) => {
    requireRole(req, editors)
    const file = (await publisher.locations())[req.params.docId]
    if (!file) return { data: [] }
    return { data: await publisher.git.history(file) }
  })
  app.get<{ Params: { docId: string }; Querystring: { from: string; to: string } }>(
    '/api/documents/:docId/diff',
    async (req) => {
      requireRole(req, editors)
      const file = (await publisher.locations())[req.params.docId]
      if (!file) throw new AppError(404, 'Không có lịch sử.')
      return { data: await publisher.git.diff(file, req.query.from, req.query.to) }
    }
  )
}
