import type { DocumentRecord, Metadata } from './index'
import { inlineDocumentIds } from './document-links'

export function documentRelations(metadata: Metadata) {
  const typed = metadata.relations || []
  return [
    ...typed,
    ...metadata.related_ids
      .filter((id) => !typed.some((r) => r.target_id === id))
      .map((target_id) => ({ target_id, kind: 'related' as const }))
  ].filter(
    (edge, index, all) =>
      all.findIndex((item) => item.target_id === edge.target_id && item.kind === edge.kind) === index
  )
}

export function relationError(source: Metadata, target: Metadata, kind: string): string | null {
  if (source.doc_id === target.doc_id) return 'Không thể liên kết tài liệu với chính nó.'
  if (source.project_id !== target.project_id)
    return 'Liên kết tài liệu phải thuộc cùng project. Chưa có chính sách liên kết khác project.'
  if (source.type === 'test-scenario' || target.type === 'test-scenario' || kind === 'verifies')
    return 'Tích hợp kiểm thử đã ngừng sử dụng. Chọn tài liệu nghiệp vụ đang hoạt động.'
  if (kind === 'governed_by' && target.type !== 'business-rule')
    return 'Đích của quan hệ Tuân theo phải là quy tắc nghiệp vụ.'
  if (kind === 'navigates_to' && (source.type !== 'screen' || target.type !== 'screen'))
    return 'Điều hướng chỉ liên kết hai màn hình.'
  if (
    kind === 'implements' &&
    (!['screen', 'function'].includes(source.type) || !['function', 'business-flow'].includes(target.type))
  )
    return 'Thực hiện liên kết màn hình/chức năng đến chức năng/quy trình.'
  return null
}

export function traceability(docs: DocumentRecord[]) {
  const active = docs.filter((doc) => doc.metadata.type !== 'test-scenario')
  const legacyIds = new Set(
    docs.filter((doc) => doc.metadata.type === 'test-scenario').map((doc) => doc.metadata.doc_id)
  )
  const edges = active.flatMap((doc) => [
    ...documentRelations(doc.metadata)
      .filter((edge) => edge.kind !== 'verifies' && !legacyIds.has(edge.target_id))
      .map((r) => ({ source_id: doc.metadata.doc_id, ...r, origin: 'metadata' })),
    ...inlineDocumentIds(doc.body)
      .filter((id) => id !== doc.metadata.doc_id && !legacyIds.has(id))
      .map((target_id) => ({ source_id: doc.metadata.doc_id, target_id, kind: 'inline', origin: 'content' }))
  ])
  for (const doc of active)
    for (const graph of doc.graphs)
      for (const node of graph.nodes) {
        const source = node.function_id || node.screen_id || doc.metadata.doc_id
        for (const target_id of [node.role_id, node.screen_id, node.function_id].filter(
          (id): id is string => !!id && id !== doc.metadata.doc_id
        ))
          edges.push({ source_id: doc.metadata.doc_id, target_id, kind: 'related', origin: graph.diagram_id })
        for (const target_id of node.rule_ids)
          edges.push({ source_id: source, target_id, kind: 'governed_by', origin: graph.diagram_id })
        if (node.screen_id && node.function_id)
          edges.push({
            source_id: node.screen_id,
            target_id: node.function_id,
            kind: 'implements',
            origin: graph.diagram_id
          })
      }
  return edges.filter(
    (edge, i) =>
      !legacyIds.has(edge.target_id) &&
      edges.findIndex(
        (e) => e.source_id === edge.source_id && e.target_id === edge.target_id && e.kind === edge.kind
      ) === i
  )
}
