import { onUnmounted, ref, watch, type Ref } from 'vue'
import { api } from './state'

const HEARTBEAT_MS = 30_000

/** Reports that the current user has `docId` open and returns the other editors seen on it. */
export function usePresence(docId: Ref<string | undefined>) {
  const others = ref<string[]>([])
  let timer: ReturnType<typeof setInterval> | undefined
  let current: string | undefined
  async function beat(id: string) {
    try {
      const result = await api<{ editors: string[] }>(`/api/documents/${id}/presence`, { method: 'POST' })
      if (id === current) others.value = result.editors
    } catch {
      /* Presence is advisory; never interrupt editing. */
    }
  }
  function stop() {
    clearInterval(timer)
    timer = undefined
    if (current) void api(`/api/documents/${current}/presence`, { method: 'DELETE' }).catch(() => undefined)
    current = undefined
    others.value = []
  }
  watch(
    docId,
    (id) => {
      stop()
      if (!id) return
      current = id
      void beat(id)
      timer = setInterval(() => void beat(id), HEARTBEAT_MS)
    },
    { immediate: true }
  )
  onUnmounted(stop)
  return others
}
