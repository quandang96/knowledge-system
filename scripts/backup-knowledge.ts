import 'dotenv/config'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { acquireWriter } from '../apps/api/src/services/writer-lease'
const source = path.resolve(process.env.KNOWLEDGE_ROOT || 'knowledge')
const targetArg = process.argv[2]
if (!targetArg)
  throw new Error('Provide an approved backup directory outside KNOWLEDGE_ROOT: pnpm backup /persistent-backups/atlas')
const target = path.resolve(targetArg)
const relative = path.relative(source, target)
if (!relative.startsWith('..') && !path.isAbsolute(relative))
  throw new Error('Backup must be outside the knowledge source tree.')
await fs.mkdir(target, { recursive: true })
const snapshot = path.join(target, `atlas-${new Date().toISOString().replace(/[:.]/g, '-')}`)
const release = await acquireWriter(source)
try {
  await fs.cp(source, snapshot, {
    recursive: true,
    filter: (file) =>
      path.basename(file) !== 'writer.lock' && !/(?:^|[\\/])(?:cache|node_modules)(?:[\\/]|$)/.test(file)
  })
} finally {
  await release()
}
console.log(`Backup created: ${snapshot}. Pause writes while backing up; verify the snapshot before restoring.`)
