# Atlas Business Knowledge Hub

Knowledge portal nội bộ bằng **Vue 3 + Vuetify 3 + VitePress + TypeScript**, dựa trên [đặc tả](docs/ATLAS_KNOWLEDGE_HUB_VIBE_CODING_SPEC.md). Giao diện mặc định tiếng Việt. Vuetify thay lớp Tailwind trong tài liệu theo yêu cầu của project.

Markdown, JSON và ảnh trên filesystem là nguồn dữ liệu chính. Không có database, localStorage document store, Docker hoặc AI backend.

## Chạy local

Yêu cầu Node.js **22 LTS**, Git và pnpm 10. Các tài liệu demo đã có trong repository; seed chỉ tạo file còn thiếu, không ghi đè file hiện tại.

```sh
corepack enable
corepack prepare pnpm@10.28.2 --activate
pnpm install
cp .env.example .env
pnpm dev
```

Mở **http://127.0.0.1:5173**. Fastify ở port 3001; VitePress proxy `/api` cùng origin. Trên PowerShell dùng `Copy-Item .env.example .env`; nếu policy chặn `pnpm.ps1`/`npm.ps1`, dùng `pnpm.cmd`/`npm.cmd`. Nếu không muốn cài pnpm global: `npx.cmd --yes pnpm@10.28.2 install` và `npm.cmd run dev`.

Tài khoản chỉ dùng cho demo trên loopback:

| Tài khoản | Mật khẩu mặc định | Quyền portal |
| --- | --- | --- |
| admin | atlas-demo-2026 | Admin: đọc, sửa, publish, restore, unpublish |
| editor | atlas-editor-2026 | Editor: đọc và sửa Draft |
| reader | atlas-reader-2026 | Reader: chỉ đọc Published |

Thay mật khẩu bằng biến môi trường trong `.env`. Local auth kiểm tra mật khẩu bằng scrypt, session ngẫu nhiên trong bộ nhớ, cookie HttpOnly/SameSite Strict và CSRF token. Restart API yêu cầu đăng nhập lại; tài liệu không mất. Business roles trong bài viết không phải quyền truy cập portal.

Chạy bản đã build, được Fastify bảo vệ cả HTML và bundles:

```sh
pnpm build:web
pnpm start
```

Mở **http://127.0.0.1:3001**. Trang `/login` không chứa nội dung business. Không phục vụ riêng `.vitepress/dist` bằng một public static server.

## Các chức năng đã triển khai

- Dashboard, cây tài liệu tự sinh từ filesystem theo type/module/ID; catalog dạng cards/table, lọc module/tag/business role.
- Tìm kiếm `Ctrl+K`, ưu tiên ID chính xác; tìm title, body, tags, module và lọc project/type/language. Tiếng Việt/Nhật/Anh dùng Unicode keyword search.
- Trang đọc có breadcrumb, metadata, TOC, related documents, screenshot gallery, caption, thumbnail và lightbox giữ tỉ lệ ảnh.
- Tạo tài liệu từ template, import `.md` UTF-8 với mapping/preview và lựa chọn rõ ràng khi trùng ID.
- Tiptap WYSIWYG: headings, bold/italic, lists, tables, code, links, ảnh, blockquote callout; Markdown Source và Preview. Autosave Draft mỗi 15 giây khi có thay đổi; xác nhận khi rời editor còn thay đổi.
- Markdown round-trip được kiểm tra theo cấu trúc. Nội dung chưa hỗ trợ, chẳng hạn task lists hoặc syntax mở rộng, mở Source và khóa rich editor để giữ nguyên. Mermaid code blocks được giữ nguyên, preview strict mode. Không có chuyển đổi Mermaid phức tạp sang Vue Flow tự động.
- Upload PNG/JPEG/WebP qua magic bytes + Sharp: tối đa 10 MB/ảnh, 20 file/lần, 100 ảnh/100 MB/tài liệu, 40 megapixels và 16.000 px/chiều. Tên hash chống collision; Draft previews có xác thực. Cover, alt, caption và gallery ordering được lưu trong frontmatter.
- Publish thực sự: validation → immutable staging snapshot → VitePress build → Git commit → atomic active pointer. Lỗi validation/build giữ bản đang phục vụ.
- History, Markdown diff, Restore toàn bộ Markdown/ảnh/graph thành revision mới và Unpublish khỏi website/search/API.
- Vue Flow: custom semantic nodes, edges có nhãn, drag/connect/delete, inspector role/screen/function/rule IDs, zoom/pan/fit/minimap, 3 loại sơ đồ, summary bắt buộc; save JSON, export JSON/Mermaid và Mermaid preview.
- Export `.md` hoặc `.zip` giữ metadata, ảnh và graph JSON. ZIP import chưa hỗ trợ; import `.md` rồi upload attachments.
- Knowledge API có authentication và citations cho MCP/RAG tương lai. Trang integrations hiển thị rõ **chưa triển khai**.

