import MarkdownIt from 'markdown-it'
import { idSchema } from './index'

const parser = new MarkdownIt({ html: false, linkify: false })
export function documentLink(id: string) { return `/document/?id=${encodeURIComponent(idSchema.parse(id))}` }
export function linkedDocumentId(href: string): string | undefined {
  if (!href.startsWith('/document/?')) return
  try {
    const url = new URL(href, 'https://atlas.invalid')
    const id = url.searchParams.get('id')
    if (idSchema.safeParse(id).success) return id!
  } catch { /* Malformed URLs are handled by the server's Markdown validator. */ }
}
export function inlineDocumentIds(body: string) {
  const ids = new Set<string>()
  for (const token of parser.parse(body, {})) for (const child of token.children || []) {
    if (child.type !== 'link_open') continue
    const id = linkedDocumentId(child.attrGet('href') || '')
    if (id) ids.add(id)
  }
  return [...ids]
}
