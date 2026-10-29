import matter from 'gray-matter'
import yaml from 'js-yaml'
import MarkdownIt from 'markdown-it'
import { metadataSchema, type Metadata } from '../../../../packages/schemas/src/index'
import { useAtlasBlocks } from '../../../../packages/schemas/src/markdown-blocks'
import { AppError } from './filesystem'
import { scanHtml } from './html'

const parser = useAtlasBlocks(new MarkdownIt({ html: true, linkify: false }))
export function parseMarkdown(raw: string, options: { sanitize?: boolean } = {}) {
  if (Buffer.byteLength(raw) > 2 * 1024 * 1024) throw new AppError(413, 'Markdown vượt quá 2 MB.')
  if (raw.includes('\0')) throw new AppError(400, 'Markdown chứa byte không hợp lệ.')
  try {
    const parsed = matter(raw, {
      engines: {
        yaml: {
          parse: (s) => yaml.load(s, { schema: yaml.JSON_SCHEMA }) as object,
          stringify: (o) => yaml.dump(o, { schema: yaml.JSON_SCHEMA, noRefs: true, lineWidth: -1 })
        }
      }
    })
    const { body, removed } = options.sanitize ? sanitizeBody(parsed.content) : { body: parsed.content, removed: [] }
    validateBody(body)
    return { metadata: parsed.data, body: body.trim() + '\n', removed }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(400, 'YAML frontmatter không hợp lệ.')
  }
}
export function serialize(metadata: Metadata, body: string) {
  return `---\n${yaml.dump(metadataSchema.parse(metadata), { schema: yaml.JSON_SCHEMA, noRefs: true, lineWidth: -1 })}---\n\n${body.trim()}\n`
}
export function validateBody(body: string) {
  if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new AppError(413, 'Nội dung vượt quá 2 MB.')
  // HTML is limited to the shared allowlist. VitePress never compiles document bodies
  // (see the .vitepress config), so `{{ }}` in text and code samples stays plain text.
  const removed = [...new Set(htmlFragments(body).flatMap((fragment) => scanHtml(fragment.content, safeLink).removed))]
  if (removed.length) throw new AppError(400, `HTML không được hỗ trợ: ${removed.join(', ')}.`)
  if (/\]\(\s*(?:javascript|data|vbscript|file):/i.test(body) || /\]\(\s*(?:\/\/|[A-Z]:\\)/i.test(body))
    throw new AppError(400, 'URL trong Markdown không an toàn.')
  for (const link of markdownLinks(body)) validateLink(link)
}
export function markdownLinks(body: string): string[] {
  const links: string[] = []
  const tokens = parser.parse(body, {})
  for (const token of tokens)
    for (const child of token.children || []) {
      const link = child.attrGet(child.type === 'image' ? 'src' : 'href')
      if (link) links.push(link)
    }
  for (const fragment of htmlFragments(body)) links.push(...scanHtml(fragment.content, () => true).links)
  // Catch links that markdown-it deliberately suppresses as unsafe.
  for (const match of body.matchAll(/!?\[[^\]]*\]\(<?([^\s)>]+)/g)) links.push(match[1])
  return [...new Set(links)]
}
export function validateLink(link: string) {
  let decoded: string
  try {
    decoded = decodeURIComponent(link)
  } catch {
    throw new AppError(400, 'URL không hợp lệ.')
  }
  if (decoded.includes('\\') || decoded.includes('\0') || /(^|\/)\.\.(\/|$)/.test(decoded) || decoded.startsWith('//'))
    throw new AppError(400, 'Không được tham chiếu ngoài kho tài liệu.')
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded) && !/^https?:\/\//i.test(decoded))
    throw new AppError(400, 'Chỉ hỗ trợ URL HTTP/HTTPS.')
  if (/^https?:\/\//i.test(decoded)) {
    const url = new URL(decoded)
    if (url.username || url.password) throw new AppError(400, 'URL không được chứa thông tin đăng nhập.')
  }
  return decoded
}
const safeLink = (link: string) => {
  try {
    validateLink(link)
    return true
  } catch {
    return false
  }
}
interface HtmlFragment {
  content: string
  lines: [number, number]
}
function htmlFragments(body: string): HtmlFragment[] {
  const fragments: HtmlFragment[] = []
  for (const token of parser.parse(body, {})) {
    if (token.type === 'html_block') fragments.push({ content: token.content, lines: token.map! })
    for (const child of token.children || [])
      if (child.type === 'html_inline') fragments.push({ content: child.content, lines: token.map! })
  }
  return fragments
}
// Import keeps what the allowlist accepts and reports the rest instead of refusing the file.
// Each cleaned fragment replaces its first match after the previous one within its block's lines.
export function sanitizeBody(body: string) {
  const lineStarts = [0]
  for (let i = 0; i < body.length; i++) if (body[i] === '\n') lineStarts.push(i + 1)
  const edits: { start: number; end: number; html: string }[] = []
  const removed = new Set<string>()
  let cursor = 0
  for (const fragment of htmlFragments(body)) {
    const scan = scanHtml(fragment.content, safeLink)
    const blockStart = lineStarts[fragment.lines[0]]
    const blockEnd = lineStarts[fragment.lines[1]] ?? body.length
    const start = body.indexOf(fragment.content, Math.max(cursor, blockStart))
    if (start < 0 || start + fragment.content.length > blockEnd) continue
    cursor = start + fragment.content.length
    if (!scan.removed.length) continue
    scan.removed.forEach((item) => removed.add(item))
    edits.push({ start, end: cursor, html: scan.html })
  }
  for (const edit of edits.reverse()) body = body.slice(0, edit.start) + edit.html + body.slice(edit.end)
  return { body, removed: [...removed] }
}
export function inspectImport(raw: string) {
  const parsed = parseMarkdown(raw, { sanitize: true })
  const metadata = parsed.metadata as Partial<Metadata>
  return {
    ...parsed,
    missing_fields: ['doc_id', 'project_id', 'type', 'module', 'title', 'owner'].filter(
      (key) => !metadata[key as keyof Metadata]
    ),
    warnings: [
      ...(parsed.removed.length ? [`Đã loại bỏ HTML không hỗ trợ: ${parsed.removed.join(', ')}`] : []),
      ...markdownLinks(parsed.body)
        .filter((v) => v.startsWith('./'))
        .map((v) => `Cần tải attachment trước khi Publish: ${v}`)
    ]
  }
}
