import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { metadataSchema, graphSchema, type Metadata } from '../packages/schemas/src/index'
import { documentPath } from '../apps/api/src/services/document-store'
import { atomicWrite, exists } from '../apps/api/src/services/filesystem'
import { serialize } from '../apps/api/src/services/markdown'

const root = path.resolve('knowledge/published')
const all: { id: string; type: Metadata['type']; title: string; summary: string; related: string[]; body: string }[] = [
  { id: 'OV-DEMO-001', type: 'overview', title: 'Bắt đầu với Demo Workflow System', summary: 'Bản đồ tri thức cho đội ngũ BA, Developer và Tester. Toàn bộ nội dung là ví dụ minh họa.', related: ['MOD-APP-001','BF-APP-001','SCR-APP-001'], body: `# Bắt đầu với Demo Workflow System

> Tất cả quy trình, quyền và dữ liệu trong project này đều là ví dụ minh họa, không phải business đã được xác nhận của công ty.

## Một nơi để hiểu đúng nghiệp vụ

Atlas kết nối quy trình, màn hình, chức năng, quyền và kiểm thử qua ID ổn định. Bắt đầu từ mục tiêu nghiệp vụ, sau đó theo các tài liệu liên quan để hiểu hành vi của hệ thống.

## Lộ trình đọc

1. Đọc [Quy trình phê duyệt](/business-flows/approval/BF-APP-001/).
2. Khám phá [Màn hình chi tiết yêu cầu](/screens/approval/SCR-APP-001/).
3. Đối chiếu [Quy tắc BR-014](/business-rules/approval/BR-014/) và [Kịch bản kiểm thử](/test-scenarios/approval/TC-APP-001/).

## Quy trình biên tập

Tạo tài liệu trong Document Studio, lưu bản nháp rồi xuất bản. Người đọc luôn xem bản Published. Markdown, ảnh và diagram JSON lưu trên filesystem.

## Thuật ngữ

| Thuật ngữ | Ý nghĩa minh họa |
| --- | --- |
| Request | Yêu cầu chờ xử lý |
| Approver | Người kiểm tra và ra quyết định |
| Data scope | Phạm vi dữ liệu được phép xem hoặc thao tác |` },
  { id: 'MOD-APP-001', type: 'module', title: 'Module phê duyệt', summary: 'Phạm vi, thành phần và các điểm kết nối của module Approval.', related: ['BF-APP-001','SCR-APP-001','FUNC-APP-003'], body: `# Module phê duyệt

## Phạm vi

Module minh họa việc tiếp nhận, xem xét và phê duyệt yêu cầu của một phòng ban. Không mô tả cơ chế tích hợp với hệ thống thật.

## Thành phần

| Thành phần | Tài liệu |
| --- | --- |
| Quy trình | [BF-APP-001](/business-flows/approval/BF-APP-001/) |
| Màn hình | [SCR-APP-001](/screens/approval/SCR-APP-001/) |
| Chức năng | [FUNC-APP-003](/functions/approval/FUNC-APP-003/) |

## Trạng thái

Pending → Approved hoặc Rejected. Yêu cầu đã có quyết định không được xử lý lại.` },
  { id: 'BF-APP-001', type: 'business-flow', title: 'Quy trình phê duyệt yêu cầu', summary: 'Từ yêu cầu mới đến quyết định phê duyệt, với điều kiện và ngoại lệ rõ ràng.', related: ['SCR-APP-001','ROLE-MANAGER','BR-014','TC-APP-001'], body: `# Quy trình phê duyệt yêu cầu

## Mục tiêu nghiệp vụ

Đảm bảo yêu cầu được người có thẩm quyền xem xét trong phạm vi dữ liệu được phép. Đây là quy trình demo.

## Tác nhân và trigger

Người quản lý phòng ban nhận một yêu cầu ở trạng thái Pending. Yêu cầu cần có đủ thông tin và được gán đúng phòng ban.

## Các bước xử lý

\`\`\`mermaid
flowchart LR
  A[Nhận yêu cầu] --> B{Kiểm tra phạm vi}
  B -->|Hợp lệ| C[Phê duyệt]
  B -->|Không hợp lệ| D[Từ chối]
\`\`\`

## Tóm tắt luồng

Tác nhân: ROLE-MANAGER. Trigger: yêu cầu chờ xử lý. Người quản lý mở SCR-APP-001 và kiểm tra BR-014. Nếu đúng phạm vi và đủ thông tin, thực hiện FUNC-APP-003 để chuyển sang Approved. Nếu không đủ điều kiện, từ chối và ghi lý do. Kết quả: một quyết định có thể truy vết.

## Ngoại lệ

- Yêu cầu đã được xử lý ở tab khác: tải lại trạng thái mới.
- Ngoài phạm vi phòng ban: không cho phép phê duyệt.` },
  { id: 'SCR-APP-001', type: 'screen', title: 'Chi tiết yêu cầu phê duyệt', summary: 'Thông tin yêu cầu, trạng thái, lịch sử và các thao tác của người phê duyệt.', related: ['BF-APP-001','FUNC-APP-003','ROLE-MANAGER','PERM-APP-001','BR-014','TC-APP-001'], body: `# Chi tiết yêu cầu phê duyệt

## Mục đích

Giúp người quản lý kiểm tra thông tin và quyết định xử lý yêu cầu. Mọi dữ liệu và tên người trong hình đều là minh họa.

## Cách truy cập

Home → Requests → Request Detail. Chọn một yêu cầu trong danh sách. URL minh họa: \`/requests/:id\`.

## Hình ảnh màn hình

![Màn hình chi tiết yêu cầu minh họa](./assets/main-screen-demo.png)

## Thành phần giao diện

| Thành phần | Mô tả | Validation | Function ID |
| --- | --- | --- | --- |
| Thông tin yêu cầu | Người tạo, phòng ban, ngày gửi | Chỉ đọc | — |
| Approve | Phê duyệt yêu cầu | Pending và đúng phạm vi | FUNC-APP-003 |
| Reject | Từ chối kèm lý do | Bắt buộc nhập lý do | — |

## Vai trò và quyền

ROLE-MANAGER được xem yêu cầu trong phòng ban được gán. Quyền phê duyệt phụ thuộc BR-014 và trạng thái Pending; quyền xem không tự động bao gồm quyền chỉnh sửa.

## Trạng thái màn hình

- Loading: đang tải thông tin.
- Empty: không có yêu cầu.
- Error: không đủ quyền hoặc tài liệu không còn tồn tại.
- Success: hiển thị quyết định mới nhất.

## Ngoại lệ

API phải kiểm tra quyền lại khi thực hiện thao tác, kể cả khi nút đang hiển thị. Xung đột trạng thái trả lỗi để người dùng tải lại.

## Kiểm thử liên quan

Đọc [TC-APP-001](/test-scenarios/approval/TC-APP-001/) để kiểm tra case positive, negative và boundary.` },
  { id: 'FUNC-APP-003', type: 'function', title: 'Phê duyệt yêu cầu', summary: 'Trigger, input/output, validation và xử lý lỗi cho thao tác Approve.', related: ['SCR-APP-001','ROLE-MANAGER','BR-014','TC-APP-001'], body: `# Phê duyệt yêu cầu

## Mục đích và trigger

Người quản lý chọn Approve trên màn hình SCR-APP-001 khi yêu cầu đang Pending. Đây là hành vi minh họa.

## Input và output

| Input | Output |
| --- | --- |
| Request ID, expected revision, ghi chú tùy chọn | Trạng thái Approved, người quyết định, thời điểm |

## Validation

1. Người dùng có quyền phê duyệt.
2. Yêu cầu thuộc phạm vi phòng ban được gán.
3. Trạng thái vẫn là Pending tại thời điểm xử lý.

## Kết quả và lỗi

Thành công: cập nhật trạng thái và lịch sử. Ngoài phạm vi: từ chối thao tác. Revision đã đổi: trả conflict để tải lại.

## Quy tắc nguồn

[BR-014 — Phạm vi phê duyệt](/business-rules/approval/BR-014/).` },
  { id: 'ROLE-MANAGER', type: 'role', title: 'Quản lý phòng ban', summary: 'Trách nhiệm, phạm vi dữ liệu và nguyên tắc kế thừa quyền của vai trò Manager.', related: ['PERM-APP-001','BR-014','FUNC-APP-003'], body: `# Quản lý phòng ban

## Trách nhiệm

Trong demo, người quản lý xem xét yêu cầu của phòng ban được gán và đưa ra quyết định.

## Vai trò cha và kế thừa

Không giả định kế thừa tự động từ vai trò nào khác. Sơ đồ thể hiện quan hệ trách nhiệm minh họa; quyền phải được cấp rõ ràng qua permission matrix.

## Phạm vi dữ liệu

Chỉ yêu cầu của phòng ban đang được gán. Không xem hoặc phê duyệt dữ liệu phòng ban khác.

## Quyền

Xem yêu cầu và phê duyệt khi trạng thái Pending và đủ điều kiện BR-014. Không có quyền sửa nội dung yêu cầu.

## Ngoại lệ

Knowledge Hub Reader/Editor/Publisher/Admin là quyền truy cập portal và hoàn toàn độc lập với business role này.` },
  { id: 'PERM-APP-001', type: 'permission', title: 'Ma trận quyền phê duyệt', summary: 'Vai trò × tài nguyên × thao tác, điều kiện và phạm vi dữ liệu được mô tả cụ thể.', related: ['ROLE-MANAGER','SCR-APP-001','FUNC-APP-003','BR-014'], body: `# Ma trận quyền phê duyệt

## Ma trận quyền

| Vai trò | Tài nguyên | View | Create | Edit | Delete | Approve | Phạm vi |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ROLE-MANAGER | SCR-APP-001 | Có | Không | Không | Không | Có điều kiện | Phòng ban được gán |

## Điều kiện

Approve chỉ khi Pending và thỏa BR-014. Tất cả kiểm tra thực hiện trên server của ứng dụng nghiệp vụ.

## Phiên bản và nguồn

Phiên bản minh họa 1.0.0. Đây là business permissions, không phải quyền biên tập Atlas.` },
  { id: 'BR-014', type: 'business-rule', title: 'Giới hạn phạm vi phê duyệt', summary: 'Quản lý chỉ phê duyệt yêu cầu trong phòng ban được gán, tại trạng thái Pending.', related: ['ROLE-MANAGER','FUNC-APP-003','TC-APP-001'], body: `# Giới hạn phạm vi phê duyệt

## Nội dung quy tắc

Trong demo, ROLE-MANAGER chỉ được phê duyệt yêu cầu trong phòng ban được gán và ở trạng thái Pending.

## Lý do và điều kiện

Giữ quyết định trong đúng phạm vi trách nhiệm. Kiểm tra department của request và tập department được gán cho người quản lý.

## Ngoại lệ và mức ưu tiên

Không có bypass trong demo. Nếu không đủ điều kiện thì từ chối, dù giao diện đang hiển thị nút Approve.

## Ví dụ

- Request thuộc phòng A, manager được gán phòng A, Pending → cho phép.
- Request thuộc phòng B, manager chỉ có phòng A → từ chối.
- Request đã Approved → từ chối xử lý lần nữa.

## Hiệu lực và nguồn

Tài liệu minh họa 1.0.0. Cần BA xác nhận lại trước khi dùng trong business thật.` },
  { id: 'TC-APP-001', type: 'test-scenario', title: 'Kiểm thử quyền phê duyệt', summary: 'Các trường hợp đúng quyền, ngoài phạm vi và xung đột trạng thái cho module Approval.', related: ['BR-014','FUNC-APP-003','SCR-APP-001'], body: `# Kiểm thử quyền phê duyệt

## Điều kiện tiên quyết

Dữ liệu demo có request Pending ở phòng A và phòng B. Tài khoản minh họa ROLE-MANAGER được gán phòng A.

## Các bước và kết quả

| Case | Bước kiểm thử | Kết quả mong đợi |
| --- | --- | --- |
| Positive | Mở request phòng A, chọn Approve | Chuyển Approved và ghi lịch sử |
| Negative | Gọi API approve request phòng B | Từ chối do ngoài scope |
| Boundary | Hai tab approve cùng request | Chỉ một quyết định thành công; tab cũ nhận conflict |
| Negative | Approve request đã Rejected | Từ chối do không Pending |

## Truy vết

Nguồn: BR-014, FUNC-APP-003 và SCR-APP-001. Các case này chỉ là dữ liệu business minh họa.` },
  { id: 'REF-DEMO-001', type: 'reference', title: 'Quy ước viết tài liệu', summary: 'ID ổn định, source links, ngôn ngữ và cách quản lý cập nhật tài liệu.', related: ['OV-DEMO-001'], body: `# Quy ước viết tài liệu

## Định danh

Mỗi đối tượng có ID bất biến. Đổi tiêu đề không đổi doc_id. ID và đường dẫn thư mục chỉ dùng ASCII.

## Nguồn và ngôn ngữ

Ghi rõ nguồn xác nhận trong source links. Dùng language vi, ja hoặc en. Atlas không tự tạo bản dịch được coi là đã duyệt.

## Cập nhật

Lưu Draft trước, kiểm tra ảnh và liên kết, rồi Publisher xuất bản. Git revision dùng để đối chiếu và khôi phục.` }
]
for (const doc of all) {
  const metadata = metadataSchema.parse({ doc_id: doc.id, project_id: 'demo-project', type: doc.type, module: 'approval', title: doc.title, language: 'vi', status: 'published', classification: 'internal', owner: 'BA Demo Team', version: '1.0.0', updated_at: '2026-10-11T09:00:00+07:00', related_ids: doc.related, tags: ['demo','approval'], summary: doc.summary, ...(doc.type === 'screen' ? { screen: { route: '/requests/:id', menu_path: ['Home','Requests','Request Detail'], screenshot: { cover: './assets/main-screen-demo.png', gallery: [{ path: './assets/main-screen-demo.png', alt: 'Màn hình chi tiết yêu cầu minh họa', caption: 'Overview · Giao diện giả định cho project demo', category: 'overview' }, { path: './assets/approve-modal-demo.webp', alt: 'Hộp thoại xác nhận phê duyệt minh họa', caption: 'Hộp thoại xác nhận · Không phải business thực', category: 'modal' }] } } } : {}) })
  const file = path.join(root, documentPath(metadata))
  if (!await exists(file)) await atomicWrite(file, serialize(metadata, doc.body))
}
const screenRoot = path.join(root, 'screens/approval/SCR-APP-001/assets')
await fs.mkdir(screenRoot, { recursive: true })
const screenshot = `<svg width="1120" height="670" xmlns="http://www.w3.org/2000/svg"><rect width="1120" height="670" fill="#f5f7fa"/><rect width="1120" height="66" fill="white"/><text x="32" y="42" font-size="24" font-weight="bold" fill="#2c4669" font-family="Arial">workflow</text><text x="835" y="41" font-size="14" fill="#66788e" font-family="Arial">DEMO  ·  Manager account</text><rect y="67" width="204" height="603" fill="#fff"/><text x="28" y="118" font-size="14" font-family="Arial" fill="#6b7a91">WORKSPACE</text><rect x="15" y="142" width="172" height="44" rx="8" fill="#eaf3ff"/><text x="31" y="170" font-family="Arial" font-size="15" fill="#3576c4">Requests</text><text x="31" y="220" font-family="Arial" font-size="15" fill="#63768d">Team members</text><text x="31" y="270" font-family="Arial" font-size="15" fill="#63768d">Activity log</text><text x="244" y="109" font-size="13" fill="#7f8da1" font-family="Arial">Requests  /  Request detail</text><text x="244" y="158" font-size="27" fill="#253a54" font-weight="bold" font-family="Arial">Request REQ-DEMO-042</text><rect x="920" y="132" width="142" height="34" rx="17" fill="#fff2d8"/><text x="948" y="154" font-family="Arial" font-size="13" fill="#ad7817">Pending review</text><rect x="244" y="198" width="818" height="279" rx="12" fill="white" stroke="#e1e7ef"/><text x="274" y="238" font-size="17" font-weight="bold" fill="#324b68" font-family="Arial">Request information</text><path d="M274 262H1032" stroke="#e6ebf2"/><text x="274" y="300" font-size="13" fill="#8996a8" font-family="Arial">SUBMITTED BY</text><text x="684" y="300" font-size="13" fill="#8996a8" font-family="Arial">DEPARTMENT</text><text x="274" y="330" font-size="16" fill="#3e526b" font-family="Arial">Demo Employee</text><text x="684" y="330" font-size="16" fill="#3e526b" font-family="Arial">Department A</text><text x="274" y="386" font-size="13" fill="#8996a8" font-family="Arial">DESCRIPTION</text><text x="274" y="416" font-size="16" fill="#3e526b" font-family="Arial">Sample request for the approval workflow.</text><rect x="244" y="501" width="818" height="128" rx="12" fill="white" stroke="#e1e7ef"/><text x="274" y="536" font-size="15" fill="#526783" font-family="Arial">Verify the request details before making a decision.</text><rect x="812" y="559" width="106" height="42" rx="7" fill="#fff" stroke="#d8e1ed"/><text x="842" y="585" font-size="14" fill="#63768d" font-family="Arial">Reject</text><rect x="932" y="559" width="106" height="42" rx="7" fill="#3576c4"/><text x="957" y="585" font-size="14" fill="#fff" font-family="Arial">Approve</text></svg>`
if (!await exists(path.join(screenRoot, 'main-screen-demo.png'))) await sharp(Buffer.from(screenshot)).png().toFile(path.join(screenRoot, 'main-screen-demo.png'))
if (!await exists(path.join(screenRoot, 'approve-modal-demo.webp'))) await sharp(Buffer.from(`<svg width="760" height="440" xmlns="http://www.w3.org/2000/svg"><rect width="760" height="440" fill="#e8edf5"/><rect x="120" y="58" width="520" height="324" rx="18" fill="#fff"/><circle cx="169" cy="110" r="19" fill="#e6f3ef"/><text x="200" y="118" font-family="Arial" font-size="22" font-weight="bold" fill="#273f58">Approve this request?</text><text x="158" y="165" font-family="Arial" font-size="15" fill="#6c7d93">REQ-DEMO-042 · Department A · Demo data</text><text x="158" y="220" font-family="Arial" font-size="14" fill="#526783">Optional note</text><rect x="158" y="233" width="444" height="58" rx="7" fill="#f9fbfd" stroke="#dbe4ef"/><text x="173" y="258" font-family="Arial" font-size="13" fill="#9ba6b7">Add context for your decision...</text><rect x="369" y="317" width="100" height="40" rx="7" fill="#f3f6fa"/><text x="398" y="343" font-family="Arial" font-size="14" fill="#526783">Cancel</text><rect x="482" y="317" width="120" height="40" rx="7" fill="#3576c4"/><text x="509" y="343" font-family="Arial" font-size="14" fill="#fff">Confirm</text></svg>`)).webp().toFile(path.join(screenRoot, 'approve-modal-demo.webp'))
const graphs = [
  { folder: 'business-flows/approval/BF-APP-001', graph: { schema_version: 1, diagram_id: 'DIA-APP-001', type: 'business-flow', title: 'Luồng phê duyệt yêu cầu', summary: 'ROLE-MANAGER nhận yêu cầu Pending, kiểm tra BR-014 tại SCR-APP-001. Đúng phạm vi: FUNC-APP-003 chuyển Approved; không hợp lệ: từ chối và ghi lý do.', nodes: [{ id: 'start', type: 'start', label: 'Nhận yêu cầu', position: { x: 40,y: 160 } }, { id: 'review', type: 'decision', label: 'Kiểm tra phạm vi', role_id: 'ROLE-MANAGER', rule_ids: ['BR-014'], position: { x: 300,y: 160 } }, { id: 'approve', type: 'end', label: 'Phê duyệt', function_id: 'FUNC-APP-003', position: { x: 570,y: 65 } }, { id: 'reject', type: 'end', label: 'Từ chối', position: { x: 570,y: 255 } }], edges: [{ id: 'e1', source: 'start', target: 'review', label: 'Pending' }, { id: 'e2', source: 'review', target: 'approve', label: 'Hợp lệ' }, { id: 'e3', source: 'review', target: 'reject', label: 'Không hợp lệ' }] } },
  { folder: 'roles/ROLE-MANAGER', graph: { schema_version: 1, diagram_id: 'DIA-ROLE-001', type: 'role-hierarchy', title: 'Phạm vi trách nhiệm Manager', summary: 'ROLE-MANAGER phụ trách yêu cầu phòng ban được gán. Quan hệ trách nhiệm không đồng nghĩa với kế thừa quyền tự động.', nodes: [{ id: 'manager', type: 'role', label: 'Quản lý phòng ban', role_id: 'ROLE-MANAGER', position: { x: 90,y: 120 } }, { id: 'scope', type: 'system', label: 'Phòng ban được gán', position: { x: 400,y: 120 } }], edges: [{ id: 'e1', source: 'manager', target: 'scope', label: 'Phạm vi dữ liệu' }] } },
  { folder: 'screens/approval/SCR-APP-001', graph: { schema_version: 1, diagram_id: 'DIA-NAV-001', type: 'screen-navigation', title: 'Điều hướng màn hình', summary: 'Từ danh sách Requests, chọn một yêu cầu để mở SCR-APP-001. Người dùng cần quyền xem và đúng data scope.', nodes: [{ id: 'list', type: 'screen', label: 'Danh sách Requests', position: { x: 90,y: 120 } }, { id: 'detail', type: 'screen', label: 'Chi tiết yêu cầu', screen_id: 'SCR-APP-001', position: { x: 400,y: 120 } }], edges: [{ id: 'e1', source: 'list', target: 'detail', label: 'Chọn request' }] } }
]
for (const { folder, graph } of graphs) { const file = path.join(root, folder, 'diagrams', `${graph.diagram_id}.graph.json`); if (!await exists(file)) await atomicWrite(file, JSON.stringify(graphSchema.parse(graph), null, 2)) }
console.log(`Demo: ${all.length} tài liệu, 2 screenshots, 3 semantic diagrams. Existing files are preserved.`)
