# ATLAS BUSINESS KNOWLEDGE HUB — VIBE CODING IMPLEMENTATION SPEC

> **Tài liệu yêu cầu triển khai V1.0**  
> Mục tiêu: đưa trực tiếp file này cho Codex, Claude Code hoặc GitHub Copilot để xây dựng một website Knowledge Hub nội bộ.  
> Ngôn ngữ giao diện mặc định: **Tiếng Việt**. Nội dung business có thể là **Tiếng Việt / Tiếng Nhật / Tiếng Anh**.  
> Kiến trúc chính thức cho giai đoạn này: **VitePress + Vue 3 + TypeScript + File Management API + Markdown/JSON + Git**, **không sử dụng database làm nguồn dữ liệu chính**.  
> Tham chiếu UI: kết hợp dashboard/sidebar/screen catalog của `Business_Knowledge_Hub_Interactive_Demo(1).zip` với Read/Edit, Document Studio và Diagram Studio của bản Atlas V4 trước đó. Nếu có các file HTML/ảnh tham chiếu, hãy dùng làm visual reference, không bê nguyên prototype localStorage vào production.

---

## 0. Lệnh làm việc cho AI coding agent — đọc trước khi bắt đầu

**Vai trò của bạn:** Senior Full-Stack Vue/Node.js Engineer, UX Engineer và Application Security Engineer.

Hãy xây dựng ứng dụng **Atlas Business Knowledge Hub** dùng nội bộ team BA/Developer/Tester, theo các yêu cầu trong file này. Mục tiêu là giúp team tự tra cứu business mà không cần hỏi BA liên tục. BA phải **mở website → tạo/import Markdown → chỉnh sửa WYSIWYG → chèn ảnh screenshot và sơ đồ → Save Draft → Publish**. Developer/Tester đọc bản Published và tra cứu theo module, màn hình, function, role, permission và business rule.

**Ràng buộc bất di bất dịch:**

1. **Markdown và file asset trong filesystem persistent là source of truth**. Không dùng PostgreSQL, Supabase hay browser localStorage làm nguồn lưu tài liệu chính.
2. **VitePress chỉ trình bày tài liệu Published**. Mọi thao tác ghi file phải đi qua Node.js API có xác thực và kiểm tra quyền.
3. **Không được giả lập thành công:** các nút Save, Publish, Upload, Restore phải thực sự ghi/đọc file và có phản hồi lỗi rõ ràng; chưa code xong thì đánh dấu chưa hỗ trợ.
4. **Không hardcode business thật**. Tạo dữ liệu *minh họa* dưới project `demo-project`, không suy diễn role/rule thực của công ty.
5. **Mỗi loại business entity có ID bất biến** (`SCR-...`, `FUNC-...`, `ROLE-...`, `BR-...`, `TC-...`) để sau này phục vụ MCP, Dify/RAGFlow.
6. Không sử dụng giao diện admin CRUD đại trà. Giữ phong cách **Documentation Portal** sang, gọn, nhiều whitespace, màu xanh nhạt; ưu tiên thao tác đọc tài liệu.
7. Thiết kế hệ thống theo từng module có thể test. Hoàn thành mỗi phase, chạy lint/build/tests và báo lại những phần đã hoạt động.
8. **Security first:** không cho ghi đường dẫn tùy ý, không để public draft, không để lộ tài liệu confidential qua static build, không tin tưởng metadata do client gửi.
9. Không tự thêm Docker, Kubernetes, Redis, Postgres, vector DB hoặc LLM vào MVP khi chưa cần. Phải chạy được trong Coder mà không cần privileged Docker.
10. File này là yêu cầu triển khai; **không được chỉ tạo lại một HTML mockup**.

**Definition of Done tổng thể:** BA import `.md`, upload ảnh cho màn hình, chỉnh sửa, lưu draft, publish; browser khác/nhân viên khác mở link vẫn thấy dữ liệu Published; restart API/web không mất file nếu thư mục được mount persistent; có Git revision để kiểm tra và khôi phục; build site chạy thành công; các file/ảnh/sơ đồ giữ nguyên cấu trúc; sẵn sàng thêm MCP read-only sau này.

---

## 1. Bối cảnh & phạm vi

### 1.1 Mục đích

- Tài liệu business hiện có thể phân tán trên Confluence, Markdown, file đính kèm, hình Figma, trao đổi BA.
- Dev/Tester cần tra cứu nhanh: business là gì, màn hình ở đâu, thao tác nào, role nào được phép, dữ liệu nào được xem, ngoại lệ và testcase liên quan.
- BA muốn cập nhật tài liệu **trực tiếp trên website như Confluence**, không bắt buộc biết Git hay Markdown.
- Hệ thống được phát triển và chạy ban đầu trong **Coder Workspace** do tổ chức cung cấp; dùng đường dẫn Coder app/port sharing **đã xác thực** để team truy cập.
- Về sau Knowledge Hub trở thành **MCP Server** cung cấp tri thức cho GitHub Copilot/Claude Code trong VS Code, có thể đồng bộ Published Markdown đến Dify hoặc RAGFlow.

### 1.2 Trong phạm vi MVP

- Read/Explore: dashboard, project/module navigation, searchable catalog, trang tài liệu có TOC.
- CRUD tài liệu theo thư mục; import `.md`; editor có preview, heading, bảng, ảnh, code, callout, liên kết nội bộ.
- Screen Detail: ảnh màn hình chính, gallery nhiều ảnh, caption, cách vào màn hình, actions và related documents.
- Upload ảnh qua UI và lưu đúng thư mục trên persistent filesystem; hỗ trợ chọn ảnh làm cover hoặc thứ tự gallery.
- Mermaid preview; Diagram Studio dựa trên **Vue Flow** cho business flow, role hierarchy, screen navigation.
- Save Draft, Publish, version history cơ bản bằng Git, rollback, optimistic concurrency; phân quyền Reader/Editor/Publisher/Admin.
- Search keyword theo title, ID, module, tag, body; navigation tự cập nhật khi có trang mới.
- Export Markdown chuẩn hóa cùng metadata, ảnh và graph JSON, sẵn sàng MCP/RAG.

### 1.3 Ngoài phạm vi giai đoạn 1

- AI chatbot thật, embedding, Dify/RAGFlow indexing, MCP server chạy thật, OCR, live collaboration real-time (Google Docs style), permission khác nhau theo từng đoạn trong cùng một tài liệu, analytics nâng cao, full audit enterprise.
- Không được thêm những service trên chỉ để minh họa UI. Hãy xây interface/adapter để sau này tích hợp.

---

## 2. Công nghệ bắt buộc và nguyên tắc tối giản

| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Web tài liệu Published | **VitePress + Vue 3 + TypeScript** | Custom theme, trang đọc Markdown, sidebar/TOC/search |
| UI | Tailwind CSS + CSS variables | Giữ thiết kế Atlas xanh nhạt, responsive |
| Editor | **Tiptap Vue 3** + Markdown conversion được kiểm thử | WYSIWYG, ưu tiên không mất Markdown khi round-trip |
| Markdown parser | markdown-it / unified, gray-matter | YAML frontmatter, bảng, code, internal links |
| Visual graph | **Vue Flow** | Graph editor, custom node, edge labels, zoom/pan |
| Diagram text | Mermaid.js | Preview/export; không chạy code không tin cậy |
| File API | **Node.js + Fastify + TypeScript** | Import, edit, save, publish, uploads, history |
| Validation | Zod hoặc JSON Schema/AJV | Kiểm tra metadata, API payload, graph |
| Search | VitePress Local Search + server-side index nhẹ | Có thể dùng MiniSearch; index tạo lại được từ MD |
| Source of truth | **Markdown + JSON + image files** | Trên thư mục persistent |
| History | **Git commits** | Commit lúc Publish, revision/diff/restore |
| Auth | OIDC/reverse proxy Coder được phê duyệt | Không triển khai public editor vô danh |
| AI integration | Interface only ở MVP | `/api/knowledge/*` để dùng lại cho MCP |

**Không cần database** ở MVP. Nếu muốn thêm SQLite FTS cho tốc độ search sau này, chỉ dùng làm **rebuildable index**, không phải nơi duy nhất lưu business.

### 2.1 VitePress và editor phối hợp ra sao?

- VitePress xây các trang **Published** bằng Markdown; build này là static.
- Phần **Document Studio / Import / Diagram Studio** là trang Vue client-side nằm trong custom VitePress theme hoặc trong các trang app-special của VitePress; nó gọi Fastify API lúc runtime.
- VitePress **không ghi file từ browser**, không tự lưu draft và không thay thế API.
- `vitepress dev` dùng khi phát triển; khi nhiều người sử dụng hãy chạy **static build** được phục vụ bởi reverse proxy / static server và **rebuild sau Publish**.
- **MCP/RAG** sau này đọc từ nguồn Published qua Knowledge API, không scrape HTML của VitePress.

### 2.2 Cấu hình VitePress đáng tin cậy

Sử dụng chính `knowledge/published` làm **VitePress project root**. Đặt `.vitepress/config.ts` và `.vitepress/theme/` ngay trong root này, để tránh thiết kế phụ thuộc symlink hoặc `srcDir` nằm ngoài project root.

Lệnh ví dụ từ repository root:

```bash
pnpm exec vitepress dev knowledge/published --host 0.0.0.0 --port 5173
pnpm exec vitepress build knowledge/published
pnpm exec vitepress preview knowledge/published --host 0.0.0.0 --port 4173
```

Khi triển khai, có thể tùy biến script `pnpm dev:web`, `pnpm build:web`. Nếu theme cần code dùng chung, đặt Vue components trong `packages/ui` và import từ theme.

---

## 3. Kiến trúc dữ liệu/file — bắt buộc triển khai chính xác

**Cây thư mục được thống nhất như sau:**

```text
atlas-knowledge-hub/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── documents.ts
│   │   │   │   ├── imports.ts
│   │   │   │   ├── uploads.ts
│   │   │   │   ├── publishing.ts
│   │   │   │   ├── search.ts
│   │   │   │   ├── diagrams.ts
│   │   │   │   └── knowledge.ts
│   │   │   ├── services/
│   │   │   │   ├── document-store.ts
│   │   │   │   ├── git-versioning.ts
│   │   │   │   ├── publisher.ts
│   │   │   │   ├── asset-store.ts
│   │   │   │   ├── knowledge-index.ts
│   │   │   │   ├── graph-validation.ts
│   │   │   │   └── permissions.ts
│   │   │   └── server.ts
│   │   └── package.json
│   └── mcp/                         # giai đoạn sau, chưa cần chạy
│       └── README.md
├── packages/
│   ├── ui/                          # components Vue tái sử dụng
│   └── schemas/                     # frontmatter, graph và API contracts
├── knowledge/
│   ├── published/                   # CHỈ chứa bản đã Publish
│   │   ├── .vitepress/
│   │   │   ├── config.ts
│   │   │   └── theme/
│   │   │       ├── index.ts
│   │   │       ├── Layout.vue
│   │   │       ├── styles.css
│   │   │       └── components/
│   │   ├── index.md
│   │   ├── overview/
│   │   │   ├── index.md
│   │   │   └── glossary.md
│   │   ├── business-flows/
│   │   │   └── approval/
│   │   │       └── BF-APP-001/
│   │   │           ├── index.md
│   │   │           ├── assets/
│   │   │           └── diagrams/
│   │   │               └── approval-flow.graph.json
│   │   ├── modules/
│   │   │   └── approval/
│   │   │       └── index.md
│   │   ├── screens/
│   │   │   └── approval/
│   │   │       └── SCR-APP-001/
│   │   │           ├── index.md
│   │   │           ├── assets/
│   │   │           │   ├── main-screen-a81b.png
│   │   │           │   └── approve-modal-c920.webp
│   │   │           └── diagrams/
│   │   │               └── navigation.graph.json
│   │   ├── functions/
│   │   │   └── approval/
│   │   │       └── FUNC-APP-003/index.md
│   │   ├── roles/
│   │   │   └── ROLE-MANAGER/
│   │   │       ├── index.md
│   │   │       └── diagrams/role-hierarchy.graph.json
│   │   ├── permissions/
│   │   │   └── approval/
│   │   │       └── PERM-APP-001/index.md
│   │   ├── business-rules/
│   │   │   └── approval/
│   │   │       └── BR-014/index.md
│   │   ├── test-scenarios/
│   │   │   └── approval/
│   │   │       └── TC-APP-001/index.md
│   │   └── references/
│   │       └── index.md
│   ├── drafts/                      # PRIVATE — không build, không public
│   │   └── SCR-APP-001/
│   │       ├── index.md
│   │       ├── assets/
│   │       ├── diagrams/
│   │       └── draft-meta.json
│   ├── staging/                     # PRIVATE — import và build tạm
│   ├── backups/                     # backup tạm, backup chính nằm ngoài workspace
│   └── .knowledge-state/
│       ├── manifest.json            # map doc_id -> published path, checksum
│       └── sync-status.json          # chỉ là trạng thái index về sau
├── scripts/
│   ├── validate-knowledge.ts
│   ├── generate-sidebar.ts
│   ├── rebuild-knowledge-index.ts
│   ├── publish-site.ts
│   └── backup-knowledge.sh
├── tests/
│   ├── e2e/
│   └── fixtures/
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

### 3.1 Quy tắc tổ chức thư mục

1. **Một màn hình = một folder riêng**: `screens/<module>/<SCREEN_ID>/index.md`.
2. Ảnh và graph dùng riêng cho màn hình nằm cạnh tài liệu: `assets/`, `diagrams/`.
3. **Business flow/function/rule/test**: mỗi đối tượng có folder theo `<MODULE>/<ID>/index.md` để ổn định khi đổi tiêu đề.
4. **Role**: `roles/<ROLE_ID>/index.md`; permission matrix: theo module, có ID riêng.
5. `overview/` dành cho tài liệu chung; `references/` là liên kết nguồn, glossary và quyết định được tách khỏi màn hình cụ thể.
6. Tên thư mục module dùng `kebab-case` ASCII (`approval`, `user-management`), **ID viết uppercase**, không dùng tên tiếng Nhật có dấu cách để định danh filesystem.
7. Di chuyển folder hay đổi tên hiển thị **không làm thay đổi `doc_id`**. Nếu đổi path, backend phải cập nhật manifest và redirect/link liên quan.
8. Nội dung source `.md` là chuẩn; `index.json` hoặc search index được tạo lại từ source, **không chỉnh tay**.
9. File Draft có cấu trúc `drafts/<doc_id>/...` và chỉ được trả về qua API có quyền, **không nằm dưới VitePress root**.
10. **Không cho phép chọn thư mục đích tùy ý bằng path raw do browser truyền vào**. Backend tự suy ra đường dẫn bằng `type`, `module` và `doc_id` đã validate.

### 3.2 Ảnh screenshot gắn với screen như thế nào?

Ví dụ màn hình `SCR-APP-001` có đường dẫn:

```text
knowledge/published/screens/approval/SCR-APP-001/index.md
knowledge/published/screens/approval/SCR-APP-001/assets/main-screen-a81b.png
knowledge/published/screens/approval/SCR-APP-001/assets/approve-modal-c920.webp
```

Trong `index.md`, sử dụng **relative image link**:

```md
![Màn hình Approval Detail](./assets/main-screen-a81b.png)

