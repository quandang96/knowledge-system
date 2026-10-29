import MarkdownIt from 'markdown-it'
import htmlBlockNames from 'markdown-it/lib/common/html_blocks.mjs'
import { HTML_OPEN_CLOSE_TAG_RE, HTML_TAG_RE } from 'markdown-it/lib/common/html_re.mjs'
import { Node } from '@tiptap/core'
import { MarkdownManager } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { useAtlasBlocks } from '../../schemas/src/markdown-blocks'
import { atlasContainers } from '../../schemas/src/html-policy'

// CommonMark HTML block starts and ends, the same table markdown-it renders with, so the
// editor keeps verbatim exactly what the document views treat as an HTML block.
// The flag says whether the block may interrupt a paragraph.
const htmlBlocks: [RegExp, RegExp, boolean][] = [
  [/^<(script|pre|style|textarea)(?=(\s|>|$))/i, /<\/(script|pre|style|textarea)>/i, true],
  [/^<!--/, /-->/, true],
  [/^<\?/, /\?>/, true],
  [/^<![A-Z]/, />/, true],
  [/^<!\[CDATA\[/, /\]\]>/, true],
  [new RegExp(`^</?(${htmlBlockNames.join('|')})(?=(\\s|/?>|$))`, 'i'), /^$/, true],
  [new RegExp(`${HTML_OPEN_CLOSE_TAG_RE.source}\\s*$`), /^$/, false]
]
// Length of the HTML block or `:::` container starting src (0 when none), trailing newline included.
function rawBlockLength(src: string, interruptsOnly = false) {
  const lines = src.split('\n')
  const first = /^ {0,3}(.*)$/.exec(lines[0])![1]
  let last = -1
  const fence = /^(:{3,})\s*([a-z]+)/.exec(first)
  if (fence && (atlasContainers as readonly string[]).includes(fence[2])) {
    const close = new RegExp(`^ {0,3}:{${fence[1].length},}\\s*$`)
    last = lines.findIndex((line, i) => i > 0 && close.test(line))
    if (last < 0) last = lines.length - 1
  } else {
    const block = htmlBlocks.find(([open]) => open.test(first))
    if (!block || (interruptsOnly && !block[2])) return 0
    const [, end] = block
    if (end.source === '^$') {
      last = lines.findIndex((line, i) => i > 0 && !line.trim()) - 1
      if (last < 0) last = lines.length - 1
    } else {
      last = lines.findIndex((line) => end.test(line))
      if (last < 0) last = lines.length - 1
    }
  }
  const length = lines.slice(0, last + 1).join('\n').length
  return length < src.length ? length + 1 : length
}
// Raw nodes hold Markdown the rich editor cannot model (HTML, Atlas `:::` blocks, `:status[]`)
// and write it back byte for byte; Studio shows them as previews or chips.
export const AtlasRawBlock = Node.create({
  name: 'atlasRawBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({ raw: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-atlas-raw]', getAttrs: (el) => ({ raw: (el as HTMLElement).dataset.atlasRaw }) }],
  renderHTML: ({ node }) => ['div', { 'data-atlas-raw': node.attrs.raw }],
  markdownTokenName: 'atlasRawBlock',
  markdownTokenizer: {
    name: 'atlasRawBlock',
    level: 'block',
    // Marks where a raw block cuts a running paragraph, as markdown-it does.
    start(src: string) {
      for (let i = src.indexOf('\n'); i >= 0; i = src.indexOf('\n', i + 1))
        if (rawBlockLength(src.slice(i + 1), true)) return i + 1
      return -1
    },
    tokenize(src: string) {
      const length = rawBlockLength(src)
      if (!length) return undefined
      const raw = src.slice(0, length)
      return { type: 'atlasRawBlock', raw, text: raw.replace(/\n+$/, '') }
    }
  },
  parseMarkdown: (token) => ({ type: 'atlasRawBlock', attrs: { raw: token.text } }),
  renderMarkdown: (node) => String(node.attrs?.raw || '')
})
const rawInline = new RegExp(`^(?:${HTML_TAG_RE.source.slice(1)}|:status\\[[^\\]\\n[]{1,40}\\](?:\\{[a-z]+\\})?)`)
export const AtlasRawInline = Node.create({
  name: 'atlasRawInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ raw: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-atlas-raw]', getAttrs: (el) => ({ raw: (el as HTMLElement).dataset.atlasRaw }) }],
  renderHTML: ({ node }) => ['span', { 'data-atlas-raw': node.attrs.raw, class: 'atlas-raw-inline' }, node.attrs.raw],
  markdownTokenName: 'atlasRawInline',
  markdownTokenizer: {
    name: 'atlasRawInline',
    level: 'inline',
    start: (src: string) => src.search(/<[a-z/!?]|:status\[/i),
    tokenize(src: string) {
      const match = rawInline.exec(src)
      return match ? { type: 'atlasRawInline', raw: match[0], text: match[0] } : undefined
    }
  },
  parseMarkdown: (token) => ({ type: 'atlasRawInline', attrs: { raw: token.text } }),
  renderMarkdown: (node) => String(node.attrs?.raw || '')
})
export const MarkdownImage = Image.extend({
  renderMarkdown(node) {
    const alt = String(node.attrs?.alt || '')
      .replace(/[\\[\]]/g, '\\$&')
      .replace(/[\r\n]/g, ' ')
    const title = String(node.attrs?.title || '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/[\r\n]/g, ' ')
    const src = String(node.attrs?.src || '')
    return `![${alt}](${src}${title ? ` "${title}"` : ''})`
  }
})
export const editorExtensions = () => [
  StarterKit.configure({ underline: false, link: { openOnClick: false, protocols: ['http', 'https'] } }),
  MarkdownImage.configure({ inline: false, allowBase64: false }),
  TableKit.configure({ table: { renderWrapper: true } }),
  AtlasRawBlock,
  AtlasRawInline
]
// Same block and HTML support as the renderers, so the editor never silently drops them.
const parser = useAtlasBlocks(new MarkdownIt({ html: true }))
export function semanticSignature(source: string): string {
  const tokens = parser.parse(source, {})
  // Ignore formatting whitespace and list indentation; preserve links, tables, images and code language/content.
  return JSON.stringify(
    tokens
      .filter((t) => !['paragraph_open', 'paragraph_close'].includes(t.type))
      .map((t) => ({
        type: t.type,
        content: t.type === 'inline' ? '' : t.content.trim(),
        info: t.info,
        attrs: t.attrs,
        children: t.children?.map((c) => ({ type: c.type, content: c.content, attrs: c.attrs }))
      }))
  )
}
export function checkRoundTrip(source: string) {
  const manager = new MarkdownManager({ extensions: editorExtensions() })
  const output = manager.serialize(manager.parse(source))
  return { safe: semanticSignature(source) === semanticSignature(output), output }
}
