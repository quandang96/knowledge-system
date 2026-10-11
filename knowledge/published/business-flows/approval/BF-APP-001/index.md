---
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
related_ids:
  - SCR-APP-001
  - ROLE-MANAGER
  - BR-014
  - TC-APP-001
tags:
  - demo
  - approval
updated_at: 2026-10-11T09:00:00+07:00
summary: Từ yêu cầu mới đến quyết định phê duyệt, với điều kiện và ngoại lệ rõ ràng.
source_links: []
---

# Quy trình phê duyệt yêu cầu

## Mục tiêu nghiệp vụ

Đảm bảo yêu cầu được người có thẩm quyền xem xét trong phạm vi dữ liệu được phép. Đây là quy trình demo.

## Tác nhân và trigger

Người quản lý phòng ban nhận một yêu cầu ở trạng thái Pending. Yêu cầu cần có đủ thông tin và được gán đúng phòng ban.

## Các bước xử lý

```mermaid
flowchart LR
  A[Nhận yêu cầu] --> B{Kiểm tra phạm vi}
  B -->|Hợp lệ| C[Phê duyệt]
  B -->|Không hợp lệ| D[Từ chối]
```

## Tóm tắt luồng

Tác nhân: ROLE-MANAGER. Trigger: yêu cầu chờ xử lý. Người quản lý mở SCR-APP-001 và kiểm tra BR-014. Nếu đúng phạm vi và đủ thông tin, thực hiện FUNC-APP-003 để chuyển sang Approved. Nếu không đủ điều kiện, từ chối và ghi lý do. Kết quả: một quyết định có thể truy vết.

## Ngoại lệ

- Yêu cầu đã được xử lý ở tab khác: tải lại trạng thái mới.
- Ngoài phạm vi phòng ban: không cho phép phê duyệt.
