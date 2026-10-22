import { spawn } from 'node:child_process'
import path from 'node:path'
const children = [
  spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/server.ts'], { stdio: 'inherit', windowsHide: true }),
  spawn(
    process.execPath,
    [
      path.resolve('node_modules/vitepress/bin/vitepress.js'),
      'dev',
      path.resolve(process.env.KNOWLEDGE_ROOT || 'knowledge', 'published'),
      '--host',
      '127.0.0.1',
      '--port',
      '5173'
    ],
    { stdio: 'inherit', windowsHide: true, env: { ...process.env, ATLAS_PROJECT_ROOT: process.cwd() } }
  )
]
const stop = () => {
  for (const child of children) child.kill()
}
process.on('SIGINT', () => {
  stop()
  process.exit(0)
})
process.on('SIGTERM', () => {
  stop()
  process.exit(0)
})
for (const child of children)
  child.on('exit', (code) => {
    stop()
    process.exit(code || 0)
  })
import 'dotenv/config'
