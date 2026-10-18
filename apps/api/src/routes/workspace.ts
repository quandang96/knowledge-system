import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { editableMetadataSchema, workspaceSchema } from '../../../../packages/schemas/src/index'
import type { DocumentStore } from '../services/document-store'
import { requireRole, readers, editors } from '../services/permissions'
import { AppError } from '../services/filesystem'
import { promises as fs } from 'node:fs'
import { safePath } from '../services/filesystem'

export async function workspaceRoutes(app: FastifyInstance, store: DocumentStore) {
  const searches: number[] = []
  app.addHook('onResponse', async (req, reply) => {
    if (req.routeOptions.url === '/api/catalog') { searches.push(reply.elapsedTime); if (searches.length > 200) searches.shift() }
  })
  app.get('/api/operations', async req => {
    requireRole(req, ['Admin'])
    const disk = await fs.statfs(store.root)
    const free = disk.bavail * disk.bsize; const total = disk.blocks * disk.bsize
    const samples = [...searches].sort((a, b) => a - b)
    const releases = await fs.readdir(await safePath(store.root, 'staging'))
    return { data: { disk: { free_bytes: free, total_bytes: total, low_space: free < 1024 ** 3 || free / total < .1 }, release_count: releases.filter(name => name.startsWith('release-')).length, search: { samples: samples.length, p95_ms: samples.length ? samples[Math.floor(samples.length * .95)] : null }, writer: 'single-process' } }
  })
  app.get('/api/workspace', async req => { requireRole(req, readers); return { data: await store.workspace.read() } })
  app.put('/api/workspace', async req => {
    const user = requireRole(req, ['Admin'])
    const input = z.object({ config: workspaceSchema, base_revision: z.string() }).strict().parse(req.body)
    const config = await store.workspace.update(input.config, input.base_revision)
    await store.audit(user.user, 'workspace-update', 'WORKSPACE-CONFIG')
    return { data: config }
  })
  app.post('/api/documents/new', async req => {
    const user = requireRole(req, editors)
    const input = z.object({ metadata: editableMetadataSchema.omit({ doc_id: true }), template_id: z.string().optional() }).strict().parse(req.body)
    let body: string | undefined
    if (input.template_id) {
      const template = (await store.workspace.read()).templates.find(t => t.id === input.template_id)
      if (!template || template.type !== input.metadata.type || (template.project_id && template.project_id !== input.metadata.project_id)) throw new AppError(400, 'Template không phù hợp project hoặc loại tài liệu.')
      body = template.body
    }
    return { data: await store.createAutomatic(input.metadata, body, user.user) }
  })
  app.post<{ Params: { docId: string } }>('/api/documents/:docId/review', async req => {
    const input = z.object({ base_revision: z.string(), action: z.enum(['submit', 'approve', 'request_changes']), reason: z.string().max(2000).default('') }).strict().parse(req.body)
    const user = requireRole(req, input.action === 'submit' ? editors : ['Publisher', 'Admin'])
    return { data: await store.review(req.params.docId, input.base_revision, input.action, user.user, input.reason) }
  })
}
