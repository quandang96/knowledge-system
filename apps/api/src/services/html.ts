import { Parser } from 'htmlparser2'
import {
  allowedClass,
  allowedStyle,
  attributeAllowed,
  authorAttributes,
  authorTags,
  opaqueTags,
  voidTags
} from '../../../../packages/schemas/src/html-policy'

const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttribute = (value: string) => escapeText(value).replace(/"/g, '&quot;')
const shorten = (value: string) => (value.length > 40 ? `${value.slice(0, 40)}…` : value)
const attributeValue: Record<string, RegExp> = {
  width: /^\d{1,4}%?$/,
  height: /^\d{1,4}%?$/,
  colspan: /^\d{1,3}$/,
  rowspan: /^\d{1,3}$/,
  align: /^(?:left|center|right)$/i
}

export interface HtmlScan {
  html: string
  removed: string[]
  links: string[]
}
// Re-serializes one Markdown HTML fragment against the author allowlist, reporting what it removed.
// Callers keep the original fragment when nothing was removed, so `html` only matters on import.
export function scanHtml(fragment: string, safeUrl: (url: string) => boolean): HtmlScan {
  const removed = new Set<string>()
  const links: string[] = []
  const emitted: boolean[] = []
  let html = ''
  let skip = 0
  // htmlparser2 silently ignores stray closing tags, so `</script>` alone needs its own check.
  for (const match of fragment.matchAll(/<\/\s*([a-z][a-z0-9-]*)/gi))
    if (!authorTags.has(match[1].toLowerCase())) removed.add(`<${match[1].toLowerCase()}>`)
  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (skip || opaqueTags.has(name)) {
          if (!skip) removed.add(`<${name}>`)
          skip++
          return
        }
        const keep = authorTags.has(name)
        emitted.push(keep)
        if (!keep) {
          removed.add(`<${name}>`)
          return
        }
        let tag = `<${name}`
        for (const [key, value] of Object.entries(attributes)) {
          const original = key === 'class' ? value.trim().split(/\s+/).join(' ') : value
          let kept: string | null = original
          if (!attributeAllowed(authorAttributes, name, key)) kept = null
          else if (key === 'class') kept = allowedClass(value) || null
          else if (key === 'style') kept = allowedStyle(value).dropped ? null : value
          else if (key === 'href' || key === 'src') kept = safeUrl(value) ? value : null
          else if (attributeValue[key] && !attributeValue[key].test(value)) kept = null
          if (kept !== original) {
            removed.add(['href', 'src', 'style', 'class'].includes(key) ? `${key}="${shorten(value)}"` : key)
            // A partly allowed class list keeps its allowed names.
            if (kept === null) continue
          }
          if (key === 'href' || key === 'src') links.push(value)
          tag += key === 'open' ? ' open' : ` ${key}="${escapeAttribute(kept)}"`
        }
        html += `${tag}>`
      },
      onclosetag(name, implied) {
        if (skip) {
          skip--
          return
        }
        if (emitted.pop() && !implied && !voidTags.has(name)) html += `</${name}>`
      },
      ontext(text) {
        if (!skip) html += escapeText(text)
      },
      oncomment(text) {
        if (!skip) html += `<!--${text}-->`
      },
      onprocessinginstruction(name) {
        removed.add(`<${shorten(name)}>`)
      }
    },
    { lowerCaseTags: true, lowerCaseAttributeNames: true, recognizeSelfClosing: true }
  )
  parser.write(fragment)
  parser.end()
  return { html, removed: [...removed], links }
}
