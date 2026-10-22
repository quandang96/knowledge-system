import { promises as fs } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { AppError, atomicWrite, safePath } from './filesystem'

export async function acquireWriter(root: string) {
  const file = await safePath(root, '.knowledge-state/writer.lock')
  await fs.mkdir(await safePath(root, '.knowledge-state'), { recursive: true })
  const canonical = await fs.realpath(root)
  const digest = createHash('sha256')
    .update(process.platform === 'win32' ? canonical.toLowerCase() : canonical)
    .digest()
  const channel = createServer((socket) => socket.destroy())
  const pipe = `\\\\.\\pipe\\atlas-writer-${digest.toString('hex')}`
  const port = 30000 + (digest.readUInt32BE(0) % 19000)
  try {
    await new Promise<void>((resolve, reject) => {
      channel.once('error', reject)
      channel.once('listening', () => {
        channel.removeListener('error', reject)
        resolve()
      })
      if (process.platform === 'win32') channel.listen(pipe)
      else channel.listen({ host: '127.0.0.1', port, exclusive: true })
    })
  } catch {
    throw new AppError(
      503,
      `Không lấy được writer lease cho kho này. Một API writer khác đang chạy hoặc kênh lease đang được sử dụng${process.platform === 'win32' ? '' : ` (loopback port ${port})`}.`
    )
  }
  channel.unref()
  const close = () =>
    new Promise<void>((resolve, reject) => channel.close((error) => (error ? reject(error) : resolve())))
  const owner = {
    pid: process.pid,
    token: randomUUID(),
    channel: process.platform === 'win32' ? 'named-pipe' : `loopback:${port}`
  }
  // The OS releases this channel even after a crash. Holding it makes reclaiming
  // an old diagnostic file safe: no second writer can reclaim it concurrently.
  try {
    await atomicWrite(file, JSON.stringify(owner))
  } catch (error) {
    await close()
    throw error
  }
  let released = false
  return async () => {
    if (released) return
    released = true
    try {
      const current = JSON.parse(await fs.readFile(file, 'utf8').catch(() => 'null'))
      if (current?.token === owner.token) await fs.rm(file, { force: true })
    } finally {
      await close()
    }
  }
}
