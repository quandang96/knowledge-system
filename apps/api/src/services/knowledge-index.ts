import type { BusinessSummary, DocumentRecord, DocumentSummary } from '../../../../packages/schemas/src/index'
import { documentRelations } from '../../../../packages/schemas/src/relations'
export function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
export function searchDocuments(records: DocumentRecord[], filters: Record<string, string | undefined>) {
  const query = normalizeSearch(filters.q || '')
  const words = query.split(/\s+/).filter(Boolean)
  return records
    .filter((d) =>
      ['project_id', 'type', 'module', 'language'].every(
        (key) => !filters[key] || d.metadata[key as keyof typeof d.metadata] === filters[key]
      )
    )
    .filter((d) => !filters.tag || d.metadata.tags.includes(filters.tag))
    .filter((d) => !filters.role || documentRelations(d.metadata).some((edge) => edge.target_id === filters.role))
    .map((doc) => {
      const m = doc.metadata
      const title = normalizeSearch(m.title)
      const identifiers = normalizeSearch(`${m.doc_id} ${m.function_code || ''} ${m.module} ${m.tags.join(' ')}`)
      const text = `${title} ${identifiers} ${normalizeSearch(doc.body)}`
      const score = [m.doc_id, m.function_code].some((id) => id && normalizeSearch(id) === query)
        ? 10000
        : !words.every((word) => text.includes(word))
          ? 0
          : (title === query ? 2000 : title.includes(query) ? 1000 : 0) +
            words.reduce((sum, word) => sum + (title.includes(word) ? 100 : identifiers.includes(word) ? 60 : 10), 0)
      return {
        ...doc,
        score,
        excerpt: (m.summary || doc.body.replace(/[#*`|]/g, '').replace(/\s+/g, ' ')).slice(0, 200)
      }
    })
    .filter((d) => !query || d.score > 0)
    .sort((a, b) => b.score - a.score || a.metadata.title.localeCompare(b.metadata.title, 'vi'))
}
// Catalog thumbnails: the cover picked in the old gallery editor, otherwise the first image placed in
// the content. Images are inserted inline now, so most documents get a cover without extra steps.
const inlineAsset = /!\[[^\]]*\]\((\.\/assets\/[a-z0-9][a-z0-9-]*\.(?:png|jpg|webp))/
export function documentCover(doc: Pick<DocumentRecord, 'metadata' | 'body'>) {
  return doc.metadata.screen?.screenshot.cover || inlineAsset.exec(doc.body)?.[1]
}
export function summary(doc: DocumentRecord & { excerpt?: string }, business?: BusinessSummary): DocumentSummary {
  return {
    metadata: doc.metadata,
    revision: doc.revision,
    url: doc.url,
    published_revision: doc.published_revision,
    excerpt: doc.excerpt || doc.metadata.summary,
    cover: documentCover(doc),
    graph_count: doc.graphs.length,
    ...(business ? { business } : {})
  }
}
export function citation(doc: DocumentRecord) {
  return {
    doc_id: doc.metadata.doc_id,
    published_revision: doc.published_revision,
    heading: doc.metadata.title,
    url: doc.url
  }
}
