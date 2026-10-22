// A draft starter, never an assertion that example business codes are approved.
export const functionConventionBody = `# Quy ước Function ID

## Cấu trúc ID

Mã nghiệp vụ có dạng AAAA-BBB-NNN: AAAA là bốn chữ in hoa thuộc nhóm nghiệp vụ, BBB là ba chữ in hoa thuộc loại màn hình/chức năng, NNN từ 001 đến 999. Backend cấp số trong từng project và cặp AAAA-BBB.

doc_id là khóa tài liệu ổn định. function_code là mã nghiệp vụ bổ sung, không đổi khi đổi tên hoặc menu. Giữ nguyên các ID legacy.

## Mã nhóm nghiệp vụ

Bảng sau là minh họa để owner cập nhật thành tài liệu chính thức, chưa phải bảng mã được tổ chức phê duyệt.

| Mã | Nhóm nghiệp vụ minh họa |
| --- | --- |
| TRAN | Transaction |
| BILL | Billing |

## Mã loại màn hình

| Mã | Loại minh họa |
| --- | --- |
| DET | Detail |
| CON | Contract |
| INQ | Inquiry |

Một Function có thể được nhiều Screen thực hiện thông qua quan hệ implements. Owner cần xác nhận bảng mã trước khi Admin bật cấp mã.

## Ví dụ

| Function ID minh họa | Diễn giải |
| --- | --- |
| TRAN-DET-001 | Transaction / Detail / 001 |
| TRAN-CON-001 | Transaction / Contract / 001 |
| TRAN-INQ-001 | Transaction / Inquiry / 001 |
| BILL-DET-001 | Billing / Detail / 001 |
| BILL-INQ-002 | Billing / Inquiry / 002 |

Các mã này chỉ minh họa cấu trúc, không phải Function ID đã được tổ chức phê duyệt.

## Ngoại lệ và chuyển đổi

Không đổi doc_id cũ như FUNC-APP-003. Chưa gắn Screen phải hiển thị rõ; không đoán mapping từ prefix hoặc hyperlink. Link nội dung lưu theo doc_id sau khi resolve mã nghiệp vụ.

## Nguồn quyết định

Owner ghi quyết định phê duyệt bảng mã, người chịu trách nhiệm và ngày hiệu lực trước khi gửi duyệt/xuất bản. Admin chọn đúng revision Published trong cấu hình cấp mã.
`
