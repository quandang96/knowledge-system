import 'dotenv/config'
import path from 'node:path'
import { DocumentStore } from '../apps/api/src/services/document-store'
import { atomicWrite, safePath } from '../apps/api/src/services/filesystem'
import { typeLabels, types } from '../packages/schemas/src/index'
const store = new DocumentStore(path.resolve(process.env.KNOWLEDGE_ROOT || 'knowledge'))
await store.init()
const docs = await store.listPublished()
const sidebar = types.map(type => ({ text:typeLabels[type],items:[...new Set(docs.filter(d=>d.metadata.type===type).map(d=>d.metadata.module))].map(module=>({text:module,items:docs.filter(d=>d.metadata.type===type&&d.metadata.module===module).sort((a,b)=>(a.metadata.order||0)-(b.metadata.order||0)||a.metadata.title.localeCompare(b.metadata.title,'vi')).map(d=>({text:`${d.metadata.doc_id} · ${d.metadata.title}`,link:d.url}))})) })).filter(group=>group.items.length)
await atomicWrite(await safePath(store.root,'.knowledge-state/sidebar.json'),JSON.stringify(sidebar,null,2))
console.log(`Generated sidebar from ${docs.length} Published files. Runtime UI derives the same tree through API.`)
