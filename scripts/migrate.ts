import 'dotenv/config'
import path from 'node:path'
import { acquireWriter } from '../apps/api/src/services/writer-lease'
import { DocumentStore } from '../apps/api/src/services/document-store'
import { CURRENT_SCHEMA_VERSION, migrateMetadata, schemaVersionOf } from '../packages/schemas/src/migrations'
import { metadataSchema } from '../packages/schemas/src/index'

// Dry-run by default. Drafts are upgraded through the normal save path (audited, revision-checked);
// Published documents are only reported because they change through edit -> review -> publish.
// The API must be stopped: taking the writer lease also prevents a writer starting meanwhile.
const root = path.resolve(process.env.KNOWLEDGE_ROOT || 'knowledge')
const apply = process.argv.includes('--apply')
const release = await acquireWriter(root)
try {
  const store = new DocumentStore(root)
  const report = {
    mode: apply ? 'apply' : 'dry-run',
    current_schema_version: CURRENT_SCHEMA_VERSION,
    drafts: [] as unknown[],
    published_needing_migration: [] as string[]
  }
  for (const draft of await store.listDrafts(true)) {
    const raw = draft.metadata as unknown as Record<string, unknown>
    if (schemaVersionOf(raw) >= CURRENT_SCHEMA_VERSION) continue
    const { metadata, applied } = migrateMetadata(raw)
    report.drafts.push({
      doc_id: draft.metadata.doc_id,
      from: schemaVersionOf(raw),
      applied: applied.map((step) => step.description)
    })
    if (apply)
      await store.save(draft.metadata.doc_id, metadataSchema.parse(metadata), draft.body, draft.revision, 'migration')
  }
  for (const doc of await store.listPublished(undefined, true))
    if (schemaVersionOf(doc.metadata as unknown as Record<string, unknown>) < CURRENT_SCHEMA_VERSION)
      report.published_needing_migration.push(doc.metadata.doc_id)
  console.log(JSON.stringify(report, null, 2))
} finally {
  await release()
}
