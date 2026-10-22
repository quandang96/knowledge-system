import 'dotenv/config'
import path from 'node:path'
import { DocumentStore } from '../apps/api/src/services/document-store'
import { atomicWrite, safePath } from '../apps/api/src/services/filesystem'
const store = new DocumentStore(path.resolve(process.env.KNOWLEDGE_ROOT || 'knowledge'))
await store.init()
const docs = await store.listPublished()
await atomicWrite(
  await safePath(store.root, '.knowledge-state/search-index.json'),
  JSON.stringify(
    docs.map((d) => ({ metadata: d.metadata, body: d.body, url: d.url, revision: d.published_revision })),
    null,
    2
  )
)
console.log(`Generated ${docs.length} records. This index is disposable; the API reads canonical Markdown.`)
