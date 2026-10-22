import type { BusinessDocumentLink, BusinessSummary, DocumentRecord } from './index'
import { documentRelations } from './relations'
import MarkdownIt from 'markdown-it'

const parser = new MarkdownIt({ html: false })
function sectionText(body: string, heading: RegExp) {
  const tokens = parser.parse(body, {})
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].type !== 'heading_open' || !heading.test(tokens[i + 1].content)) continue
    for (let j = i + 3; j < tokens.length; j++) {
      if (tokens[j].type === 'heading_open') break
      if (tokens[j].type === 'inline' && tokens[j].content.trim()) return tokens[j].content.slice(0, 300)
    }
  }
  return ''
}
export function businessIndex(documents: DocumentRecord[]) {
  const docs = documents.filter((doc) => doc.metadata.type !== 'test-scenario')
  const byId = new Map(docs.map((doc) => [doc.metadata.doc_id, doc]))
  const index = new Map<string, BusinessSummary>()
  const link = (doc: DocumentRecord): BusinessDocumentLink => ({
    doc_id: doc.metadata.doc_id,
    title: doc.metadata.title,
    url: doc.url,
    module: doc.metadata.module,
    ...(doc.metadata.function_code ? { function_code: doc.metadata.function_code } : {})
  })
  for (const doc of docs) {
    const rules = documentRelations(doc.metadata)
      .filter((edge) => edge.kind === 'governed_by')
      .map((edge) => byId.get(edge.target_id))
      .filter(
        (target): target is DocumentRecord =>
          !!target && target.metadata.type === 'business-rule' && target.metadata.project_id === doc.metadata.project_id
      )
      .map(link)
    index.set(doc.metadata.doc_id, {
      screens: [],
      functions: [],
      rules,
      trigger:
        doc.metadata.type === 'function'
          ? sectionText(doc.body, /^trigger(?:\b|\s)|^tác nhân và trigger|^kích hoạt/i)
          : ''
    })
  }
  // This read model uses only canonical Screen --implements--> Function metadata.
  // Inline links, related edges and graph nodes never silently create a mapping.
  for (const screen of docs.filter((doc) => doc.metadata.type === 'screen')) {
    const targets = new Set(
      documentRelations(screen.metadata)
        .filter((edge) => edge.kind === 'implements')
        .map((edge) => edge.target_id)
    )
    for (const id of targets) {
      const fn = byId.get(id)
      if (!fn || fn.metadata.type !== 'function' || fn.metadata.project_id !== screen.metadata.project_id) continue
      const details = index.get(id)!
      index.get(screen.metadata.doc_id)!.functions.push({ ...link(fn), trigger: details.trigger, rules: details.rules })
      details.screens.push(link(screen))
    }
  }
  return index
}