![Hộp thoại Approve](./assets/approve-modal-c920.webp)
```

VitePress sẽ xử lý các ảnh tương đối được tham chiếu khi build. Dùng tên file mang nghĩa + hậu tố hash để tránh trùng tên, không ghi đè ảnh cũ vô tình. Không dùng absolute path kiểu `/home/coder/...` trong Markdown và không lưu ảnh dưới `node_modules` hoặc container filesystem tạm.

**Giai đoạn Draft:** UI upload ảnh lên `knowledge/drafts/<doc_id>/assets/`, chèn link `./assets/<generated-name>`. Khi Publish, sao chép ảnh được tham chiếu sang `knowledge/published/.../assets/` cùng đường dẫn tương đối; xử lý asset cũ đang được bản Published sử dụng bằng revision/version, không xóa vội. Đường dẫn ảnh trong Markdown giữ nguyên giữa Draft và Published. Editor preview Draft phải lấy ảnh qua **authenticated preview API**, không thông qua static public URL.

Nếu cần upload file PDF/tài liệu tham khảo, phải xử lý riêng bằng download API hoặc asset publication policy; VitePress không tự copy mọi file chỉ vì chúng xuất hiện dưới dạng link Markdown.

---

## 4. Chuẩn metadata/frontmatter dùng chung cho UI, MCP và RAG

**Các thuộc tính bắt buộc:** `doc_id`, `project_id`, `type`, `module`, `title`, `language`, `status`, `classification`, `owner`, `version`, `related_ids`, `updated_at`.

```yaml
---
doc_id: SCR-APP-001
project_id: project-alpha
type: screen
module: approval
title: Approval Detail
language: ja
status: published
classification: internal
owner: ba-team
version: '1.2.0'
updated_at: '2026-10-11T09:00:00+07:00'
related_ids:
  - BF-APP-001
  - FUNC-APP-003
  - ROLE-MANAGER
  - BR-014
  - TC-APP-001
tags:
  - approval
  - requests
screen:
  route: '/requests/:id'
  menu_path:
    - Home
    - Requests
    - Request Detail
  screenshot:
    cover: './assets/main-screen-a81b.png'
    gallery:
      - './assets/main-screen-a81b.png'
      - './assets/approve-modal-c920.webp'
---
```

**Quy tắc:**

- `doc_id` phải duy nhất trong project và không được tự thay đổi khi sửa tên.
- `type` thuộc danh sách `overview | business-flow | module | screen | function | role | permission | business-rule | test-scenario | reference`.
- `classification`: `internal | confidential | restricted`; nếu static build chung cho team thì chỉ build những tài liệu được phép chia sẻ cho **toàn bộ nhóm đã xác thực**. Tài liệu có ACL riêng không được đưa vào build chung.
- `related_ids` không được phép trỏ đến đối tượng không tồn tại nếu Publish; nếu liên kết chưa sẵn sàng phải báo warning có chủ đích.
- `version` trong frontmatter phục vụ business revision; **Git commit hash** phục vụ trace kỹ thuật.
- Ngày giờ do backend ghi, không tin `updated_at` do client tự gửi.
- `owner` là người/phòng ban quản trị tài liệu, không phải role business.
- `screen.menu_path` phải phản ánh cách truy cập trong ứng dụng đích; nếu theo role khác nhau, ghi nhiều đường đi kèm role/condition.
- Metadata không phải bộ phân quyền duy nhất. API kiểm tra ACL từ nguồn danh tính được phê duyệt.

---

## 5. Thiết kế UI/UX — giữ style Atlas Dashboard, nâng cấp kiểu Confluence

### 5.1 Visual identity

- **Phong cách:** Enterprise Knowledge Portal, sáng, sạch, hiện đại, tinh tế; tránh gradient rực, viền nhiều và card quá dày.
- Tông chính: light blue / slate / neutral white. Gợi ý CSS variables: `--brand-50: #eff7ff`, `--brand-100: #dfedff`, `--brand-500: #3b82c4`, `--text-primary: #24364b`, `--border: #e0e9f2`.
- Font hệ thống dễ đọc, nội dung từ 14–16px, line-height 1.6–1.75; heading phân cấp rõ.
- Desktop 1440×900/16:9 là layout tham chiếu; hỗ trợ màn hình laptop 1280 và tablet/mobile.
- Sidebar trái có thể collapse, TOC phải sticky, content max-width khoảng 850–950px để đọc dài không mỏi mắt.
- Hình screenshot phải hiển thị **đủ khung**, không crop mất phần quan trọng; có zoom/lightbox.

