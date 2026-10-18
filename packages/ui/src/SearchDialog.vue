<script setup lang="ts">
import { useDelayedBusy } from './async-state'
import { iconGroup } from './theme'
import { onUnmounted, ref, watch } from 'vue'
import { types, typeIcons, typeLabels, type CatalogResult, type DocumentSummary } from '../../schemas/src/index'
import { api, state } from './state'
const open = defineModel<boolean>({ default: false })
const documentTypeItems = types.map(value=>({title:typeLabels[value],value}))
const query = ref(''); const items = ref<DocumentSummary[]>([]); const total = ref(0); const busy = ref(false); const error = ref(''); const selected = ref(0)
const showBusy = useDelayedBusy(busy)
const type = ref(''); const language = ref(''); const resultHost = ref<HTMLElement>()
let timer: ReturnType<typeof setTimeout>; let controller: AbortController | undefined
watch([query, type, language, open, () => state.project], () => {
  clearTimeout(timer); controller?.abort(); items.value = []; total.value = 0; error.value = ''; selected.value = 0
  if (!open.value) return
  busy.value = true
  const abort = new AbortController(); controller = abort
  timer = setTimeout(async () => {
    try {
      const params = new URLSearchParams({ q: query.value, project_id: state.project, page_size: '20', type: type.value, language: language.value })
      const result = await api<CatalogResult>(`/api/catalog?${params}`, { signal: abort.signal })
      if (!abort.signal.aborted) { items.value = result.items; total.value = result.total }
    } catch (e) { if (!abort.signal.aborted) error.value = (e as Error).message }
    finally { if (!abort.signal.aborted) busy.value = false }
  }, 180)
})
function keydown(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key) || !items.value.length) return
  if ((event.target as HTMLElement).closest('.search-filters')) return
  event.preventDefault()
  if (event.key === 'Enter') { (resultHost.value?.querySelectorAll<HTMLAnchorElement>('.search-result')[selected.value])?.click(); return }
  selected.value = (selected.value + (event.key === 'ArrowDown' ? 1 : -1) + items.value.length) % items.value.length
  resultHost.value?.querySelectorAll('.search-result')[selected.value]?.scrollIntoView({ block: 'nearest' })
}
onUnmounted(() => { clearTimeout(timer); controller?.abort() })
</script>
<template>
  <v-dialog v-model="open" max-width="780">
    <section class="search-dialog" aria-label="Tìm kiếm tài liệu" @keydown="keydown">
      <v-text-field v-model="query" autofocus prepend-inner-icon="mdi-magnify" placeholder="Tìm tên, ID hoặc nội dung…" :loading="showBusy" hide-details variant="solo" flat aria-label="Tìm kiếm tri thức" :aria-activedescendant="items.length ? `search-item-${selected}` : undefined" />
      <div class="search-filters"><v-select v-model="type" :items="[{ title: 'Mọi loại tài liệu', value: '' }, ...documentTypeItems]" label="Loại tài liệu" hide-details /><v-select v-model="language" :items="[{title:'Mọi ngôn ngữ',value:''},{title:'Tiếng Việt',value:'vi'},{title:'日本語',value:'ja'},{title:'English',value:'en'}]" label="Ngôn ngữ" hide-details /></div>
      <div ref="resultHost" class="search-results" aria-live="polite" :aria-busy="busy"><p class="eyebrow">{{ busy ? 'Đang tìm kiếm…' : `${total} kết quả đã xuất bản` }}</p>
        <v-alert v-if="error" type="error" variant="tonal">{{ error }}</v-alert>
        <a v-for="(doc,index) in items" :id="`search-item-${index}`" :key="doc.metadata.doc_id" :href="doc.url" class="search-result" :class="{ 'is-selected': selected === index }" @mouseenter="selected = index" @click="open = false"><span class="icon-box"><v-icon :icon="typeIcons[doc.metadata.type]" :class="['semantic-icon',`semantic-${iconGroup(doc.metadata.type)}`]" /></span><span><strong>{{ doc.metadata.title }}</strong><small>{{ doc.metadata.doc_id }} · {{ typeLabels[doc.metadata.type] }}</small><span class="search-excerpt">{{ doc.excerpt }}</span></span><v-icon icon="mdi-arrow-top-right" size="19" /></a>
        <p v-if="!busy && !items.length && !error" class="empty-text">Không tìm thấy tài liệu. Thử từ khóa khác hoặc bỏ bớt bộ lọc.</p>
      </div><div class="search-footer">Hỗ trợ tiếng Việt không dấu · ↑ ↓ chọn · Enter mở · Esc đóng</div>
    </section>
  </v-dialog>
</template>
