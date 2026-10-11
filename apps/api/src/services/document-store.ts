import { promises as fs } from 'node:fs'
import path from 'node:path'
import { idSchema, metadataSchema, type Metadata, type DocumentRecord, type Graph } from '../../../../packages/schemas/src/index'
import { AppError, atomicWrite, checksum, exists, safePath, SerialQueue, walk } from './filesystem'
import { parseMarkdown, serialize, validateBody } from './markdown'
import { validateGraph } from './graph-validation'

export const folders: Record<Metadata['type'], string> = { overview: 'overview', 'business-flow': 'business-flows', module: 'modules', screen: 'screens', function: 'functions', role: 'roles', permission: 'permissions', 'business-rule': 'business-rules', 'test-scenario': 'test-scenarios', reference: 'references' }
export function documentPath(meta: Metadata) { return `${folders[meta.type]}/${meta.type === 'role' ? '' : `${meta.module}/`}${meta.doc_id}/index.md` }
export function canonicalUrl(relative: string) { return `/${relative.replace(/index\.md$/, '').replace(/\.md$/, '')}` }
export function template(meta: Metadata) {
  const headings: Record<string, string[]> = {
    screen: ['Mục đích', 'Cách truy cập', 'Thành phần giao diện', 'Chức năng', 'Vai trò và quyền', 'Quy tắc nghiệp vụ', 'Trạng thái màn hình', 'Ngoại lệ', 'Kịch bản kiểm thử'],
    'business-flow': ['Mục tiêu nghiệp vụ', 'Tác nhân', 'Trigger và điều kiện', 'Các bước xử lý', 'Kết quả', 'Ngoại lệ'],
    function: ['Mục đích', 'Trigger', 'Input và output', 'Validation', 'Kết quả và lỗi', 'Quyền và quy tắc'],
    role: ['Trách nhiệm', 'Vai trò cha', 'Chính sách kế thừa', 'Phạm vi dữ liệu', 'Quyền', 'Ngoại lệ'],
    permission: ['Ma trận quyền', 'Điều kiện', 'Phạm vi dữ liệu', 'Quy tắc nguồn'],
    'business-rule': ['Nội dung quy tắc', 'Lý do', 'Điều kiện', 'Ngoại lệ', 'Mức ưu tiên', 'Ví dụ', 'Ngày hiệu lực'],
    'test-scenario': ['Điều kiện tiên quyết', 'Vai trò và dữ liệu', 'Các bước kiểm thử', 'Kết quả mong đợi', 'Positive, negative và boundary cases']
  }
  return `# ${meta.title}\n\n${(headings[meta.type] || ['Tổng quan', 'Nội dung', 'Tài liệu liên quan']).map(h => `## ${h}\n\nĐiền nội dung đã được xác nhận tại đây.\n`).join('\n')}`
}
export class DocumentStore {
  readonly locks = new Map<string, SerialQueue>()
  constructor(public root: string) { this.root = path.resolve(root) }
  lock<T>(id: string, job: () => Promise<T>) { idSchema.parse(id); if (!this.locks.has(id)) this.locks.set(id, new SerialQueue()); return this.locks.get(id)!.run(job) }
  async init() { for (const dir of ['published', 'drafts', 'staging', '.knowledge-state']) { const dest = await safePath(this.root, dir); await fs.mkdir(dest, { recursive: true }) } }
  async activeState(): Promise<{ release?: string; revision?: string }> {
    const file = await safePath(this.root, '.knowledge-state/active.json')
    return await exists(file) ? JSON.parse(await fs.readFile(file, 'utf8')) : {}
  }
  async activeRoot(state?: { release?: string; revision?: string }) { state ||= await this.activeState(); return state.release ? safePath(this.root, 'staging', state.release, 'published') : safePath(this.root, 'published') }
  async readFile(file: string, relative: string, draft = false, publishedRevision?: string): Promise<DocumentRecord> {
    const raw = await fs.readFile(file, 'utf8').catch(() => { throw new AppError(404, 'Không tìm thấy tài liệu.') })
    const parsed = parseMarkdown(raw)
    const metadata = metadataSchema.parse(parsed.metadata)
    const folder = path.dirname(file)
    const graphs: Graph[] = []
    for (const graphFile of await walk(await safePath(folder, 'diagrams'))) if (graphFile.endsWith('.graph.json')) graphs.push(validateGraph(JSON.parse(await fs.readFile(graphFile, 'utf8'))))
    const assets = (await walk(await safePath(folder, 'assets'))).map(file => { const name = path.basename(file); return { path: `./assets/${name}`, preview_url: `/api/documents/${metadata.doc_id}/${draft ? 'draft-assets' : 'published-assets'}/${name}` } })
    return { metadata, body: parsed.body, revision: checksum(raw + JSON.stringify(graphs)), relative_path: relative, url: canonicalUrl(relative), graphs, assets, ...(!draft ? { published_revision: publishedRevision || (await this.activeState()).revision || 'initial' } : {}) }
  }
  async listPublished(snapshot?: { release?: string; revision?: string }): Promise<DocumentRecord[]> {
    const state = snapshot || await this.activeState()
    const root = await this.activeRoot(state)
    const records: DocumentRecord[] = []
    for (const file of await walk(root)) {
      if (!file.endsWith('.md')) continue
      const raw = await fs.readFile(file, 'utf8')
      if (!raw.startsWith('---') || !parseMarkdown(raw).metadata.doc_id) continue
      const record = await this.readFile(file, path.relative(root, file).split(path.sep).join('/'), false, state.revision || 'initial')
      if (record.metadata.status === 'published' && record.metadata.classification === 'internal') records.push(record)
    }
    return records
  }
  async published(id: string, snapshot?: { release?: string; revision?: string }) { idSchema.parse(id); const record = (await this.listPublished(snapshot)).find(d => d.metadata.doc_id === id); if (!record) throw new AppError(404, 'Tài liệu chưa được xuất bản hoặc không nằm trong phạm vi truy cập.'); return record }
  async draft(id: string) { idSchema.parse(id); const file = await safePath(this.root, 'drafts', id, 'index.md'); return this.readFile(file, `drafts/${id}/index.md`, true) }
  async listDrafts() { const dir = await safePath(this.root, 'drafts'); const result: DocumentRecord[] = []; for (const entry of await fs.readdir(dir)) if (idSchema.safeParse(entry).success && await exists(path.join(dir, entry, 'index.md'))) result.push(await this.draft(entry)); return result }
  async create(input: unknown, body: string | undefined, user: string) {
    const meta = metadataSchema.parse(input)
    return this.lock(meta.doc_id, async () => {
      if ((await this.listPublished()).some(d => d.metadata.doc_id === meta.doc_id) || await exists(await safePath(this.root, 'drafts', meta.doc_id, 'index.md'))) throw new AppError(409, 'ID đã tồn tại. Chọn sửa bản nháp hiện tại hoặc dùng ID mới.')
      return this.writeDraft({ ...meta, status: 'draft', updated_at: new Date().toISOString() }, body || template(meta), user)
    })
  }
  async ensureDraft(id: string, user: string) {
    return this.lock(id, async () => {
      if (await exists(await safePath(this.root, 'drafts', id, 'index.md'))) return this.draft(id)
      const snapshot = await this.activeState()
      const published = await this.published(id, snapshot)
      const source = await safePath(await this.activeRoot(snapshot), path.dirname(published.relative_path))
      const target = await safePath(this.root, 'drafts', id)
      await fs.cp(source, target, { recursive: true, dereference: false })
      return this.writeDraft({ ...published.metadata, status: 'draft', updated_at: new Date().toISOString() }, published.body, user)
    })
  }
  async save(id: string, input: unknown, body: string, revision: string, user: string) {
    return this.lock(id, async () => {
      const current = await this.draft(id)
      if (!revision || current.revision !== revision) throw new AppError(409, 'Bản nháp đã thay đổi. Tải lại để đối chiếu trước khi lưu.', { current_revision: current.revision })
      const meta = metadataSchema.parse(input)
      if (meta.doc_id !== id || meta.project_id !== current.metadata.project_id || meta.type !== current.metadata.type || meta.module !== current.metadata.module) throw new AppError(400, 'ID, project, loại và module không được đổi sau khi tạo. Chuyển thư mục chưa được hỗ trợ.')
      return this.writeDraft({ ...meta, status: 'draft', updated_at: new Date().toISOString() }, body, user)
    })
  }
  async writeDraft(meta: Metadata, body: string, user: string) {
    validateBody(body)
    const file = await safePath(this.root, 'drafts', meta.doc_id, 'index.md')
    const raw = serialize(meta, body)
    await atomicWrite(file, raw)
    await atomicWrite(await safePath(this.root, 'drafts', meta.doc_id, 'draft-meta.json'), JSON.stringify({ editor: user, updated_at: meta.updated_at, revision: checksum(raw), base_published_commit: (await this.activeState()).revision || null }, null, 2))
    await this.audit(user, 'save-draft', meta.doc_id)
    return this.draft(meta.doc_id)
  }
  async audit(user: string, action: string, id: string) { await fs.appendFile(await safePath(this.root, '.knowledge-state/audit.jsonl'), JSON.stringify({ user, action, doc_id: id, at: new Date().toISOString() }) + '\n', { mode: 0o600 }) }
}
