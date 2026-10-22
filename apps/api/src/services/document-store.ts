import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  defaultSections,
  documentTypes,
  idSchema,
  isActiveType,
  typeFolders,
  metadataSchema,
  type Metadata,
  type DocumentRecord,
  type DraftRecord,
  type ReviewState,
  type Graph
} from '../../../../packages/schemas/src/index'
import { documentRelations } from '../../../../packages/schemas/src/relations'
import { CURRENT_SCHEMA_VERSION } from '../../../../packages/schemas/src/migrations'
import { AppError, atomicWrite, checksum, exists, safePath, SerialQueue, walk } from './filesystem'
import { parseMarkdown, serialize, validateBody } from './markdown'
import { validateGraph } from './graph-validation'
import { WorkspaceStore } from './workspace'
import { documentChecklist } from './review'
import { Presence } from './presence'
import { assignFunctionCode, type FunctionCodeContext } from './function-codes'

export const folders = typeFolders
export function documentPath(meta: Metadata) {
  return `${folders[meta.type]}/${meta.type === 'role' ? '' : `${meta.module}/`}${meta.doc_id}/index.md`
}
export function canonicalUrl(relative: string) {
  return `/${relative.replace(/index\.md$/, '').replace(/\.md$/, '')}`
}
export function template(meta: Metadata) {
  const sections = documentTypes[meta.type].sections || defaultSections
  return `# ${meta.title}\n\n${sections.map((h) => `## ${h}\n\nĐiền nội dung đã được xác nhận tại đây.\n`).join('\n')}`
}
export class DocumentStore {
  readonly locks = new Map<string, SerialQueue>()
  readonly allocationQueue = new SerialQueue()
  readonly presence = new Presence()
  private readonly functionCodeQueue = new SerialQueue()
  private readonly functionCodeContext: FunctionCodeContext
  readonly workspace: WorkspaceStore
  private publishedCache?: {
    key: string
    records: Promise<DocumentRecord[]>
    byId: Promise<Map<string, DocumentRecord>>
  }
  constructor(public root: string) {
    this.root = path.resolve(root)
    this.workspace = new WorkspaceStore(this.root)
    this.functionCodeContext = {
      root: this.root,
      workspace: this.workspace,
      allDocuments: async () => [...(await this.listPublished(undefined, true)), ...(await this.listDrafts(true))],
      published: (id) => this.published(id)
    }
  }
  lock<T>(id: string, job: () => Promise<T>) {
    idSchema.parse(id)
    if (!this.locks.has(id)) this.locks.set(id, new SerialQueue())
    return this.locks.get(id)!.run(job)
  }
  async init() {
    for (const dir of ['published', 'drafts', 'staging', '.knowledge-state']) {
      const dest = await safePath(this.root, dir)
      await fs.mkdir(dest, { recursive: true })
    }
    await this.workspace.init([...(await this.listPublished()), ...(await this.listDrafts())])
  }
  async activeState(): Promise<{ release?: string; revision?: string }> {
    const file = await safePath(this.root, '.knowledge-state/active.json')
    return (await exists(file)) ? JSON.parse(await fs.readFile(file, 'utf8')) : {}
  }
  async activeRoot(state?: { release?: string; revision?: string }) {
    state ||= await this.activeState()
    return state.release ? safePath(this.root, 'staging', state.release, 'published') : safePath(this.root, 'published')
  }
  async readFile(file: string, relative: string, draft = false, publishedRevision?: string): Promise<DocumentRecord> {
    const raw = await fs.readFile(file, 'utf8').catch(() => {
      throw new AppError(404, 'Không tìm thấy tài liệu.')
    })
    const parsed = parseMarkdown(raw)
    const metadata = metadataSchema.parse(parsed.metadata)
    const folder = path.dirname(file)
    const graphs: Graph[] = []
    for (const graphFile of await walk(await safePath(folder, 'diagrams')))
      if (graphFile.endsWith('.graph.json'))
        graphs.push(validateGraph(JSON.parse(await fs.readFile(graphFile, 'utf8'))))
    const assets = (await walk(await safePath(folder, 'assets'))).map((file) => {
      const name = path.basename(file)
      return {
        path: `./assets/${name}`,
        preview_url: `/api/documents/${metadata.doc_id}/${draft ? 'draft-assets' : 'published-assets'}/${name}`
      }
    })
    return {
      metadata,
      body: parsed.body,
      revision: checksum(raw + JSON.stringify(graphs)),
      relative_path: relative,
      url: canonicalUrl(relative),
      graphs,
      assets,
      ...(!draft ? { published_revision: publishedRevision || (await this.activeState()).revision || 'initial' } : {})
    }
  }
  async listPublished(
    snapshot?: { release?: string; revision?: string },
    includeLegacy = false
  ): Promise<DocumentRecord[]> {
    const state = snapshot || (await this.activeState())
    if (!state.release)
      return (await this.scanPublished(state)).filter((doc) => includeLegacy || isActiveType(doc.metadata.type))
    const key = `${state.release}:${state.revision}`
    if (this.publishedCache?.key !== key) {
      const records = this.scanPublished(state).catch((error) => {
        this.publishedCache = undefined
        throw error
      })
      this.publishedCache = {
        key,
        records,
        byId: records.then(
          (items) => new Map(items.map((d) => [d.metadata.doc_id, d])),
          () => new Map<string, DocumentRecord>()
        )
      }
    }
    // Callers may edit returned metadata. Never expose the immutable cache by reference.
    return structuredClone(
      (await this.publishedCache.records).filter((doc) => includeLegacy || isActiveType(doc.metadata.type))
    )
  }
  private async scanPublished(state: { release?: string; revision?: string }) {
    const root = await this.activeRoot(state)
    const records: DocumentRecord[] = []
    for (const file of await walk(root)) {
      if (!file.endsWith('.md')) continue
      const raw = await fs.readFile(file, 'utf8')
      if (!raw.startsWith('---') || !parseMarkdown(raw).metadata.doc_id) continue
      const record = await this.readFile(
        file,
        path.relative(root, file).split(path.sep).join('/'),
        false,
        state.revision || 'initial'
      )
      if (record.metadata.status === 'published' && record.metadata.classification === 'internal') records.push(record)
    }
    return records
  }
  async published(id: string, snapshot?: { release?: string; revision?: string }, includeLegacy = false) {
    idSchema.parse(id)
    const state = snapshot || (await this.activeState())
    const key = `${state.release}:${state.revision}`
    if (!state.release || this.publishedCache?.key !== key) await this.listPublished(state, true)
    const record =
      state.release && this.publishedCache?.key === key
        ? (await this.publishedCache.byId).get(id)
        : (await this.listPublished(state, true)).find((d) => d.metadata.doc_id === id)
    if (!record) throw new AppError(404, 'Tài liệu chưa được xuất bản hoặc không nằm trong phạm vi truy cập.')
    if (!includeLegacy) this.assertActive(record.metadata)
    return structuredClone(record)
  }
  async publishedKey(
    key: string,
    project?: string,
    includeLegacy = false,
    snapshot?: { release?: string; revision?: string }
  ) {
    idSchema.parse(key)
    const found = (await this.listPublished(snapshot, true)).filter(
      (doc) =>
        (!project || doc.metadata.project_id === project) &&
        (doc.metadata.doc_id === key || doc.metadata.function_code === key)
    )
    if (found.length > 1) throw new AppError(409, 'Mã trùng ở nhiều project. Chọn project để mở đúng tài liệu.')
    if (!found.length) throw new AppError(404, 'Tài liệu chưa được xuất bản hoặc không nằm trong phạm vi truy cập.')
    if (!includeLegacy) this.assertActive(found[0].metadata)
    return found[0]
  }
  assertActive(meta: Pick<Metadata, 'type'>) {
    if (!isActiveType(meta.type))
      throw new AppError(
        410,
        'Loại tài liệu đã ngừng sử dụng. Nội dung cũ vẫn được giữ tại kho lưu trữ legacy để đọc và export.'
      )
  }
  // Parsing every draft (Markdown, zod, graphs, checksum) dominates list/quality/reference requests.
  // Entries are keyed by the stat signature of index.md, diagrams/ and assets/, so any write
  // (including by another path or tool) invalidates them without explicit bookkeeping.
  private readonly draftCache = new Map<string, { signature: string; doc: DocumentRecord; editor?: string }>()
  private async draftSignature(folder: string) {
    const stat = async (file: string) => {
      const info = await fs.stat(file).catch(() => null)
      return info ? `${info.mtimeMs}:${info.size}:${info.ino}` : '-'
    }
    const list = async (dir: string) => {
      const names = (await fs.readdir(dir).catch(() => [] as string[])).sort()
      return (await Promise.all(names.map(async (name) => `${name}:${await stat(path.join(dir, name))}`))).join(',')
    }
    return [
      await stat(path.join(folder, 'index.md')),
      await stat(path.join(folder, 'draft-meta.json')),
      await list(path.join(folder, 'diagrams')),
      await list(path.join(folder, 'assets'))
    ].join('|')
  }
  private async readDraftFile(id: string, file: string) {
    const signature = await this.draftSignature(path.dirname(file))
    const cached = this.draftCache.get(id)
    if (cached?.signature === signature) return { doc: structuredClone(cached.doc), editor: cached.editor }
    const doc = await this.readFile(file, `drafts/${id}/index.md`, true)
    const editor = await fs
      .readFile(path.join(path.dirname(file), 'draft-meta.json'), 'utf8')
      .then((raw) => (JSON.parse(raw) as { editor?: unknown }).editor)
      .catch(() => undefined)
    const entry = { signature, doc: structuredClone(doc), editor: typeof editor === 'string' ? editor : undefined }
    this.draftCache.set(id, entry)
    return { doc, editor: entry.editor }
  }
  async draft(id: string, includeLegacy = false): Promise<DraftRecord> {
    idSchema.parse(id)
    const file = await safePath(this.root, 'drafts', id, 'index.md')
    const { doc, editor } = await this.readDraftFile(id, file)
    if (!includeLegacy) this.assertActive(doc.metadata)
    const reviewFile = await safePath(this.root, '.knowledge-state/reviews', `${id}.json`)
    const stored: ReviewState | null = (await exists(reviewFile))
      ? JSON.parse(await fs.readFile(reviewFile, 'utf8'))
      : null
    return {
      ...doc,
      editor,
      review: stored?.revision === doc.revision ? stored : { status: 'draft', revision: doc.revision },
      checklist: documentChecklist(doc)
    }
  }
  async listDrafts(includeLegacy = false) {
    const dir = await safePath(this.root, 'drafts')
    const result: DraftRecord[] = []
    for (const entry of await fs.readdir(dir))
      if (idSchema.safeParse(entry).success && (await exists(path.join(dir, entry, 'index.md')))) {
        const doc = await this.draft(entry, true)
        if (includeLegacy || isActiveType(doc.metadata.type)) result.push(doc)
      }
    return result
  }
  async create(input: unknown, body: string | undefined, user: string, codeRequest?: { group: string; kind: string }) {
    const meta = metadataSchema.parse(input)
    this.assertActive(meta)
    delete meta.verification
    await this.workspace.validateLocation(meta.project_id, meta.module)
    return this.lock(meta.doc_id, async () => {
      if (
        (await this.listPublished(undefined, true)).some((d) => d.metadata.doc_id === meta.doc_id) ||
        (await exists(await safePath(this.root, 'drafts', meta.doc_id, 'index.md')))
      )
        throw new AppError(409, 'ID đã tồn tại. Chọn sửa bản nháp hiện tại hoặc dùng ID mới.')
      if (
        [...(await this.listPublished(undefined, true)), ...(await this.listDrafts(true))].some(
          (doc) => doc.metadata.function_code === meta.doc_id && doc.metadata.doc_id !== meta.doc_id
        )
      )
        throw new AppError(
          409,
          'Document ID trùng Function ID của tài liệu khác. Chọn key khác để giữ deep link ổn định.'
        )
      return this.writeDraft(
        { ...meta, status: 'draft', updated_at: new Date().toISOString() },
        body || template(meta),
        user,
        codeRequest
      )
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
      return this.writeDraft(
        { ...published.metadata, status: 'draft', updated_at: new Date().toISOString() },
        published.body,
        user
      )
    })
  }
  async save(
    id: string,
    input: unknown,
    body: string,
    revision: string,
    user: string,
    codeRequest?: { group: string; kind: string }
  ) {
    return this.lock(id, async () => {
      const current = await this.draft(id)
      if (!revision || current.revision !== revision)
        throw new AppError(409, 'Bản nháp đã thay đổi. Tải lại để đối chiếu trước khi lưu.', {
          current_revision: current.revision
        })
      const meta = metadataSchema.parse(input)
      delete meta.verification
      if (
        meta.doc_id !== id ||
        meta.project_id !== current.metadata.project_id ||
        meta.type !== current.metadata.type ||
        meta.module !== current.metadata.module
      )
        throw new AppError(
          400,
          'ID, project, loại và module không được đổi sau khi tạo. Chuyển thư mục chưa được hỗ trợ.'
        )
      return this.writeDraft(
        { ...meta, status: 'draft', updated_at: new Date().toISOString() },
        body,
        user,
        codeRequest
      )
    })
  }
  async writeDraft(meta: Metadata, body: string, user: string, codeRequest?: { group: string; kind: string }) {
    return this.functionCodeQueue.run(async () => {
      this.assertActive(meta)
      // Canonical writes use relations only. related_ids is a read adapter for old files.
      meta = { ...meta, relations: documentRelations(meta), related_ids: [], schema_version: CURRENT_SCHEMA_VERSION }
      validateBody(body)
      meta = await assignFunctionCode(this.functionCodeContext, meta, codeRequest)
      const file = await safePath(this.root, 'drafts', meta.doc_id, 'index.md')
      const raw = serialize(meta, body)
      await atomicWrite(file, raw)
      await atomicWrite(
        await safePath(this.root, 'drafts', meta.doc_id, 'draft-meta.json'),
        JSON.stringify(
          {
            editor: user,
            updated_at: meta.updated_at,
            revision: checksum(raw),
            base_published_commit: (await this.activeState()).revision || null
          },
          null,
          2
        )
      )
      await this.audit(user, 'save-draft', meta.doc_id)
      return this.draft(meta.doc_id)
    })
  }
  async createAutomatic(
    input: Omit<Metadata, 'doc_id'>,
    body: string | undefined,
    user: string,
    codeRequest?: { group: string; kind: string }
  ) {
    return this.allocationQueue.run(async () => {
      const stem = `${documentTypes[input.type].idPrefix}-${input.project_id.toUpperCase().replace(/-/g, '').slice(0, 14)}-${input.module.toUpperCase().replace(/-/g, '').slice(0, 14)}`
      const used = new Set(
        [...(await this.listPublished()), ...(await this.listDrafts())].map((d) => d.metadata.doc_id)
      )
      let number = 1
      while (used.has(`${stem}-${String(number).padStart(3, '0')}`)) number++
      return this.create({ ...input, doc_id: `${stem}-${String(number).padStart(3, '0')}` }, body, user, codeRequest)
    })
  }
  async review(
    id: string,
    revision: string,
    action: 'submit' | 'approve' | 'request_changes',
    user: string,
    reason = ''
  ) {
    return this.lock(id, async () => {
      const doc = await this.draft(id)
      if (doc.revision !== revision) throw new AppError(409, 'Bản nháp đã thay đổi. Tải lại trước khi duyệt.')
      const review: ReviewState =
        action === 'submit'
          ? { status: 'in_review', revision, submitted_by: user, submitted_at: new Date().toISOString() }
          : {
              ...doc.review,
              status: action === 'approve' ? 'approved' : 'changes_requested',
              reviewer: user,
              reviewed_at: new Date().toISOString(),
              reason
            }
      if (action !== 'submit' && doc.review.status !== 'in_review')
        throw new AppError(409, 'Tài liệu chưa được gửi duyệt hoặc đã thay đổi sau khi gửi.')
      if (action !== 'submit' && doc.review.submitted_by === user)
        throw new AppError(403, 'Người gửi duyệt cần một người khác đánh giá nội dung.')
      if (action === 'request_changes' && !reason.trim()) throw new AppError(400, 'Nhập nội dung cần chỉnh sửa.')
      if (action === 'approve' || action === 'submit') {
        const missing = doc.checklist.filter((item) => !item.passed)
        if (missing.length) throw new AppError(400, 'Hoàn thiện checklist trước khi gửi/duyệt.', missing)
      }
      await atomicWrite(
        await safePath(this.root, '.knowledge-state/reviews', `${id}.json`),
        JSON.stringify(review, null, 2)
      )
      await this.audit(user, `review-${action}`, id)
      return this.draft(id)
    })
  }
  async audit(user: string, action: string, id: string) {
    await fs.appendFile(
      await safePath(this.root, '.knowledge-state/audit.jsonl'),
      JSON.stringify({ user, action, doc_id: id, at: new Date().toISOString() }) + '\n',
      { mode: 0o600 }
    )
  }
}