## Cấu trúc và lưu trữ

```text
apps/api/src/               Fastify routes, auth, file/asset store, publish, Git
apps/mcp/                  Roadmap adapter read-only
packages/schemas/          Metadata, graph schema và contracts dùng chung
packages/ui/               Vue/Vuetify portal, Tiptap và Vue Flow
knowledge/published/       Canonical Published Markdown + assets + .vitepress
knowledge/drafts/<ID>/     Draft index.md, assets, diagrams, draft-meta.json
knowledge/staging/         Immutable releases: published/, dist/, manifest.json
knowledge/.knowledge-state/ active.json, manifest.json, audit.jsonl, history/.git
scripts/                   Seed, validate, derive sidebar/index, publish, backup
tests/                     Acceptance/security, round-trip và real build smoke
```

`screen/function/flow/rule/test/permission/module/overview/reference` có folder theo loại/module/ID; role dùng `roles/<ROLE_ID>/index.md`. Relative image paths `./assets/...` giữ nguyên giữa Draft/Published. Graphs lưu ở `diagrams/<DIA-ID>.graph.json`.

History dùng **Git repository riêng tại `.knowledge-state/history`**, không tự commit thay đổi code hoặc docs chưa commit của bạn vào repository project. Backup phải bao gồm Git history này. Markdown Published vẫn có thể được track cùng source code trong một Git remote private được phê duyệt.

Release pointer là nguồn xác định bản active cho cả API và static serving. `knowledge/published` là bản mirror để chỉnh/backup và phát triển với VitePress; restart sửa mirror từ release active nếu copy bị gián đoạn. Khi đã có active release, chỉnh file Published bằng tay cần quy trình vận hành riêng; dùng Studio để cập nhật bình thường. Generated manifest/index có thể tạo lại từ Markdown.

## Coder và production

Đặt repository và **toàn bộ `KNOWLEDGE_ROOT`** trên persistent volume của Workspace template; xác minh mount còn sau restart/recreate trước khi nhập business thật. Cần giữ cả `published`, `drafts`, `staging` và `.knowledge-state`; không dùng `/tmp` làm storage thực tế.

Local login cố ý chặn truy cập từ xa. Production dùng adapter trusted reverse proxy của tổ chức; project không cấu hình thay OIDC/Coder gateway của bạn:

```dotenv
NODE_ENV=production
AUTH_MODE=proxy
PROXY_SHARED_SECRET=<secret-ngau-nhien-it-nhat-32-ky-tu>
ALLOWED_ORIGIN=https://<authenticated-coder-app>
COOKIE_SECURE=true
API_HOST=0.0.0.0
API_PORT=3001
KNOWLEDGE_ROOT=/approved-persistent-volume/atlas/knowledge
```

Gateway phải xác thực người dùng và **xóa/ghi đè** các headers từ client trước khi chuyển tiếp:

| Header | Giá trị do gateway cung cấp |
| --- | --- |
| X-Atlas-Proxy-Secret | Secret khớp backend, chỉ trên mạng nội bộ |
| X-Atlas-User | Danh tính ASCII đã xác thực |
| X-Atlas-Role | Reader / Editor / Publisher / Admin do server-side mapping xác định |

Không mở trực tiếp API tới internet và không cho client tự đặt role. Chỉ gateway được kết nối backend. Coder app access phải là authenticated/organization được phê duyệt. Fastify phục vụ cả site + `/api`; không bật wildcard CORS. Ghi log không bao gồm password, cookie, secret hoặc payload tài liệu.

Một static build chung chỉ chứa **Published/Internal** và chỉ truy cập qua auth. Confidential/Restricted bị chặn Publish; phục vụ ACL riêng cần tách build hoặc thêm authorized server delivery. API không tin status/updated_at/path từ client; ID/project/type/module bất biến sau khi tạo. Di chuyển thư mục, bản dịch theo locale và ACL theo từng tài liệu chưa hỗ trợ trong MVP.