### 5.2 Layout desktop

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Atlas | Project [▼]   🔎 Search knowledge (Ctrl+K)     AI (later)   User avatar │
├──────────────────────┬───────────────────────────────────────┬───────────────────┤
│ Knowledge Tree       │ Breadcrumb                            │ On this page      │
│                      │                                       │                   │
│ Dashboard            │ Screen Title   [Published] [Edit]     │ Overview          │
│ Business             │ SCR-APP-001 · owner · version         │ Navigation        │
│   Flows              │                                       │ Screenshot        │
│   Modules            │ Purpose / Menu / Requirements         │ Actions           │
│ Screens              │                                       │ Permissions       │
│   Approval           │ [FULL-SIZE SCREENSHOT GALLERY]         │ Business rules    │
│ Functions            │                                       │ Related tests     │
│ Roles                │ Actions / Roles / Business Rules       │                   │
│ Permission Matrix    │                                       │ Related docs      │
│ Business Rules       │ Flow chart / Exceptions / Testcases    │                   │
│ Test Scenarios       │                                       │                   │
│ References           │                                       │                   │
└──────────────────────┴───────────────────────────────────────┴───────────────────┘
```

### 5.3 Các màn hình phải xây

| Route logic | Màn hình | Nội dung chính |
|---|---|---|
| `/` | Dashboard | Tổng quan dự án, tài liệu phổ biến, gần cập nhật, quick links |
| `/business-flows/` | Business Workflows | Danh sách quy trình và sơ đồ tổng quan |
| `/screens/` | Screen Catalog | Cards/table, filter module, role, tag, trạng thái |
| `/screens/<module>/<id>/` | Screen Detail | Screenshot, menu path, actions, related rules, roles, tests |
| `/functions/` | Function Catalog | Chức năng, hành động, input/output, validations |
| `/roles/` | Role Hierarchy | Cây role, mô tả trách nhiệm và data scope |
| `/permissions/` | Permission Matrix | Role × resource × action, scope, condition |
| `/business-rules/` | Business Rules | Điều kiện, exception, examples, precedence |
| `/test-scenarios/` | Testing Guide | Preconditions, steps, expected results, source links |
| `/studio/` | Document Studio | New page, import, Read/Edit, Save Draft, Publish |
| `/studio/diagrams/` | Diagram Studio | Vue Flow nodes/edges, inspector, Mermaid/JSON export |
| `/studio/history/` | Revision history | Commit list, diff, restore |
| `/settings/integrations/` | Integrations placeholder | MCP/Dify/RAGFlow roadmap, không giả làm kết nối thật |

**Không yêu cầu VitePress tự cung cấp các route động:** các trang studio có thể là Vue components trong custom theme với entry Markdown cố định ở root Published, còn dữ liệu runtime lấy từ API. Route đọc tài liệu Generated dựa trên file Markdown.

### 5.4 Document Studio — chi tiết

- Nút `New Page`, `Import Markdown`, `Edit`, `Save Draft`, `Discard`, `Request Review` (optional), `Publish`, `History`, `Export MD`.
- Editor có formatting toolbar: H1/H2/H3, bold, italic, bulleted/ordered list, quote, table, code block, links, image, callout, Mermaid, visual diagram.
- Chỉnh sửa trực tiếp WYSIWYG; có tab `Preview` và `Markdown Source` (cho advanced users).
- Autosave mỗi khoảng 10–20 giây hoặc theo debounce hợp lý nếu có thay đổi; có nhãn `Saved / Saving / Unsaved changes / Conflict`.
- Không autosave trực tiếp vào Published.
- Khi rời trang còn thay đổi chưa lưu, xác nhận trước khi rời.
- Các block Mermaid, graph JSON và ảnh phải giữ nguyên sau import → edit → export; nếu không round-trip được cấu trúc nào, **cảnh báo**, không xóa âm thầm.
- Cho phép drag & drop ảnh ngay vào editor, đồng thời có nút `Upload Screenshot` riêng trên Screen Detail.
- Bao gồm responsive trên mobile nhưng UX edit diagram trên màn nhỏ có thể chuyển thành view mode hoặc inspector đơn giản.

### 5.5 Screen Detail — bắt buộc có Gallery ảnh

Bố cục gợi ý:

1. Header `SCR-APP-001 — Approval Detail`, module, owner, version, trạng thái.
2. Business purpose (mô tả ngắn + khi nào sử dụng).
3. Navigation breadcrumb (Home → Requests → Detail), URL mẫu và điều kiện vào màn hình.
4. **Screenshot Gallery**: cover lớn giữ nguyên tỉ lệ, thumbnails dưới, zoom/lightbox, caption, alt text, thứ tự, chọn cover.
5. Danh sách UI areas/components: Filter, Table, Action buttons, Modal, validation messages.
6. Actions/Functions table có ID, role, rule liên quan.
7. Role access & data scope.
8. States: loading, empty, error, success; liên kết ảnh state tương ứng.
9. Workflow/Diagram (nếu có), related business rules/test scenarios.
10. Last updated, source link Figma/Confluence (nếu có).

UI Editor screenshot cần hỗ trợ **Upload nhiều ảnh**, rename caption (chỉ metadata, không đổi file gốc nếu không cần), reorder, set cover, remove, preview; màn hình đọc chỉ thấy ảnh Published.

### 5.6 Diagram Studio — visual như Atlas V4, đẹp hơn Mermaid mặc định

- Dùng **Vue Flow** với custom node cards: Start/End, Action, Decision, System, Screen, Role.
- Edge có label điều kiện: `Yes/No`, `Approve/Reject`, `Success/Error`.
- Màu node dùng ngữ nghĩa nhất quán, không màu tùy tiện; các đường cong có arrow và khoảng trống dễ đọc.
- Có zoom, pan, fit-to-view, auto layout tùy chọn, mini-map, inspector sửa node/edge.
- **Mỗi node chứa semantic metadata**, ví dụ `node_id`, `label`, `node_type`, `role_id`, `screen_id`, `function_id`, `rule_ids`, `description`.
- Graph canonical = **JSON node/edge**, source Mermaid là bản xuất ra; có thể render SVG/PNG nhưng **không lưu ảnh làm nguồn duy nhất**.
- Lưu graph draft `drafts/<doc_id>/diagrams/<diagram_id>.graph.json`, Publish sang sibling `diagrams/`.
- Chèn vào bài viết thông qua block theo diagram ID, hoặc embed Mermaid được sinh ra kèm mô tả chữ (AI/MCP dùng được).
- Bắt buộc có **textual flow summary**: actor, trigger, condition, transition, outcome, exceptions.
- Nếu import Mermaid phức tạp không parse được, giữ nguyên raw Mermaid source và hiển thị chỉ đọc + cảnh báo trước khi chuyển sang Vue Flow.

Ví dụ graph semantic:

```json
{
  "schema_version": 1,
  "diagram_id": "DIA-APP-001",
  "type": "business-flow",
  "title": "Approval workflow",
  "nodes": [
    {"id":"n-start","type":"start","label":"Submit Request","role_id":"ROLE-EMPLOYEE","position":{"x":40,"y":110}},
    {"id":"n-review","type":"decision","label":"Manager reviews","role_id":"ROLE-MANAGER","rule_ids":["BR-014"],"position":{"x":310,"y":110}},
    {"id":"n-approved","type":"end","label":"Approved","position":{"x":620,"y":30}},
    {"id":"n-rejected","type":"end","label":"Rejected","position":{"x":620,"y":210}}
  ],
  "edges": [
    {"id":"e1","source":"n-start","target":"n-review"},
    {"id":"e2","source":"n-review","target":"n-approved","label":"Approve"},
    {"id":"e3","source":"n-review","target":"n-rejected","label":"Reject"}
  ]
}
```

---

## 6. CRUD, Import, Save Draft, Publish, History — các luồng phải chạy thật

### 6.1 Tạo tài liệu mới

1. BA chọn `New Page` → loại tài liệu (`Screen`, `Business Flow`, ...), module, title, language.
2. Backend sinh hoặc xác nhận `doc_id` theo schema; kiểm tra ID duy nhất.
3. Sinh Draft Markdown từ template theo type tại `knowledge/drafts/<doc_id>/index.md`.
4. Editor mở bản nháp; Published chưa thay đổi.

### 6.2 Import Markdown

1. BA chọn file `.md` (về sau tùy chọn `.zip` gồm markdown + assets).
2. Backend giới hạn kích thước và validate UTF-8, YAML frontmatter và nội dung an toàn.
3. Phân tích ID/title/type/module; nếu thiếu metadata, **mở Import Mapping step** để BA điền các trường cần thiết.
4. Nếu `doc_id` đã tồn tại, hỏi `Update existing draft` hoặc `Import as new document`; **không tự ghi đè**.
5. Resolve ảnh tương đối: `.md` đơn lẻ có ảnh relative không đi kèm → cảnh báo missing asset; `.zip` phải chống zip-slip và xử lý kiểm tra giới hạn số file/dung lượng.
6. Mở bản Preview → `Import to Draft` → editor cho chỉnh sửa ngay.
7. Sau khi Save Draft, reload URL Draft vẫn hiện đúng nội dung nhờ API đọc file thực tế.

### 6.3 Upload screenshot / image

1. Editor hoặc Screen Detail cho chọn nhiều ảnh `PNG/JPEG/WebP` (GIF cân nhắc hỗ trợ read-only nếu cần animation; SVG mặc định từ chối trừ khi sanitize nghiêm ngặt).
2. Validate **MIME bằng nội dung file** chứ không chỉ extension, giới hạn mặc định **10 MB/file**, **20 file/lần** (configurable), giới hạn tổng dung lượng cho từng doc.
3. Backend kiểm tra `doc_id`, role `Editor`, vùng Draft, tên file an toàn; generate tên mới: `purpose-<short-hash>.<ext>`.
4. Lưu file vào `knowledge/drafts/<doc_id>/assets/` bằng thao tác atomic; trả `{asset_id, relative_path, preview_url, width, height, mime}`.
5. Đưa ảnh vào editor / gallery metadata; có caption, alt, category (`overview | state | modal | error | mobile`), order, cover.
6. Khi Publish, backend kiểm tra tất cả relative links, copy images referenced sang folder Published tương ứng.
7. Khi xóa ảnh trong Draft, không được xóa ảnh Published đang dùng; asset cleaning sau khi chắc chắn không có revision tham chiếu.
8. Xem ảnh Draft qua `GET /api/documents/:docId/draft-assets/:assetId` có auth; Published ảnh truy cập qua route static **chỉ nếu site public đối với đúng nhóm người**.
9. Không cho upload đuôi thực thi, HTML, script; không cho phép URL hoặc nội dung ảnh truy xuất file ngoài root.

### 6.4 Save Draft / Autosave

1. API nhận `base_revision` hoặc HTTP `If-Match` với file checksum.
2. Đọc checksum hiện tại; nếu thay đổi bởi người khác → trả **409 Conflict**, cho người dùng Reload / Compare / Save as copy; không ghi đè yên lặng.
3. Validate Markdown/metadata/diagram links.
4. Ghi vào file tạm cùng filesystem rồi **atomic rename** vào Draft; ghi `draft-meta.json` (editor, updated_at, base_published_commit, draft revision).
5. Trả về revision mới và thời điểm lưu; UI hiển thị `Saved` khi server xác nhận.
6. Không phụ thuộc localStorage để phục hồi; localStorage chỉ có thể dùng như unsaved buffer bổ trợ (không thay thế server files).

### 6.5 Publish

1. Chỉ `Publisher`/`Admin` hoặc `Editor` được cấp quyền publish mới thao tác.
2. Lấy lock cấp tài liệu + publish queue; validate frontmatter, liên kết tới docs, ảnh, graph, Markdown compatibility.
3. Tạo **staging snapshot** của Published + thay đổi draft; chạy build kiểm tra và link validation trên bản staging; không ghi đè site đang phục vụ.
4. Nếu fail: giữ Published cũ, trả lỗi/validation rõ ràng; Draft còn nguyên.
5. Nếu thành công: commit Published Markdown + assets + diagram JSON bằng Git (author/commit message có doc ID), cập nhật manifest/index, tạo bản site mới và **đổi active release một cách atomic**.
6. Chỉ sau khi release thành công mới đánh dấu revision Published đã active; MCP/API read chỉ đọc bản active Published.
7. Nếu quá trình deploy/commit bị lỗi giữa chừng phải rollback hoặc giữ active revision cũ; không báo publish thành công giả.
8. Có màn hình Publish History gồm `doc_id`, version, Git SHA, user, timestamp và comment.

**MVP fallback hợp lý:** Nếu xây full release-swap trong Coder quá phức tạp, vẫn phải có validation-before-write, serialized publish queue, rebuild, giữ bản site hiện tại tới khi build mới OK, rollback được từ Git và không expose draft; ghi rõ giới hạn nhất quán khi publish đồng thời trong README.

### 6.6 Restore / Unpublish

- `Restore` tạo **revision mới từ nội dung revision cũ**; không rewrite Git history.
- `Unpublish` gỡ nội dung khỏi site/index/MCP active release và lưu lịch sử; không chỉ ẩn trong sidebar.
- Khi thay đổi classification từ Internal sang Restricted, không để file nằm trong published static build chung.

---

## 7. API contract tối thiểu (Fastify)

| Method | Endpoint | Mục đích / quyền |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/projects` | Dự án mà user được xem |
| GET | `/api/documents?project_id=&type=&module=&q=` | Search/list Published, filter ACL |
| GET | `/api/documents/:docId` | Published document, permission checked |
| POST | `/api/documents` | Create new Draft — Editor |
| GET | `/api/documents/:docId/draft` | Draft — Editor/Publisher authorized |
| PUT | `/api/documents/:docId/draft` | Save Draft, If-Match/concurrency |
| POST | `/api/documents/import` | Upload .md, analyze, preview |
| POST | `/api/documents/:docId/assets` | Upload image to Draft |
| GET | `/api/documents/:docId/draft-assets/:assetId` | Auth-protected draft image |
| DELETE | `/api/documents/:docId/assets/:assetId` | Remove draft attachment, safe refs |
| POST | `/api/documents/:docId/publish` | Validate/commit/build/publish |
| POST | `/api/documents/:docId/unpublish` | Remove from active publication |
| GET | `/api/documents/:docId/history` | Git revisions/history |
| GET | `/api/documents/:docId/diff?from=&to=` | Compare revisions |
| POST | `/api/documents/:docId/restore` | Restore by new commit |
| GET | `/api/documents/:docId/export.md` | Export Markdown |
| GET | `/api/documents/:docId/related` | Follow related IDs |
| GET | `/api/diagrams/:diagramId` | Graph JSON + textual source |
| PUT | `/api/documents/:docId/draft-diagrams/:diagramId` | Save diagram draft |
| GET | `/api/knowledge/search?q=&project_id=&module=&type=` | Retrieval interface for future MCP |
| GET | `/api/knowledge/documents/:docId` | Knowledge read by ID, Published only |

