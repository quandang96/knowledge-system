---
doc_id: FUNC-APP-003
project_id: demo-project
type: function
module: approval
title: Phê duyệt yêu cầu
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
summary: Trigger, input/output, validation và xử lý lỗi cho thao tác Approve.
source_links: []
---

# Phê duyệt yêu cầu

## Mục đích và trigger

Người quản lý chọn Approve trên màn hình SCR-APP-001 khi yêu cầu đang Pending. Đây là hành vi minh họa.

## Input và output

| Input | Output |
| --- | --- |
| Request ID, expected revision, ghi chú tùy chọn | Trạng thái Approved, người quyết định, thời điểm |

## Validation

1. Người dùng có quyền phê duyệt.
2. Yêu cầu thuộc phạm vi phòng ban được gán.
3. Trạng thái vẫn là Pending tại thời điểm xử lý.

## Kết quả và lỗi

Thành công: cập nhật trạng thái và lịch sử. Ngoài phạm vi: từ chối thao tác. Revision đã đổi: trả conflict để tải lại.

## Quy tắc nguồn

[BR-014 — Phạm vi phê duyệt](/business-rules/approval/BR-014/).
