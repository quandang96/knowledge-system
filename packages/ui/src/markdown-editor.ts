import MarkdownIt from 'markdown-it'
import { MarkdownManager } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
export const MarkdownImage = Image.extend({
  renderMarkdown(node) {
    const alt = String(node.attrs?.alt || '').replace(/[\\[\]]/g, '\\$&').replace(/[\r\n]/g, ' ')
    const title = String(node.attrs?.title || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ')
    const src = String(node.attrs?.src || '')
    return `![${alt}](${src}${title ? ` "${title}"` : ''})`
  }
})
export const editorExtensions = () => [StarterKit.configure({ underline: false, link: { openOnClick: false, protocols: ['http','https'] } }), MarkdownImage.configure({ inline: false, allowBase64: false }), TableKit.configure({ table: { renderWrapper: true } })]
const parser = new MarkdownIt({ html: false })
export function semanticSignature(source: string): string {
  const tokens = parser.parse(source, {})
  // Ignore formatting whitespace and list indentation; preserve links, tables, images and code language/content.
  return JSON.stringify(tokens.filter(t => !['paragraph_open','paragraph_close'].includes(t.type)).map(t => ({ type: t.type, content: t.type === 'inline' ? '' : t.content.trim(), info: t.info, attrs: t.attrs, children: t.children?.map(c => ({ type: c.type, content: c.content, attrs: c.attrs })) })))
}
export function checkRoundTrip(source: string) {
  const manager = new MarkdownManager({ extensions: editorExtensions() })
  const output = manager.serialize(manager.parse(source))
  return { safe: semanticSignature(source) === semanticSignature(output), output }
}
