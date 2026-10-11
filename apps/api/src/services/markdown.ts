import matter from 'gray-matter'
import yaml from 'js-yaml'
import MarkdownIt from 'markdown-it'
import { metadataSchema, type Metadata } from '../../../../packages/schemas/src/index'
import { AppError } from './filesystem'

const parser = new MarkdownIt({ html: false, linkify: false })
export function parseMarkdown(raw: string) {
  if (Buffer.byteLength(raw) > 2 * 1024 * 1024) throw new AppError(413, 'Markdown vượt quá 2 MB.')
  if (raw.includes('\0')) throw new AppError(400, 'Markdown chứa byte không hợp lệ.')
  try {
    const parsed = matter(raw, { engines: { yaml: { parse: s => yaml.load(s, { schema: yaml.JSON_SCHEMA }) as object, stringify: o => yaml.dump(o, { schema: yaml.JSON_SCHEMA, noRefs: true, lineWidth: -1 }) } } })
    validateBody(parsed.content)
    return { metadata: parsed.data, body: parsed.content.trim() + '\n' }
  } catch (error) { if (error instanceof AppError) throw error; throw new AppError(400, 'YAML frontmatter không hợp lệ.') }
}
export function serialize(metadata: Metadata, body: string) {
  return `---\n${yaml.dump(metadataSchema.parse(metadata), { schema: yaml.JSON_SCHEMA, noRefs: true, lineWidth: -1 })}---\n\n${body.trim()}\n`
}
export function validateBody(body: string) {
  if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new AppError(413, 'Nội dung vượt quá 2 MB.')
  // Do not allow Vue/HTML execution through the VitePress Markdown compiler.
  // Code fences are also checked: refusing unsafe samples is safer than compiling input.
  if (/<\/?[a-zA-Z!][^>]*>|\{\{|\}\}|<\?(?:php|=)|\b(?:v-html|v-bind|v-on)\s*=/i.test(body)) throw new AppError(400, 'Markdown không được chứa HTML, Vue component hoặc biểu thức Vue. Dùng Markdown thuần.')
  if (/\]\(\s*(?:javascript|data|vbscript|file):/i.test(body) || /\]\(\s*(?:\/\/|[A-Z]:\\)/i.test(body)) throw new AppError(400, 'URL trong Markdown không an toàn.')
  for (const link of markdownLinks(body)) validateLink(link)
}
export function markdownLinks(body: string): string[] {
  const links: string[] = []
  const tokens = parser.parse(body, {})
  for (const token of tokens) for (const child of token.children || []) {
    const link = child.attrGet(child.type === 'image' ? 'src' : 'href')
    if (link) links.push(link)
  }
  // Catch links that markdown-it deliberately suppresses as unsafe.
  for (const match of body.matchAll(/!?\[[^\]]*\]\(<?([^\s)>]+)/g)) links.push(match[1])
  return [...new Set(links)]
}
export function validateLink(link: string) {
  let decoded: string
  try { decoded = decodeURIComponent(link) } catch { throw new AppError(400, 'URL không hợp lệ.') }
  if (decoded.includes('\\') || decoded.includes('\0') || /(^|\/)\.\.(\/|$)/.test(decoded) || decoded.startsWith('//')) throw new AppError(400, 'Không được tham chiếu ngoài kho tài liệu.')
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded) && !/^https?:\/\//i.test(decoded)) throw new AppError(400, 'Chỉ hỗ trợ URL HTTP/HTTPS.')
  if (/^https?:\/\//i.test(decoded)) {
    const url = new URL(decoded)
    if (url.username || url.password) throw new AppError(400, 'URL không được chứa thông tin đăng nhập.')
  }
  return decoded
}
export function inspectImport(raw: string) {
  const parsed = parseMarkdown(raw)
  const metadata = parsed.metadata as Partial<Metadata>
  return { ...parsed, missing_fields: ['doc_id', 'project_id', 'type', 'module', 'title', 'owner'].filter(key => !metadata[key as keyof Metadata]), warnings: markdownLinks(parsed.body).filter(v => v.startsWith('./')).map(v => `Cần tải attachment trước khi Publish: ${v}`) }
}
