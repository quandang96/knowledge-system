// Real VitePress build + persistent filesystem + Git. Run separately from the fast acceptance suite.
import { promises as fs } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { createServer } from '../../apps/api/src/server'
import { metadataSchema } from '../../packages/schemas/src/index'

const base = path.resolve('.cache/e2e')
await fs.mkdir(base, { recursive: true })
const root = await fs.mkdtemp(path.join(base, 'knowledge-'))
await fs.cp(path.resolve('knowledge/published'), path.join(root, 'published'), {
  recursive: true,
  filter: (file) => !/[\\/](?:dist|cache|\.temp)(?:[\\/]|$)/.test(file)
})
const auth = {
  mode: 'local' as const,
  passwords: {
    admin: { password: 'smoke-test', role: 'Admin' as const },
    reader: { password: 'reader-test', role: 'Reader' as const }
  }
}
let server = await createServer({ root, auth })
let cookie = ''
let csrf = ''
async function login() {
  const response = await server.app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'admin', password: 'smoke-test' }
  })
  assert.equal(response.statusCode, 200)
  cookie = String(response.headers['set-cookie']).split(';')[0]
  csrf = response.json().data.csrf
}
async function request(
  method: 'GET' | 'PUT' | 'POST',
  url: string,
  payload?: unknown,
  headers: Record<string, string> = {}
) {
  return server.app.inject({
    method,
    url,
    headers: { cookie, 'x-csrf-token': csrf, ...headers },
    ...(payload !== undefined ? { payload: payload as any } : {})
  })
}
try {
  await login()
  const metadata = metadataSchema.parse({
    doc_id: 'SCR-SMOKE-001',
    project_id: 'demo-project',
    type: 'screen',
    module: 'approval',
    title: 'Real Publish smoke test',
    owner: 'Smoke Test',
    related_ids: ['BR-014'],
    screen: { route: '/smoke', menu_path: ['Home', 'Smoke'], screenshot: { gallery: [] } }
  })
  const created = await request('POST', '/api/documents', {
    metadata,
    body: '# Real Publish\n\n## Purpose\n\nFilesystem smoke test.'
  })
  assert.equal(created.statusCode, 201, created.body)
  const buffer = await sharp({ create: { width: 80, height: 50, channels: 3, background: '#ddeeff' } })
    .png()
    .toBuffer()
  const boundary = 'atlas-smoke-boundary'
  const multipart = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="smoke.png"\r\nContent-Type: image/png\r\n\r\n`
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ])
  const uploaded = await request('POST', '/api/documents/SCR-SMOKE-001/assets', multipart, {
    'content-type': `multipart/form-data; boundary=${boundary}`
  })
  assert.equal(uploaded.statusCode, 200, uploaded.body)
  const image = uploaded.json().data[0]
  const doc = created.json().data
  doc.metadata.screen.screenshot = {
    cover: image.relative_path,
    gallery: [
      { path: image.relative_path, alt: 'Smoke test image', caption: 'Generated fixture', category: 'overview' }
    ]
  }
  const saved = await request('PUT', '/api/documents/SCR-SMOKE-001/draft', {
    metadata: doc.metadata,
    body: `# Real Publish\n\n## Purpose\n\nFilesystem smoke test.\n\n![Smoke](${image.relative_path})`,
    base_revision: doc.revision
  })
  assert.equal(saved.statusCode, 200, saved.body)
  console.log('Running real staging VitePress build...')
  const published = await request('POST', '/api/documents/SCR-SMOKE-001/publish', {
    base_revision: saved.json().data.revision
  })
  assert.equal(published.statusCode, 200, published.body)
  assert.match(published.json().data.revision, /^[a-f0-9]{40}$/)
  const response = await request('GET', '/screens/approval/SCR-SMOKE-001/')
  assert.equal(response.statusCode, 200, response.body)
  assert.match(response.body, /Real Publish/)
  const active = await server.store.activeState()
  const dist = path.join(root, 'staging', active.release!, 'dist')
  const assetFiles = await fs.readdir(path.join(dist, 'assets'))
  assert.ok(
    assetFiles.some((name) => name.includes('smoke') && name.endsWith('.png')),
    'VitePress did not build the relative screenshot'
  )
  await server.app.close()
  server = await createServer({ root, auth })
  await login()
  assert.equal((await request('GET', '/api/knowledge/documents/SCR-SMOKE-001')).statusCode, 200)
  assert.equal(
    (await request('GET', `/api/documents/SCR-SMOKE-001/published-assets/${image.asset_id}`)).statusCode,
    200
  )
  console.log('Running real Unpublish build...')
  const removed = await request('POST', '/api/documents/SCR-SMOKE-001/unpublish', {})
  assert.equal(removed.statusCode, 200, removed.body)
  assert.equal((await request('GET', '/screens/approval/SCR-SMOKE-001/')).statusCode, 404)
  assert.equal((await request('GET', '/api/knowledge/documents/SCR-SMOKE-001')).statusCode, 404)
  console.log(
    'PASS: actual build, relative screenshot, authenticated HTML, Git SHA, restart persistence, and Unpublish.'
  )
} finally {
  await server.app.close()
  const resolved = path.resolve(root)
  assert.ok(resolved.startsWith(base + path.sep))
  await fs.rm(resolved, { recursive: true, force: true })
}
