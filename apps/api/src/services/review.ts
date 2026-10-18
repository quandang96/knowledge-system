import type { ChecklistItem, DocumentRecord } from '../../../../packages/schemas/src/index'

export function documentChecklist(doc: DocumentRecord): ChecklistItem[] {
  return [
    { key: 'summary', label: 'Có mô tả ngắn để người đọc hiểu phạm vi', passed: doc.metadata.summary.trim().length > 0 },
    { key: 'owner', label: 'Có người chịu trách nhiệm nội dung', passed: doc.metadata.owner.trim().length > 0 },
    { key: 'structure', label: 'Có ít nhất một mục nội dung', passed: /^##\s+\S/m.test(doc.body) },
    { key: 'placeholder', label: 'Đã thay nội dung mẫu bằng nghiệp vụ đã xác nhận', passed: !/Điền nội dung đã được xác nhận tại đây|Tác nhân: cần điền|\bTODO\b|\bTBD\b/i.test(doc.body + doc.graphs.map(g => g.summary).join('\n')) },
    { key: 'source', label: 'Có nguồn tham chiếu hoặc mục giải thích nguồn quyết định', passed: doc.metadata.source_links.length > 0 || /^##\s+.*(?:nguồn|source|quyết định)/im.test(doc.body) },
    { key: 'classification', label: 'Phân loại nội bộ, có thể phát hành vào kho chung', passed: doc.metadata.classification === 'internal' }
  ]
}
