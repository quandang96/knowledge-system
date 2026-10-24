import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { describe, expect, it } from 'vitest'
import { registerAuth } from '../apps/api/src/services/permissions'

describe('HTTPS quick tunnel login', () => {
  it('accepts only the public HTTPS origin for login and writes', async () => {
    const app = Fastify()
    await app.register(cookie)
    await registerAuth(app, {
      mode: 'local',
      tunnelHttpsOrigin: true,
      secureCookie: true,
      passwords: { admin: { password: 'test-password', role: 'Admin' } }
    })
    app.post('/api/write', async () => ({ ok: true }))
    const host = 'share.trycloudflare.com'
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { host, origin: `https://${host}` },
      payload: { username: 'admin', password: 'test-password' }
    })
    expect(login.statusCode).toBe(200)
    expect(login.headers['set-cookie']).toContain('Secure')
    const cookieHeader = String(login.headers['set-cookie']).split(';')[0]
    const csrf = login.json().data.csrf
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/write',
          headers: { host, origin: `https://${host}`, cookie: cookieHeader, 'x-csrf-token': csrf }
        })
      ).statusCode
    ).toBe(200)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/write',
          headers: { host, origin: 'https://other.example', cookie: cookieHeader, 'x-csrf-token': csrf }
        })
      ).statusCode
    ).toBe(403)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          headers: { host, origin: `http://${host}` },
          payload: { username: 'admin', password: 'test-password' }
        })
      ).statusCode
    ).toBe(403)
    await app.close()
  })
})
