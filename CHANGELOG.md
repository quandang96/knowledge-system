# Changelog

## 2026-10-23 — Dọn repo: ignore test/docs/playwright, xóa script chết

- `.gitignore`: untrack các file test/docs còn sót (`tests/api.test.ts`, `tests/markdown.test.ts`, `tests/e2e/publish-smoke.ts`, `docs/ATLAS_KNOWLEDGE_HUB_VIBE_CODING_SPEC.md`); giữ nguyên trên đĩa, chỉ bỏ khỏi git. `output/` ignore toàn bộ (trước chỉ `output/playwright/`).
- Chuyển 5 file liên quan Playwright ra khỏi `scripts/` vào `tests/e2e/` (đã ignore): `browser-v4-fixture.ts`, `check-navigation-browser.js`, `check-v4-browser.js`, `check-v4-media-errors-browser.js`, `check-v4-publish-browser.js`.
- Xóa script một lần đã hoàn tất và không còn gì đọc output của chúng: `generate-sidebar.ts`, `rebuild-knowledge-index.ts`, `inventory-v21.ts` (+ `output/v21-inventory*.json`), `prepare-v4.ts`. Bỏ `inventory:v21` và `prepare:v4` khỏi `package.json`.

## 2026-10-22 — Hoàn thiện gợi ý @

- `@` mở gợi ý cả sau dấu câu (`(@`, `“@`, `[@`), không chỉ sau dấu cách; vẫn không mở khi dính liền sau chữ/số (email).
- Nút **Liên kết trong nội dung** / **Liên kết tài liệu** chèn `@` tại con trỏ (tự thêm dấu cách nếu cần) và mở cùng danh sách gợi ý; **Tìm nâng cao** ở cuối danh sách mở hộp tìm kiếm đầy đủ và thay đúng đoạn `@...` đã gõ.
- Khung quan hệ trong Studio không còn gọi lại API sau mỗi phím gõ.
- Sửa đoạn mã thừa của ô upload Gallery cũ hiện ra ở đầu trang Bản nháp.

## 2026-10-22 — Gọn trang biên tập, gợi ý @ và sơ đồ Mermaid

- Gõ `@` mở danh sách gợi ý ngay dưới con trỏ (lọc theo key/tên, có dấu hoặc không dấu; ↑↓, Enter, Esc) trong cả Soạn thảo và Markdown Source (`mention.ts`, `MentionMenu.vue`). Hộp tìm kiếm đầy đủ vẫn mở bằng nút.
- Bỏ khối Gallery: ảnh chèn trực tiếp vào nội dung; ảnh đại diện ở danh mục lấy từ ảnh đầu tiên trong nội dung (cover cũ vẫn được ưu tiên). Tài liệu còn Gallery cũ có nút **Chèn vào nội dung**.
- Bỏ khối checklist riêng: nút **Gửi duyệt** hiện số mục còn thiếu và dialog liệt kê từng mục; lỗi checklist từ server (gửi hoặc duyệt) cũng liệt kê mục.
- Bỏ khối "Tài liệu liên quan và quan hệ nâng cao": quan hệ có kiểu chỉ hiện đúng chỗ (`relation-fields.ts`, `TypedRelationEditor.vue` thay `ScreenFunctionEditor.vue`): Screen có Chức năng và Điều hướng, Function có Quy tắc áp dụng. Liên kết "Liên quan" cũ nằm trong **Liên kết khác**.
- Mermaid: node bo góc, có bóng nhẹ, nhãn đường nối nằm trên nền viên thuốc nên không bị đường kẻ đè. Vẫn vẽ trong trình duyệt; không dùng VitePress để xuất HTML vì không đổi được giao diện.
- Sửa lỗi có từ trước: chữ gõ trong lúc đang tải ảnh có thể bị mất khi con trỏ nằm sau dòng "Đang tải ảnh…".
- Cập nhật script E2E (`links-`, `media-`, `media-errors-browser-smoke.js`) và fixture thêm `FUNC-QA-APPROVE`.

## 2026-10-22 — Dialog thông báo và snackbar

