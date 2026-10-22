import 'dotenv/config'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { DocumentStore } from '../apps/api/src/services/document-store'
import { documentRelations } from '../packages/schemas/src/relations'
import { linkedDocumentId } from '../packages/schemas/src/document-links'
import { markdownLinks } from '../apps/api/src/services/markdown'

// Read-only inventory: does not initialize a writer or change any knowledge files.
const root = path.resolve(process.env.KNOWLEDGE_ROOT || 'knowledge')
const store = new DocumentStore(root)
const published = await store.listPublished(undefined, true)
const drafts = await store.listDrafts(true)
const legacy = [
  ...published.map((doc) => ({ ...doc, scope: 'published' })),
  ...drafts.map((doc) => ({ ...doc, scope: 'draft' }))
].filter((doc) => doc.metadata.type === 'test-scenario')
const ids = new Set(legacy.map((doc) => doc.metadata.doc_id))
const report = {
  at: new Date().toISOString(),
  root,
  active: await store.activeState(),
  published_count: published.length,
  draft_count: drafts.length,
  legacy: legacy.map((doc) => ({
    scope: doc.scope,
    id: doc.metadata.doc_id,
    project_id: doc.metadata.project_id,
    path: doc.relative_path,
    revision: doc.revision,
    export_url: `/api/documents/${doc.metadata.doc_id}/export.zip${doc.scope === 'draft' ? '?draft=true' : ''}`
  })),
  references: [...published, ...drafts].flatMap((doc) =>
    documentRelations(doc.metadata)
      .filter((edge) => ids.has(edge.target_id) || edge.kind === 'verifies')
      .map((edge) => ({ source: doc.metadata.doc_id, status: doc.metadata.status, ...edge }))
  ),
  body_references: [...published, ...drafts].flatMap((doc) =>
    markdownLinks(doc.body)
      .filter((link) => link.startsWith('/test-scenarios/') || ids.has(linkedDocumentId(link) || ''))
      .map((link) => ({ source: doc.metadata.doc_id, status: doc.metadata.status, link }))
  ),
  graph_references: [...published, ...drafts].flatMap((doc) =>
    doc.graphs.flatMap((graph) =>
      graph.nodes.flatMap((node) =>
        [node.role_id, node.screen_id, node.function_id, ...node.rule_ids]
          .filter((id) => id && ids.has(id))
          .map((target_id) => ({ source: doc.metadata.doc_id, graph: graph.diagram_id, node: node.id, target_id }))
      )
    )
  ),
  legacy_templates: (await store.workspace.read()).templates
    .filter((item) => item.type === 'test-scenario')
    .map((item) => ({ id: item.id, project_id: item.project_id, version: item.version })),
  policy: 'No documents removed. Legacy is read/export only; active product search and pickers exclude test-scenario.'
}
const target = path.resolve('output/v21-inventory.json')
await fs.mkdir(path.dirname(target), { recursive: true })
await fs.writeFile(target, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
