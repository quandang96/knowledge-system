import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { useAtlasBlocks } from '../../schemas/src/markdown-blocks'
import {
  allowedClass,
  allowedStyle,
  attributeAllowed,
  blockedTags,
  opaqueTags,
  renderAttributes
} from '../../schemas/src/html-policy'

// Every document view renders through this parser; HTML it emits must pass sanitizeHtml.
export const createAtlasMarkdown = () => useAtlasBlocks(new MarkdownIt({ html: true, linkify: false }))

const allowedAttributes = [...new Set(Object.values(renderAttributes).flat())]
let hooked = false
// Second line of defence after the API: drops forbidden tags and attributes outside renderAttributes.
export function sanitizeHtml(html: string) {
  if (typeof window === 'undefined' || !html) return ''
  if (!hooked) {
    hooked = true
    DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
      const tag = node.nodeName.toLowerCase()
      if (!attributeAllowed(renderAttributes, tag, data.attrName)) data.keepAttr = false
      else if (data.attrName === 'class') data.attrValue = allowedClass(data.attrValue, true)
      else if (data.attrName === 'style') data.attrValue = allowedStyle(data.attrValue).style
      if (data.keepAttr && !data.attrValue && !['alt', 'open'].includes(data.attrName)) data.keepAttr = false
    })
    // A page opened from a document must not reach back into Atlas through window.opener.
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.nodeName === 'A' && node.getAttribute('target')) node.setAttribute('rel', 'noopener noreferrer')
    })
  }
  return DOMPurify.sanitize(html, {
    // DOMPurify's default tag list, minus everything the API refuses.
    FORBID_TAGS: [...opaqueTags, ...blockedTags],
    ALLOWED_ATTR: allowedAttributes,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:https?:|[^a-z]|[a-z0-9+.-]+(?:[^a-z0-9+.\-:]|$))/i
  })
}