**Response envelope gợi ý:**

```json
{
  "data": {
    "doc_id": "SCR-APP-001",
    "revision": "sha256:a1b2...",
    "status": "draft",
    "title": "Approval Detail",
    "relative_path": "screens/approval/SCR-APP-001/index.md"
  },
  "error": null
}
```

- API không nhận `absolute_file_path` để ghi tùy ý.
- `GET /api/knowledge/*` phục vụ dữ liệu Published chuẩn; cả website search và MCP sau này dùng cùng service, không mỗi bên một logic riêng.
- Chống traversal: normalize/realpath, từ chối `..`, absolute paths, symlink escape, null byte; giới hạn quyền OS cho process API chỉ ở thư mục được phép.
- API key/token chỉ ở backend/environment secrets, không trong `.md`, bundle frontend hoặc Git.

---

## 8. Chuẩn nội dung — templates bắt buộc cho BA

Tạo sẵn form template khi BA chọn loại tài liệu. Các heading gợi ý nhưng có thể mở rộng. UI phải giúp BA biết nên điền gì bằng placeholder/hint ngắn, không làm trang thành một form dài cứng nhắc.

### 8.1 Screen (`SCR-*`)

```md
# SCR-APP-001 — Approval Detail

## 1. Mục đích / Business Purpose
Màn hình này dùng để ...

## 2. Cách truy cập / Navigation
Home → Requests → Request Detail

## 3. Hình ảnh màn hình
![Overview](./assets/main-screen-a81b.png)

## 4. Thành phần giao diện (UI Elements)
| Field / Action | Mô tả | Validation | Function ID |
|---|---|---|---|
| Approve button | Phê duyệt | Chỉ enabled ở Pending | FUNC-APP-003 |

## 5. Chức năng
- FUNC-APP-003 — Approve request

## 6. Role & Permission
| Role | View | Edit | Approve | Data scope |
|---|---|---|---|---|
| ROLE-MANAGER | Yes | No | Conditional | Assigned department |

## 7. Business Rules
- BR-014 — Giới hạn phạm vi phê duyệt.

## 8. Screen States
- Loading, Empty, Error, Success.

## 9. Exceptions
- Nếu ngoài phạm vi dữ liệu, không được Approve.

## 10. Related Documents & Test Cases
- TC-APP-001
```

