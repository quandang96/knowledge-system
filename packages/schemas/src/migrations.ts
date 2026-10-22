// Versioned upgrades for document front matter. A document without `schema_version` is version 0.
// To change the format: bump CURRENT_SCHEMA_VERSION, append a migration whose `from` is the previous
// version, and keep older migrations untouched so any old file can be brought forward step by step.
export const CURRENT_SCHEMA_VERSION = 1
type RawMetadata = Record<string, unknown>
export interface Migration {
  from: number
  to: number
  description: string
  migrate(metadata: RawMetadata): RawMetadata
}

export const migrations: Migration[] = [
  {
    from: 0,
    to: 1,
    description: 'Chuyển related_ids sang relations (kind=related); related_ids chỉ còn là adapter đọc.',
    migrate(metadata) {
      const legacy = Array.isArray(metadata.related_ids)
        ? metadata.related_ids.filter((id): id is string => typeof id === 'string')
        : []
      const typed = Array.isArray(metadata.relations)
        ? (metadata.relations as { target_id?: unknown; kind?: unknown }[])
        : []
      const relations = [
        ...typed,
        ...legacy
          .filter((id) => !typed.some((edge) => edge.target_id === id))
          .map((target_id) => ({ target_id, kind: 'related' }))
      ]
      return { ...metadata, ...(relations.length ? { relations } : {}), related_ids: [] }
    }
  }
]

export function schemaVersionOf(metadata: RawMetadata) {
  return typeof metadata.schema_version === 'number' ? metadata.schema_version : 0
}

/** Applies every pending migration in order and stamps the current version. */
export function migrateMetadata(input: RawMetadata): { metadata: RawMetadata; applied: Migration[] } {
  let metadata = { ...input }
  let version = schemaVersionOf(metadata)
  if (version > CURRENT_SCHEMA_VERSION)
    throw new Error(
      `Tài liệu dùng schema_version ${version} mới hơn phiên bản hỗ trợ (${CURRENT_SCHEMA_VERSION}). Hãy cập nhật ứng dụng.`
    )
  const applied: Migration[] = []
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = migrations.find((item) => item.from === version)
    if (!step) throw new Error(`Thiếu migration từ schema_version ${version}.`)
    metadata = step.migrate(metadata)
    version = step.to
    applied.push(step)
  }
  return { metadata: { ...metadata, schema_version: version }, applied }
}
