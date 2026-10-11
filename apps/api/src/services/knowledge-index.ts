import { type DocumentRecord } from '../../../../packages/schemas/src/index'
export function searchDocuments(records: DocumentRecord[], filters: Record<string, string | undefined>) {
  const query = (filters.q || '').trim().toLocaleLowerCase()
  const words = query.split(/\s+/).filter(Boolean)
  return records.filter(d => ['project_id', 'type', 'module', 'language'].every(key => !filters[key] || d.metadata[key as keyof typeof d.metadata] === filters[key]))
    .map(doc => {
      const m = doc.metadata
      const title = `${m.doc_id} ${m.title} ${m.module} ${m.tags.join(' ')}`.toLocaleLowerCase()
      const text = `${title} ${doc.body}`.toLocaleLowerCase()
      const score = m.doc_id.toLocaleLowerCase() === query ? 10000 : words.reduce((sum, word) => sum + (title.includes(word) ? 100 : text.includes(word) ? 10 : 0), 0)
      return { ...doc, score, excerpt: (m.summary || doc.body.replace(/[#*`|]/g, '').replace(/\s+/g, ' ')).slice(0,200) }
    }).filter(d => !query || d.score > 0).sort((a,b) => b.score - a.score || a.metadata.title.localeCompare(b.metadata.title, 'vi'))
}
export function citation(doc: DocumentRecord) { return { doc_id: doc.metadata.doc_id, published_revision: doc.published_revision, heading: doc.metadata.title, url: doc.url } }