- Thêm dialog dùng chung (`dialog.ts`, `AppDialog.vue`) cho lỗi, cảnh báo và xác nhận; thay toàn bộ 10 hộp `window.confirm` của trình duyệt ở trang biên tập và sơ đồ. Các thao tác bị chặn vì còn thay đổi chưa lưu (đổi project, tạo tài liệu khác, đăng xuất) được thực hiện lại sau khi người dùng chọn **Bỏ thay đổi**.
- `notify()` chỉ dùng snackbar cho thao tác hoàn tất; thông tin, cảnh báo và lỗi (kể cả `fail()`) mở dialog. Lỗi đăng nhập, lỗi tạo tài liệu, lỗi lưu cấu hình và lỗi tải ảnh (có nút **Thử tải lại**) chuyển từ banner trong trang sang dialog.
- Thêm snackbar khi lưu bản nháp thủ công (autosave vẫn im lặng), xử lý góp ý, tạo bản nháp từ bộ chọn liên kết và chuẩn bị bản nháp quy ước Function ID (giờ mở Studio tại chỗ thay vì tải lại toàn trang).
- Giữ dạng banner cho trạng thái cố định của trang: thông báo quyền/chính sách, cảnh báo gắn với một khối nội dung và lỗi tải danh sách có nút **Thử lại** ngay tại vùng bị lỗi.

## 2026-10-22 — Rà soát giao diện từng màn hình

- Menu: bỏ nhóm thu gọn "Nâng cao", thay bằng nhóm **Quản lý** luôn mở; mỗi mục có ô icon màu cùng kích thước (Vuetify ghi kích thước inline nên icon được đặt trong ô riêng). Thanh bên gọn lại để hiện đủ mục trong cửa sổ cao 900px.
- Ô nhập dạng gạch chân không còn nền trắng trên nền màu (ô "Loại liên kết", bộ lọc danh mục); nút "Liên kết chức năng" và "Chuẩn bị bản nháp quy ước" cùng tông primary với các nút liên kết khác.
- Trang tài liệu: bảng Markdown ôm vừa nội dung (viền không còn chạy quá cột cuối), bỏ đường kẻ đôi quanh mục lục, thẻ tài liệu liên quan xếp lưới với icon màu thống nhất; icon ở "Điểm bắt đầu" không còn bị tô xám.
- Bộ lọc Thư viện/Màn hình có nhãn như trang Function ID; toolbar sơ đồ thẳng hàng; panel quy ước có khung bo góc; tiêu đề "Cấu hình không gian" khớp tên menu; bỏ các eyebrow viết hoa toàn bộ; Legacy không còn viền thừa phía trên.
- Điện thoại: bảng cuộn ngang thay vì bóp cột thành từng chữ; đầu trang Studio không ngắt đôi mã tài liệu.
- Nút Đăng nhập không còn bị khóa khi trường trống, để trình duyệt tự điền vẫn đăng nhập được.

## 2026-10-22 — Menu, tạo tài liệu và trạng thái tải

- Thanh bên chia **Tra cứu / Biên tập / Nâng cao** theo quyền, có nút **Tạo tài liệu** và Hướng dẫn ở cuối; Reader chỉ thấy phần Tra cứu.
- Tạo tài liệu bằng hộp thoại dùng chung mở ngay tại trang hiện tại (`CreateDocumentDialog.vue`): kiểm tra trường ngay dưới ô nhập, Document ID/Ngôn ngữ chuyển vào Tùy chọn nâng cao, ID tự viết hoa; bản nháp mới mở trong Studio không cần tải lại. Trong Studio, tài liệu được mở tại chỗ. Liên kết cũ `/studio/?new=<type>` vẫn mở hộp thoại.
- Thanh tiến trình khi chuyển trang, skeleton khi màn hình đang tải (thay vì vùng trống), tải trước các màn hình hay dùng; footer không còn nhảy và bề rộng trang không đổi khi xuất hiện thanh cuộn. Sửa skeleton bị tô màu xanh đậm.
- Đăng nhập sai không còn làm form biến mất rồi hiện lại; thanh danh mục hiển thị "Đang tải…" thay vì "0 tài liệu".