Markdown user không được chứa HTML/Vue expressions/components, kể cả sample có syntax đó trong code fences; URLs chỉ HTTP/HTTPS hoặc đường dẫn nội bộ hợp lệ. SVG/HTML uploads bị chặn. Symlink và path traversal bị từ chối. Publish kiểm tra related IDs, assets, graph references và internal Markdown URLs trước build.

**Chỉ chạy một process API ghi dữ liệu trên mỗi kho knowledge.** Publish queue và doc locks hiện nằm trong process; chưa hỗ trợ nhiều writer replicas. `scripts/publish-site.ts` dành cho operator có quyền filesystem và chỉ chạy khi API đã dừng. Mỗi release được giữ lại để recovery; chưa tự garbage-collect release/ảnh. Theo dõi dung lượng và thiết lập retention được tổ chức phê duyệt. Client đang mở nên reload sau publish để tải static bundles của release mới.

Khởi động sau restart bằng process supervisor/Coder startup command của template: `pnpm start` sau khi dependencies có sẵn, build ban đầu đã chạy và mount đúng `KNOWLEDGE_ROOT`. Không phụ thuộc terminal cá nhân. Không có Docker requirement.

## Backup và restore kho

Git local không bảo vệ khỏi mất nguyên workspace. Dừng writer trước khi tạo snapshot nhất quán:

```sh
pnpm backup /approved-external-backups/atlas
```

Script sao chép Published, Draft, assets, releases, pointer, audit và Git history sang thư mục ngoài source tree. Tổ chức quyết định encryption, retention, remote private và quyền truy cập backup. Không lưu backup thực tế trong cùng workspace bị xóa.

Để phục hồi: dừng API, copy snapshot về persistent directory, cấu hình `KNOWLEDGE_ROOT`, kiểm tra pointer và Git history, chạy `pnpm validate`, rồi `pnpm start`. Khôi phục một tài liệu riêng bằng History → Restore; thao tác này tạo commit mới, không rewrite lịch sử. Backup script dùng filesystem nên operator phải có quyền OS thích hợp.

## Kiểm tra

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build:web
pnpm test:e2e
```

Acceptance suite dùng **filesystem, ảnh và Git thật**, build callback thay thế để kiểm thử nhanh các lỗi và atomic activation. `test:e2e` chạy **VitePress build thật hai lần**, publish screenshot → authenticated URL → restart → unpublish; kho test riêng trong `.cache` và được dọn khi kết thúc.

Có thể tái tạo generated state bằng:

```sh
pnpm exec tsx scripts/generate-sidebar.ts
pnpm exec tsx scripts/rebuild-knowledge-index.ts
```

API đọc source Markdown trực tiếp; generated JSON không phải database/source of truth. Tests bao phủ bộ AT-001…AT-020 trong đặc tả theo các nhóm tương ứng, cùng CSRF, symlink, role boundary, immutable metadata và ZIP export. Browser QA dùng Playwright; screenshots kiểm tra được lưu trong `output/playwright/` và không track Git.

## API tiêu biểu

`GET /api/documents`, `/api/documents/:id`, `/related`, `/export.md`, `/export.zip`; `POST /api/documents`, `/import`, `/import/confirm`, `/:id/edit`, `/:id/assets`, `/:id/publish`, `/:id/unpublish`, `/:id/restore`; `GET/PUT /:id/draft`; `GET /:id/history`, `/diff`; `PUT /:id/draft-diagrams/:diagramId`; `GET /api/diagrams/:id`; `GET /api/knowledge/search`, `/api/knowledge/documents/:id`.

Write API yêu cầu identity hợp lệ, role phù hợp và `X-CSRF-Token` lấy từ `/api/auth/session`. Save/publish yêu cầu `base_revision`; stale revision trả 409. Responses dùng `{data, error}`; các lỗi thực sự được trả về UI. MCP roadmap ở [apps/mcp/README.md](apps/mcp/README.md).

Tham chiếu kỹ thuật: [VitePress custom themes](https://vitepress.dev/guide/custom-theme), [Tiptap Markdown](https://tiptap.dev/docs/editor/markdown), [Vue Flow](https://vueflow.dev/guide/), [Vuetify](https://vuetifyjs.com/en/getting-started/installation/).
