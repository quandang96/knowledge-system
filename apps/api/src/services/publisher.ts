import { promises as fs } from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { metadataSchema, assetPathSchema, type DocumentRecord } from '../../../../packages/schemas/src/index'
import { AppError, atomicWrite, exists, safePath, SerialQueue, walk } from './filesystem'
import { DocumentStore, documentPath, canonicalUrl } from './document-store'
import { GitVersioning } from './git-versioning'
import { markdownLinks, parseMarkdown, serialize } from './markdown'
import { validateGraph } from './graph-validation'

const execute = promisify(execFile)
export async function validatePublished(source: string) {
  const docs: DocumentRecord[] = []
  const ids = new Set<string>()
  const urls = new Set<string>()
  const files = await walk(source)
  for (const file of files.filter(f => f.endsWith('.md'))) {
    const relative = path.relative(source, file).split(path.sep).join('/')
    urls.add(canonicalUrl(relative))
    const parsed = parseMarkdown(await fs.readFile(file, 'utf8'))
    if (!parsed.metadata.doc_id) continue // Trusted app route pages are created by the application.
    const meta = metadataSchema.parse(parsed.metadata)
    if (meta.status !== 'published' || meta.classification !== 'internal') throw new AppError(400, `${meta.doc_id}: chỉ bản Published/Internal được đưa vào static build chung.`)
    if (documentPath(meta) !== relative) throw new AppError(400, `${meta.doc_id}: cấu trúc thư mục không đúng quy định.`)
    if (ids.has(meta.doc_id)) throw new AppError(400, `ID bị trùng: ${meta.doc_id}`)
    ids.add(meta.doc_id)
    docs.push({ metadata: meta, body: parsed.body, relative_path: relative, url: canonicalUrl(relative), revision: '', graphs: [], assets: [] })
  }
  for (const doc of docs) {
    const missing = doc.metadata.related_ids.filter(id => !ids.has(id))
    if (missing.length) throw new AppError(400, `${doc.metadata.doc_id}: related_ids chưa tồn tại: ${missing.join(', ')}`)
    const links = [...markdownLinks(doc.body), ...(doc.metadata.screen?.screenshot.gallery.map(i => i.path) || []), ...(doc.metadata.screen?.screenshot.cover ? [doc.metadata.screen.screenshot.cover] : [])]
    for (const link of links) {
      if (/^https?:\/\//i.test(link) || link.startsWith('#')) continue
      const clean = decodeURIComponent(link.split('#')[0].split('?')[0])
      if (clean.startsWith('./assets/') && !assetPathSchema.safeParse(clean).success) throw new AppError(400, `Asset link không hợp lệ: ${link}`)
      if (clean.startsWith('/')) { if (!urls.has(clean.endsWith('/') ? clean : `${clean}/`)) throw new AppError(400, `Liên kết nội bộ chưa tồn tại: ${link}`) }
      else if (!await exists(await safePath(path.dirname(path.join(source, doc.relative_path)), clean))) throw new AppError(400, `Attachment chưa tồn tại: ${link}`)
    }
    const graphRoot = await safePath(source, path.dirname(doc.relative_path), 'diagrams')
    for (const graphFile of await walk(graphRoot)) {
      const graph = validateGraph(JSON.parse(await fs.readFile(graphFile, 'utf8')))
      if (path.basename(graphFile) !== `${graph.diagram_id}.graph.json`) throw new AppError(400, 'Tên file graph không khớp diagram ID.')
      for (const node of graph.nodes) for (const id of [node.role_id, node.screen_id, node.function_id, ...node.rule_ids].filter(Boolean)) if (!ids.has(id!)) throw new AppError(400, `Diagram tham chiếu ID chưa tồn tại: ${id}`)
    }
  }
  return docs
}
export interface PublisherOptions { projectRoot: string; build?: (source: string, output: string) => Promise<void> }
export class Publisher {
  queue = new SerialQueue()
  git: GitVersioning
  constructor(public store: DocumentStore, public options: PublisherOptions) { this.git = new GitVersioning(path.join(store.root, '.knowledge-state/history')) }
  async init() {
    await this.store.init()
    await this.git.init(await this.store.activeRoot())
    if (!(await this.store.activeState()).revision) await atomicWrite(await safePath(this.store.root, '.knowledge-state/active.json'), JSON.stringify({ revision: await this.git.git(['rev-parse', 'HEAD']) }, null, 2))
    await this.updateLocations(await this.store.listPublished())
    await this.writeManifest(await this.store.listPublished())
  }
  async locations(): Promise<Record<string,string>> { const file = await safePath(this.store.root, '.knowledge-state/locations.json'); return await exists(file) ? JSON.parse(await fs.readFile(file, 'utf8')) : {} }
  async updateLocations(docs: DocumentRecord[]) { await atomicWrite(await safePath(this.store.root, '.knowledge-state/locations.json'), JSON.stringify({ ...await this.locations(), ...Object.fromEntries(docs.map(d => [d.metadata.doc_id, d.relative_path])) }, null, 2)) }
  async writeManifest(docs: DocumentRecord[]) { await atomicWrite(await safePath(this.store.root, '.knowledge-state/manifest.json'), JSON.stringify(Object.fromEntries(docs.map(d => [d.metadata.doc_id, { path:d.relative_path, checksum:d.revision, published_revision:d.published_revision, url:d.url }])), null, 2)) }
  async build(source: string, output: string) {
    if (this.options.build) return this.options.build(source, output)
    try {
      await execute(process.execPath, [path.join(this.options.projectRoot, 'node_modules/vitepress/bin/vitepress.js'), 'build', source], {
        cwd: this.options.projectRoot, timeout: 180000, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
        env: { ...process.env, ATLAS_PROJECT_ROOT: this.options.projectRoot, ATLAS_BUILD_OUTPUT: output }
      })
    } catch (error) { const e = error as { stderr?: string; stdout?: string }; throw new AppError(422, 'VitePress build thất bại. Bản đang phục vụ được giữ nguyên.', (e.stderr || e.stdout || '').slice(-4000)) }
  }
  async publish(id: string, revision: string, user: string, comment = '') {
    return this.queue.run(() => this.store.lock(id, async () => {
      const draft = await this.store.draft(id)
      if (!revision || draft.revision !== revision) throw new AppError(409, 'Bản nháp đã thay đổi. Tải lại trước khi Publish.')
      if (draft.metadata.classification !== 'internal') throw new AppError(400, 'Confidential/Restricted cần cơ chế phân phối ACL riêng và không được xuất bản vào site chung. Có thể Unpublish bản cũ.')
      return this.release(id, user, `Publish ${id}${comment ? `: ${comment.slice(0,200)}` : ''}`, async source => {
        const relative = documentPath(draft.metadata)
        const folder = await safePath(source, path.dirname(relative))
        await fs.mkdir(folder, { recursive: true })
        // Keep older published assets; Git retains them across revisions.
        for (const child of ['assets', 'diagrams']) {
          const from = await safePath(this.store.root, 'drafts', id, child)
          if (await exists(from)) await fs.cp(from, await safePath(folder, child), { recursive: true })
        }
        await atomicWrite(await safePath(folder, 'index.md'), serialize({ ...draft.metadata, status: 'published', updated_at: new Date().toISOString() }, draft.body))
      })
    }))
  }
  async unpublish(id: string, user: string) {
    return this.queue.run(() => this.store.lock(id, async () => {
      const doc = await this.store.published(id)
      return this.release(id, user, `Unpublish ${id}`, async source => { await fs.rm(await safePath(source, path.dirname(doc.relative_path)), { recursive: true, force: true }) })
    }))
  }
  async release(id: string, user: string, message: string, change: (source: string) => Promise<void>) {
    const release = `release-${Date.now()}-${randomUUID().slice(0,8)}`
    const source = await safePath(this.store.root, 'staging', release, 'published')
    const output = await safePath(this.store.root, 'staging', release, 'dist')
    await fs.mkdir(source, { recursive: true })
    await fs.cp(await this.store.activeRoot(), source, { recursive: true, filter: (file) => !/(?:^|[\\/])(?:cache|dist|node_modules)(?:[\\/]|$)/.test(file) })
    await change(source)
    const docs = await validatePublished(source)
    await this.build(source, output)
    // The immutable snapshot and built site become active together through one pointer.
    const revision = await this.git.commit(source, user, message)
    await this.updateLocations(docs)
    const manifest = Object.fromEntries(docs.map(d => [d.metadata.doc_id, { path: d.relative_path, revision, url: d.url }]))
    await atomicWrite(await safePath(this.store.root, 'staging', release, 'manifest.json'), JSON.stringify(manifest, null, 2))
    await atomicWrite(await safePath(this.store.root, '.knowledge-state/active.json'), JSON.stringify({ release, revision, activated_at: new Date().toISOString() }, null, 2))
    // Canonical files mirror the release. API and static delivery keep using the pointer.
    // If interrupted, restart repairs this mirror from the active snapshot.
    await this.syncCanonical(source).catch(() => undefined)
    await this.writeManifest(await this.store.listPublished()).catch(() => undefined)
    await this.store.audit(user, message.startsWith('Unpublish') ? 'unpublish' : 'publish', id).catch(() => undefined)
    return { doc_id: id, revision, release, url: docs.find(d => d.metadata.doc_id === id)?.url || '/', status: message.startsWith('Unpublish') ? 'unpublished' : 'published' }
  }
  async syncCanonical(source: string) {
    const canonical = await safePath(this.store.root, 'published')
    for (const file of await walk(canonical)) await fs.rm(file, { force: true })
    await fs.cp(source, canonical, { recursive: true, filter: file => !file.includes('.vitepress') })
  }
  async restore(id: string, revision: string, user: string) {
    const location = (await this.locations())[id]
    if (!location) throw new AppError(404, 'Không tìm thấy lịch sử tài liệu.')
    await this.store.lock(id, async () => {
      const raw = await this.git.show(revision, location)
      const parsed = parseMarkdown(raw)
      const meta = metadataSchema.parse(parsed.metadata)
      if (meta.doc_id !== id) throw new AppError(400, 'Revision không thuộc tài liệu này.')
      const target = await safePath(this.store.root, 'drafts', id)
      await fs.rm(target, { recursive: true, force: true })
      await this.git.restoreFolder(revision, path.dirname(location).split(path.sep).join('/'), target)
      await this.store.writeDraft({ ...meta, status: 'draft', updated_at: new Date().toISOString() }, parsed.body, user)
    })
    const draft = await this.store.draft(id)
    return this.publish(id, draft.revision, user, `Restore ${revision.slice(0,12)}`)
  }
}
