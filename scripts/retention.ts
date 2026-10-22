import 'dotenv/config'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { acquireWriter } from '../apps/api/src/services/writer-lease'
import { safePath, exists } from '../apps/api/src/services/filesystem'

const root = path.resolve(process.env.KNOWLEDGE_ROOT || 'knowledge')
const apply = process.argv.includes('--apply')
const keepArg = process.argv.find((a) => a.startsWith('--keep='))?.split('=')[1]
const daysArg = process.argv.find((a) => a.startsWith('--days='))?.split('=')[1]
const keep = Number(keepArg || 20)
const days = Number(daysArg || 7)
if (!Number.isInteger(keep) || keep < 2 || !Number.isInteger(days) || days < 1)
  throw new Error('Use --keep=N (>=2), --days=N (>=1). Default is dry-run.')
// The API must be stopped. Taking its lease also prevents a writer starting during cleanup.
const release = await acquireWriter(root)
try {
  const stateFile = await safePath(root, '.knowledge-state/active.json')
  const active = (await exists(stateFile)) ? JSON.parse(await fs.readFile(stateFile, 'utf8')) : {}
  const staging = await safePath(root, 'staging')
  const releases = []
  for (const name of await fs.readdir(staging)) {
    if (!/^release-\d+-[a-f0-9-]+$/.test(name)) continue
    const absolute = await safePath(staging, name)
    const stat = await fs.stat(absolute)
    if (stat.isDirectory()) releases.push({ name, absolute, modified: stat.mtimeMs })
  }
  releases.sort((a, b) => b.modified - a.modified)
  const candidates = releases
    .slice(keep)
    .filter((item) => item.name !== active.release && Date.now() - item.modified > days * 86400000)
  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        root,
        active: active.release,
        keep_newest: keep,
        minimum_age_days: days,
        candidates: candidates.map((item) => item.name)
      },
      null,
      2
    )
  )
  if (apply)
    for (const item of candidates) {
      const checked = await safePath(staging, item.name)
      if (checked !== item.absolute || !checked.startsWith(staging + path.sep) || item.name === active.release)
        throw new Error('Unsafe retention target')
      await fs.rm(checked, { recursive: true, force: true })
    }
} finally {
  await release()
}
