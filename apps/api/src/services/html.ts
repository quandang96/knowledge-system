import { Parser } from 'htmlparser2'
import {
  allowedClass,
  allowedStyle,
  attributeAllowed,
  authorAttributes,
  blockedTags,
  legacyClasses,
  legacyTags,
  opaqueTags,
  textAlignTags,
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
  align: /^(?:left|center|right)$/i,
  target: /^_(?:blank|self)$/i
}
// Rewrites a legacy presentational attribute to a style declaration ('' drops it),
// or returns undefined when the attribute is not legacy.
function legacyAttribute(tag: string, key: string, value: string) {
  if (tag === 'font' && key === 'color') return allowedStyle(`color: ${value}`).dropped ? '' : `color: ${value}`
  if (tag === 'font' && (key === 'size' || key === 'face')) return ''
  if (key === 'align' && textAlignTags.has(tag))
    return /^(?:left|center|right|justify)$/i.test(value) ? `text-align: ${value.toLowerCase()}` : ''
}

export interface HtmlScan {
  html: string
  removed: string[]
  converted: string[]
  links: string[]
}
// Re-serializes one Markdown HTML fragment against the shared policy. `removed` lists attack
// markup (saving is refused); `converted` lists what was rewritten or harmlessly dropped.
// Callers keep the original fragment when nothing was removed or converted.
export function scanHtml(fragment: string, safeUrl: (url: string) => boolean): HtmlScan {
  const removed = new Set<string>()
  const converted = new Set<string>()
  const links: string[] = []
  const emitted: (string | null)[] = []
  let html = ''
  let skip = 0
  // Inline HTML arrives one tag per fragment, so a legacy closing tag comes alone.
  const closing = /^<\/\s*([a-z][a-z0-9-]*)\s*>$/i.exec(fragment.trim())
  const legacyClose = closing && legacyTags[closing[1].toLowerCase()]
  if (legacyClose)
    return { html: `</${legacyClose}>`, removed: [], converted: [`<${closing[1].toLowerCase()}>`], links }
  // htmlparser2 silently ignores stray closing tags, so `</script>` alone needs its own check.
  for (const match of fragment.matchAll(/<\/\s*([a-z][a-z0-9-]*)/gi)) {
    const name = match[1].toLowerCase()
    if (opaqueTags.has(name) || blockedTags.has(name)) removed.add(`<${name}>`)
  }
  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (skip || opaqueTags.has(name)) {
          if (!skip) removed.add(`<${name}>`)
          skip++
          return
        }
        const output = legacyTags[name] || name
        const blocked = blockedTags.has(output)
        const keep = !blocked && /^[a-z][a-z0-9-]*$/.test(output)
        emitted.push(keep ? output : null)
        if (!keep) {
          ;(blocked ? removed : converted).add(`<${shorten(name)}>`)
          return
        }
        if (output !== name) converted.add(`<${name}>`)
        const styles = name === 'center' ? ['text-align: center'] : []
        let tag = `<${output}`
        for (const [key, value] of Object.entries(attributes)) {
          const legacy = legacyAttribute(name, key, value)
          if (legacy !== undefined) {
            if (name !== 'font') converted.add(key)
            if (legacy) styles.push(legacy)
            continue
          }
          // rel is always set below so an author cannot weaken it.
          if (output === 'a' && key === 'rel') continue
          // Class names and data-* only carry styling or scripting hooks, so dropping them is safe.
          if (key === 'class') {
            const names = value.trim().split(/\s+/)
            const kept = allowedClass(names.map((name) => legacyClasses[name] || name).join(' '))
            if (kept !== names.join(' ')) converted.add(`class="${shorten(value)}"`)
            if (kept) tag += ` class="${kept}"`
            continue
          }
          if (key.startsWith('data-')) {
            converted.add(key)
            continue
          }
          // Event handlers and script URLs are attacks; anything else unsupported is dropped.
          if (key.startsWith('on') || ((key === 'href' || key === 'src') && !safeUrl(value))) {
            removed.add(key.startsWith('on') ? key : `${key}="${shorten(value)}"`)
            continue
          }
          if (!attributeAllowed(authorAttributes, output, key) || attributeValue[key]?.test(value) === false) {
            converted.add(key === 'style' ? `style="${shorten(value)}"` : key)
            continue
          }
          if (key === 'href' || key === 'src') links.push(value)
          if (key === 'style') {
            const style = allowedStyle(value)
            if (style.dropped) converted.add(`style="${shorten(value)}"`)
            if (style.style) styles.unshift(style.dropped ? style.style : value)
          } else tag += key === 'open' ? ' open' : ` ${key}="${escapeAttribute(value)}"`
        }
        if (styles.length) tag += ` style="${escapeAttribute(styles.join('; '))}"`
        if (output === 'a') {
          const rel = /^_blank$/i.test(attributes.target || '') ? 'noopener noreferrer' : undefined
          if (attributes.rel !== rel) converted.add('rel')
          if (rel) tag += ` rel="${rel}"`
        }
        html += `${tag}>`
      },
      onclosetag(name, implied) {
        if (skip) {
          skip--
          return
        }
        const output = emitted.pop()
        if (output && !implied && !voidTags.has(output)) html += `</${output}>`
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
  return { html, removed: [...removed], converted: [...converted], links }
}
