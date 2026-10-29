---
schema_version: 1
doc_id: BF-APP-001
project_id: demo-project
type: business-flow
module: approval
title: Quy trình phê duyệt yêu cầu
language: vi
status: published
classification: internal
owner: BA Demo Team
version: 1.0.0
related_ids: []
tags:
  - demo
  - approval
relations:
  - target_id: SCR-APP-001
    kind: related
  - target_id: ROLE-MANAGER
    kind: related
  - target_id: BR-014
    kind: related
updated_at: 2026-10-29T15:24:41.204Z
summary: Từ yêu cầu mới đến quyết định phê duyệt, với điều kiện và ngoại lệ rõ ràng.
source_links: []
---

# Thư viện Markdown + HTML Blocks

Tài liệu mẫu kết hợp Markdown và các thẻ HTML thuần để xây dựng tài liệu kỹ thuật/nghiệp vụ. Các khối `<details>` và `<summary>` **mở/đóng được mà không cần JavaScript**.

> **Cấu trúc tệp:** `markdown_html_blocks.md` (nội dung), `markdown_html_blocks.css` (giao diện), `markdown_html_blocks.js` (tùy chọn: chỉ cho nhóm accordion mở một mục tại một thời điểm). Không có JavaScript nhúng trong file Markdown.

## 1. Markdown thông dụng

