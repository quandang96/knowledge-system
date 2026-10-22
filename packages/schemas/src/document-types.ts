// Single source of truth for document types. To add a type: append it to `storedTypes`
// (and `types` if users may create it), then add one entry to `documentTypes`; the compiler
// rejects a missing entry. Folder, label, icon, ID prefix and template sections derive from here.
export const types = [
  'overview',
  'business-flow',
  'module',
  'screen',
  'function',
  'role',
  'permission',
  'business-rule',
  'reference'
] as const
// Legacy records remain parseable/exportable, but are never offered for new content.
export const storedTypes = [...types, 'test-scenario'] as const
export type StoredType = (typeof storedTypes)[number]
export interface DocumentTypeDefinition {
  folder: string
  label: string
  icon: string
  // Semantic colour group used by the UI theme.
  group: 'utility' | 'screen' | 'function' | 'rule'
  // Prefix of automatically generated document IDs.
  idPrefix: string
  // Headings of the starter body; the generic outline is used when omitted.
  sections?: string[]
}
export const defaultSections = ['Tổng quan', 'Nội dung', 'Tài liệu liên quan']
export const documentTypes: Record<StoredType, DocumentTypeDefinition> = {
  overview: {
    folder: 'overview',
    label: 'Giới thiệu',
    icon: 'mdi-book-open-page-variant-outline',
    group: 'utility',
    idPrefix: 'OV'
  },
  'business-flow': {
    folder: 'business-flows',
    label: 'Quy trình nghiệp vụ',
    icon: 'mdi-transit-connection-variant',
    group: 'utility',
    idPrefix: 'BF',
    sections: ['Mục tiêu nghiệp vụ', 'Tác nhân', 'Trigger và điều kiện', 'Các bước xử lý', 'Kết quả', 'Ngoại lệ']
  },
  module: { folder: 'modules', label: 'Phân hệ', icon: 'mdi-view-grid-outline', group: 'utility', idPrefix: 'MOD' },
  screen: {
    folder: 'screens',
    label: 'Màn hình',
    icon: 'mdi-monitor',
    group: 'screen',
    idPrefix: 'SCR',
    sections: [
      'Mục đích',
      'Cách truy cập',
      'Thành phần giao diện',
      'Chức năng',
      'Vai trò và quyền',
      'Quy tắc nghiệp vụ',
      'Trạng thái màn hình',
      'Ngoại lệ'
    ]
  },
  function: {
    folder: 'functions',
    label: 'Chức năng',
    icon: 'mdi-lightning-bolt-outline',
    group: 'function',
    idPrefix: 'FUNC',
    sections: ['Mục đích', 'Trigger', 'Input và output', 'Validation', 'Kết quả và lỗi', 'Quyền và quy tắc']
  },
  role: {
    folder: 'roles',
    label: 'Vai trò nghiệp vụ',
    icon: 'mdi-account-group-outline',
    group: 'utility',
    idPrefix: 'ROLE',
    sections: ['Trách nhiệm', 'Vai trò cha', 'Chính sách kế thừa', 'Phạm vi dữ liệu', 'Quyền', 'Ngoại lệ']
  },
  permission: {
    folder: 'permissions',
    label: 'Ma trận quyền',
    icon: 'mdi-shield-key-outline',
    group: 'utility',
    idPrefix: 'PERM',
    sections: ['Ma trận quyền', 'Điều kiện', 'Phạm vi dữ liệu', 'Quy tắc nguồn']
  },
  'business-rule': {
    folder: 'business-rules',
    label: 'Quy tắc nghiệp vụ',
    icon: 'mdi-scale-balance',
    group: 'rule',
    idPrefix: 'BR',
    sections: ['Nội dung quy tắc', 'Lý do', 'Điều kiện', 'Ngoại lệ', 'Mức ưu tiên', 'Ví dụ', 'Ngày hiệu lực']
  },
  'test-scenario': {
    folder: 'test-scenarios',
    label: 'Kịch bản kiểm thử',
    icon: 'mdi-checkbox-marked-circle-outline',
    group: 'utility',
    idPrefix: 'TC'
  },
  reference: {
    folder: 'references',
    label: 'Tài liệu tham khảo',
    icon: 'mdi-link-variant',
    group: 'utility',
    idPrefix: 'REF'
  }
}
export function isActiveType(type: string): type is (typeof types)[number] {
  return (types as readonly string[]).includes(type)
}
const pick = <T>(project: (definition: DocumentTypeDefinition) => T) =>
  Object.fromEntries(Object.entries(documentTypes).map(([type, definition]) => [type, project(definition)])) as Record<
    string,
    T
  >
export const typeLabels: Record<string, string> = pick((definition) => definition.label)
export const typeIcons: Record<string, string> = pick((definition) => definition.icon)
export const typeFolders: Record<StoredType, string> = pick((definition) => definition.folder) as Record<
  StoredType,
  string
>
export const typeIconGroups: Record<string, string> = pick((definition) => definition.group)
