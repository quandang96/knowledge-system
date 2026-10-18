import { z } from 'zod'

export const types = ['overview', 'business-flow', 'module', 'screen', 'function', 'role', 'permission', 'business-rule', 'reference'] as const
// Legacy records remain parseable/exportable, but are never offered for new content.
export const storedTypes = [...types, 'test-scenario'] as const
export function isActiveType(type: string): type is typeof types[number] { return (types as readonly string[]).includes(type) }
export const typeLabels: Record<string, string> = { overview: 'Giới thiệu', 'business-flow': 'Quy trình nghiệp vụ', module: 'Phân hệ', screen: 'Màn hình', function: 'Chức năng', role: 'Vai trò nghiệp vụ', permission: 'Ma trận quyền', 'business-rule': 'Quy tắc nghiệp vụ', 'test-scenario': 'Kịch bản kiểm thử', reference: 'Tài liệu tham khảo' }
export const typeIcons: Record<string, string> = { overview: 'mdi-book-open-page-variant-outline', 'business-flow': 'mdi-transit-connection-variant', module: 'mdi-view-grid-outline', screen: 'mdi-monitor', function: 'mdi-lightning-bolt-outline', role: 'mdi-account-group-outline', permission: 'mdi-shield-key-outline', 'business-rule': 'mdi-scale-balance', 'test-scenario': 'mdi-checkbox-marked-circle-outline', reference: 'mdi-link-variant' }
export const idSchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/).max(80)
export const moduleSchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).max(60)
export const assetPathSchema = z.string().regex(/^\.\/assets\/[a-z0-9][a-z0-9-]*\.(png|jpg|webp)$/)
export const relationKinds = ['related', 'implements', 'governed_by', 'navigates_to'] as const
export const relationLabels: Record<string, string> = { related: 'Liên quan', implements: 'Thực hiện', governed_by: 'Tuân theo quy tắc', verifies: 'Kiểm chứng (legacy)', navigates_to: 'Điều hướng đến', inline: 'Trong nội dung' }
export const relationSchema = z.object({ target_id: idSchema, kind: z.enum([...relationKinds, 'verifies']) }).strict()
const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Ngày không hợp lệ.')
export const galleryItemSchema = z.preprocess(value => typeof value === 'string' ? { path: value, alt: 'Ảnh màn hình' } : value, z.object({ path: assetPathSchema, alt: z.string().max(300), caption: z.string().max(500).default(''), category: z.enum(['overview', 'state', 'modal', 'error', 'mobile']).default('overview') }))
export const metadataSchema = z.object({
  doc_id: idSchema, project_id: moduleSchema, type: z.enum(storedTypes), module: moduleSchema,
  title: z.string().trim().min(1).max(180), language: z.enum(['vi', 'ja', 'en']).default('vi'),
  status: z.enum(['draft', 'published']).default('draft'),
  classification: z.enum(['internal', 'confidential', 'restricted']).default('internal'),
  owner: z.string().min(1).max(100), version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
  related_ids: z.array(idSchema).max(100).default([]), tags: z.array(z.string().max(60)).max(30).default([]),
  relations: z.array(relationSchema).max(100).optional(),
  review_due_at: calendarDateSchema.optional(),
  effective_from: calendarDateSchema.optional(),
  verification: z.object({ reviewer: z.string(), reviewed_at: z.string(), source_revision: z.string(), reason: z.string() }).strict().optional(),
  updated_at: z.string().default(''), summary: z.string().max(1000).default(''), order: z.number().optional(),
  source_links: z.array(z.object({ label: z.string().max(100), url: z.string().url().refine(v => /^https?:\/\//.test(v)) })).default([]),
  // Optional presentation only; old Markdown and metadata remain valid unchanged.
  image_layout: z.record(assetPathSchema, z.object({ align: z.enum(['left','center','right']), width: z.number().int().min(25).max(100) }).strict()).optional(),
  screen: z.object({ route: z.string().max(200).default(''), menu_path: z.array(z.string().max(100)).default([]), screenshot: z.object({ cover: assetPathSchema.optional(), gallery: z.array(galleryItemSchema).max(100).default([]) }).default({ gallery: [] }) }).optional()
}).strict()
export type Metadata = z.infer<typeof metadataSchema>
export const editableMetadataSchema = metadataSchema.extend({ type: z.enum(types) })
export const nodeSchema = z.object({ id: z.string().regex(/^[a-zA-Z0-9-]+$/).max(80), type: z.enum(['start', 'end', 'action', 'decision', 'system', 'screen', 'role']), label: z.string().max(200), position: z.object({ x: z.number().finite(), y: z.number().finite() }), role_id: idSchema.optional(), screen_id: idSchema.optional(), function_id: idSchema.optional(), rule_ids: z.array(idSchema).default([]), description: z.string().max(1000).default('') })
export const graphSchema = z.object({ schema_version: z.literal(1), diagram_id: idSchema, type: z.enum(['business-flow', 'role-hierarchy', 'screen-navigation']), title: z.string().max(200), summary: z.string().min(1).max(5000), nodes: z.array(nodeSchema).max(150), edges: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9-]+$/), source: z.string(), target: z.string(), label: z.string().max(200).default('') })).max(300) })
export type Graph = z.infer<typeof graphSchema>
export interface DocumentRecord { metadata: Metadata; body: string; revision: string; relative_path: string; url: string; published_revision?: string; graphs: Graph[]; assets: { path: string; preview_url: string }[] }
export interface ReviewState { status: 'draft' | 'in_review' | 'changes_requested' | 'approved'; revision: string; submitted_by?: string; submitted_at?: string; reviewer?: string; reviewed_at?: string; reason?: string }
export interface DraftRecord extends DocumentRecord { review: ReviewState; checklist: ChecklistItem[] }
export interface ChecklistItem { key: string; label: string; passed: boolean }
export interface DocumentSummary { metadata: Metadata; revision: string; url: string; published_revision?: string; excerpt: string; graph_count: number }
export interface CatalogResult { items: DocumentSummary[]; total: number; page: number; page_size: number; facets: { modules: string[]; tags: string[]; roles: string[] } }
export const moduleConfigSchema = z.object({ id: moduleSchema, name: z.string().trim().min(1).max(100) }).strict()
export const projectSchema = z.object({ id: moduleSchema, name: z.string().trim().min(1).max(100), description: z.string().max(500).default(''), demo: z.boolean().default(false), require_review: z.boolean().default(true), modules: z.array(moduleConfigSchema).max(100).default([]) }).strict()
export const templateSchema = z.object({ id: moduleSchema, name: z.string().trim().min(1).max(100), type: z.enum(storedTypes), project_id: moduleSchema.optional(), body: z.string().min(1).max(100000), version: z.number().int().positive().default(1) }).strict()
export const workspaceSchema = z.object({ version: z.literal(1), name: z.string().trim().min(1).max(100), projects: z.array(projectSchema).max(100), templates: z.array(templateSchema).max(100) }).strict()
export type ProjectConfig = z.infer<typeof projectSchema>
export type DocumentTemplate = z.infer<typeof templateSchema>
export type WorkspaceConfig = z.infer<typeof workspaceSchema>
export interface WorkspaceResponse extends WorkspaceConfig { revision: string }
export interface PublishJob { id: string; doc_ids: string[]; user: string; status: 'queued' | 'validating' | 'building' | 'activating' | 'completed' | 'failed'; created_at: string; finished_at?: string; error?: string; result?: { revision: string; release: string } }
export interface KnowledgeEdge { source_id: string; target_id: string; kind: string; origin: string }
export interface QualityReport { total: number; edges: KnowledgeEdge[]; broken: KnowledgeEdge[]; orphans: DocumentSummary[]; overdue: DocumentSummary[]; drafts: (DocumentSummary & { review: ReviewState })[] }
export interface ReferenceCandidate extends DocumentSummary { publication: 'draft' | 'published' }
export interface ReferenceResults { items: ReferenceCandidate[]; total: number; page: number; page_size: number }
export interface Connections { outgoing: (KnowledgeEdge & { document?: DocumentSummary })[]; incoming: (KnowledgeEdge & { document?: DocumentSummary })[]; impact: DocumentSummary[] }
export interface FeedbackItem { id: string; doc_id: string; project_id: string; title: string; revision: string; user: string; message: string; created_at: string; status: 'open' | 'resolved'; resolved_by?: string; resolved_at?: string }
export const reviewLabels: Record<ReviewState['status'], string> = { draft: 'Đang soạn', in_review: 'Chờ duyệt', changes_requested: 'Cần chỉnh sửa', approved: 'Đã duyệt' }
export type AccessRole = 'Reader' | 'Editor' | 'Publisher' | 'Admin'
export interface Session { user: string; role: AccessRole; csrf: string }
