<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import MediaImage from './MediaImage.vue'
import { assetUrl } from './state'
const props = defineProps(nodeViewProps)
// Tiptap node views have their own Vue render roots; explicit IDs avoid collisions.
const fieldId = `image-${crypto.randomUUID()}`
const imageSrc = computed(() => assetUrl({metadata:{doc_id:props.extension.storage.docId}}, String(props.node.attrs.src || ''), true))
const layout = computed(() => props.extension.storage.imageLayout()[props.node.attrs.src] || {align:'center',width:100})
const align = ref<'left'|'center'|'right'>('center'); const width = ref(100)
const localAsset = computed(() => String(props.node.attrs.src || '').startsWith('./assets/'))
const layoutStyle = computed(() => ({width:`${layout.value.width}%`,marginInlineStart:layout.value.align==='left'?'0':'auto',marginInlineEnd:layout.value.align==='right'?'0':'auto'}))
const editing = ref(false); const alt = ref(''); const caption = ref('')
watch(() => props.node.attrs, attrs => { alt.value = attrs.alt || ''; caption.value = attrs.title || '' }, { immediate: true })
function edit() { align.value = layout.value.align; width.value = layout.value.width; editing.value = true }
function apply() { props.updateAttributes({alt:alt.value,title:caption.value}); if(localAsset.value) props.extension.storage.setLayout(props.node.attrs.src,{align:align.value,width:width.value}); editing.value = false }
function replace() { props.editor.view.dom.dispatchEvent(new CustomEvent('atlas-image-replace', { bubbles: true, detail: { position: props.getPos() } })) }
</script>
<template>
  <NodeViewWrapper class="editor-image-node" :class="{ 'image-selected': selected }" :contenteditable="false">
    <div class="image-node-actions"><v-btn variant="text" size="small" prepend-icon="mdi-image-edit-outline" @click="replace">Thay ảnh</v-btn><v-btn variant="text" size="small" prepend-icon="mdi-text-box-outline" @click="edit">Alt text / Caption</v-btn><v-spacer /><v-btn variant="text" size="small" color="error" icon="mdi-image-remove-outline" aria-label="Xóa ảnh khỏi nội dung" title="Chỉ gỡ khỏi nội dung; giữ file và lịch sử" @click="deleteNode" /></div>
    <MediaImage :src="imageSrc" :alt="node.attrs.alt" :caption="node.attrs.title" :style="layoutStyle" zoomable />
    <v-dialog v-model="editing" max-width="520"><form class="new-doc-form" @submit.prevent="apply"><h2>Thông tin ảnh</h2><v-text-field :id="fieldId + '-alt'" v-model="alt" label="Alt text" maxlength="300" /><v-textarea :id="fieldId + '-caption'" v-model="caption" label="Caption" rows="2" maxlength="500" /><template v-if="localAsset"><v-select :id="fieldId + '-align'" v-model="align" label="Căn lề" :items="[{title:'Trái',value:'left'},{title:'Giữa',value:'center'},{title:'Phải',value:'right'}]" /><v-slider :id="fieldId + '-width'" name="Chiều rộng (%)" v-model="width" label="Chiều rộng (%)" :min="25" :max="100" :step="5" thumb-label="always" color="primary" class="mt-6" /><p class="field-help">Ảnh giữ nguyên tỉ lệ. Có thể dùng phím mũi tên để đổi kích thước.</p></template><p class="field-help">Caption được lưu trong title của ảnh Markdown. File gốc vẫn được giữ khi gỡ ảnh khỏi nội dung.</p><div class="form-actions"><v-btn variant="text" @click="editing = false">Hủy</v-btn><v-btn type="submit" color="primary">Áp dụng</v-btn></div></form></v-dialog>
  </NodeViewWrapper>
</template>
