# Changelog

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
