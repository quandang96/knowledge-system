# Atlas Business Knowledge Hub

Knowledge portal nội bộ bằng **Vue 3 + Vuetify 3 + VitePress + TypeScript**, dựa trên đặc tả nội bộ (`docs/ATLAS_KNOWLEDGE_HUB_VIBE_CODING_SPEC.md`, không đưa lên git). Giao diện mặc định tiếng Việt. Vuetify thay lớp Tailwind trong tài liệu theo yêu cầu của project.

Markdown, JSON và ảnh trên filesystem là nguồn dữ liệu chính. Không có database, localStorage document store hoặc AI backend.

**Tài liệu:** [Hướng dẫn sử dụng](packages/ui/src/help/HUONG_DAN_SU_DUNG.md) (cũng là trang **Hướng dẫn sử dụng** trong app). Tài liệu nội bộ `docs/CHUC_NANG_DA_TRIEN_KHAI.md` và `docs/VAN_HANH.md` không đưa lên git.

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
| publisher | atlas-publisher-2026 | Publisher: như Editor, thêm duyệt, publish, restore, unpublish (không có quyền cấu hình) |
| reader | atlas-reader-2026 | Reader: chỉ đọc Published |

Thay mật khẩu bằng biến môi trường trong `.env`. Local auth kiểm tra mật khẩu bằng scrypt, session ngẫu nhiên trong bộ nhớ, cookie HttpOnly/SameSite Strict và CSRF token. Restart API yêu cầu đăng nhập lại; tài liệu không mất. Business roles trong bài viết không phải quyền truy cập portal.

Chạy bản đã build, được Fastify bảo vệ cả HTML và bundles:

```sh
pnpm build:web
pnpm start
```

Mở **http://127.0.0.1:3001**. Trang `/login` không chứa nội dung business. Không phục vụ riêng `.vitepress/dist` bằng một public static server.

## Chia sẻ tạm thời qua Docker và Cloudflare

Cần Docker Desktop đang chạy. Copy `docker.env.example` thành `.env.docker`, rồi điền email được phép truy cập và bốn mật khẩu riêng, đủ mạnh. `CLOUDFLARE_ALLOWED_EMAILS` nhận một email hoặc nhiều email ngăn cách bằng dấu phẩy. Không dùng lại mật khẩu demo trong `.env.example`.

```powershell
Copy-Item docker.env.example .env.docker
# Sửa .env.docker trước khi chạy
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker logs -f cloudflared
```

Lấy URL `https://...trycloudflare.com` trong log và gửi cho các email đã khai báo. Người nhận xác thực email bằng mã một lần của Cloudflare, sau đó đăng nhập app bằng tài khoản `admin`, `editor`, `publisher` hoặc `reader` và mật khẩu tương ứng. `Publisher` và `Admin` có quyền xuất bản. Xem log ứng dụng bằng `docker compose --env-file .env.docker logs -f app`.

Volume Docker `knowledge` chứa `published`, `drafts`, `staging` và `.knowledge-state`; lần đầu được khởi tạo từ dữ liệu trong image. `docker compose --env-file .env.docker down` giữ volume, còn `down -v` xóa volume và dữ liệu. Hãy sao lưu volume riêng trước khi nâng cấp hoặc xóa máy. URL tạm đổi khi tunnel khởi động lại; theo [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/), cách này dành cho chia sẻ thử nghiệm. Triển khai lâu dài cần tunnel có tên/domain cố định và gateway xác thực production như [hướng dẫn vận hành](docs/VAN_HANH.md).

## Kiểm tra nhanh

```sh
pnpm typecheck && pnpm lint && pnpm test
```

Chi tiết E2E, browser fixture và production: [docs/VAN_HANH.md](docs/VAN_HANH.md).

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

## API tiêu biểu

Có alias có phiên bản `/api/v1/...` (tương đương `/api/...`) và hợp đồng OpenAPI cho các endpoint tri thức tại `GET /api/openapi.json` (cần đăng nhập). Định dạng code TypeScript: `pnpm format`. Nâng cấp front matter giữa các phiên bản: `pnpm migrate` (dry-run) / `pnpm migrate --apply` khi API đã dừng.

`GET /api/documents`, `/api/documents/:id`, `/related`, `/export.md`, `/export.zip`; `POST /api/documents`, `/import`, `/import/confirm`, `/:id/edit`, `/:id/assets`, `/:id/publish`, `/:id/unpublish`, `/:id/restore`; `GET/PUT /:id/draft`; `GET /:id/history`, `/diff`; `PUT /:id/draft-diagrams/:diagramId`; `GET /api/diagrams/:id`; `GET /api/knowledge/search`, `/api/knowledge/documents/:id`.

Write API yêu cầu identity hợp lệ, role phù hợp và `X-CSRF-Token` lấy từ `/api/auth/session`. Save/publish yêu cầu `base_revision`; stale revision trả 409. Responses dùng `{data, error}`; các lỗi thực sự được trả về UI. MCP roadmap ở [apps/mcp/README.md](apps/mcp/README.md).

Tham chiếu kỹ thuật: [VitePress custom themes](https://vitepress.dev/guide/custom-theme), [Tiptap Markdown](https://tiptap.dev/docs/editor/markdown), [Vue Flow](https://vueflow.dev/guide/), [Vuetify](https://vuetifyjs.com/en/getting-started/installation/).
