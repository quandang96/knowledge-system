import { ApiError, state } from './state'

export interface UploadedImage { asset_id: string; relative_path: string; preview_url: string; width: number; height: number }

// XHR exposes actual bytes sent. Completion still waits for validation by the API.
export function uploadImages(docId: string, files: File[], progress: (percent: number | null) => void): Promise<UploadedImage[]> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `/api/documents/${encodeURIComponent(docId)}/assets`)
    request.withCredentials = true
    if (state.session) request.setRequestHeader('X-CSRF-Token', state.session.csrf)
    request.upload.onprogress = event => progress(event.lengthComputable ? Math.round(event.loaded / event.total * 100) : null)
    request.onload = () => {
      let payload
      try { payload = JSON.parse(request.responseText) } catch { reject(new Error('Phản hồi tải ảnh không hợp lệ. Thử lại khi kết nối ổn định.')); return }
      if (request.status >= 200 && request.status < 300) resolve(payload.data)
      else { if (request.status === 401) state.session = null; reject(new ApiError(request.status, payload.error?.message || 'Không thể tải ảnh.', payload.error?.details)) }
    }
    request.onerror = () => reject(new Error('Mất kết nối khi tải ảnh. Kiểm tra mạng rồi thử lại.'))
    request.ontimeout = () => reject(new Error('Tải ảnh quá thời gian chờ. Kiểm tra kết nối rồi thử lại.'))
    request.timeout = 120000
    const data = new FormData()
    for (const file of files) data.append('files', file)
    progress(null)
    request.send(data)
  })
}
