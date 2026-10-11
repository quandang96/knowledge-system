import type { FastifyInstance } from 'fastify'
import { promises as fs } from 'node:fs'
import { z } from 'zod'
import { requireRole, editors, readers } from '../services/permissions'
import { AppError, safePath } from '../services/filesystem'
import { uploadAsset } from '../services/asset-store'
import type { DocumentStore } from '../services/document-store'
import { markdownLinks } from '../services/markdown'
const assetName = z.string().regex(/^[a-z0-9][a-z0-9-]*\.(png|jpg|webp)$/).max(150)
export async function uploadRoutes(app: FastifyInstance, store: DocumentStore) {
  app.post<{ Params: { docId: string } }>('/api/documents/:docId/assets', async req => {
    const user = requireRole(req, editors)
    return store.lock(req.params.docId, async () => {
      const result = []
      for await (const part of req.files({ limits: { files: 20, fileSize: 10 * 1024 * 1024 } })) {
        const buffer = await part.toBuffer()
        if (part.file.truncated) throw new AppError(413, 'Ảnh vượt quá 10 MB.')
        result.push(await uploadAsset(store, req.params.docId, buffer, part.filename))
      }
      if (!result.length) throw new AppError(400, 'Chọn ít nhất một ảnh.')
      await store.audit(user.user, 'upload', req.params.docId)
      return { data: result }
    })
  })
  for (const kind of ['draft-assets', 'published-assets'] as const) app.get<{ Params: { docId: string; assetId: string } }>(`/api/documents/:docId/${kind}/:assetId`, async (req, reply) => {
    requireRole(req, kind === 'draft-assets' ? editors : readers)
    const name = assetName.parse(req.params.assetId)
    const snapshot = await store.activeState()
    const doc = kind === 'draft-assets' ? await store.draft(req.params.docId) : await store.published(req.params.docId, snapshot)
    const root = kind === 'draft-assets' ? await safePath(store.root, 'drafts', doc.metadata.doc_id) : await safePath(await store.activeRoot(snapshot), doc.relative_path.replace(/\/index.md$/, ''))
    const data = await fs.readFile(await safePath(root, 'assets', name)).catch(() => { throw new AppError(404, 'Không tìm thấy ảnh.') })
    return reply.type(`image/${name.endsWith('.jpg') ? 'jpeg' : name.split('.').pop()}`).send(data)
  })
  app.delete<{ Params: { docId: string; assetId: string } }>('/api/documents/:docId/assets/:assetId', async req => {
    const user = requireRole(req, editors)
    return store.lock(req.params.docId, async () => {
      const name = assetName.parse(req.params.assetId); const doc = await store.draft(req.params.docId); const reference = `./assets/${name}`
      if (markdownLinks(doc.body).includes(reference) || doc.metadata.screen?.screenshot.gallery.some(i => i.path === reference) || doc.metadata.screen?.screenshot.cover === reference) throw new AppError(409, 'Gỡ ảnh khỏi nội dung/gallery trước khi xóa file.')
      await fs.rm(await safePath(store.root, 'drafts', req.params.docId, 'assets', name))
      await store.audit(user.user, 'delete-asset', req.params.docId)
      return { data: true }
    })
  })
}