**Tất cả thông tin trên chỉ là dữ liệu demo**, cần BA điền lại theo dự án thực tế.

### 8.2 Business Flow (`BF-*`)

- Business objective, actors, trigger, preconditions, sequence (diagram + text), decisions, postconditions, exceptions, related screens/roles/rules.

### 8.3 Function (`FUNC-*`)

- Purpose, trigger, input, output, validation, success/error handling, permissions, business rules, related screens.

### 8.4 Role (`ROLE-*`)

- Role description, parent role, inheritance policy, data scope, privileges, examples, exceptions, linked permission matrix; **nêu rõ nếu inheritance không tự động**.

### 8.5 Permission (`PERM-*`)

- Role × module/screen/function × view/create/edit/delete/approve × condition × data scope; source rule and effective version.

### 8.6 Business Rule (`BR-*`)

- Rule statement, why, when applied, condition, exception, priority, examples, effective date, source and expected system behavior.

### 8.7 Test Scenario (`TC-*`)

- Preconditions, role/test data, test steps, expected result, positive/negative/boundary cases, source IDs.

### 8.8 Multi-language

- Lưu ngôn ngữ trong frontmatter.
- Nếu cùng một đối tượng có bản tiếng Nhật và tiếng Việt, dùng **ID logic chung + locale-specific pages** hoặc metadata `translation_of`, tránh tạo hai ID nghiệp vụ khác nhau khi đó là một entity.
- Search hỗ trợ tiếng Nhật/Việt, ID ưu tiên exact match; fallback keyword. Không tự tạo bản dịch “đã được duyệt” bằng AI.

---

## 9. Search, navigation và data traceability

- Search `Ctrl+K` tìm theo `doc_id`, title, module, tags và nội dung Published. Exact ID (`SCR-APP-001`) được ưu tiên cao hơn fuzzy keyword.
- Sidebar tạo từ Published manifest; nhóm theo type > module > entity, sort theo `order` hoặc title; không hardcode sidebar mỗi khi BA thêm trang.
- Breadcrumb từ module/path và tài liệu cha, không từ title tùy ý.
- `related_ids` phải trở thành clickable internal links trong UI, có preview card `type + id + title`.
- Broken references và orphan documents có trang `Knowledge Health` cho BA/Admin thấy.
- VitePress built-in local search có thể dùng cho nội dung bài viết; API search dùng index filesystem nhẹ để tra cứu có cấu trúc. Không xây hai nguồn dữ liệu độc lập.
- UI cần hiển thị **Last updated, Owner, Version, Source Links** trên trang.

---

## 10. Security, Coder Workspace và lưu trữ bền vững

### 10.1 Phân biệt hai loại role

- **Business roles**: Manager, Approver, Employee... là nội dung đang được mô tả trong Knowledge Hub.
- **Knowledge Hub access roles**: `Reader`, `Editor`, `Publisher`, `Admin` quyết định ai có thể xem/sửa/publish; không được tự đồng nhất hai loại.

### 10.2 Access control

- Người dùng chưa xác thực không truy cập được tài liệu nội bộ hoặc write API.
- `Reader`: đọc Published phù hợp quyền; `Editor`: tạo/sửa Draft; `Publisher`: publish/restore/unpublish; `Admin`: config/quản lý thành viên.
- Mỗi API ghi file và mỗi endpoint Draft phải kiểm tra session và quyền từ server.
- Với VitePress static build chung, **mọi người có quyền tải site đều có thể đọc các trang nằm trong build**. Nếu cần tài liệu phân quyền khác nhau theo nhóm/người, phải tách build hoặc dùng server-side authorized content delivery; không được chỉ ẩn menu hay dựa vào CSS.

### 10.3 Coder-specific

- Xác định thư mục mount persistent của Workspace template. Repository và `knowledge/` phải ở vị trí tồn tại sau restart/recreate theo thiết kế Coder; không mặc định `/tmp` hoặc container layer là persistent.
- Ưu tiên truy cập website qua Coder app URL chế độ `authenticated` / `organization` được phép; không mở editor port public.
- Bảo vệ Fastify API và tránh CORS wildcard; ưu tiên reverse proxy **same-origin** (`/api/*`).
- Sau restart phải tự khởi động dịch vụ hoặc có runbook rõ ràng; không phụ thuộc shell session thủ công.
- Git push/backup tới nguồn được tổ chức phê duyệt; **Git local không bảo vệ khỏi bị xóa nguyên workspace**.
- Chính sách retention và backup phải được tổ chức chấp thuận. Không đưa tài liệu nội bộ lên GitHub public.

### 10.4 An toàn Markdown/VitePress và uploads

- **Không render tùy ý Vue expressions/components/raw HTML do tài liệu người dùng upload cung cấp**. VitePress có khả năng biên dịch Vue trong Markdown, vì vậy phải xây content sanitation/escaping theo allowlist trước build; không để `<script>`, component tùy ý, `{{ expression }}` không an toàn lọt vào nội dung VitePress build.
- Markdown link/image URL phải được allowlist theo scheme và đường dẫn hợp lệ, chống XSS/javascript: URLs.
- Parser YAML phải có validation và giới hạn nội dung, không tin input trực tiếp.
- SVG/HTML từ bên ngoài bị từ chối hoặc sanitize an toàn, không inline script.
- Giới hạn upload size/count, validate magic bytes và dimensions, chống decompression bomb.
- File API không thực thi shell command chứa path/input người dùng; gọi `git`/`vitepress` với argument list an toàn.
- Limit/rate limit API, CSRF protection theo authentication model, audit tối thiểu `who/what/when` khi save/publish.

---

## 11. MCP-ready design và khả năng nối Dify/RAGFlow sau này

**Không cần triển khai MCP server trong MVP**, nhưng API/service phải sẵn sàng.

