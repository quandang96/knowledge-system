---
doc_id: PERM-APP-001
project_id: demo-project
type: permission
module: approval
title: Ma trận quyền phê duyệt
language: vi
status: published
classification: internal
owner: BA Demo Team
version: 1.0.0
related_ids:
  - ROLE-MANAGER
  - SCR-APP-001
  - FUNC-APP-003
  - BR-014
tags:
  - demo
  - approval
updated_at: 2026-10-11T09:00:00+07:00
summary: Vai trò × tài nguyên × thao tác, điều kiện và phạm vi dữ liệu được mô tả cụ thể.
source_links: []
---

# Ma trận quyền phê duyệt

## Ma trận quyền

| Vai trò | Tài nguyên | View | Create | Edit | Delete | Approve | Phạm vi |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ROLE-MANAGER | SCR-APP-001 | Có | Không | Không | Không | Có điều kiện | Phòng ban được gán |

## Điều kiện

Approve chỉ khi Pending và thỏa BR-014. Tất cả kiểm tra thực hiện trên server của ứng dụng nghiệp vụ.

## Phiên bản và nguồn

Phiên bản minh họa 1.0.0. Đây là business permissions, không phải quyền biên tập Atlas.
