import { defineAsyncComponent, ref, type Component } from 'vue'
import ViewSkeleton from './ViewSkeleton.vue'

// Number of screen chunks still downloading; the shell shows a progress bar while it is non-zero.
export const pendingViews = ref(0)

export function track<T>(work: Promise<T>) {
  pendingViews.value++
  return work.finally(() => pendingViews.value--)
}

/**
 * Lazily loaded screen. A skeleton replaces the blank area if the chunk takes longer than a
 * moment, so switching screens never shows an empty page or a footer jumping up and down.
 */
export function lazyView(loader: () => Promise<{ default: Component }>) {
  return defineAsyncComponent({ loader: () => track(loader()), loadingComponent: ViewSkeleton, delay: 120 })
}

/** Downloads screen chunks while the browser is idle so the first visit opens instantly. */
export function prefetch(loaders: (() => Promise<unknown>)[]) {
  const run = () => loaders.forEach((load) => void load().catch(() => undefined))
  const idle = (window as Window & { requestIdleCallback?: (callback: () => void) => number }).requestIdleCallback
  if (idle) idle(run)
  else setTimeout(run, 1500)
}
