interface InlineToken { type: string; content: string; children?: InlineToken[] | null }
export function imageAlt(token: InlineToken): string {
  // markdown-it's renderInlineAsText skips text_special (escaped brackets/entities).
  return (token.children || []).map(child => child.children ? imageAlt(child) : ['text','text_special','code_inline'].includes(child.type) ? child.content : ['softbreak','hardbreak'].includes(child.type) ? ' ' : '').join('')
}
