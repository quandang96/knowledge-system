import 'dotenv/config'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ZodError } from 'zod'
import { DocumentStore } from './services/document-store'
import { Publisher, type PublisherOptions } from './services/publisher'
import { AppError, safePath, exists } from './services/filesystem'
import { registerAuth, requireRole, readers, type AuthOptions } from './services/permissions'
import { documentRoutes } from './routes/documents'
import { importRoutes } from './routes/imports'
import { uploadRoutes } from './routes/uploads'
import { publishingRoutes } from './routes/publishing'
import { diagramRoutes } from './routes/diagrams'
import { knowledgeRoutes } from './routes/knowledge'
import { workspaceRoutes } from './routes/workspace'
import { catalogRoutes } from './routes/catalog'
import { feedbackRoutes } from './routes/feedback'
import { acquireWriter } from './services/writer-lease'
import { idSchema } from '../../../packages/schemas/src/index'
import { atlasColors } from '../../../packages/ui/src/theme'
import { openApiDocument } from './openapi'

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export interface ServerOptions {
  root?: string
  auth?: AuthOptions
  build?: PublisherOptions['build']
  logger?: boolean
}
export async function createServer(options: ServerOptions = {}) {
  // /api/v1/... is an alias of /api/... so integrations can pin a version without duplicating routes.
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 3 * 1024 * 1024,
    trustProxy: false,
    rewriteUrl: (req) => (req.url || '/').replace(/^\/api\/v1(?=[/?]|$)/, '/api')
  })
  await app.register(cookie)
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 20 } })
  // Behind the gateway every request shares one IP, so limit per authenticated user. The hook runs after
  // the auth onRequest hook; unauthenticated requests (including login) still fall back to the client IP.
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    hook: 'preHandler',
    keyGenerator: (req) => (req.identity ? `user:${req.identity.user}` : req.ip)
  })
  const store = new DocumentStore(options.root || path.resolve(projectRoot, process.env.KNOWLEDGE_ROOT || 'knowledge'))
  const publisher = new Publisher(store, { projectRoot, build: options.build })
  const releaseWriter = await acquireWriter(store.root)
  app.addHook('onClose', releaseWriter)
  try {
    await publisher.init()
    const state = await store.activeState()
    if (state.release) await publisher.syncCanonical(await store.activeRoot())
    await registerAuth(
      app,
      options.auth || {
        mode: process.env.AUTH_MODE === 'proxy' ? 'proxy' : 'local',
        production: process.env.NODE_ENV === 'production',
        proxySecret: process.env.PROXY_SHARED_SECRET,
        allowedOrigin: process.env.ALLOWED_ORIGIN,
        secureCookie: process.env.COOKIE_SECURE === 'true',
        passwords: {
          admin: { password: process.env.LOCAL_ADMIN_PASSWORD || 'atlas-demo-2026', role: 'Admin' },
          editor: { password: process.env.LOCAL_EDITOR_PASSWORD || 'atlas-editor-2026', role: 'Editor' },
          publisher: { password: process.env.LOCAL_PUBLISHER_PASSWORD || 'atlas-publisher-2026', role: 'Publisher' },
          reader: { password: process.env.LOCAL_READER_PASSWORD || 'atlas-reader-2026', role: 'Reader' }
        }
      }
    )
    app.setErrorHandler((error, req, reply) => {
      const apiError = error as Error & { statusCode?: number }
      const status = error instanceof ZodError ? 400 : apiError.statusCode || 500
      if (status >= 500) req.log.error(error)
      reply.code(status).send({
        data: null,
        error: {
          message:
            error instanceof ZodError
              ? 'Dữ liệu không hợp lệ.'
              : status >= 500
                ? 'Không thể hoàn tất thao tác. Kiểm tra log máy chủ.'
                : apiError.message,
          details: error instanceof ZodError ? error.issues : (error as AppError).details
        }
      })
    })
    app.get('/api/health', async () => ({ data: { status: 'ok', storage: 'filesystem' } }))
    app.get('/api/openapi.json', async (req) => {
      requireRole(req, readers)
      return openApiDocument()
    })
    await documentRoutes(app, store)
    await importRoutes(app, store)
    await uploadRoutes(app, store)
    await publishingRoutes(app, publisher)
    await diagramRoutes(app, store)
    await knowledgeRoutes(app, store)
    await workspaceRoutes(app, store)
    await catalogRoutes(app, store)
    await feedbackRoutes(app, store)
    const mime: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.webp': 'image/webp',
      '.json': 'application/json',
      '.woff2': 'font/woff2',
      '.woff': 'font/woff',
      '.ttf': 'font/ttf',
      '.ico': 'image/x-icon',
      '.svg': 'image/svg+xml'
    }
    // Login shell has no business content. All compiled pages and bundles require auth.
    app.get('/login', async (_req, reply) => reply.type('text/html').send(loginShell))
    app.get('/*', async (req, reply) => {
      if (req.url.startsWith('/api/')) throw new AppError(404, 'API không tồn tại.')
      if (!req.identity) return reply.redirect('/login')
      requireRole(req, readers)
      const state = await store.activeState()
      const dist = state.release
        ? await safePath(store.root, 'staging', state.release, 'dist')
        : path.join(store.root, 'published/.vitepress/dist')
      let raw: string
      try {
        raw = decodeURIComponent(req.url.split('?')[0])
      } catch {
        throw new AppError(400, 'URL không hợp lệ.')
      }
      if (
        raw.includes('..') ||
        raw.includes('\\') ||
        raw.includes('\0') ||
        raw.split('/').some((p) => p.startsWith('.'))
      )
        throw new AppError(400, 'Đường dẫn không hợp lệ.')
      const stableId = raw === '/document/' ? new URL(req.url, 'https://atlas.invalid').searchParams.get('id') : null
      const pathId = raw.match(/\/([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\/?(?:index\.html)?$/)?.[1]
      if (raw === '/test-scenarios/' || raw === '/test-scenarios') return reply.redirect('/legacy/')
      if (stableId || pathId) {
        const doc = await (
          stableId
            ? store.publishedKey(
                idSchema.parse(stableId),
                new URL(req.url, 'https://atlas.invalid').searchParams.get('project_id') || undefined,
                true,
                state
              )
            : store.published(idSchema.parse(pathId), state, true)
        ).catch((error) => {
          if (stableId) throw error
          return null
        })
        if (doc?.metadata.type === 'test-scenario') return reply.redirect(`/legacy/?id=${doc.metadata.doc_id}`)
        if (doc && (stableId || raw !== doc.url)) return reply.redirect(doc.url)
      }
      let relative = raw.replace(/^\//, '')
      if (!path.extname(relative))
        relative = relative.endsWith('/') || !relative ? `${relative}index.html` : `${relative}/index.html`
      const file = await safePath(dist, relative)
      if (!(await exists(file))) throw new AppError(404, 'Trang không tồn tại hoặc đã được gỡ xuất bản.')
      const type = mime[path.extname(file)]
      if (!type) throw new AppError(404, 'File không được phục vụ.')
      return reply
        .header('Cache-Control', 'private, no-store')
        .type(type)
        .send(await fs.readFile(file))
    })
    return { app, store, publisher }
  } catch (error) {
    await app.close()
    throw error
  }
}
const loginShell = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Đăng nhập · Atlas</title><style>body{font:16px system-ui;background:${atlasColors['background']};color:${atlasColors['on-surface']};margin:0;display:grid;place-items:center;min-height:100vh}form{background:white;border:1px solid ${atlasColors['outline']};border-radius:20px;padding:40px;width:min(360px,75vw)}h1{letter-spacing:-1px}label{display:block;margin:18px 0 6px}input,button{font:inherit;box-sizing:border-box;padding:12px;border:1px solid ${atlasColors['control-outline']};border-radius:8px;width:100%}button{background:${atlasColors['primary']};color:white;border:0;margin-top:24px;cursor:pointer}p{color:${atlasColors['text-secondary']};font-size:14px}#error{color:${atlasColors['error']}}input:focus-visible,button:focus-visible{outline:3px solid ${atlasColors['primary']};outline-offset:3px}</style><form id="login"><h1>atlas<span style="color:${atlasColors['primary']}">.</span></h1><p>Business Knowledge Hub · Đăng nhập nội bộ</p><label for="user">Tài khoản</label><input id="user" autocomplete="username" required><label for="pass">Mật khẩu</label><input id="pass" type="password" autocomplete="current-password" required><button>Đăng nhập</button><p id="error" role="alert"></p></form><script>document.getElementById('login').addEventListener('submit',async e=>{e.preventDefault();const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('user').value,password:document.getElementById('pass').value})});const j=await r.json();if(r.ok)location.href='/';else document.getElementById('error').textContent=j.error.message})</script></html>`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { app } = await createServer({ logger: true })
  await app.listen({ host: process.env.API_HOST || '127.0.0.1', port: Number(process.env.API_PORT || 3001) })
  let closing = false
  const stop = async () => {
    if (closing) return
    closing = true
    await app.close()
    process.exit(0)
  }
  process.on('SIGTERM', () => {
    void stop()
  })
  process.on('SIGINT', () => {
    void stop()
  })
}
