// Contract for read-only integrations (MCP adapters, Dify, RAGFlow). Hand-maintained and limited to the
// stable knowledge endpoints; tests/improvements.test.ts fails if a documented path stops existing.
// Every path is reachable under both /api/... and the versioned /api/v1/... alias.
const envelope = (data: object) => ({ type: 'object', required: ['data'], properties: { data } })
const error = {
  description: 'Lỗi',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: { data: { nullable: true }, error: { type: 'object', properties: { message: { type: 'string' } } } }
      }
    }
  }
}
const ok = (data: object) => ({
  description: 'Thành công',
  content: { 'application/json': { schema: envelope(data) } }
})
const docId = {
  name: 'docId',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$' }
}
const query = (name: string, description: string) => ({
  name,
  in: 'query',
  required: false,
  description,
  schema: { type: 'string' }
})
const citation = {
  type: 'object',
  properties: {
    doc_id: { type: 'string' },
    published_revision: { type: 'string' },
    heading: { type: 'string' },
    url: { type: 'string' }
  }
}
const metadata = {
  type: 'object',
  description: 'Front matter của tài liệu (doc_id, type, project_id, module, title, status, ...).',
  additionalProperties: true
}

export const openApiPaths = [
  '/api/knowledge/search',
  '/api/knowledge/documents/{docId}',
  '/api/documents/{docId}/related',
  '/api/diagrams/{diagramId}',
  '/api/catalog',
  '/api/health'
] as const

export function openApiDocument() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Atlas Knowledge Hub API',
      version: '1.0.0',
      description:
        'API đọc tri thức đã xuất bản. Yêu cầu phiên đăng nhập hoặc header của gateway; chỉ trả tài liệu Published/Internal. Mọi response có dạng { data, error }.'
    },
    servers: [{ url: '/api/v1', description: 'Alias có phiên bản; /api tương đương.' }],
    paths: {
      '/knowledge/search': {
        get: {
          summary: 'Tìm tài liệu đã xuất bản, kèm citation',
          parameters: ['q', 'project_id', 'type', 'module', 'language', 'tag'].map((name) =>
            query(name, name === 'q' ? 'Từ khóa; hỗ trợ tiếng Việt không dấu.' : `Lọc theo ${name}.`)
          ),
          responses: {
            200: ok({
              type: 'array',
              items: {
                type: 'object',
                properties: { metadata, excerpt: { type: 'string' }, score: { type: 'number' }, citation }
              }
            }),
            401: error
          }
        }
      },
      '/knowledge/documents/{docId}': {
        get: {
          summary: 'Nội dung tài liệu, citation và tài liệu liên quan',
          parameters: [docId],
          responses: {
            200: ok({
              type: 'object',
              properties: {
                metadata,
                body: { type: 'string' },
                citation,
                related: { type: 'array', items: { type: 'object', properties: { metadata, citation } } }
              }
            }),
            404: error
          }
        }
      },
      '/documents/{docId}/related': {
        get: {
          summary: 'Tài liệu liên quan cùng project',
          parameters: [docId],
          responses: { 200: ok({ type: 'array', items: { type: 'object', additionalProperties: true } }), 404: error }
        }
      },
      '/diagrams/{diagramId}': {
        get: {
          summary: 'Sơ đồ đã xuất bản (graph JSON)',
          parameters: [{ name: 'diagramId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: ok({ type: 'object', additionalProperties: true }), 404: error }
        }
      },
      '/catalog': {
        get: {
          summary: 'Danh mục có phân trang, lọc và facets',
          parameters: [
            ...['q', 'project_id', 'type', 'module', 'tag', 'role'].map((name) => query(name, `Lọc theo ${name}.`)),
            { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
            { name: 'page_size', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
            { name: 'sort', in: 'query', schema: { type: 'string', enum: ['relevance', 'updated', 'title'] } }
          ],
          responses: {
            200: ok({
              type: 'object',
              properties: {
                items: { type: 'array', items: { type: 'object', additionalProperties: true } },
                total: { type: 'integer' },
                page: { type: 'integer' },
                page_size: { type: 'integer' }
              }
            })
          }
        }
      },
      '/health': {
        get: {
          summary: 'Kiểm tra dịch vụ',
          responses: {
            200: ok({ type: 'object', properties: { status: { type: 'string' }, storage: { type: 'string' } } })
          }
        }
      }
    }
  }
}
