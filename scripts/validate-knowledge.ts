import path from 'node:path'
import { validatePublished } from '../apps/api/src/services/publisher'
const docs = await validatePublished(path.resolve(process.env.KNOWLEDGE_ROOT || 'knowledge', 'published'))
console.log(`Validated ${docs.length} published documents, references, assets and graphs.`)
import 'dotenv/config'
