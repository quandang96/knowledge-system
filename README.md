# Atlas Business Knowledge Hub

Knowledge portal nội bộ bằng **Vue 3 + Vuetify 3 + VitePress + TypeScript**, dựa trên [đặc tả](docs/ATLAS_KNOWLEDGE_HUB_VIBE_CODING_SPEC.md). Giao diện mặc định tiếng Việt. Vuetify thay lớp Tailwind trong tài liệu theo yêu cầu của project.

Markdown, JSON và ảnh trên filesystem là nguồn dữ liệu chính. Không có database, localStorage document store, Docker hoặc AI backend.

**Dành cho người dùng:** [Hướng dẫn sử dụng Atlas](docs/HUONG_DAN_SU_DUNG.md).

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

### Editor, media và giao diện V3 (18/10/2026)

- Editor có CSS riêng; chèn ảnh tại con trỏ từ toolbar, paste, kéo thả hoặc thư viện của tài liệu. Có placeholder/progress thật, alt/caption, căn lề/kích thước giữ tỉ lệ, lỗi ảnh và retry.
- Reader/editor dùng canvas rộng; có thể ẩn danh sách nháp. Form thông thường dùng underlined; global search giữ kiểu riêng. Màu/icon semantic dùng chung trong theme.
- Mermaid render đúng vị trí trong bài và rich editor, có Source, loading/error, zoom/pan/reset/fullscreen; giữ strict mode. Vue Flow tiếp tục lưu graph JSON, undo/redo và semantic references.
- Save/review/publish/export và các trang dữ liệu có feedback theo request/job thật; không mất buffer mới khi response cũ về chậm.
- `image_layout` là frontmatter **tùy chọn** để giữ căn lề/chiều rộng ảnh asset; tài liệu cũ không cần migration. Caption vẫn là title của ảnh Markdown, không đưa HTML vào source.

Chi tiết file sửa, kiểm tra và ảnh trước/sau: [báo cáo V3](docs/ATLAS_V3_IMPLEMENTATION_2026-10-18.md). Các browser checks mới nằm trong `tests/e2e/*media*`, `mermaid-browser-smoke.js`, `async-browser-smoke.js`; dùng kho riêng qua `npm run test:browser:fixture`.

### Cải thiện workspace và quy trình nội dung (18/10/2026)

- Giao diện Bright UI V2.1 dùng Be Vietnam Pro tự phục vụ, chữ nội dung 16px, primary `#096FE8`, nền `#FAFCFF` và surface trắng. Theme chung ở `packages/ui/src/theme.ts`; CSS dùng semantic tokens từ Vuetify, bao gồm dialog/overlay.
- Dashboard tập trung tìm kiếm, nội dung gần cập nhật và việc cần xử lý; thư viện có phân trang server, lọc/sắp xếp theo URL và lựa chọn card/list. LocalStorage chỉ lưu lựa chọn project và dạng hiển thị theo người dùng, không lưu nội dung tài liệu.
- Tìm kiếm hỗ trợ tiếng Việt có/không dấu, ưu tiên ID và khớp tên; nhiều từ khóa cần cùng xuất hiện. API `/api/catalog` trả summary/pagination/facets; `/api/library` trả metadata dùng cho điều hướng. Các endpoint `/api/documents` cũ được giữ để tương thích.
- Admin quản lý tên workspace, project, phân hệ và template tại **Cấu hình không gian**. Project mới mặc định yêu cầu duyệt; project đã tồn tại được nhập vào registry với chính sách publish cũ. Muốn áp dụng duyệt cho project cũ, Admin bật **Yêu cầu người khác duyệt trước khi xuất bản**.
- Draft → Chờ duyệt → Đã duyệt/Cần chỉnh sửa. Người gửi cần một Publisher/Admin khác duyệt; approval gắn đúng revision và hết hiệu lực khi sửa tài liệu hoặc sơ đồ. Checklist kiểm tra mô tả, người phụ trách, cấu trúc, placeholder, nguồn và classification; người duyệt vẫn phải xác nhận tính đúng đắn nghiệp vụ.
- **Duyệt và xuất bản** cho phép đối chiếu bản đang phục vụ với bản gửi duyệt, chọn nhóm tài liệu trong cùng project và theo dõi job validation/build/activation. Hai tài liệu mới tham chiếu nhau có thể phát hành trong cùng nhóm. Lỗi giữ nguyên bản active.
- Bản nháp **dùng chung cho nhóm Editor/Publisher/Admin**. Bộ chọn project là ngữ cảnh/bộ lọc, không phải ranh giới bảo mật. Project membership và ACL theo tài liệu chưa có trong phiên bản này.
- Liên kết bằng **Tìm → Chọn → Lưu**; bộ chọn dùng chung cho quan hệ `related`, `implements`, `governed_by`, `navigates_to` và tham chiếu sơ đồ. Gõ `@` trong rich editor hoặc Markdown Source để chèn link theo ID bền vững; thao tác này không tự tạo quan hệ nghiệp vụ có kiểu. Backlinks và ảnh hưởng được tính từ index. `related_ids` cũ vẫn đọc được; khi lưu mới chỉ ghi danh sách chuẩn `relations` và để `related_ids` rỗng.
- Test Scenario/QA coverage đã ngừng là tính năng sản phẩm: không tạo/import/publish mới, không có menu, template hay KPI coverage. File và Git history cũ vẫn giữ; `/legacy/` cung cấp tra cứu/export có xác thực. Đường dẫn TC cũ hiển thị kho lưu trữ, không còn mở editor. Các engineering tests vẫn được giữ và chạy.
- Người đọc gửi góp ý trên trang tài liệu; nhóm biên tập xử lý trong trang Chất lượng. Các ngày hiệu lực/rà soát có thể đặt ở Studio. Diagram Studio có undo/redo cục bộ và picker tham chiếu theo loại.
- Save acknowledgment không thay buffer mới hơn khi response chậm. Khi còn thay đổi chưa lưu hoặc đang lưu/upload, UI bảo vệ chuyển trang/project; conflict giữ nội dung và cho xuất JSON recovery có metadata.
- Trang đọc render body và metadata từ cùng bản ghi API để tránh trộn nội dung static cũ với metadata mới. Mục lục dùng heading đã parse, có bản mobile. Nội dung Markdown vẫn bị chặn HTML/Vue như trước.