**Chữ đậm**, *chữ nghiêng*, ~~gạch ngang~~, `mã inline` và [liên kết](https://example.com).

- Danh sách không thứ tự
- Nội dung tiếp theo

1. Bước thứ nhất
2. Bước thứ hai

> **Lưu ý:** Đây là blockquote Markdown, không cần HTML.

```text
Đây là fenced code block.
Bạn có thể đổi text thành json, html, sql, bash, ...
```

## 2. Details / Summary cơ bản

Bấm dòng tiêu đề để mở hoặc đóng nội dung. Hoạt động bằng HTML thuần.

<details class="atlas-expand">
  <summary>Xem thông tin chi tiết</summary>
  <div class="atlas-expand-body">
    <p>Đây là nội dung được ẩn mặc định.</p>
    <ul>
      <li>Có thể chứa văn bản.</li>
      <li>Có thể chứa danh sách và <strong>HTML</strong>.</li>
    </ul>
  </div>
</details>

## 3. Details mở sẵn với `open`

<details class="atlas-expand" open>
  <summary>Thông tin quan trọng (mở mặc định)</summary>
  <div class="atlas-expand-body">
    <p>Thuộc tính <code>open</code> giúp khối hiển thị nội dung ngay khi tải trang.</p>
  </div>
</details>

## 4. Details lồng nhau

<details class="atlas-expand">
  <summary>Module Transaction</summary>
  <div class="atlas-expand-body">
    <p>Các chức năng của module:</p>
    <details class="atlas-expand">
      <summary>TRAN-DET-001 — Chi tiết giao dịch</summary>
      <div class="atlas-expand-body">
        <p>Hiển thị trạng thái, số tiền và lịch sử cập nhật của giao dịch.</p>
      </div>
    </details>
    <details class="atlas-expand">
      <summary>TRAN-INQ-002 — Tra cứu giao dịch</summary>
      <div class="atlas-expand-body">
        <p>Lọc, tìm kiếm và xem danh sách giao dịch.</p>
      </div>
    </details>
  </div>
</details>

## 5. FAQ với Details / Summary

<details class="atlas-expand">
  <summary>Markdown có hỗ trợ HTML không?</summary>
  <div class="atlas-expand-body">
    <p>Có, nếu trình render cho phép HTML. Một số nơi sẽ lọc thuộc tính hoặc thẻ vì lý do an toàn.</p>
  </div>
</details>

<details class="atlas-expand">
  <summary>Thẻ details có cần JavaScript không?</summary>
  <div class="atlas-expand-body">
    <p>Không. Trình duyệt hỗ trợ đóng/mở bằng hành vi mặc định của HTML.</p>
  </div>
</details>

## 6. Accordion — mở một mục tại một thời điểm

Nhóm bên dưới dùng thuộc tính <code>data-exclusive</code>. **Không có JavaScript:** từng mục vẫn mở/đóng bình thường. **Có JavaScript ngoài:** mở mục mới sẽ tự đóng mục khác trong cùng nhóm.

<div>
  <details class="atlas-expand">
    <summary>Bước 1 — Kiểm tra dữ liệu</summary>
    <div class="atlas-expand-body"><p>Đảm bảo các trường bắt buộc hợp lệ.</p></div>
  </details>
  <details class="atlas-expand">
    <summary>Bước 2 — Xử lý nghiệp vụ</summary>
    <div class="atlas-expand-body"><p>Áp dụng quy tắc và ghi lại kết quả xử lý.</p></div>
  </details>
  <details class="atlas-expand">
    <summary>Bước 3 — Phản hồi</summary>
    <div class="atlas-expand-body"><p>Trả trạng thái và thông tin cho người dùng.</p></div>
  </details>
</div>

## 7. Các loại thông báo HTML

<div class="atlas-panel atlas-panel--info">
  <strong>Thông tin</strong>
  <p>Ghi chú về chức năng hoặc quy định sử dụng.</p>
</div>

<div class="atlas-panel atlas-panel--warning">
  <strong>Cảnh báo</strong>
  <p>Kiểm tra lại dữ liệu trước khi thực hiện thao tác.</p>
</div>

<div class="atlas-panel atlas-panel--tip">
  <strong>Thành công</strong>
  <p>Thao tác đã được hoàn tất.</p>
</div>

<div class="atlas-panel atlas-panel--danger">
  <strong>Lỗi</strong>
  <p>Không thể tiếp tục nếu dữ liệu không hợp lệ.</p>
</div>

## 8. Khối mô tả màn hình nghiệp vụ

<section>
  <h3>Transaction Detail</h3>
  <p><strong>Function ID:</strong> <code>TRAN-DET-001</code></p>
  <p><strong>Mục đích:</strong> Xem chi tiết một giao dịch.</p>
  <p><strong>Đầu vào:</strong> Transaction ID.</p>
  <p><strong>Đầu ra:</strong> Thông tin giao dịch và lịch sử trạng thái.</p>
  <details class="atlas-expand">
    <summary>Xem quy tắc nghiệp vụ</summary>
    <div class="atlas-expand-body">
      <ol>
        <li>Chỉ hiển thị giao dịch mà người dùng được phép truy cập.</li>
        <li>Ghi rõ trạng thái hiện tại và thời điểm cập nhật.</li>
        <li>Hiển thị thông báo phù hợp khi không tìm thấy giao dịch.</li>
      </ol>
    </div>
  </details>
</section>

## 9. Bảng Markdown và HTML

| Function ID | Màn hình | Trạng thái |
|:--|:--|:--|
| `TRAN-DET-001` | Chi tiết giao dịch | Hoạt động |
| `BILL-INQ-002` | Tra cứu hóa đơn | Phát triển |

<table>
  <thead><tr><th>Thuộc tính</th><th>Ý nghĩa</th><th>Bắt buộc</th></tr></thead>
  <tbody>
    <tr><td><code>transactionId</code></td><td>Mã giao dịch</td><td>Có</td></tr>
    <tr><td><code>status</code></td><td>Trạng thái</td><td>Không</td></tr>
  </tbody>
</table>

## 10. Code block và HTML block khác nhau như thế nào?

**Code block:** chỉ hiển thị mã nguồn, không thực thi/render HTML.

```html
<details>
  <summary>Tiêu đề</summary>
  <p>Nội dung</p>
</details>
```

**HTML block:** thẻ bên dưới được render trực tiếp khi trình đọc Markdown cho phép HTML.

<details>
  <summary>Ví dụ HTML thuần không CSS</summary>
  <p>Không phụ thuộc stylesheet và không cần JavaScript.</p>
</details>

---

## Sử dụng và tương thích

- **Chỉ cần Markdown:** `<details>` / `<summary>` vẫn hoạt động khi môi trường cho phép HTML; không cần import CSS hoặc JavaScript.
- **Muốn có giao diện đẹp:** tải `markdown_html_blocks.css` vào stylesheet của website/VitePress.
- **Muốn accordion tự đóng mục cũ:** tải `markdown_html_blocks.js` từ phần thiết lập website/theme (không nhúng script vào Markdown). File này hoàn toàn tùy chọn.
- **VitePress:** có thể import CSS/JS trong `docs/.vitepress/theme/index.ts` thay vì viết script trong tài liệu.
- **GitHub:** hỗ trợ phần lớn thẻ `<details>` / `<summary>`, nhưng không cho chạy JavaScript tùy ý hoặc tự tải stylesheet riêng từ file Markdown; các class CSS tùy chỉnh có thể không có tác dụng.
- **Lưu ý:** không phải mọi Markdown renderer đều xử lý Markdown nằm bên trong thẻ HTML như nhau. Các mẫu ở trên dùng HTML đầy đủ bên trong các block để tránh khác biệt đó.
