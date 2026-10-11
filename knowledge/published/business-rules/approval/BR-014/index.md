---
doc_id: BR-014
project_id: demo-project
type: business-rule
module: approval
title: Giới hạn phạm vi phê duyệt
language: vi
status: published
classification: internal
owner: BA Demo Team
version: 1.0.0
related_ids:
  - ROLE-MANAGER
  - FUNC-APP-003
  - TC-APP-001
tags:
  - demo
  - approval
updated_at: 2026-10-11T09:00:00+07:00
summary: Quản lý chỉ phê duyệt yêu cầu trong phòng ban được gán, tại trạng thái Pending.
source_links: []
---

# Giới hạn phạm vi phê duyệt

## Nội dung quy tắc

Trong demo, ROLE-MANAGER chỉ được phê duyệt yêu cầu trong phòng ban được gán và ở trạng thái Pending.

## Lý do và điều kiện

Giữ quyết định trong đúng phạm vi trách nhiệm. Kiểm tra department của request và tập department được gán cho người quản lý.

## Ngoại lệ và mức ưu tiên

Không có bypass trong demo. Nếu không đủ điều kiện thì từ chối, dù giao diện đang hiển thị nút Approve.

## Ví dụ

- Request thuộc phòng A, manager được gán phòng A, Pending → cho phép.
- Request thuộc phòng B, manager chỉ có phòng A → từ chối.
- Request đã Approved → từ chối xử lý lần nữa.

## Hiệu lực và nguồn

Tài liệu minh họa 1.0.0. Cần BA xác nhận lại trước khi dùng trong business thật.
