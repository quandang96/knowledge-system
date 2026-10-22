import type { FastifyInstance, FastifyRequest } from 'fastify'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { AccessRole, Session } from '../../../../packages/schemas/src/index'
import { AppError } from './filesystem'

declare module 'fastify' {
  interface FastifyRequest {
    identity: Session | null
  }
}
export interface AuthOptions {
  mode: 'local' | 'proxy'
  passwords?: Record<string, { password: string; role: AccessRole }>
  proxySecret?: string
  production?: boolean
  allowedOrigin?: string
  secureCookie?: boolean
}
export function requireRole(req: FastifyRequest, roles: AccessRole[]) {
  if (!req.identity) throw new AppError(401, 'Vui lòng đăng nhập.')
  if (!roles.includes(req.identity.role)) throw new AppError(403, 'Bạn không có quyền thực hiện thao tác này.')
  return req.identity
}
export const readers: AccessRole[] = ['Reader', 'Editor', 'Publisher', 'Admin']
export const editors: AccessRole[] = ['Editor', 'Publisher', 'Admin']
export const publishers: AccessRole[] = ['Publisher', 'Admin']
const equal = (a: string, b: string) => {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
export async function registerAuth(app: FastifyInstance, options: AuthOptions) {
  if (options.production && options.mode !== 'proxy')
    throw new Error('Production requires AUTH_MODE=proxy behind an authenticated gateway.')
  if (options.mode === 'proxy' && (options.proxySecret?.length || 0) < 32)
    throw new Error('PROXY_SHARED_SECRET must contain at least 32 characters.')
  const sessions = new Map<string, { session: Session; expires: number }>()
  const salt = randomBytes(32)
  const accounts = new Map(
    Object.entries(options.passwords || {}).map(([name, value]) => [
      name,
      { hash: scryptSync(value.password, salt, 64), role: value.role }
    ])
  )
  app.decorateRequest('identity', null)
  app.addHook('onRequest', async (req, reply) => {
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'same-origin')
      .header('X-Frame-Options', 'DENY')
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store')
    if (options.mode === 'proxy') {
      const secret = String(req.headers['x-atlas-proxy-secret'] || '')
      const user = String(req.headers['x-atlas-user'] || '')
      const role = String(req.headers['x-atlas-role'] || '') as AccessRole
      if (equal(secret, options.proxySecret!) && /^[a-zA-Z0-9@._-]{1,100}$/.test(user) && readers.includes(role))
        req.identity = { user, role, csrf: 'same-origin-proxy' }
    } else {
      const remote = req.raw.socket.remoteAddress || ''
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote))
        throw new AppError(403, 'Local login chỉ cho phép loopback. Coder cần cấu hình authenticated proxy.')
      const token = req.cookies.atlas_session
      const entry = token ? sessions.get(token) : undefined
      if (entry && entry.expires > Date.now()) req.identity = entry.session
      else if (token) sessions.delete(token)
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.url.startsWith('/api/auth/login')) {
      if (!req.identity) throw new AppError(401, 'Vui lòng đăng nhập.')
      const origin = req.headers.origin
      const expected = options.allowedOrigin || `${req.protocol}://${req.headers.host}`
      if (origin && origin !== expected) throw new AppError(403, 'Origin không được phép.')
      if (!equal(String(req.headers['x-csrf-token'] || ''), req.identity.csrf))
        throw new AppError(403, 'CSRF token không hợp lệ.')
    }
  })
  app.get('/api/auth/session', async (req) => ({ data: requireRole(req, readers) }))
  app.post<{ Body: { username?: string; password?: string } }>(
    '/api/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      if (options.mode !== 'local') throw new AppError(400, 'Đăng nhập qua gateway của tổ chức.')
      const origin = req.headers.origin
      if (origin && origin !== (options.allowedOrigin || `${req.protocol}://${req.headers.host}`))
        throw new AppError(403, 'Origin không được phép.')
      const account = accounts.get(req.body?.username || '')
      const password = req.body?.password || ''
      if (password.length > 200) throw new AppError(401, 'Tên đăng nhập hoặc mật khẩu không đúng.')
      const hash = scryptSync(password, salt, 64)
      if (!account || !timingSafeEqual(hash, account.hash))
        throw new AppError(401, 'Tên đăng nhập hoặc mật khẩu không đúng.')
      const token = randomBytes(32).toString('hex')
      const session: Session = { user: req.body.username!, role: account.role, csrf: randomBytes(24).toString('hex') }
      for (const [key, value] of sessions) if (value.expires < Date.now()) sessions.delete(key)
      sessions.set(token, { session, expires: Date.now() + 8 * 3600000 })
      reply.setCookie('atlas_session', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: options.secureCookie || false,
        path: '/',
        maxAge: 8 * 3600
      })
      return { data: session }
    }
  )
  app.post('/api/auth/logout', async (req, reply) => {
    if (req.cookies.atlas_session) sessions.delete(req.cookies.atlas_session)
    reply.clearCookie('atlas_session', { path: '/' })
    return { data: true }
  })
}
