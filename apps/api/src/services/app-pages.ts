import { promises as fs } from 'node:fs'
import { AppError, atomicWrite, exists, safePath } from './filesystem'

// App routes ship with code, independently of a previously activated content
// snapshot. No business document or release pointer is changed here.
const appPages = [
  { route: 'function-ids', view: 'function-ids', title: 'Function ID & Quy ước' },
  { route: 'help', view: 'help', title: 'Hướng dẫn sử dụng' }
]
export async function ensureAppPages(source: string) {
  for (const page of appPages) {
    const file = await safePath(source, page.route, 'index.md')
    if (await exists(file)) {
      if (/^doc_id:/m.test(await fs.readFile(file, 'utf8')))
        throw new AppError(409, `Route /${page.route}/ đang thuộc tài liệu nghiệp vụ; không ghi đè.`)
      continue
    }
    await atomicWrite(file, `---\ntitle: ${page.title}\natlas_view: ${page.view}\n---\n`)
  }
}
