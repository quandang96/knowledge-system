<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { typeIcons, typeLabels } from '../../schemas/src/index'
import { iconGroup } from './theme'
import type { MentionState } from './mention'

const props = defineProps<{ state: MentionState }>()
const emit = defineEmits<{ select: [index: number]; hover: [index: number]; more: [] }>()
const list = ref<HTMLElement>()

// Keep the list on screen: open above the caret when there is no room below.
const style = computed(() => {
  const width = 380
  const left = Math.max(8, Math.min(props.state.left, window.innerWidth - width - 8))
  const below = window.innerHeight - props.state.top > 300
  return below
    ? { left: `${left}px`, top: `${props.state.top + 6}px`, width: `${width}px` }
    : { left: `${left}px`, bottom: `${window.innerHeight - props.state.top + 30}px`, width: `${width}px` }
})
watch(
  () => props.state.active,
  async () => {
    await nextTick()
    list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }
)
</script>

<template>
  <Teleport to="body">
    <div v-if="state.open" class="mention-menu" :style="style" @mousedown.prevent>
      <div class="mention-menu-head">
        <span>Liên kết tài liệu<template v-if="state.query"> · “{{ state.query }}”</template></span>
        <v-progress-circular v-if="state.loading" indeterminate size="14" width="2" color="primary" />
      </div>
      <ul v-if="state.items.length" ref="list" role="listbox" aria-label="Gợi ý tài liệu">
        <li
          v-for="(item, index) in state.items"
          :key="item.metadata.doc_id"
          role="option"
          :aria-selected="index === state.active"
          @mouseenter="emit('hover', index)"
          @click="emit('select', index)"
        >
          <span class="icon-tile" :class="`semantic-${iconGroup(item.metadata.type)}`"><v-icon :icon="typeIcons[item.metadata.type]" size="16" /></span>
          <span class="mention-text">
            <code>{{ item.metadata.function_code || item.metadata.doc_id }}</code>
            <strong>{{ item.metadata.title }}</strong>
            <small>{{ typeLabels[item.metadata.type] }}{{ item.publication === 'draft' ? ' · Bản nháp' : '' }}</small>
          </span>
        </li>
      </ul>
      <p v-else-if="!state.loading" class="mention-empty">{{ state.error || 'Không có tài liệu khớp trong project này.' }}</p>
      <p v-else-if="!state.items.length" class="mention-empty">Đang tìm tài liệu…</p>
      <div class="mention-menu-foot">
        <span>{{ state.query ? '↑↓ chọn · Enter chèn · Esc đóng' : 'Gõ key hoặc tên để lọc · Esc đóng' }}</span>
        <button type="button" class="text-link" @click="emit('more')">Tìm nâng cao</button>
      </div>
    </div>
  </Teleport>
</template>
