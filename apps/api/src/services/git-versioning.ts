import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { AppError, exists, safePath, walk, atomicWrite } from './filesystem'
const execute = promisify(execFile)
export class GitVersioning {
  constructor(public directory: string) {}
  async git(args: string[]) { return (await execute('git', args, { cwd: this.directory, maxBuffer: 30 * 1024 * 1024, windowsHide: true })).stdout.trim() }
  async init(source: string) {
    await fs.mkdir(this.directory, { recursive: true })
    if (!await exists(path.join(this.directory, '.git'))) {
      await this.git(['init', '--initial-branch=main'])
      await this.git(['config', 'user.name', 'Atlas Knowledge Hub'])
      await this.git(['config', 'user.email', 'atlas@localhost'])
      await this.git(['config', 'core.autocrlf', 'false'])
      await this.snapshot(source)
      await this.git(['add', '--all'])
      await this.git(['commit', '-m', 'Initialize published knowledge'])
    }
  }
  async snapshot(source: string) {
    for (const item of await fs.readdir(this.directory)) if (item !== '.git') await fs.rm(await safePath(this.directory, item), { recursive: true, force: true })
    for (const file of await walk(source)) {
      const relative = path.relative(source, file).split(path.sep).join('/')
      if (!/\.(md|png|jpg|webp|json)$/.test(relative)) continue
      const target = await safePath(this.directory, relative)
      await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(file, target)
    }
  }
  async commit(source: string, user: string, message: string) {
    await this.snapshot(source)
    await this.git(['add', '--all'])
    await this.git(['-c', `user.name=${user}`, '-c', 'user.email=atlas@localhost', 'commit', '--allow-empty', '-m', message])
    return this.git(['rev-parse', 'HEAD'])
  }
  async history(relative: string) {
    const log = await this.git(['log', '--format=%H%x09%aI%x09%an%x09%s', '--', relative])
    return log ? log.split('\n').map(row => { const [revision, at, user, ...message] = row.split('\t'); return { revision, at, user, message: message.join('\t') } }) : []
  }
  validateRevision(revision: string) { if (!/^[a-f0-9]{40}$/.test(revision)) throw new AppError(400, 'Git revision không hợp lệ.'); return revision }
  async show(revision: string, relative: string) { this.validateRevision(revision); try { return await this.git(['show', `${revision}:${relative}`]) } catch { throw new AppError(404, 'Không có tài liệu trong revision này.') } }
  async diff(relative: string, from: string, to: string) { return this.git(['diff', this.validateRevision(from), this.validateRevision(to), '--', relative]) }
  async restoreFolder(revision: string, folder: string, target: string) {
    this.validateRevision(revision)
    const files = await this.git(['ls-tree', '-r', '--name-only', revision, '--', folder])
    if (!files) throw new AppError(404, 'Revision không có nội dung tài liệu.')
    for (const file of files.split('\n')) {
      if (!file.startsWith(`${folder}/`)) throw new AppError(400, 'Revision path không hợp lệ.')
      const destination = await safePath(target, file.slice(folder.length + 1))
      const result = await execute('git', ['show', `${revision}:${file}`], { cwd: this.directory, encoding: 'buffer', maxBuffer: 12 * 1024 * 1024, windowsHide: true })
      await atomicWrite(destination, result.stdout)
    }
  }
}
