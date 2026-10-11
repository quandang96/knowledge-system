import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { randomUUID, createHash } from 'node:crypto'
import { AppError, atomicWrite, safePath, walk } from './filesystem'
import { type DocumentStore } from './document-store'
export async function uploadAsset(store: DocumentStore, id: string, data: Buffer, filename: string) {
  await store.draft(id)
  if (data.length > 10 * 1024 * 1024) throw new AppError(413, 'Ảnh vượt quá 10 MB.')
  const assetRoot = await safePath(store.root, 'drafts', id, 'assets')
  const files = await walk(assetRoot)
  let total = data.length
  for (const file of files) total += (await fs.stat(file)).size
  if (total > 100 * 1024 * 1024 || files.length >= 100) throw new AppError(413, 'Mỗi tài liệu tối đa 100 ảnh / 100 MB.')
  const isPng = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  const isJpg = data[0] === 255 && data[1] === 216 && data[2] === 255
  const isWebp = data.subarray(0,4).toString() === 'RIFF' && data.subarray(8,12).toString() === 'WEBP'
  if (!isPng && !isJpg && !isWebp) throw new AppError(400, 'Chỉ hỗ trợ ảnh PNG, JPEG và WebP hợp lệ. SVG/HTML bị từ chối.')
  let image
  try { const decoder = sharp(data, { limitInputPixels: 40_000_000, animated: false }); image = await decoder.metadata(); await decoder.stats() }
  catch { throw new AppError(400, 'Ảnh không hợp lệ hoặc kích thước vượt giới hạn.') }
  if (!image.width || !image.height || image.width > 16000 || image.height > 16000) throw new AppError(400, 'Kích thước ảnh không hợp lệ.')
  const ext = isPng ? 'png' : isJpg ? 'jpg' : 'webp'
  const purpose = path.parse(filename).name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0,40) || 'screenshot'
  const hash = createHash('sha256').update(data).update(randomUUID()).digest('hex').slice(0,12)
  const name = `${purpose}-${hash}.${ext}`
  await atomicWrite(await safePath(assetRoot, name), data)
  return { asset_id: name, relative_path: `./assets/${name}`, preview_url: `/api/documents/${id}/draft-assets/${name}`, width: image.width, height: image.height, mime: `image/${ext === 'jpg' ? 'jpeg' : ext}` }
}
