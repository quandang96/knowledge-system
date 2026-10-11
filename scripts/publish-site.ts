import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DocumentStore } from '../apps/api/src/services/document-store'
import { Publisher } from '../apps/api/src/services/publisher'
const id=process.argv[2]
if(!id)throw new Error('Usage: pnpm exec tsx scripts/publish-site.ts DOC-ID. Trusted filesystem operator only.')
const root=path.resolve(process.env.KNOWLEDGE_ROOT||'knowledge')
const publisher=new Publisher(new DocumentStore(root),{projectRoot:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')})
await publisher.init()
const doc=await publisher.store.draft(id)
console.log(await publisher.publish(id,doc.revision,'local-operator','Publish via trusted operator CLI'))
