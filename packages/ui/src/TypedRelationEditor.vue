<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { type Metadata, type ReferenceCandidate, type ReferenceResults } from '../../schemas/src/index'
import { api } from './state'
import type { RelationField } from './relation-fields'
import DocumentReferencePicker from './DocumentReferencePicker.vue'

// One typed relation (e.g. Screen implements Function) edited as a short list with its own picker.
const relations = defineModel<Metadata['relations']>({ default: () => [] })
const props = defineProps<{ sourceId: string; projectId: string; field: RelationField }>()
const open = ref(false)
const targets = ref<Record<string, ReferenceCandidate>>({})
const loading = ref(false)
const error = ref('')
let controller: AbortController | undefined

const ids = computed(() => relations.value?.filter((edge) => edge.kind === props.field.kind).map((edge) => edge.target_id) || [])
async function resolve() {
  controller?.abort()
  const abort = new AbortController()
  controller = abort
  error.value = ''
  loading.value = true
  try {
    for (let offset = 0; offset < ids.value.length; offset += 50) {
      const params = new URLSearchParams({ source_id: props.sourceId, project_id: props.projectId, ids: ids.value.slice(offset, offset + 50).join(','), page_size: '50' })
      const result = await api<ReferenceResults>(`/api/knowledge/references?${params}`, { signal: abort.signal })
      if (!abort.signal.aborted) for (const item of result.items) targets.value[item.metadata.doc_id] = item
    }
  } catch (failure) {
    if (!abort.signal.aborted) error.value = (failure as Error).message
  } finally {
    if (!abort.signal.aborted) loading.value = false
  }
}
// A string key: a fresh array would count as a change on every edit of the draft and refetch.
watch(() => `${props.sourceId}|${props.projectId}|${ids.value.join(',')}`, resolve, { immediate: true })
onUnmounted(() => controller?.abort())

// A target that no longer resolves, or has the wrong type, blocks publishing; show it so it can be removed.
const invalid = (id: string) => !loading.value && targets.value[id]?.metadata.type !== props.field.targetType
function add(items: ReferenceCandidate[]) {
  const next = [...(relations.value || [])]
  for (const item of items)
    if (item.metadata.type === props.field.targetType && item.metadata.project_id === props.projectId && !ids.value.includes(item.metadata.doc_id)) {
      next.push({ target_id: item.metadata.doc_id, kind: props.field.kind })
      targets.value[item.metadata.doc_id] = item
    }
  relations.value = next
}
function remove(id: string) {
  relations.value = relations.value?.filter((edge) => !(edge.kind === props.field.kind && edge.target_id === id))
}
</script>

<template>
  <section class="screen-function-editor typed-relation-editor">
    <div class="section-heading">
      <div><h3>{{ field.title }}</h3><p class="field-help">{{ field.help }} Lưu nháp để giữ liên kết.</p></div>
      <v-btn variant="tonal" color="primary" size="small" prepend-icon="mdi-plus" @click="open = true">{{ field.addLabel }}</v-btn>
    </div>
    <v-alert v-if="error" type="warning" variant="tonal">{{ error }}<v-btn variant="text" @click="resolve">Thử lại</v-btn></v-alert>
    <div v-for="id in ids" :key="id" class="function-mapping-row">
      <code :class="field.targetType === 'function' ? 'semantic-function-text' : undefined">{{ targets[id]?.metadata.function_code || id }}</code>
      <span>
        {{ targets[id]?.metadata.title || id }}
        <small v-if="invalid(id)" class="relation-warning"><v-icon icon="mdi-alert-circle-outline" size="16" />Không còn khả dụng; gỡ trước khi xuất bản.</small>
      </span>
      <v-btn icon="mdi-close" variant="text" size="small" :aria-label="`Gỡ ${targets[id]?.metadata.title || id}`" @click="remove(id)" />
    </div>
    <p v-if="!ids.length" class="field-help">{{ field.empty }}</p>
    <DocumentReferencePicker v-model="open" :source-id="sourceId" :project-id="projectId" :allowed-types="[field.targetType]" :exclude-ids="ids" :title="field.pickerTitle" @select="add" />
  </section>
</template>
