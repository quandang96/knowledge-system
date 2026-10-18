import { promises as fs } from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { metadataSchema, assetPathSchema, type DocumentRecord, type DraftRecord, type PublishJob } from '../../../../packages/schemas/src/index'
import { documentRelations, relationError } from '../../../../packages/schemas/src/relations'
import { linkedDocumentId } from '../../../../packages/schemas/src/document-links'
import { AppError, atomicWrite, exists, safePath, SerialQueue, walk } from './filesystem'
import { DocumentStore, documentPath, canonicalUrl } from './document-store'
import { GitVersioning } from './git-versioning'
import { markdownLinks, parseMarkdown, serialize } from './markdown'
import { validateGraph } from './graph-validation'

const execute = promisify(execFile)
export async function validatePublished(source: string, changedIds: string[] = []) {
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
    // Read-only legacy snapshots never become a gate for active business content.
    if (doc.metadata.type === 'test-scenario') continue
    const missing = documentRelations(doc.metadata).map(r => r.target_id).filter(id => !ids.has(id))
    if (missing.length) throw new AppError(400, `${doc.metadata.doc_id}: related_ids chưa tồn tại: ${missing.join(', ')}`)
    for (const relation of documentRelations(doc.metadata)) {
      const target = docs.find(d => d.metadata.doc_id === relation.target_id)!
      if (target.metadata.type === 'test-scenario' && !changedIds.includes(doc.metadata.doc_id)) continue
      const error = relationError(doc.metadata, target.metadata, relation.kind)
      if (error) throw new AppError(400, `${doc.metadata.doc_id}: ${error}`)
    }
    const links = [...markdownLinks(doc.body), ...(doc.metadata.screen?.screenshot.gallery.map(i => i.path) || []), ...(doc.metadata.screen?.screenshot.cover ? [doc.metadata.screen.screenshot.cover] : [])]
    for (const link of links) {
      if (/^https?:\/\//i.test(link) || link.startsWith('#')) continue
      const stableId = linkedDocumentId(link)
      if (stableId) {
        const target = docs.find(item => item.metadata.doc_id === stableId)
        if (!target) throw new AppError(400, `Liên kết tài liệu chưa xuất bản: ${stableId}. Xuất bản cùng changeset nếu đây là tài liệu mới.`)
        const error = relationError(doc.metadata, target.metadata, 'related')
        if (error) throw new AppError(400, `${doc.metadata.doc_id}: ${error}`)
        continue
      }
      if (changedIds.includes(doc.metadata.doc_id) && link.startsWith('/test-scenarios/')) throw new AppError(400, 'Liên kết kiểm thử đã ngừng sử dụng. Thay liên kết legacy trước khi xuất bản.')
      const clean = decodeURIComponent(link.split('#')[0].split('?')[0])
      if (clean.startsWith('./assets/') && !assetPathSchema.safeParse(clean).success) throw new AppError(400, `Asset link không hợp lệ: ${link}`)
      if (clean.startsWith('/')) { if (!urls.has(clean.endsWith('/') ? clean : `${clean}/`)) throw new AppError(400, `Liên kết nội bộ chưa tồn tại: ${link}`) }
      else if (!await exists(await safePath(path.dirname(path.join(source, doc.relative_path)), clean))) throw new AppError(400, `Attachment chưa tồn tại: ${link}`)
    }
    const graphRoot = await safePath(source, path.dirname(doc.relative_path), 'diagrams')
    for (const graphFile of await walk(graphRoot)) {
      const graph = validateGraph(JSON.parse(await fs.readFile(graphFile, 'utf8')))
      if (path.basename(graphFile) !== `${graph.diagram_id}.graph.json`) throw new AppError(400, 'Tên file graph không khớp diagram ID.')
      for (const node of graph.nodes) for (const [id, type] of [[node.role_id,'role'],[node.screen_id,'screen'],[node.function_id,'function'],...node.rule_ids.map(id=>[id,'business-rule'])]) {
        if (!id) continue
        const target = docs.find(item=>item.metadata.doc_id===id)
        if (!target || target.metadata.type !== type || target.metadata.project_id !== doc.metadata.project_id) throw new AppError(400, `Diagram tham chiếu không hợp lệ hoặc ngoài project: ${id}`)
      }
    }
  }
  return docs
}
export interface PublisherOptions { projectRoot: string; build?: (source: string, output: string) => Promise<void> }
export class Publisher {
  queue = new SerialQueue()
  jobs = new Map<string, PublishJob>()
  git: GitVersioning
  constructor(public store: DocumentStore, public options: PublisherOptions) { this.git = new GitVersioning(path.join(store.root, '.knowledge-state/history')) }
  async init() {
    await this.store.init()
    await this.git.init(await this.store.activeRoot())
    if (!(await this.store.activeState()).revision) await atomicWrite(await safePath(this.store.root, '.knowledge-state/active.json'), JSON.stringify({ revision: await this.git.git(['rev-parse', 'HEAD']) }, null, 2))
    await this.updateLocations(await this.store.listPublished())
    await this.writeManifest(await this.store.listPublished(undefined, true))
    const jobRoot = await safePath(this.store.root, '.knowledge-state/jobs')
    if (await exists(jobRoot)) for (const file of await fs.readdir(jobRoot)) {
      if (!/^[a-f0-9-]+\.json$/.test(file)) continue
      const job: PublishJob = JSON.parse(await fs.readFile(await safePath(jobRoot, file), 'utf8'))
      if (!['completed', 'failed'].includes(job.status)) { job.status = 'failed'; job.error = 'Tiến trình đã dừng trước khi ghi nhận hoàn tất. Kiểm tra release đang active trước khi thử lại.'; job.finished_at = new Date().toISOString(); await this.persistJob(job) }
      this.jobs.set(job.id, job)
    }
  }
  async locations(): Promise<Record<string,string>> { const file = await safePath(this.store.root, '.knowledge-state/locations.json'); return await exists(file) ? JSON.parse(await fs.readFile(file, 'utf8')) : {} }
  async updateLocations(docs: DocumentRecord[]) { await atomicWrite(await safePath(this.store.root, '.knowledge-state/locations.json'), JSON.stringify({ ...await this.locations(), ...Object.fromEntries(docs.map(d => [d.metadata.doc_id, d.relative_path])) }, null, 2)) }
  async writeManifest(docs: DocumentRecord[]) { await atomicWrite(await safePath(this.store.root, '.knowledge-state/manifest.json'), JSON.stringify(Object.fromEntries(docs.map(d => [d.metadata.doc_id, { path:d.relative_path, checksum:d.revision, published_revision:d.published_revision, url:d.metadata.type==='test-scenario'?`/legacy/?id=${d.metadata.doc_id}`:d.url, ...(d.metadata.type==='test-scenario'?{legacy:true}:{}) }])), null, 2)) }
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
    return this.publishMany([{ doc_id: id, base_revision: revision }], user, comment)
  }
  private lockMany<T>(ids: string[], job: () => Promise<T>): Promise<T> {
    return ids.length ? this.store.lock(ids[0], () => this.lockMany(ids.slice(1), job)) : job()
  }
  async publishMany(items: { doc_id: string; base_revision: string }[], user: string, comment = '', job?: PublishJob) {
    if (!items.length || new Set(items.map(i => i.doc_id)).size !== items.length) throw new AppError(400, 'Chọn ít nhất một tài liệu, không trùng ID.')
    return this.queue.run(() => this.lockMany(items.map(i => i.doc_id).sort(), async () => {
      if (job) await this.phase(job, 'validating')
      const drafts: DraftRecord[] = []
      for (const item of items) {
        const draft = await this.store.draft(item.doc_id)
        if (!item.base_revision || draft.revision !== item.base_revision) throw new AppError(409, `${item.doc_id}: bản nháp đã thay đổi. Tải lại trước khi xuất bản.`)
        if (draft.metadata.classification !== 'internal') throw new AppError(400, 'Confidential/Restricted cần cơ chế phân phối ACL riêng và không được xuất bản vào site chung.')
        const project = await this.store.workspace.validateLocation(draft.metadata.project_id, draft.metadata.module)
        if (project.require_review && (draft.review.status !== 'approved' || draft.review.revision !== draft.revision)) throw new AppError(400, `${item.doc_id}: cần được người khác duyệt đúng revision trước khi xuất bản.`)
        if (project.require_review && draft.checklist.some(c => !c.passed)) throw new AppError(400, `${item.doc_id}: checklist chưa hoàn tất.`)
        drafts.push(draft)
      }
      if (new Set(drafts.map(d => d.metadata.project_id)).size !== 1) throw new AppError(400, 'Một đợt xuất bản chỉ gồm tài liệu trong cùng project.')
      const id = items[0].doc_id
      return this.release(id, user, `Publish ${items.map(i => i.doc_id).join(', ')}${comment ? `: ${comment.slice(0,200)}` : ''}`, async source => {
        for (const draft of drafts) {
        const id = draft.metadata.doc_id
        const relative = documentPath(draft.metadata)
        const folder = await safePath(source, path.dirname(relative))
        await fs.mkdir(folder, { recursive: true })
        // Keep older published assets; Git retains them across revisions.
        for (const child of ['assets', 'diagrams']) {
          const from = await safePath(this.store.root, 'drafts', id, child)
          if (await exists(from)) await fs.cp(from, await safePath(folder, child), { recursive: true })
        }
        const meta = { ...draft.metadata }
        delete meta.verification
        if (draft.review.status === 'approved') meta.verification = { reviewer: draft.review.reviewer!, reviewed_at: draft.review.reviewed_at!, source_revision: draft.revision, reason: draft.review.reason || '' }
        await atomicWrite(await safePath(folder, 'index.md'), serialize({ ...meta, status: 'published', updated_at: new Date().toISOString() }, draft.body))
        }
      }, job, items.map(item => item.doc_id))
    }))
  }
  private async persistJob(job: PublishJob) { await atomicWrite(await safePath(this.store.root, '.knowledge-state/jobs', `${job.id}.json`), JSON.stringify(job, null, 2)) }
  private async phase(job: PublishJob, status: PublishJob['status']) { job.status = status; await this.persistJob(job) }
  async enqueue(items: { doc_id: string; base_revision: string }[], user: string, comment: string) {
    const job: PublishJob = { id: randomUUID(), doc_ids: items.map(i => i.doc_id), user, status: 'queued', created_at: new Date().toISOString() }
    await this.persistJob(job); this.jobs.set(job.id, job)
    void this.publishMany(items, user, comment, job).then(async result => {
      job.result = { revision: result.revision, release: result.release }; job.finished_at = new Date().toISOString(); await this.phase(job, 'completed')
    }).catch(async error => {
      job.error = error instanceof AppError ? error.message : 'Xuất bản thất bại. Kiểm tra log máy chủ.'; job.finished_at = new Date().toISOString(); await this.phase(job, 'failed')
    }).catch(() => { job.status = 'failed'; job.error = 'Không ghi được trạng thái job. Kiểm tra dung lượng và release active.' })
    return { ...job }
  }
  async unpublish(id: string, user: string) {
    return this.queue.run(() => this.store.lock(id, async () => {
      const doc = await this.store.published(id)
      return this.release(id, user, `Unpublish ${id}`, async source => { await fs.rm(await safePath(source, path.dirname(doc.relative_path)), { recursive: true, force: true }) })
    }))
  }
  async release(id: string, user: string, message: string, change: (source: string) => Promise<void>, job?: PublishJob, changedIds: string[] = []) {
    const release = `release-${Date.now()}-${randomUUID().slice(0,8)}`
    const source = await safePath(this.store.root, 'staging', release, 'published')
    const output = await safePath(this.store.root, 'staging', release, 'dist')
    await fs.mkdir(source, { recursive: true })
    await fs.cp(await this.store.activeRoot(), source, { recursive: true, filter: (file) => !/(?:^|[\\/])(?:cache|dist|node_modules)(?:[\\/]|$)/.test(file) })
    await change(source)
    const docs = await validatePublished(source, changedIds)
    if (job) await this.phase(job, 'building')
    await this.build(source, output)
    if (job) await this.phase(job, 'activating')
    // The immutable snapshot and built site become active together through one pointer.
    const revision = await this.git.commit(source, user, message)
    await this.updateLocations(docs)
    const manifest = Object.fromEntries(docs.map(d => [d.metadata.doc_id, { path: d.relative_path, revision, url: d.metadata.type==='test-scenario'?`/legacy/?id=${d.metadata.doc_id}`:d.url, ...(d.metadata.type==='test-scenario'?{legacy:true}:{}) }]))
    await atomicWrite(await safePath(this.store.root, 'staging', release, 'manifest.json'), JSON.stringify(manifest, null, 2))
    await atomicWrite(await safePath(this.store.root, '.knowledge-state/active.json'), JSON.stringify({ release, revision, activated_at: new Date().toISOString() }, null, 2))
    // Canonical files mirror the release. API and static delivery keep using the pointer.
    // If interrupted, restart repairs this mirror from the active snapshot.
    await this.syncCanonical(source).catch(() => undefined)
    await this.writeManifest(await this.store.listPublished(undefined, true)).catch(() => undefined)
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
      this.store.assertActive(meta)
      if (meta.doc_id !== id) throw new AppError(400, 'Revision không thuộc tài liệu này.')
      const target = await safePath(this.store.root, 'drafts', id)
      await fs.rm(target, { recursive: true, force: true })
      await this.git.restoreFolder(revision, path.dirname(location).split(path.sep).join('/'), target)
      await this.store.writeDraft({ ...meta, status: 'draft', updated_at: new Date().toISOString() }, parsed.body, user)
    })
    const draft = await this.store.draft(id)
    if ((await this.store.workspace.read()).projects.find(p => p.id === draft.metadata.project_id)?.require_review) return { doc_id: id, status: 'draft', revision: draft.revision, url: `/studio/?doc=${id}` }
    return this.publish(id, draft.revision, user, `Restore ${revision.slice(0,12)}`)
  }
}
