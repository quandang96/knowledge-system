import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}
export const checksum = (value: string | Buffer) => `sha256:${createHash('sha256').update(value).digest('hex')}`
export async function exists(file: string) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}
export async function safePath(root: string, ...parts: string[]) {
  const target = path.resolve(root, ...parts)
  const relative = path.relative(path.resolve(root), target)
  if (relative.startsWith('..') || path.isAbsolute(relative) || parts.some((p) => p.includes('\0') || p.includes('\\')))
    throw new AppError(400, 'Đường dẫn không hợp lệ.')
  // Reject symlinks in every component, including existing parent directories.
  let current = path.resolve(root)
  const ancestors: string[] = []
  while (true) {
    ancestors.push(current)
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  for (const ancestor of ancestors.reverse()) {
    const stat = await fs.lstat(ancestor).catch(() => null)
    if (stat?.isSymbolicLink()) throw new AppError(400, 'Không hỗ trợ symbolic link trong kho tài liệu.')
  }
  current = path.resolve(root)
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part)
    const stat = await fs.lstat(current).catch(() => null)
    if (stat?.isSymbolicLink()) throw new AppError(400, 'Không hỗ trợ symbolic link trong kho tài liệu.')
  }
  return target
}
export async function atomicWrite(file: string, value: string | Buffer) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${randomUUID()}.tmp`
  try {
    await fs.writeFile(temp, value, { mode: 0o600 })
    await fs.rename(temp, file)
  } finally {
    await fs.rm(temp, { force: true })
  }
}
export async function walk(root: string): Promise<string[]> {
  if (!(await exists(root))) return []
  const result: string[] = []
  for (const item of await fs.readdir(root, { withFileTypes: true })) {
    if (item.isSymbolicLink()) throw new AppError(400, 'Kho tài liệu chứa symbolic link.')
    if (item.name.startsWith('.') || ['node_modules', 'dist'].includes(item.name)) continue
    const file = path.join(root, item.name)
    if (item.isDirectory()) result.push(...(await walk(file)))
    else result.push(file)
  }
  return result
}
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve()
  run<T>(job: () => Promise<T>): Promise<T> {
    const next = this.tail.then(job, job)
    this.tail = next.catch(() => undefined)
    return next
  }
}