### 11.1 Boundary

```text
[BA Editor]
    ↓ Save Draft / Publish
[File API + Git]
    ↓ active published files
[Knowledge Service (validation + search + permissions)]
    ├── [VitePress site]
    ├── [Future MCP Adapter] → VS Code GitHub Copilot / Claude Code
    └── [Future AI Index Adapter] → Dify / RAGFlow
```

MCP không được đọc thẳng một filesystem không hạn chế khi dùng bởi remote users. Hãy dùng cùng authorization-aware Knowledge Service mà website/API sử dụng.

### 11.2 Read-only MCP tools tương lai

| Tool | Input | Output |
|---|---|---|
| `search_knowledge` | query, project, module, type | doc ID, title, excerpt, revision, link |
| `get_document` | doc ID | Published Markdown + metadata + canonical URL |
| `get_screen` | screen ID | navigation, images/alt, actions, roles, rules |
| `get_business_rules` | related ID | rules + source citations |
| `get_role_permissions` | role ID, module | explicit permission matrix + scope |
| `get_business_flow` | flow ID | text summary + semantic nodes/edges |
| `get_related_documents` | doc ID | related documents filtered by permission |

- Citations phải có `doc_id`, `published_revision` (Git SHA/manifest), `heading`, `url`.
- Không trả file draft / tài liệu bị unpublish.
- URL phải truy cập được từ VS Code của người dùng; `localhost` của desktop không phải `localhost` trong Coder.
- GitHub Copilot và Claude Code có thể nhận nội dung MCP rồi gửi tới model theo chính sách của công cụ. **Chỉ kết nối khi chính sách bảo mật tổ chức cho phép**.

### 11.3 Dify/RAGFlow adapters (future)

- Index bản **Published** khi có event publish/unpublish/delete; không index Draft.
- Export Markdown canonical kèm metadata, related IDs, text summary của sơ đồ và các image captions.
- Duy trì mapping `doc_id → provider dataset/document ID`, last synced revision, errors; mapping là generated state, không là nội dung chuẩn.
- Nếu provider không enforce ACL per-user theo yêu cầu, dùng External Retrieval/API có kiểm soát quyền thay vì đẩy mọi nội dung vào một dataset chung.

---

## 12. Các bước yêu cầu AI coding agent triển khai theo thứ tự

### Phase 1 — Scaffold và Published Documentation (ưu tiên đầu tiên)

- [ ] Tạo pnpm monorepo, Vue/VitePress custom theme, Fastify API scaffold.
- [ ] Tạo cây thư mục `knowledge/published` chuẩn và khoảng 8 tài liệu demo có liên kết ID.
- [ ] Dựng Dashboard, Knowledge Tree, Screen Catalog, Screen Detail, search, TOC, related docs.
- [ ] Chạy `vitepress dev/build` thành công, không có broken links.
- [ ] Screenshots demo phải hiển thị đủ, không bị cắt; có responsive.

**Acceptance:** mở một tài liệu bằng URL sau build, xem được screenshot, breadcrumb, related docs; sidebar tự động từ file.

### Phase 2 — File API + Markdown Import/Edit

- [ ] Implement auth + roles đơn giản theo phương án nội bộ được phê duyệt.
- [ ] List/Create/Read Draft, Import `.md`, preview, Save Draft.
- [ ] Tiptap Editor (heading, table, image, code, callout) + markdown round-trip.
- [ ] Optimistic concurrency 409, atomic writes và validation.
- [ ] Reload hoặc đổi browser vẫn đọc được Draft qua API khi có quyền.

**Acceptance:** BA import `.md`, sửa một đoạn, Save Draft, refresh trình duyệt, nội dung vẫn nguyên trong file thực tế.

### Phase 3 — Upload screenshot và Screen Gallery

- [ ] API upload multi image vào draft folder tương ứng với screen ID.
- [ ] Add screenshot cover/gallery, caption, alt text, reordering, lightbox.
- [ ] Ảnh được lưu đúng `/knowledge/drafts/<doc_id>/assets`; sau Publish xuất hiện tại `/knowledge/published/screens/<module>/<id>/assets`.
- [ ] Đường dẫn ảnh tương đối hoạt động sau build; ảnh từ draft không public.
- [ ] Có test file trùng tên, ảnh không hợp lệ, 10 MB limit, rollback publish.

**Acceptance:** upload 2 ảnh, chọn cover, Save, Publish, mở browser khác thấy ảnh; file thực tế nằm trong đúng folder của screen.

### Phase 4 — Publish + Git History

- [ ] Staging validation, publish queue, VitePress build, atomic release swap, Git commit.
- [ ] History screen, diff và Restore, Unpublish.
- [ ] Bảo đảm lỗi build không ghi đè site đang hoạt động.
- [ ] Sidebar/search/related links tự động cập nhật sau publish.

**Acceptance:** publish một trang mới rồi restart app, trang vẫn tồn tại; Restore trả nội dung cũ thành revision mới.

### Phase 5 — Diagram Studio

- [ ] Vue Flow custom nodes, edge labels, add/edit/remove/drag, auto-fit.
- [ ] Save semantic JSON vào đúng `diagrams/` tương ứng; Markdown references + text summary.
- [ ] Preview Mermaid và export Mermaid/JSON.
- [ ] Role hierarchy, business flow, screen navigation có mẫu diagram khác nhau.

**Acceptance:** sửa tên node và label một nhánh, Save Draft, Publish, mở lại Editor vẫn còn toàn bộ graph/branch, không thành ảnh phẳng.

### Phase 6 — Knowledge API/MCP readiness

- [ ] Public (authenticated) read API `search_knowledge`, get document, related graph, rules, permissions.
- [ ] Exact-ID search, metadata filters, canonical links/versions.
- [ ] Integration placeholder chỉ là roadmap, không hiển thị `Connected` giả.
- [ ] Tài liệu hướng dẫn thêm remote MCP vào VS Code sau này.

**Acceptance:** API trả Published knowledge có citations và không thấy Draft; không expose restricted docs qua search.

---

## 13. Bộ test cases không được bỏ qua

| ID | Test | Expected |
|---|---|---|
| AT-001 | Import MD không có frontmatter | Hiển thị bước mapping, không crash |
| AT-002 | Import cùng `doc_id` | Hỏi update/new, không tự overwrite |
| AT-003 | Upload ảnh screen | Ảnh nằm trong đúng Draft folder + preview |
| AT-004 | Publish screen kèm 2 ảnh | Build đọc được ảnh từ Published folder |
| AT-005 | Save hai tab chung 1 document | Tab cũ nhận 409 Conflict khi save |
| AT-006 | Restart API/Web | Nội dung vẫn còn trên persistent storage |
| AT-007 | Unauthorized GET Draft asset | 401/403, không xem được ảnh |
| AT-008 | File `../../etc/passwd` | Bị từ chối, không đọc/ghi ngoài root |
| AT-009 | Upload HTML/SVG chứa script | Bị chặn hoặc sanitize đúng |
| AT-010 | Markdown có `<script>` / Vue expression | Không thực thi code tùy ý |
| AT-011 | Publish MD link tới file không tồn tại | Publish thất bại, Published cũ còn nguyên |
| AT-012 | Publish VitePress build lỗi | Giữ active site cũ, UI báo lỗi |
| AT-013 | Restore revision cũ | Tạo revision mới, Git history không rewrite |
| AT-014 | Unpublish | Website/search/Knowledge API không truy xuất được |
| AT-015 | Mermaid/diagram JSON edit/reload | Giữ node/edge/role/rule metadata |
| AT-016 | File PNG và WebP có trùng basename | Tên generated không collision |
| AT-017 | Broken `related_ids` | Cảnh báo/cản publish theo policy |
| AT-018 | Reader thử gọi Save/Publish bằng API trực tiếp | 403, không ghi file |
| AT-019 | Search theo `SCR-APP-001` | Exact ID nằm đầu kết quả |
| AT-020 | Xóa file Published chỉ bằng ẩn sidebar | Test phải thất bại; không được rò nội dung qua URL |

