import { onUnmounted, reactive } from 'vue'
import type { ReferenceCandidate, ReferenceResults } from '../../schemas/src/index'
import { documentLink } from '../../schemas/src/document-links'
import { api } from './state'

// Inline "@" suggestions shared by the rich editor and Markdown Source. Typing `@` at the start of a
// line or after anything but a letter/digit opens a list under the caret that narrows by ID or title
// as you type. Letters right before `@` (e-mail addresses) do not trigger it.

/** `@query` immediately before the caret, if any. `start` is the index of the `@`. */
export function findMention(textBefore: string) {
  const match = /(?:^|[^\p{L}\p{N}_])@([^\s@[\]()]{0,40})$/u.exec(textBefore)
  if (!match) return null
  return { query: match[1], start: textBefore.length - match[1].length - 1 }
}

export function markdownLink(item: ReferenceCandidate) {
  return `[${item.metadata.title.replace(/[[\]\\]/g, '\\$&')}](${documentLink(item.metadata.doc_id)})`
}

export interface MentionState {
  open: boolean
  query: string
  /** Document positions (rich editor) or string offsets (textarea) covering `@query`. */
  from: number
  to: number
  left: number
  top: number
  items: ReferenceCandidate[]
  active: number
  loading: boolean
  error: string
}

export function useMention(context: () => { sourceId: string; projectId: string }) {
  const state = reactive<MentionState>({
    open: false,
    query: '',
    from: 0,
    to: 0,
    left: 0,
    top: 0,
    items: [],
    active: 0,
    loading: false,
    error: ''
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  // An `@` the user dismissed with Escape stays closed until the caret leaves it.
  let dismissedAt = -1

  function search(query: string) {
    clearTimeout(timer)
    controller?.abort()
    state.loading = true
    timer = setTimeout(async () => {
      const abort = new AbortController()
      controller = abort
      const { sourceId, projectId } = context()
      const params = new URLSearchParams({
        project_id: projectId,
        source_id: sourceId,
        q: query,
        page: '1',
        page_size: '8'
      })
      try {
        const result = await api<ReferenceResults>(`/api/knowledge/references?${params}`, { signal: abort.signal })
        if (abort.signal.aborted) return
        state.items = result.items
        state.active = 0
        state.error = ''
      } catch (failure) {
        if (!abort.signal.aborted) {
          state.items = []
          state.error = (failure as Error).message
        }
      } finally {
        if (!abort.signal.aborted) state.loading = false
      }
    }, 120)
  }

  /** Re-evaluates the caret. `at` is where `@` sits, `caret` where typing continues. */
  function update(
    match: { query: string; at: number; caret: number } | null,
    place: () => { left: number; top: number }
  ) {
    if (!match || match.at === dismissedAt) {
      if (!match) dismissedAt = -1
      close()
      return
    }
    const position = place()
    Object.assign(state, { from: match.at, to: match.caret, left: position.left, top: position.top })
    if (!state.open || match.query !== state.query) {
      state.query = match.query
      search(match.query)
    }
    state.open = true
  }

  function close() {
    if (!state.open) return
    state.open = false
    clearTimeout(timer)
    controller?.abort()
    state.loading = false
  }

  /** Handles navigation keys while the list is open. Returns the chosen item on Enter/Tab. */
  function key(event: KeyboardEvent): 'handled' | ReferenceCandidate | null {
    if (!state.open) return null
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (state.items.length)
        state.active = (state.active + (event.key === 'ArrowDown' ? 1 : -1) + state.items.length) % state.items.length
      return 'handled'
    }
    if (event.key === 'Escape') {
      dismissedAt = state.from
      close()
      return 'handled'
    }
    if ((event.key === 'Enter' || event.key === 'Tab') && state.items[state.active]) return state.items[state.active]
    return null
  }

  onUnmounted(() => {
    clearTimeout(timer)
    controller?.abort()
  })
  return { state, update, close, key }
}

// Properties that affect where text wraps inside a textarea, copied to the measuring mirror.
const mirrored = [
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'whiteSpace',
  'wordWrap',
  'wordBreak'
] as const

/** Viewport coordinates of the bottom-left corner of a character in a textarea. */
export function textareaCaret(textarea: HTMLTextAreaElement, position: number) {
  const style = getComputedStyle(textarea)
  const mirror = document.createElement('div')
  for (const property of mirrored) mirror.style[property] = style[property]
  Object.assign(mirror.style, {
    position: 'absolute',
    visibility: 'hidden',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    top: '0',
    left: '-9999px'
  })
  mirror.textContent = textarea.value.slice(0, position)
  const marker = document.createElement('span')
  marker.textContent = textarea.value.slice(position, position + 1) || '.'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const box = textarea.getBoundingClientRect()
  const left = box.left + marker.offsetLeft - textarea.scrollLeft
  const top = box.top + marker.offsetTop - textarea.scrollTop + parseFloat(style.lineHeight || '20')
  mirror.remove()
  return { left, top }
}

/** Text to insert so a typed or button-inserted `@` starts a mention: a space is added after a word. */
export function mentionTrigger(charBefore: string) {
  return /[\p{L}\p{N}_]/u.test(charBefore) ? ' @' : '@'
}
