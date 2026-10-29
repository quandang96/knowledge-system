---
name: atlas-markdown-authoring
description: Use when writing, generating, converting or importing Markdown documents for Atlas (knowledge-system) - business flows, screens, functions, business rules - especially when the content needs HTML, callouts, collapsible sections, columns, status badges, tables, images or links, or when a save fails with "HTML có thể chạy mã hoặc giả giao diện nên bị chặn", "URL trong Markdown không an toàn", "Chỉ hỗ trợ URL HTTP/HTTPS" or "Không được tham chiếu ngoài kho tài liệu".
---

# Viết Markdown/HTML cho Atlas

## Tổng quan

Atlas render tài liệu bằng **markdown-it (`html: true`) + block Atlas `:::`**, rồi lọc HTML **hai lớp**:

1. **API** (`apps/api/src/services/html.ts`, `markdown.ts`): khi **lưu**, HTML nguy hiểm hoặc URL xấu làm **lỗi 400**; khi **import**, chúng bị tự xóa và báo cảnh báo. Thuộc tính/class/CSS không hỗ trợ thì **bị bỏ âm thầm** (không lỗi).
2. **Trình duyệt** (DOMPurify trong `packages/ui/src/atlas-markdown.ts`): lọc lại lần nữa theo cùng chính sách `packages/schemas/src/html-policy.ts`.

**Nguyên tắc:** Markdown thuần trước → block Atlas `:::` → HTML chỉ khi hai cách trên không làm được. HTML càng ít thì càng ít thứ bị lọc mất.

## Chọn cú pháp theo nhu cầu

| Cần | Dùng | Không dùng |
|---|---|---|
| Đậm, nghiêng, gạch, code, danh sách, trích dẫn | Markdown: `**` `*` `~~` `` ` `` `-` `1.` `>` | `<b>`, `<i>`, `<ul>` viết tay |
| Hộp thông tin / cảnh báo | `::: info`, `note`, `tip`, `warning`, `danger` | `<div class="doc-callout">`, `<div style="border…">` |
| Nội dung thu gọn | `::: expand Tiêu đề` | `<details>` (chỉ dùng khi bắt buộc HTML) |
| Hai cột | `:::: columns` + `::: column` | `<div style="display:flex">` (bị bỏ CSS) |
| Nhãn trạng thái | `:status[Đã duyệt]{green}` | `<span style="background…">` |
| Bảng | Bảng Markdown | `<table>` (chỉ khi cần `colspan`/`rowspan`) |
| Sơ đồ | Code fence ` ```mermaid ` | `<svg>`, ảnh sơ đồ nhúng base64 |
| Ảnh | `![Mô tả](./assets/ten-anh.png)` | `<img src="./assets/…">`, `data:` |
| Link tài liệu khác | `[Tên](/document/?id=BF-APP-001)` | `../folder/index.md` |
| Chữ màu / căn giữa | `<span style="color: #c62828">` / `<p style="text-align: center">` | `<font>`, `<center>`, `<strong style>` |
| Phím tắt, chỉ số, viết tắt | `<kbd>`, `<sub>`, `<sup>`, `<mark>`, `<abbr title>` | — |

## Frontmatter (YAML bắt buộc ở đầu file)

```yaml
---
doc_id: BF-APP-002          # CHỮ HOA-SỐ, có ít nhất một dấu '-', ≤ 80 ký tự
project_id: demo-project    # chữ thường, số, '-'
type: business-flow         # overview | business-flow | module | screen | function | role | permission | business-rule | reference (không dùng test-scenario: legacy)
module: approval            # chữ thường, số, '-'
title: Quy trình phê duyệt  # 1–180 ký tự — đây là tiêu đề hiển thị
owner: BA Team
language: vi                # vi | ja | en
status: draft               # draft | published
version: 1.0.0              # x.y.z
summary: Một câu tóm tắt.   # ≤ 1000 ký tự
tags: [approval]
related_ids: []
---
```

- `function_code` (nếu có): dạng `AAAA-BBB-001` (4 chữ hoa – 3 chữ hoa – 001…999).
- Ngày (`review_due_at`, `effective_from`): `YYYY-MM-DD`. `source_links[].url` phải là `http(s)://`.
- Không thêm khóa lạ: schema là `strict`, khóa không có trong `packages/schemas/src/index.ts` sẽ làm lỗi.

## Cấu trúc thân tài liệu

- **Không viết `# H1`**: trang tài liệu ẩn mọi H1, tiêu đề lấy từ `title` trong frontmatter.
- Mục chính dùng `##`, mục con `###`. **Mục lục chỉ lấy `##`/`###` Markdown** — `<h2>` viết bằng HTML không vào mục lục; `{#id}` không được hỗ trợ.
- Dùng đúng thứ tự mục theo loại tài liệu (`sections` trong `packages/schemas/src/document-types.ts`), ví dụ `business-flow`: Mục tiêu nghiệp vụ → Tác nhân → Trigger và điều kiện → Các bước xử lý → Kết quả → Ngoại lệ. Loại không khai báo: Tổng quan → Nội dung → Tài liệu liên quan.
- Thân tài liệu ≤ 2 MB, không chứa byte `\0`.