---

## 14. Demo data cần tạo (chỉ là ví dụ)

- Project: `project-alpha` — Demo Workflow System.
- Business Flow: `BF-APP-001` — Approval Process.
- Screen: `SCR-APP-001` — Approval Detail.
- Function: `FUNC-APP-003` — Approve Request.
- Business Role: `ROLE-MANAGER` — Department Manager.
- Business Rule: `BR-014` — Manager approval scope.
- Permission: `PERM-APP-001` — Approve permission matrix.
- Test Scenario: `TC-APP-001` — Approval role cases.

Những tài liệu này phải link qua lại bằng `related_ids`, và ít nhất một Screen cần có ảnh minh họa, một Business Flow có graph JSON/Mermaid và một Role có hierarchy diagram.

---

## 15. Câu lệnh vận hành, persistent volume và backup

### 15.1 Local development

Sau khi cài dependencies, scripts root khuyến nghị:

```bash
pnpm install
pnpm dev:api                 # Fastify, port 3001
pnpm dev:web                 # VitePress, port 5173
pnpm build:web               # generate static site
pnpm test
pnpm lint
```

Proxy dev/web đảm bảo `/api/*` trỏ tới Fastify và các API yêu cầu auth; tránh frontend gọi API qua public endpoint không bảo vệ.

### 15.2 Filesystem persistence

- Dùng cấu hình env ví dụ `KNOWLEDGE_ROOT=/path/to/persistent/repo/knowledge` — phải nằm trong **Coder persistent volume**.
- Kiểm tra thực tế tính bền vững của mount theo template Coder trước khi nhập business thật.
- `knowledge/published` + `.git` + attachments phải được lưu/backup; có thể push repo private được phép và backup volume ngoài workspace.
- Sau khi di chuyển workspace/rebuild container, mount lại đúng `KNOWLEDGE_ROOT` trước khi chạy service.
- Ghi README về cách backup/restore và khôi phục Git revision; không hardcode đường dẫn giả định của công ty.

### 15.3 Git và .gitignore

- Nên track `knowledge/published/**/*.md`, `assets` hợp lệ, `diagrams/*.graph.json`, `.vitepress` config/theme và code.
- Không track `knowledge/drafts/`, `knowledge/staging/`, temp upload, secrets, build artifacts, cache, tokens, search index.
- **Vì Published có thể chứa dữ liệu nội bộ**, Git remote phải private và được tổ chức phê duyệt. Không public repository.
- Tránh commit files khổng lồ bằng giới hạn upload + Git LFS nếu tổ chức cho phép.
- Nếu draft phải được backup thì backup bằng storage riêng có access control; `.gitignore` không có nghĩa là draft đã được backup.

---

## 16. Definition of Done theo góc nhìn người dùng

### BA

- [ ] Đăng nhập → tạo tài liệu mới → sửa trực tiếp mà không cần mở IDE.
- [ ] Import Markdown rồi chỉnh sửa như Confluence.
- [ ] Upload nhiều ảnh cho một screen, sắp xếp cover/gallery, ảnh lưu đúng folder.
- [ ] Chèn flowchart đẹp và chỉnh sửa từng node/nhánh mà không phải viết Mermaid bằng tay.
- [ ] Save Draft không làm Dev/Tester thấy thay đổi chưa xuất bản.
- [ ] Publish, xem lịch sử, xem diff, khôi phục phiên bản trước.

### Dev/Tester

- [ ] Tìm screen/function/role/rule bằng ID hoặc từ khóa.
- [ ] Xem ảnh màn hình rõ ràng, không crop, zoom được.
- [ ] Hiểu cách vào màn hình, chức năng, business flow, permission và testcase liên quan.
- [ ] Bấm link sang các tài liệu liên quan mà không bị lỗi.
- [ ] Nội dung đọc là bản Published ổn định.

### Admin / Technical

- [ ] Restart service không làm mất nội dung trong persistent storage.
- [ ] Không ghi dữ liệu ra ngoài allowed root, không leak draft/restricted content.
- [ ] Search và API Knowledge lấy cùng Published source of truth.
- [ ] Git revision/diff/restore hoạt động thực tế.
- [ ] Không cần database, Docker privileged, Dify, RAGFlow hoặc LLM để chạy MVP.
- [ ] Có README, `.env.example`, scripts và tests cơ bản để team tái triển khai.

---

## 17. Final instructions để copy vào Codex / Claude Code

> Hãy đọc toàn bộ `ATLAS_KNOWLEDGE_HUB_VIBE_CODING_SPEC.md` và triển khai **website chạy thật**, không dừng ở mockup. Tập trung đúng thứ tự: (1) VitePress Custom Theme + Atlas Dashboard / Screen Catalog / Detail, (2) File API + Rich Editor + Markdown Import/Save, (3) Upload screenshot có persistent file storage theo screen folder, (4) Publish + Git History + atomic rebuild, (5) Vue Flow Diagram Studio, (6) Knowledge API chuẩn bị cho MCP. Dùng `knowledge/published` làm VitePress root, `knowledge/drafts` private, folder theo doc type/module/ID. Mọi ảnh màn hình lưu tại `screens/<module>/<SCREEN_ID>/assets`, graph JSON tại `diagrams`. Giữ nguyên `doc_id`, `related_ids`, version và source links. Không tự thêm PostgreSQL/Redis/Docker/K8s/AI backend. Khi hoàn thành từng phase phải chạy tests/build, nêu những chức năng hoạt động thật, giới hạn và bước chạy trong Coder. Nếu có prototype Atlas V4 và file ZIP UI cũ, tham khảo visual layout và giữ phong cách xanh nhạt, clean, professional.

---

## 18. Tài liệu kỹ thuật tham chiếu

- VitePress custom theme: https://vitepress.dev/guide/custom-theme
- VitePress routing/project root: https://vitepress.dev/guide/routing
- VitePress asset handling/relative image links: https://vitepress.dev/guide/asset-handling
- VitePress frontmatter: https://vitepress.dev/guide/frontmatter
- VitePress site configuration: https://vitepress.dev/reference/site-config
- MCP SDK (khi triển khai MCP): https://github.com/modelcontextprotocol/typescript-sdk

**Ghi chú:** Đây là đặc tả kiến trúc và hành vi mong muốn, không phải codebase đã được triển khai. Các giá trị ID, tên chức năng, business và người dùng trong ví dụ đều giả định.
