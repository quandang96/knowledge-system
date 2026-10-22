import type { Metadata } from '../../schemas/src/index'

type RelationKind = NonNullable<Metadata['relations']>[number]['kind']

// Typed relations that drive other screens, offered only where they make sense. Generic "related"
// links are written with @ in the content instead; traceability picks those up automatically.
export interface RelationField {
  kind: RelationKind
  targetType: Metadata['type']
  title: string
  help: string
  addLabel: string
  empty: string
  pickerTitle: string
}

const fields: Partial<Record<Metadata['type'], RelationField[]>> = {
  screen: [
    {
      kind: 'implements',
      targetType: 'function',
      title: 'Chức năng trên màn hình',
      help: 'Function thực hiện trên màn hình này; hiện trong bảng chức năng của trang Screen.',
      addLabel: 'Liên kết chức năng',
      empty: 'Chưa liên kết Function.',
      pickerTitle: 'Chọn chức năng trên màn hình'
    },
    {
      kind: 'navigates_to',
      targetType: 'screen',
      title: 'Điều hướng đến màn hình',
      help: 'Màn hình người dùng có thể chuyển tới từ màn hình này.',
      addLabel: 'Thêm màn hình đích',
      empty: 'Chưa có màn hình đích.',
      pickerTitle: 'Chọn màn hình đích'
    }
  ],
  function: [
    {
      kind: 'governed_by',
      targetType: 'business-rule',
      title: 'Quy tắc áp dụng',
      help: 'Business Rule chi phối chức năng này; hiện ở cột Rule trong bảng chức năng của Screen.',
      addLabel: 'Thêm quy tắc',
      empty: 'Chưa gắn quy tắc nghiệp vụ.',
      pickerTitle: 'Chọn quy tắc nghiệp vụ'
    }
  ]
}

export function relationFields(type: Metadata['type'] | undefined) {
  return (type && fields[type]) || []
}
