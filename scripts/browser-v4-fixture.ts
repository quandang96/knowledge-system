import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import sharp from 'sharp'
import { createServer } from '../apps/api/src/server'
import { documentPath } from '../apps/api/src/services/document-store'
import { serialize } from '../apps/api/src/services/markdown'
import { metadataSchema } from '../packages/schemas/src/index'
import { prepareV3Fixture } from '../tests/e2e/v3-fixture'

const base = path.resolve('.cache/browser-qa')
await fs.mkdir(base, { recursive: true })
const root = await fs.mkdtemp(path.join(base, 'v4-'))
await fs.cp(path.resolve('knowledge/published'), path.join(root, 'published'), {
  recursive: true,
  filter: (file) => !/[\\/](?:dist|cache|\.temp)(?:[\\/]|$)/.test(file)
})
const common = {
  project_id: 'demo-project',
  module: 'approval',
  status: 'published',
  owner: 'QA fixture',
  updated_at: '2026-10-21T00:00:00+07:00',
  summary: 'Dữ liệu tổng hợp chỉ dùng kiểm tra V4.'
}
const fn = metadataSchema.parse({
  ...common,
  doc_id: 'FUNC-V4-BROWSER-001',
  type: 'function',
  function_code: 'TRAN-DET-001',
  title: 'Xem chi tiết giao dịch',
  relations: [{ kind: 'governed_by', target_id: 'BR-014' }]
})
const screen = metadataSchema.parse({
  ...common,
  doc_id: 'SCR-V4-BROWSER-001',
  type: 'screen',
  title: 'Chi tiết giao dịch — fixture V4',
  relations: [
    { kind: 'implements', target_id: fn.doc_id },
    { kind: 'governed_by', target_id: 'BR-014' }
  ],
  screen: { route: '/transactions/:id', menu_path: ['Giao dịch', 'Chi tiết'], screenshot: { gallery: [] } }
})
const screenBody =
  '# Chi tiết giao dịch\n\n## Mô tả nghiệp vụ\n\nVăn bản trước ảnh tổng quan.\n\n![Tổng quan giao dịch](./assets/v4-overview.png "Ảnh ngay sau đoạn mô tả")\n\nVăn bản sau ảnh tổng quan.\n\n## Hành vi chính\n\nVăn bản trước ảnh kết quả.\n\n![Kết quả giao dịch](./assets/v4-state.png "Ảnh nằm trong hành vi")\n\nVăn bản sau ảnh kết quả.\n\n## Luồng xử lý\n\n```mermaid\nflowchart LR\n A[Chọn giao dịch] --> B[Xem chi tiết]\n```\n\n## Nguồn quyết định\n\nNhóm kiểm thử giao diện xác nhận fixture, không phải quy định nghiệp vụ.\n'
for (const [metadata, body] of [
  [
    fn,
    '# Xem chi tiết\n\n## Trigger\n\nChọn một giao dịch trong danh sách.\n\n## Input và output\n\nMã giao dịch → thông tin chi tiết.\n\n## Nguồn quyết định\n\nFixture V4.\n'
  ],
  [screen, screenBody]
] as const) {
  const file = path.join(root, 'published', documentPath(metadata))
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, serialize(metadata, body))
}
const assets = path.join(root, 'published', path.dirname(documentPath(screen)), 'assets')
await fs.mkdir(assets, { recursive: true })
for (const [name, color] of [
  ['v4-overview.png', '#EAF4FF'],
  ['v4-state.png', '#E9F9F0']
])
  await sharp({ create: { width: 1200, height: 480, channels: 3, background: color } })
    .png()
    .toFile(path.join(assets, name))
const server = await createServer({
  root,
  auth: {
    mode: 'local',
    passwords: {
      admin: { password: 'qa-admin', role: 'Admin' },
      editor: { password: 'qa-editor', role: 'Editor' },
      publisher: { password: 'qa-publisher', role: 'Publisher' },
      reader: { password: 'qa-reader', role: 'Reader' }
    }
  }
})
const { revision, ...config } = await server.store.workspace.read()
config.projects.push({
  id: 'qa-pilot',
  name: 'Pilot kiểm tra',
  description: 'Kho riêng kiểm tra.',
  demo: false,
  require_review: true,
  modules: [{ id: 'billing', name: 'Thanh toán' }]
})
await server.store.workspace.update(config, revision)
for (const [id, type, title] of [
  ['REF-QA-AUTOSAVE', 'reference', 'Kiểm tra autosave'],
  ['REF-QA-TARGET', 'reference', 'Tài liệu nguồn thanh toán'],
  ['BR-QA-LIMIT', 'business-rule', 'Quy tắc hạn mức']
])
  await server.store.create(
    metadataSchema.parse({
      doc_id: id,
      type,
      title,
      project_id: 'qa-pilot',
      module: 'billing',
      owner: 'editor',
      summary: 'Nguồn nghiệp vụ dùng trong kiểm tra.'
    }),
    '# ' + title + '\n\n## Nội dung\n\nNội dung ban đầu.\n\n## Nguồn quyết định\n\nNhóm QA xác nhận.\n',
    'editor'
  )
await prepareV3Fixture(server.store)
await server.app.listen({ host: '127.0.0.1', port: 3002 })
const web = spawn(
  process.execPath,
  [
    path.resolve('node_modules/vitepress/bin/vitepress.js'),
    'dev',
    path.join(root, 'published'),
    '--host',
    '127.0.0.1',
    '--port',
    '5174'
  ],
  {
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, ATLAS_PROJECT_ROOT: process.cwd(), ATLAS_API_TARGET: 'http://127.0.0.1:3002' }
  }
)
console.log('V4 QA root:', root)
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  web.kill()
  await server.app.close()
  if (!path.resolve(root).startsWith(base + path.sep)) throw new Error('Unsafe cleanup')
  await fs.rm(root, { recursive: true, force: true })
  process.exit(0)
}
process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())
