import type MarkdownIt from 'markdown-it'
import type { PluginWithParams, StateInline, Token } from 'markdown-it'
import markdownItContainer from 'markdown-it-container'
import { atlasPanels, isStatusColor, panelIcons, panelLabels, type AtlasPanel } from './html-policy'

// @types/markdown-it-container targets the CJS markdown-it types; the plugin itself is identical.
const container = markdownItContainer as unknown as PluginWithParams

// Confluence-style blocks: `::: info Title`, `::: expand Title`, `:::: columns` / `::: column`
// and inline `:status[Text]{green}`. Outer containers need more colons than the ones they hold.
export function useAtlasBlocks(md: MarkdownIt) {
  const title = (info: string, name: string) => md.utils.escapeHtml(info.trim().slice(name.length).trim())
  for (const name of atlasPanels)
    md.use(container, name, {
      render: (tokens: Token[], index: number) => {
        if (tokens[index].nesting !== 1) return '</div></div>\n'
        const label = title(tokens[index].info, name) || panelLabels[name as AtlasPanel]
        return `<div class="atlas-panel atlas-panel--${name}"><p class="atlas-panel-title"><span class="mdi ${panelIcons[name as AtlasPanel]}" aria-hidden="true"></span>${label}</p><div class="atlas-panel-body">\n`
      }
    })
  md.use(container, 'expand', {
    render: (tokens: Token[], index: number) =>
      tokens[index].nesting === 1
        ? `<details class="atlas-expand"><summary>${title(tokens[index].info, 'expand') || panelLabels.expand}</summary><div class="atlas-expand-body">\n`
        : '</div></details>\n'
  })
  for (const name of ['columns', 'column'])
    md.use(container, name, {
      render: (tokens: Token[], index: number) =>
        tokens[index].nesting === 1 ? `<div class="atlas-${name}">\n` : '</div>\n'
    })
  md.inline.ruler.before('link', 'atlas_status', status)
  md.renderer.rules.atlas_status = (tokens, index) =>
    `<span class="atlas-status atlas-status--${tokens[index].meta.color}">${md.utils.escapeHtml(tokens[index].content)}</span>`
  return md
}

const statusOpen = ':status['
function status(state: StateInline, silent: boolean) {
  const start = state.pos
  if (state.src.charCodeAt(start) !== 0x3a || !state.src.startsWith(statusOpen, start)) return false
  const close = state.src.indexOf(']', start + statusOpen.length)
  if (close < 0) return false
  const text = state.src.slice(start + statusOpen.length, close).trim()
  if (!text || text.length > 40 || /[\n[]/.test(text)) return false
  const color = /^\{([a-z]+)\}/.exec(state.src.slice(close + 1))
  if (!silent) {
    const token = state.push('atlas_status', 'span', 0)
    token.content = text
    token.meta = { color: color && isStatusColor(color[1]) ? color[1] : 'grey' }
  }
  state.pos = close + 1 + (color?.[0].length || 0)
  return true
}
