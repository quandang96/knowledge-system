import type { DocumentRecord, Metadata } from '../../../../packages/schemas/src/index'
import { functionCodeRequestSchema } from '../../../../packages/schemas/src/index'
import { AppError, atomicWrite, exists, safePath } from './filesystem'
import type { WorkspaceStore } from './workspace'
import { promises as fs } from 'node:fs'

// Function ID reservations: stable business aliases (AAAA-BBB-NNN) that never change once issued and
// never shadow another document's ID. Callers must serialize calls (DocumentStore does).
export interface FunctionCodeContext {
  root: string
  workspace: WorkspaceStore
  /** Published and draft records of every type, including legacy. */
  allDocuments(): Promise<DocumentRecord[]>
  published(id: string): Promise<DocumentRecord>
}
export async function assignFunctionCode(
  ctx: FunctionCodeContext,
  meta: Metadata,
  request?: { group: string; kind: string }
): Promise<Metadata> {
  if (meta.type !== 'function' && (meta.function_code || request))
    throw new AppError(400, 'Function ID chỉ dành cho tài liệu Chức năng.')
  const file = await safePath(ctx.root, '.knowledge-state/function-codes.json')
  const reservations: Record<string, Record<string, string>> = (await exists(file))
    ? JSON.parse(await fs.readFile(file, 'utf8'))
    : {}
  // Canonical IDs and aliases share the resolver. A new document must not
  // shadow an existing (even unpublished) alias, including concurrent creates.
  if (Object.values(reservations).some((codes) => codes[meta.doc_id] && codes[meta.doc_id] !== meta.doc_id))
    throw new AppError(409, 'Document ID trùng Function ID đã cấp cho tài liệu khác.')
  if (meta.type !== 'function') return meta
  const codes = Object.hasOwn(reservations, meta.project_id)
    ? reservations[meta.project_id]
    : (reservations[meta.project_id] = {})
  // Include both versions: a draft must not release an alias still in Published.
  const docs = await ctx.allDocuments()
  for (const doc of docs.filter((doc) => doc.metadata.project_id === meta.project_id && doc.metadata.function_code)) {
    const code = doc.metadata.function_code!
    if (codes[code] && codes[code] !== doc.metadata.doc_id) throw new AppError(409, `Function ID đã bị trùng: ${code}`)
    codes[code] = doc.metadata.doc_id
  }
  const assigned = Object.entries(codes).find(([, id]) => id === meta.doc_id)?.[0]
  if (assigned && meta.function_code && assigned !== meta.function_code)
    throw new AppError(409, 'Function ID đã cấp là mã ổn định, không được đổi.')
  if (assigned) meta.function_code = assigned // Keep the identity during restore of older revisions.
  if (request && (assigned || meta.function_code))
    throw new AppError(400, 'Tài liệu đã có Function ID; không cấp lại mã.')
  if (!assigned && (meta.function_code || request)) {
    const rules = (await ctx.workspace.read()).projects.find(
      (project) => project.id === meta.project_id
    )?.function_id_rules
    if (!rules?.enabled)
      throw new AppError(
        400,
        'Admin cần xác nhận tài liệu quy ước và bật bảng mã cho project trước khi cấp Function ID.'
      )
    const convention = await ctx.published(rules.convention_id)
    if (convention.metadata.type !== 'reference' || convention.revision !== rules.convention_revision)
      throw new AppError(409, 'Quy ước Published đã thay đổi. Admin cần xác nhận lại bảng mã đúng revision.')
    const selected = request
      ? functionCodeRequestSchema.parse(request)
      : { group: meta.function_code!.split('-')[0], kind: meta.function_code!.split('-')[1] }
    if (
      !rules.groups.some((item) => item.code === selected.group) ||
      !rules.kinds.some((item) => item.code === selected.kind)
    )
      throw new AppError(400, 'Mã nhóm/loại chưa nằm trong bảng mã được duyệt của project.')
    if (request) {
      const stem = `${selected.group}-${selected.kind}-`
      let number = 1
      while (
        codes[`${stem}${String(number).padStart(3, '0')}`] ||
        docs.some(
          (doc) =>
            doc.metadata.doc_id === `${stem}${String(number).padStart(3, '0')}` && doc.metadata.doc_id !== meta.doc_id
        )
      )
        number++
      if (number > 999) throw new AppError(409, 'Nhóm Function ID đã hết sequence 001–999.')
      meta.function_code = `${stem}${String(number).padStart(3, '0')}`
    }
    if (codes[meta.function_code!] && codes[meta.function_code!] !== meta.doc_id)
      throw new AppError(409, 'Function ID đã tồn tại trong project.')
    if (docs.some((doc) => doc.metadata.doc_id === meta.function_code && doc.metadata.doc_id !== meta.doc_id))
      throw new AppError(409, 'Function ID trùng Document ID đã tồn tại. Chọn mã khác để giữ deep link ổn định.')
    codes[meta.function_code!] = meta.doc_id
  }
  if (meta.function_code) await atomicWrite(file, JSON.stringify(reservations, null, 2))
  return meta
}