## Block Atlas

```markdown
::: warning Kiểm tra dữ liệu trước khi duyệt
Nội dung panel. **Markdown** dùng được bên trong.
:::

:::: expand Xem quy tắc chi tiết
::: tip
Block lồng bên trong.
:::
::::

:::: columns
::: column
Cột trái
:::
::: column
Cột phải
:::
::::

Trạng thái: :status[Đã duyệt]{green}
```

- Loại panel: `info`, `note`, `tip`, `warning`, `danger`. Bỏ trống tiêu đề thì dùng nhãn mặc định (Thông tin, Ghi chú, Mẹo, Cảnh báo, Nguy hiểm, Xem thêm).
- **Block ngoài phải có NHIỀU dấu `:` hơn block trong** (`::::` bọc `:::`, `:::::` bọc `::::`). Cùng số dấu → block đóng sai chỗ và lộ dòng `:::` thừa.
- `:status[...]`: chữ 1–40 ký tự, không xuống dòng, không chứa `[`. Màu: `grey`, `blue`, `green`, `yellow`, `red`, `purple`; màu khác thành `grey`.
- Trong danh sách, thụt block theo nội dung của mục (2 dấu cách cho `- `).

## Link và ảnh

| Hợp lệ | Bị chặn khi lưu (lỗi) |
|---|---|
| `https://…`, `http://…` | `javascript:`, `data:`, `vbscript:`, `file:` |
| `/document/?id=DOC-ID` (link tài liệu nội bộ) | `mailto:`, `tel:`, mọi scheme khác ngoài http(s) |
| `./assets/ten-file.png` (`.png`, `.jpg`, `.webp`; tên chữ thường, số, `-`) | `../…` (ra ngoài kho), `//host/…`, `C:\…`, chứa `\` |
| | `https://user:pass@host` |

- Ảnh dùng **cú pháp Markdown** `![alt](./assets/…)`; luôn có `alt` mô tả. Chỉ cú pháp Markdown mới được Atlas đổi sang URL thật của asset — `<img src="./assets/…">` có thể không hiện.
- Ảnh `./assets/…` phải được tải lên trước khi Publish.

## HTML: chính sách chi tiết

### Thẻ làm LỖI khi lưu (import thì bị xóa)

- Bị xóa **cả nội dung bên trong**: `script`, `style`, `iframe`, `frame`, `frameset`, `object`, `embed`, `applet`, `portal`, `svg`, `math`, `template`, `textarea`, `noscript`, `noembed`, `noframes`, `title`, `select`, `xmp`, `plaintext`, `head`, `link`, `meta`, `base`.
- Bị xóa thẻ, giữ chữ: `form`, `input`, `button`, `option`, `optgroup`, `datalist`, `dialog`, `param`.
- Thuộc tính sự kiện `on…` (`onclick`, `onerror`…), `href`/`src` có URL không hợp lệ (bảng trên).

### Thẻ an toàn nên dùng

`p`, `div`, `section`, `span`, `strong`, `em`, `code`, `pre`, `br`, `hr`, `ul`, `ol`, `li`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `details`, `summary`, `blockquote`, `img`, `a`, `kbd`, `sub`, `sup`, `mark`, `abbr`, `small`, `dl`, `dt`, `dd`. Thẻ tự đặt (`<my-box>`) lưu được nhưng trình duyệt bỏ thẻ — đừng dùng.

### Thuộc tính được giữ (mọi thứ khác bị bỏ âm thầm)

| Thẻ | Thuộc tính |
|---|---|
| Mọi thẻ | `class` (chỉ tên `atlas-…`), `title`, `lang`, `dir` |
| `a` | `href`, `target` (`_blank` hoặc `_self`; `rel` do Atlas tự đặt) |
| `img` | `src`, `alt`, `width`, `height` (chỉ số hoặc `%`: `300`, `50%` — **không** `300px`) |
| `td`, `th` | `colspan`, `rowspan` (số), `align` (`left`/`center`/`right`), `style` |
| `details` | `open` |
| `p`, `div`, `section`, `span`, `mark`, `h1`–`h6` | `style` |

Bị bỏ: `id`, mọi `data-*`, `style` trên thẻ khác bảng trên (ví dụ `<strong style>`, `<li style>`, `<table style>`), `width` trên `td`.

### CSS trong `style` (khai báo khác bị bỏ, phần hợp lệ được giữ)

| Thuộc tính | Giá trị chấp nhận |
|---|---|
| `color`, `background-color` | `#rgb`, `#rrggbb`, `rgb()`, `rgba()`, tên màu (`red`). **Không** `hsl()`, `var()`, `#rrggbbaa` |
| `text-align` | `left`, `center`, `right`, `justify` |
| `font-weight` | `normal`, `bold`, `100`–`900` |
| `font-style` | `normal`, `italic` |
| `text-decoration` | `none`, `underline`, `line-through` |
| `vertical-align` | `top`, `middle`, `bottom` |
| `font-size` | `10px`–`72px`, `0.75`–`4` `em`/`rem`, `75%`–`400%`, `small`…`xx-large` |

