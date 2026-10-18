import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vitepress'

// VitePress route.path contains only the pathname. Observe query-only navigation too.
export function useLocationQuery() {
  const query=ref(typeof window==='undefined'?'':window.location.search)
  const router=useRouter();let previous:typeof router.onAfterRouteChange
  const update=()=>{query.value=window.location.search}
  const after:NonNullable<typeof router.onAfterRouteChange>=async href=>{await previous?.(href);update()}
  onMounted(()=>{update();previous=router.onAfterRouteChange;router.onAfterRouteChange=after;window.addEventListener('popstate',update)})
  onUnmounted(()=>{if(router.onAfterRouteChange===after)router.onAfterRouteChange=previous;window.removeEventListener('popstate',update)})
  return query
}
