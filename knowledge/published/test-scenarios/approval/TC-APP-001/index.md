---
doc_id: TC-APP-001
project_id: demo-project
type: test-scenario
module: approval
title: Kiểm thử quyền phê duyệt
language: vi
status: published
classification: internal
owner: BA Demo Team
version: 1.0.0
related_ids:
  - BR-014
  - FUNC-APP-003
  - SCR-APP-001
tags:
  - demo
  - approval
updated_at: 2026-10-11T09:00:00+07:00
summary: Các trường hợp đúng quyền, ngoài phạm vi và xung đột trạng thái cho module Approval.
source_links: []
---

# Kiểm thử quyền phê duyệt

## Điều kiện tiên quyết

Dữ liệu demo có request Pending ở phòng A và phòng B. Tài khoản minh họa ROLE-MANAGER được gán phòng A.

## Các bước và kết quả

| Case | Bước kiểm thử | Kết quả mong đợi |
| --- | --- | --- |
| Positive | Mở request phòng A, chọn Approve | Chuyển Approved và ghi lịch sử |
| Negative | Gọi API approve request phòng B | Từ chối do ngoài scope |
| Boundary | Hai tab approve cùng request | Chỉ một quyết định thành công; tab cũ nhận conflict |
| Negative | Approve request đã Rejected | Từ chối do không Pending |

## Truy vết

Nguồn: BR-014, FUNC-APP-003 và SCR-APP-001. Các case này chỉ là dữ liệu business minh họa.