## 2026-10-22 — Cải thiện vận hành và khả năng mở rộng

- Rate limit theo người dùng thay vì IP (sau gateway mọi request cùng IP); thêm tài khoản demo `publisher`; bỏ `tests/*` và `docs` khỏi `.gitignore`; thêm CI (format, typecheck, lint, test, build).
- Cache bản nháp theo chữ ký file (mtime/size) nên list/quality/reference không parse lại draft chưa đổi; draft có thêm `editor` (người lưu cuối).
- Registry loại tài liệu duy nhất (`packages/schemas/src/document-types.ts`) thay cho 6 bảng rải rác; tách cấp Function ID ra `function-codes.ts`.
- Trang **Hướng dẫn sử dụng** (`/help/`) trong ứng dụng, panel **Việc của tôi** ở Tổng quan, và cảnh báo khi người khác đang mở cùng bản nháp.
- Khung migration có phiên bản (`schema_version`, `pnpm migrate`), alias `/api/v1/...` và hợp đồng OpenAPI tại `/api/openapi.json`.
- Thêm Prettier cho file TypeScript (`pnpm format`, `pnpm format:check`).

## 2026-10-18 — Editor, Media và UI V3

- Tách style Tiptap, chèn ảnh tại con trỏ với placeholder được map theo transaction; thêm paste, thư viện, progress thật, alt/caption, layout ảnh và fallback/retry.
- Mở rộng reader/editor, TOC thu gọn, underlined controls và semantic icon/color tokens.
- Mermaid dùng một renderer strict cho reader/preview/rich/Vue Flow; zoom/pan/fullscreen, loading/error/source và bảo vệ render đến muộn. Node mới không chồng lên node cũ.
- Thêm skeleton/loading/error cho dữ liệu, export và publish job; giữ revision/conflict, protected assets, legacy read-only và Markdown + Git.
- Thêm `image_layout` tùy chọn tương thích ngược; 66 tests/10 files và 28 cặp contrast đạt. Chi tiết: [báo cáo V3](docs/ATLAS_V3_IMPLEMENTATION_2026-10-18.md).

## 2026-10-18 — Sửa input và floating label

- Bỏ giá trị `12px` gán sai vào `--v-field-label-scale`: animation focus/blur của Vuetify đọc thành `scale(12)`. Giữ scale mặc định 0,75, đặt chữ trong ô 16px và label nổi 12px.
- Giữ bo góc 8px bằng CSS để notch không dùng hình học của ô dạng viên thuốc; label nổi và nội dung nhập thẳng hàng. Ngăn input bị kéo cao theo textarea hoặc thông báo validation bên cạnh.
- Kiểm tra trình duyệt bằng `tests/e2e/input-browser-smoke.js`: 9 trường hợp desktop, 4 trường hợp mobile, dialog, reduced motion, focus/blur theo từng frame, nhập/xóa và chọn giá trị đều đạt. Đã kiểm tra thêm form Cấu hình thực tế; typecheck, lint và build production thành công.

## 2026-10-18 — Atlas V2.1 Bright UI

- Thêm bộ chọn tài liệu dùng chung: tìm kiếm, phân trang, multi-select, keyboard, summary preview và tạo Draft từ empty state.
- Thêm inline `@` cho rich editor/Markdown Source và stable ID resolver; tự tính backlinks từ metadata, nội dung và graph.
- Chuẩn hóa ghi `relations`, giữ adapter đọc `related_ids`, revision checks và atomic changeset validation.
- Ngừng tạo/chỉnh sửa/publish Test Scenario; bỏ coverage trong sản phẩm. Giữ legacy đọc/export có xác thực và tombstone đường cũ, không xóa dữ liệu.
- Áp dụng Bright Blue/Clean White, chuẩn hóa control/overlay states và các cặp màu đạt tương phản.
- Thêm inventory/runbook, regression về legacy/link/project scope, browser link tests; giữ engineering tests hiện có.

Chi tiết: [báo cáo triển khai](docs/ATLAS_V21_IMPLEMENTATION_2026-10-18.md), [migration/rollback](docs/ATLAS_V21_MIGRATION_RUNBOOK_2026-10-18.md).
