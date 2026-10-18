import { promises as fs } from 'node:fs'
import path from 'node:path'
import { strToU8, zipSync } from 'fflate'
import type { DocumentStore } from './document-store'
import { AppError, safePath, walk } from './filesystem'
import { serialize } from './markdown'

export async function exportBundle(store: DocumentStore, id: string, draft: boolean) {
  const active = await store.activeState()
  const doc = draft ? await store.draft(id, true) : await store.published(id, active, true)
  const folder = draft ? await safePath(store.root, 'drafts', id) : await safePath(await store.activeRoot(active), path.dirname(doc.relative_path))
  const archive: Record<string, Uint8Array> = {
    'index.md': strToU8(serialize(doc.metadata, doc.body)),
    'metadata.json': strToU8(JSON.stringify({ metadata:doc.metadata,revision:doc.revision,published_revision:doc.published_revision,url:doc.url }, null, 2))
  }
  let total = 0
  for (const part of ['assets','diagrams']) for (const file of await walk(await safePath(folder,part))) {
    const size = (await fs.stat(file)).size; total += size
    if(total > 100*1024*1024) throw new AppError(413,'Export tối đa 100 MB attachments.')
    const relative = path.relative(folder,file).split(path.sep).join('/')
    archive[relative] = await fs.readFile(file)
  }
  return zipSync(archive, { level:0 })
}
