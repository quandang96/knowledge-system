import { z } from 'zod'

export const types = ['overview', 'business-flow', 'module', 'screen', 'function', 'role', 'permission', 'business-rule', 'test-scenario', 'reference'] as const
export const typeLabels: Record<string, string> = { overview: 'Tổng quan', 'business-flow': 'Quy trình nghiệp vụ', module: 'Modules', screen: 'Màn hình', function: 'Chức năng', role: 'Vai trò nghiệp vụ', permission: 'Ma trận quyền', 'business-rule': 'Quy tắc nghiệp vụ', 'test-scenario': 'Kịch bản kiểm thử', reference: 'Tài liệu tham khảo' }
export const typeIcons: Record<string, string> = { overview: 'mdi-book-open-page-variant-outline', 'business-flow': 'mdi-transit-connection-variant', module: 'mdi-view-grid-outline', screen: 'mdi-monitor', function: 'mdi-lightning-bolt-outline', role: 'mdi-account-group-outline', permission: 'mdi-shield-key-outline', 'business-rule': 'mdi-scale-balance', 'test-scenario': 'mdi-checkbox-marked-circle-outline', reference: 'mdi-link-variant' }
export const idSchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/).max(80)
export const moduleSchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).max(60)
export const assetPathSchema = z.string().regex(/^\.\/assets\/[a-z0-9][a-z0-9-]*\.(png|jpg|webp)$/)
export const galleryItemSchema = z.preprocess(value => typeof value === 'string' ? { path: value, alt: 'Ảnh màn hình' } : value, z.object({ path: assetPathSchema, alt: z.string().max(300), caption: z.string().max(500).default(''), category: z.enum(['overview', 'state', 'modal', 'error', 'mobile']).default('overview') }))
export const metadataSchema = z.object({
  doc_id: idSchema, project_id: moduleSchema, type: z.enum(types), module: moduleSchema,
  title: z.string().trim().min(1).max(180), language: z.enum(['vi', 'ja', 'en']).default('vi'),
  status: z.enum(['draft', 'published']).default('draft'),
  classification: z.enum(['internal', 'confidential', 'restricted']).default('internal'),
  owner: z.string().min(1).max(100), version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
  related_ids: z.array(idSchema).max(100).default([]), tags: z.array(z.string().max(60)).max(30).default([]),
  updated_at: z.string().default(''), summary: z.string().max(1000).default(''), order: z.number().optional(),
  source_links: z.array(z.object({ label: z.string().max(100), url: z.string().url().refine(v => /^https?:\/\//.test(v)) })).default([]),
  screen: z.object({ route: z.string().max(200).default(''), menu_path: z.array(z.string().max(100)).default([]), screenshot: z.object({ cover: assetPathSchema.optional(), gallery: z.array(galleryItemSchema).max(100).default([]) }).default({ gallery: [] }) }).optional()
}).strict()
export type Metadata = z.infer<typeof metadataSchema>
export const nodeSchema = z.object({ id: z.string().regex(/^[a-zA-Z0-9-]+$/).max(80), type: z.enum(['start', 'end', 'action', 'decision', 'system', 'screen', 'role']), label: z.string().max(200), position: z.object({ x: z.number().finite(), y: z.number().finite() }), role_id: idSchema.optional(), screen_id: idSchema.optional(), function_id: idSchema.optional(), rule_ids: z.array(idSchema).default([]), description: z.string().max(1000).default('') })
export const graphSchema = z.object({ schema_version: z.literal(1), diagram_id: idSchema, type: z.enum(['business-flow', 'role-hierarchy', 'screen-navigation']), title: z.string().max(200), summary: z.string().min(1).max(5000), nodes: z.array(nodeSchema).max(150), edges: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9-]+$/), source: z.string(), target: z.string(), label: z.string().max(200).default('') })).max(300) })
export type Graph = z.infer<typeof graphSchema>
export interface DocumentRecord { metadata: Metadata; body: string; revision: string; relative_path: string; url: string; published_revision?: string; graphs: Graph[]; assets: { path: string; preview_url: string }[] }
export type AccessRole = 'Reader' | 'Editor' | 'Publisher' | 'Admin'
export interface Session { user: string; role: AccessRole; csrf: string }
