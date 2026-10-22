import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

// Delay feedback only; requests themselves are never delayed by this helper.
export function useDelayedBusy(busy: Ref<boolean>, delay = 180) {
  const visible = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(
    busy,
    (value) => {
      clearTimeout(timer)
      if (value)
        timer = setTimeout(() => {
          visible.value = true
        }, delay)
      else visible.value = false
    },
    { immediate: true }
  )
  onBeforeUnmount(() => clearTimeout(timer))
  return visible
}
