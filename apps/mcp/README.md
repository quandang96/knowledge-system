# MCP adapter — roadmap

Không có MCP/LLM runtime trong MVP. Adapter tương lai phải gọi cùng authorization-aware `/api/knowledge/search`, `/api/knowledge/documents/:docId`, `/api/documents/:docId/related`, `/api/diagrams/:diagramId`.

Citations có `doc_id`, `published_revision`, `heading`, `url`; không đọc thẳng drafts hoặc filesystem. Dùng URL Coder đã xác thực có thể truy cập từ VS Code. Khi tổ chức phê duyệt việc gửi tài liệu tới model, thêm một remote MCP service với identity của người dùng, đăng ký các tools read-only và cấu hình endpoint đó trong VS Code. Không lưu token trong Markdown hay source code.