`workspace.json`, quyết định duyệt, góp ý và trạng thái jobs lưu trong `.knowledge-state/` và phải nằm trong backup. Tài liệu Published ghi người duyệt và revision nguồn trong metadata `verification`; client không tự đặt chứng thực này. Khi khôi phục lịch sử của project yêu cầu duyệt, Restore tạo Draft và cần duyệt lại trước khi phát hành.

API bổ sung: `GET/PUT /api/workspace`, `POST /api/documents/new`, `POST /api/documents/:docId/review`, `POST/GET /api/publish-jobs`, `GET /api/publish-jobs/:jobId`, `GET /api/quality`, `GET /api/documents/:docId/connections`, `POST /api/documents/:docId/feedback`, `GET /api/feedback`, `POST /api/feedback/:feedbackId/resolve`, `GET /api/operations` (Admin). V2.1 thêm `GET /api/knowledge/references` (Editor+, phân trang, giới hạn project của nguồn), `GET /api/legacy/documents[/:docId]` (chỉ đọc; draft yêu cầu Editor+) và đường ID bền vững `/document/?id=DOC-ID`. Không mở quyền draft cho Reader.

### Vận hành và kiểm tra bổ sung

API lấy writer lease cho mỗi `KNOWLEDGE_ROOT`: Windows dùng named pipe, Linux dùng loopback port dẫn xuất từ đường dẫn kho. Hệ điều hành nhả kênh lease khi process dừng hoặc bị kill; file `.knowledge-state/writer.lock` chỉ là thông tin chẩn đoán và có thể được phục hồi khi lấy lại được lease. Nếu kênh lease đang bận, API từ chối khởi động; trên Linux cần kiểm tra port được báo. Lease chỉ bảo vệ các process trên cùng host, không hỗ trợ nhiều writer từ nhiều host cùng mount persistent volume. Backup và retention cũng lấy lease nên phải dừng API trước khi chạy. Backup loại `writer.lock` khỏi snapshot.

```sh
npm run check:theme
npm run inventory:v21
npm run benchmark:search
npm run storage:retention -- --keep=20 --days=7
```

Retention mặc định **dry-run**, luôn giữ release active và ít nhất số bản mới nhất đã chọn; chỉ xem xét release cũ hơn khoảng ngày đã chọn. Sau khi kiểm tra danh sách, operator có thể thêm `--apply` để dọn. Không xóa Git history/Draft. Tác vụ này không tự chạy theo lịch.

Admin xem dung lượng trống, số release và p95 của tối đa 200 request catalog gần nhất tại Cấu hình không gian. Search dùng cache immutable theo release và lookup ID; chưa có distributed cache hoặc nhiều writer.

Benchmark tạo kho tổng hợp riêng trong `.cache`, không dùng nội dung nghiệp vụ thật và dọn fixture khi hoàn tất. Kết quả được lưu ở `.cache/benchmarks/latest.json`. Benchmark local đo Fastify inject + warm cache; không bao gồm network/browser và không chứng minh capacity production.

Browser regression cho response save chậm có thể lặp lại với Playwright CLI:

```sh
npm run test:browser:fixture
```

Lệnh tạo một kho tạm riêng, API port 3002 và web port 5174. Mở `http://127.0.0.1:5174/studio/?doc=REF-QA-AUTOSAVE`, đăng nhập `editor` / `qa-editor`, rồi chạy trong cùng Playwright CLI session:

```sh
npx --yes --package @playwright/cli playwright-cli -s=atlas-qa open "http://127.0.0.1:5174/studio/?doc=REF-QA-AUTOSAVE" --headed
# Đăng nhập editor trên browser session này trước khi chạy script.
npx --yes --package @playwright/cli playwright-cli -s=atlas-qa run-code --filename=tests/e2e/editor-browser-smoke.js
npx --yes --package @playwright/cli playwright-cli -s=atlas-qa run-code --filename=tests/e2e/links-browser-smoke.js
```

Script kiểm tra buffer Markdown, rich text và metadata dưới response chậm 2,5 giây; `tests/e2e/diagram-browser-smoke.js` kiểm tra add/undo/redo/save khi mở sơ đồ fixture; không dùng `@playwright/test`. Dừng fixture bằng Ctrl+C để nhả lease và dọn kho tạm. `ATLAS_API_TARGET` cho phép VitePress dev proxy trỏ sang API fixture; mặc định vẫn là port 3001.

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
