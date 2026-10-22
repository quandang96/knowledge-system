import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { validatePublished } from '../apps/api/src/services/publisher'
import { ensureAppPages } from '../apps/api/src/services/app-pages'
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.resolve(repository, process.env.KNOWLEDGE_ROOT || 'knowledge', 'published')
await ensureAppPages(source)
const documents = await validatePublished(source)
console.log(`Validated ${documents.length} published documents, references, assets and graphs.`)
const child = spawn(
  process.execPath,
  [path.join(repository, 'node_modules/vitepress/bin/vitepress.js'), 'build', source],
  {
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, ATLAS_PROJECT_ROOT: repository, ATLAS_BUILD_OUTPUT: path.join(source, '.vitepress/dist') }
  }
)
child.on('exit', (code) => process.exit(code || 0))
child.on('error', (error) => {
  console.error(error.message)
  process.exit(1)
})