Không có: `display`, `position`, `margin`, `padding`, `border`, `width`, `flex`, `grid`, `float`… → bố cục dùng block Atlas, không dùng CSS.

### Class

Chỉ giữ class bắt đầu `atlas-`. Class có giao diện thật: `atlas-panel` + `atlas-panel--info|note|tip|warning|danger`, `atlas-panel-title`, `atlas-panel-body`, `atlas-expand`, `atlas-expand-body`, `atlas-columns`, `atlas-column`, `atlas-status` + `atlas-status--<màu>`. Ưu tiên cú pháp `:::` thay vì tự viết các class này.

Chuyển đổi tự động khi import: `<font color>` → `<span style="color">`, `<center>`/`align=` → `text-align`, `doc-callout--info|note|tip|warning|danger` → panel tương ứng (`--success` → `tip`), `doc-details` → `atlas-expand`, `doc-details__body` → `atlas-expand-body`.

## Bẫy của markdown-it (lỗi hiển thị, không báo lỗi)

1. **Markdown bên trong thẻ HTML chỉ được render khi cách bằng dòng trống.**
   ```markdown
   <details>
   <summary>Tiêu đề</summary>

   - Mục **đậm** sẽ render đúng

   </details>
   ```
   Không có dòng trống → `**đậm**` hiện nguyên văn.
2. **Khối HTML kéo dài tới dòng trống tiếp theo.** Luôn để một dòng trống trước và sau khối HTML; dòng văn bản dính ngay sau `</div>` bị nuốt thành HTML thô.
3. **Thụt 4 dấu cách = code block.** Không thụt khối HTML cấp ngoài cùng ≥ 4 dấu cách.
4. **Dấu `|` trong ô bảng phải viết `\|`**, kể cả trong `` `code` `` — nếu không, ô bị tách đôi.
5. `{{ }}` an toàn, hiển thị nguyên văn. Comment `<!-- -->` không hiện với người đọc — không đặt nội dung cần đọc trong comment.
6. Code fence luôn ghi ngôn ngữ (` ```json `, ` ```sql `, ` ```mermaid `). HTML minh họa phải nằm trong ` ```html ` để hiển thị mã chứ không render.

## Kiểm tra trước khi trả kết quả

- [ ] Frontmatter đủ `doc_id`, `project_id`, `type`, `module`, `title`, `owner`, đúng định dạng, không khóa lạ
- [ ] Không có `# H1`; mục dùng `##`/`###` đúng thứ tự theo loại tài liệu
- [ ] Không có thẻ trong danh sách bị chặn, không có `on…=`, không có URL ngoài `http(s)`, `/document/?id=`, `./assets/`
- [ ] Block `:::` lồng nhau: ngoài nhiều dấu `:` hơn trong; mỗi block đều được đóng
- [ ] Mọi `class` đều là `atlas-…`; `style` chỉ đặt trên thẻ được phép, chỉ dùng thuộc tính CSS trong bảng
- [ ] Có dòng trống quanh mọi khối HTML và giữa thẻ HTML với Markdown bên trong
- [ ] Ảnh dùng `![alt](./assets/…)`, `|` trong bảng đã escape

Kiểm chứng chắc chắn: chạy nội dung qua `validateBody` (lưu) hoặc `sanitizeBody` (import) trong `apps/api/src/services/markdown.ts` — `removed` rỗng và `converted` rỗng (hoặc chỉ có `rel`, do Atlas tự thêm cho `target="_blank"`) nghĩa là không có gì bị lọc.

## Lỗi thường gặp

| Viết | Hậu quả | Sửa |
|---|---|---|
| `<div class="doc-card">` | Class bị bỏ, mất giao diện | `::: info Tiêu đề` |
| `<div style="display:flex">` | CSS bị bỏ, không thành cột | `:::: columns` / `::: column` |
| `<strong style="color:red">` | Mất màu | `<span style="color: red"><strong>…</strong></span>` |
| `::: expand` bọc `::: info` | Đóng sai, lộ `:::` | `:::: expand` bọc `::: info` |
| `<a href="mailto:…">` | Lỗi khi lưu | Ghi email dạng text hoặc `` `ten@congty.vn` `` |
| `[Xem](../BF-APP-001/index.md)` | Lỗi khi lưu | `[Xem](/document/?id=BF-APP-001)` |
| `<img width="300px">` | Mất kích thước | `width="300"` hoặc `width="50%"` |
| `<button>`, `<input>` để mô tả UI | Lỗi khi lưu | Mô tả bằng chữ: **[Lưu]**, `<kbd>Enter</kbd>` hoặc ảnh chụp màn hình |
| `<svg>` / ảnh `data:` | Lỗi khi lưu | ` ```mermaid ` hoặc file trong `./assets/` |
| `data-exclusive`, `id="…"` | Bị bỏ âm thầm | Không dựa vào thuộc tính này |
