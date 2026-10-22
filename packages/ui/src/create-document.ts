import { reactive } from 'vue'
import type { DraftRecord, Metadata } from '../../schemas/src/index'
import { guard } from './state'

// One create dialog for the whole app: it opens over the current page instead of navigating to
// Studio first, and only moves to Studio once the draft exists.
export const createDialog = reactive({ open: false, type: undefined as Metadata['type'] | undefined })

/**
 * Opens the dialog unless a page with unsaved work vetoes the `atlas:before-create` guard event
 * (Studio does, and reopens it through `retry` once the user agrees to leave the draft).
 */
export function openCreate(type?: Metadata['type']) {
  if (!guard('atlas:before-create', () => openCreate(type))) return
  createDialog.type = type
  createDialog.open = true
}

// The draft just created, handed to Studio so it renders without fetching it again.
let created: DraftRecord | undefined
export function rememberCreated(doc: DraftRecord) {
  created = doc
}
export function takeCreated(id: string) {
  const doc = created?.metadata.doc_id === id ? created : undefined
  created = undefined
  return doc
}
