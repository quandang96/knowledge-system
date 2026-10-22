import { reactive } from 'vue'

// One in-app dialog for everything that needs the user's attention: errors, warnings and
// confirmations. Completed actions use the snackbar instead (see notify() in state.ts).
export type DialogTone = 'info' | 'success' | 'warning' | 'error'
export interface DialogRequest {
  title: string
  message: string
  tone: DialogTone
  confirmText: string
  /** Absent for a plain notice, which only has one button. */
  cancelText?: string
  resolve(confirmed: boolean): void
}

// Requests queue up so a second message never replaces one the user has not read yet.
export const dialogQueue = reactive<DialogRequest[]>([])

const titles: Record<DialogTone, string> = {
  info: 'Thông báo',
  success: 'Hoàn tất',
  warning: 'Cần chú ý',
  error: 'Không thể hoàn tất thao tác'
}

interface DialogOptions {
  message: string
  title?: string
  tone?: DialogTone
  confirmText?: string
}

/** Shows a notice with a single button. Resolves once it is closed. */
export function alertDialog(options: DialogOptions) {
  const tone = options.tone || 'info'
  return new Promise<void>((resolve) =>
    dialogQueue.push({
      title: options.title || titles[tone],
      message: options.message,
      tone,
      confirmText: options.confirmText || 'Đã hiểu',
      resolve: () => resolve()
    })
  )
}

/** Asks a yes/no question. Resolves true only when the confirm button is chosen. */
export function confirmDialog(options: DialogOptions & { cancelText?: string }) {
  const tone = options.tone || 'warning'
  return new Promise<boolean>((resolve) =>
    dialogQueue.push({
      title: options.title || titles[tone],
      message: options.message,
      tone,
      confirmText: options.confirmText || 'Tiếp tục',
      cancelText: options.cancelText || 'Hủy',
      resolve
    })
  )
}

/** Unsaved-work guard used before leaving a document, switching project or creating another one. */
export function confirmDiscard(message: string) {
  return confirmDialog({ title: 'Thay đổi chưa lưu', message, confirmText: 'Bỏ thay đổi', cancelText: 'Ở lại' })
}
