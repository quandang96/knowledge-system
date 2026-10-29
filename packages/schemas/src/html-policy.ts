// Shared HTML policy. Tags are open except opaqueTags/blockedTags; attributes stay on an
// allowlist. The API rejects attack markup on save (strips it on import) and drops other
// unsupported attributes; the browser re-sanitizes rendered output against renderAttributes.
export const atlasPanels = ['info', 'note', 'tip', 'warning', 'danger'] as const
export const atlasContainers = [...atlasPanels, 'expand', 'columns', 'column'] as const
export const statusColors = ['grey', 'blue', 'green', 'yellow', 'red', 'purple'] as const
export type AtlasPanel = (typeof atlasPanels)[number]
export type StatusColor = (typeof statusColors)[number]

export const panelLabels: Record<AtlasPanel | 'expand', string> = {
  info: 'Thông tin',
  note: 'Ghi chú',
  tip: 'Mẹo',
  warning: 'Cảnh báo',
  danger: 'Nguy hiểm',
  expand: 'Xem thêm'
}
export const panelIcons: Record<AtlasPanel, string> = {
  info: 'mdi-information-outline',
  note: 'mdi-note-text-outline',
  tip: 'mdi-lightbulb-on-outline',
  warning: 'mdi-alert-outline',
  danger: 'mdi-alert-octagon-outline'
}

// Legacy tags the API rewrites to their modern equivalent instead of rejecting.
export const legacyTags: Record<string, string> = { font: 'span', center: 'div' }
// Classes from imported docs that have an Atlas block equivalent. Other classes outside
// the atlas- prefix are dropped on write, never rejected.
export const legacyClasses: Record<string, string> = {
  'doc-callout': 'atlas-panel',
  'doc-callout--info': 'atlas-panel--info',
  'doc-callout--note': 'atlas-panel--note',
  'doc-callout--tip': 'atlas-panel--tip',
  'doc-callout--success': 'atlas-panel--tip',
  'doc-callout--warning': 'atlas-panel--warning',
  'doc-callout--danger': 'atlas-panel--danger',
  'doc-details': 'atlas-expand',
  'doc-details__body': 'atlas-expand-body'
}
export const textAlignTags = new Set(['p', 'div', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
// Any tag is accepted except these. Opaque tags run code, load other documents or
// swallow markup, so they are dropped together with everything inside them.
export const opaqueTags = new Set([
  'script',
  'style',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'portal',
  'svg',
  'math',
  'template',
  'textarea',
  'noscript',
  'noembed',
  'noframes',
  'title',
  'select',
  'xmp',
  'plaintext',
  'head',
  'link',
  'meta',
  'base'
])
// Forms and dialogs can pose as Atlas UI (fake sign-in, overlays); dropped, text kept.
export const blockedTags = new Set(['form', 'input', 'button', 'option', 'optgroup', 'datalist', 'dialog', 'param'])
export const voidTags = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'track', 'wbr'])

type AttributePolicy = Record<string, readonly string[]>
const cell = ['colspan', 'rowspan', 'align', 'style']
export const authorAttributes: AttributePolicy = {
  '*': ['class', 'title', 'lang', 'dir'],
  a: ['href', 'target'],
  img: ['src', 'alt', 'width', 'height'],
  th: cell,
  td: cell,
  details: ['open'],
  span: ['style'],
  div: ['style'],
  section: ['style'],
  p: ['style'],
  mark: ['style'],
  ...Object.fromEntries(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((tag) => [tag, ['style']]))
}
// Attributes Atlas's own renderer emits (heading anchors, image layout, Mermaid, icons).
export const renderAttributes: AttributePolicy = {
  ...authorAttributes,
  '*': [...authorAttributes['*'], 'aria-hidden'],
  a: [...authorAttributes.a, 'rel'],
  h2: [...authorAttributes.h2, 'id'],
  h3: [...authorAttributes.h3, 'id'],
  img: [...authorAttributes.img, 'data-asset-path', 'loading'],
  div: [...authorAttributes.div, 'data-atlas-mermaid']
}
export function attributeAllowed(policy: AttributePolicy, tag: string, name: string) {
  return !!(policy[tag]?.includes(name) || policy['*'].includes(name))
}

const authorClass = /^atlas-[a-z0-9_-]+$/
const renderClass = /^(?:atlas-[a-z0-9_-]+|language-[a-z0-9_+-]+|mdi|mdi-[a-z0-9-]+)$/
// Returns the allowed class list, or '' when nothing survives.
export function allowedClass(value: string, render = false) {
  const pattern = render ? renderClass : authorClass
  return value
    .split(/\s+/)
    .filter((name) => pattern.test(name))
    .join(' ')
}

const colorValue =
  /^(?:#[0-9a-f]{3}|#[0-9a-f]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)|[a-z]{3,20})$/i
// Bounded so text cannot be hidden from readers while search and chat still see it.
const fontSize = {
  test(value: string) {
    if (/^(?:small|medium|large|x-large|xx-large)$/i.test(value)) return true
    const match = /^(\d{1,3}(?:\.\d+)?)(px|em|rem|%)$/i.exec(value)
    if (!match) return false
    const [min, max] = { px: [10, 72], em: [0.75, 4], rem: [0.75, 4], '%': [75, 400] }[match[2].toLowerCase()]!
    return Number(match[1]) >= min && Number(match[1]) <= max
  }
}
const styleRules: Record<string, { test(value: string): boolean }> = {
  color: colorValue,
  'background-color': colorValue,
  'text-align': /^(?:left|center|right|justify)$/i,
  'font-weight': /^(?:normal|bold|[1-9]00)$/i,
  'font-style': /^(?:normal|italic)$/i,
  'text-decoration': /^(?:none|underline|line-through)$/i,
  'vertical-align': /^(?:top|middle|bottom)$/i,
  'font-size': fontSize
}
// Keeps only allowed declarations; `dropped` says whether anything was removed.
export function allowedStyle(value: string) {
  const kept: string[] = []
  let dropped = false
  for (const declaration of value.split(';')) {
    if (!declaration.trim()) continue
    const split = declaration.indexOf(':')
    const name = declaration.slice(0, split).trim().toLowerCase()
    const raw = declaration.slice(split + 1).trim()
    if (split > 0 && styleRules[name]?.test(raw)) kept.push(`${name}: ${raw}`)
    else dropped = true
  }
  return { style: kept.join('; '), dropped }
}

export const isStatusColor = (value: string): value is StatusColor =>
  (statusColors as readonly string[]).includes(value)
