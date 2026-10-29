// Shared HTML allowlist. The API rejects (or, on import, strips) anything outside
// authorPolicy; the browser re-sanitizes rendered output against renderPolicy.
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

const markdownTags = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'code',
  'pre',
  'blockquote',
  'em',
  'strong',
  'hr',
  'br',
  's'
]
export const authorTags = new Set([
  ...markdownTags,
  'u',
  'mark',
  'sub',
  'sup',
  'span',
  'div',
  'details',
  'summary',
  'kbd',
  'abbr',
  'del',
  'ins',
  'small',
  'b',
  'i'
])
// Dropped together with everything inside them, never unwrapped.
export const opaqueTags = new Set([
  'script',
  'style',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
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
export const voidTags = new Set(['br', 'hr', 'img', 'wbr'])

type AttributePolicy = Record<string, readonly string[]>
const cell = ['colspan', 'rowspan', 'align', 'style']
export const authorAttributes: AttributePolicy = {
  '*': ['class'],
  a: ['href', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  th: cell,
  td: cell,
  abbr: ['title'],
  details: ['open'],
  span: ['style'],
  div: ['style'],
  p: ['style'],
  mark: ['style']
}
// Attributes Atlas's own renderer emits (heading anchors, image layout, Mermaid, icons).
export const renderAttributes: AttributePolicy = {
  ...authorAttributes,
  '*': ['class', 'aria-hidden'],
  h2: ['id'],
  h3: ['id'],
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
const styleRules: Record<string, RegExp> = {
  color: colorValue,
  'background-color': colorValue,
  'text-align': /^(?:left|center|right|justify)$/i
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
