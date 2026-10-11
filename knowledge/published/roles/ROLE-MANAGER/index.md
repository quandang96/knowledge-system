---
doc_id: ROLE-MANAGER
project_id: demo-project
type: role
module: approval
title: Quản lý phòng ban
language: vi
status: published
classification: internal
owner: BA Demo Team
version: 1.0.0
related_ids:
  - PERM-APP-001
  - BR-014
  - FUNC-APP-003
tags:
  - demo
  - approval
updated_at: 2026-10-11T09:00:00+07:00
summary: Trách nhiệm, phạm vi dữ liệu và nguyên tắc kế thừa quyền của vai trò Manager.
source_links: []
---

# Quản lý phòng ban

## Trách nhiệm

Trong demo, người quản lý xem xét yêu cầu của phòng ban được gán và đưa ra quyết định.

## Vai trò cha và kế thừa

Không giả định kế thừa tự động từ vai trò nào khác. Sơ đồ thể hiện quan hệ trách nhiệm minh họa; quyền phải được cấp rõ ràng qua permission matrix.

## Phạm vi dữ liệu

Chỉ yêu cầu của phòng ban đang được gán. Không xem hoặc phê duyệt dữ liệu phòng ban khác.

## Quyền

Xem yêu cầu và phê duyệt khi trạng thái Pending và đủ điều kiện BR-014. Không có quyền sửa nội dung yêu cầu.

## Ngoại lệ

Knowledge Hub Reader/Editor/Publisher/Admin là quyền truy cập portal và hoàn toàn độc lập với business role này.
