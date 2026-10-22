<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vitepress'
import { idSchema, metadataSchema, typeIcons, typeLabels, types, type DraftRecord, type Metadata } from '../../schemas/src/index'
import { api, canManage, currentProject, notify, state } from './state'
import { createDialog, rememberCreated } from './create-document'

const router = useRouter()
const formRef = ref<{ validate(): Promise<{ valid: boolean }>; resetValidation(): void }>()
const busy = ref(false)
const advanced = ref(false)
const type = ref<Metadata['type']>('screen')
const title = ref('')
const module = ref('')
const templateId = ref('')
const owner = ref('')
const docId = ref('')
const language = ref<Metadata['language']>('vi')
const functionGroup = ref('')
const functionKind = ref('')

// Business-facing types first, in the order teams usually document them.
const focused = ['screen', 'function', 'business-rule', 'reference']
const rank = (type: string) => (focused.includes(type) ? focused.indexOf(type) : focused.length)
const typeItems = [...types].sort((a, b) => rank(a) - rank(b)).map((value) => ({ title: typeLabels[value], value }))
const modules = computed(() => currentProject.value?.modules || [])
const templates = computed(() => [
  { id: '', name: 'Mẫu mặc định theo loại' },
  ...(state.workspace?.templates.filter(
    (item) => item.type === type.value && (!item.project_id || item.project_id === state.project)
  ) || [])
])
const functionRules = computed(() => (type.value === 'function' ? currentProject.value?.function_id_rules : undefined))

const required = (message: string) => (value: string) => !!value?.trim() || message
const rules = {
  title: [required('Nhập tiêu đề tài liệu.'), (value: string) => value.length <= 180 || 'Tối đa 180 ký tự.'],
  module: [required('Chọn phân hệ.')],
  owner: [required('Nhập người phụ trách.'), (value: string) => value.length <= 100 || 'Tối đa 100 ký tự.'],
  docId: [
    (value: string) =>
      !value || idSchema.safeParse(value).success || 'Chỉ dùng chữ IN HOA, số và dấu gạch ngang, ví dụ SCR-APP-001.'
  ],
  functionPair: [() => !!functionGroup.value === !!functionKind.value || 'Chọn đủ nhóm nghiệp vụ và loại chức năng.']
}

watch(
  () => createDialog.open,
  (open) => {
    if (!open) return
    type.value = createDialog.type || 'screen'
    title.value = ''
    module.value = modules.value.length === 1 ? modules.value[0].id : ''
    templateId.value = ''
    owner.value = state.session?.user || ''
    docId.value = ''
    language.value = 'vi'
    functionGroup.value = ''
    functionKind.value = ''
    advanced.value = false
    formRef.value?.resetValidation()
  }
)
watch(type, () => {
  templateId.value = ''
  functionGroup.value = ''
  functionKind.value = ''
})
// A typed ID is uppercase by convention; normalise as the user types instead of rejecting it later.
watch(docId, (value) => {
  const upper = value.toUpperCase().replace(/\s+/g, '-')
  if (upper !== value) docId.value = upper
})

function close() {
  if (!busy.value) createDialog.open = false
}
// Escape and outside clicks close the dialog, except while the draft is being created.
function toggle(open: boolean) {
  if (open) createDialog.open = true
  else close()
}

async function submit() {
  if (busy.value) return
  if (!(await formRef.value?.validate())?.valid) return
  busy.value = true
  try {
    const meta = metadataSchema.parse({
      doc_id: docId.value || 'AUTO-NEW',
      project_id: state.project,
      type: type.value,
      module: module.value,
      title: title.value.trim(),
      owner: owner.value.trim(),
      language: language.value,
      ...(type.value === 'screen' ? { screen: {} } : {})
    })
    const function_code_request =
      type.value === 'function' && functionGroup.value && functionKind.value
        ? { group: functionGroup.value, kind: functionKind.value }
        : undefined
    let doc: DraftRecord
    if (docId.value) {
      doc = await api<DraftRecord>('/api/documents', {
        method: 'POST',
        body: JSON.stringify({ metadata: meta, function_code_request })
      })
    } else {
      const metadata: Partial<Metadata> = { ...meta }
      delete metadata.doc_id
      doc = await api<DraftRecord>('/api/documents/new', {
        method: 'POST',
        body: JSON.stringify({ metadata, template_id: templateId.value || undefined, function_code_request })
      })
    }
    createDialog.open = false
    notify(`Đã tạo bản nháp ${doc.metadata.doc_id}.`)
    // Studio, when open, takes the draft in place; elsewhere we move to Studio with it preloaded.
    if (!window.dispatchEvent(new CustomEvent('atlas:document-created', { detail: doc, cancelable: true }))) return
    rememberCreated(doc)
    await router.go(`/studio/?doc=${encodeURIComponent(doc.metadata.doc_id)}`)
  } catch (failure) {
    // Field problems are shown under each field; server refusals (duplicate ID, missing rules…) open the dialog.
    notify(failure instanceof Error ? failure.message : 'Không thể tạo tài liệu. Kiểm tra các trường rồi thử lại.', 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="createDialog.open"
    max-width="640"
    :persistent="busy"
    scrollable
    @update:model-value="toggle"
  >
    <v-card class="create-dialog">
      <v-form ref="formRef" class="new-doc-form" validate-on="blur lazy" @submit.prevent="submit">
        <div class="create-dialog-heading">
          <div>
            <span class="eyebrow">Tài liệu mới · {{ currentProject?.name || 'Chưa chọn project' }}</span>
            <h2>Bắt đầu một bản nháp</h2>
          </div>
          <v-btn icon="mdi-close" variant="text" size="small" aria-label="Đóng" :disabled="busy" @click="close" />
        </div>
        <v-alert v-if="!modules.length" type="info" variant="tonal" class="mb-4">
          Project chưa có phân hệ nên chưa thể tạo tài liệu.
          <a v-if="canManage" href="/settings/workspace/" class="text-link" @click="close">Thêm phân hệ</a>
          <span v-else>Liên hệ Admin để thêm phân hệ.</span>
        </v-alert>
        <div class="form-grid">
          <v-select
            v-model="type"
            :items="typeItems"
            label="Loại tài liệu"
            :prepend-inner-icon="typeIcons[type]"
            class="full-width"
          />
          <v-text-field
            v-model="title"
            label="Tiêu đề"
            :rules="rules.title"
            counter="180"
            autofocus
            class="full-width"
          />
          <v-select
            v-model="module"
            :items="modules"
            item-title="name"
            item-value="id"
            label="Phân hệ"
            :rules="rules.module"
            :disabled="!modules.length"
          />
          <v-text-field v-model="owner" label="Người phụ trách" :rules="rules.owner" />
          <template v-if="functionRules?.enabled">
            <v-select
              v-model="functionGroup"
              :items="functionRules.groups"
              item-title="name"
              item-value="code"
              label="Nhóm nghiệp vụ (Function ID)"
              :rules="rules.functionPair"
              clearable
            />
            <v-select
              v-model="functionKind"
              :items="functionRules.kinds"
              item-title="name"
              item-value="code"
              label="Loại chức năng (Function ID)"
              :rules="rules.functionPair"
              clearable
            />
          </template>
          <p v-else-if="type === 'function'" class="field-help full-width">
            Function ID chưa được bật cho project này; có thể cấp mã sau khi Admin xác nhận quy ước.
          </p>
          <v-select
            v-model="templateId"
            :items="templates"
            item-title="name"
            item-value="id"
            label="Mẫu nội dung"
            :disabled="!!docId"
            :hint="docId ? 'Mẫu tùy chỉnh chỉ áp dụng khi hệ thống tự tạo ID.' : ''"
            persistent-hint
            class="full-width"
          />
        </div>
        <button
          type="button"
          class="advanced-toggle"
          :aria-expanded="advanced"
          aria-controls="create-advanced"
          @click="advanced = !advanced"
        >
          <v-icon :icon="advanced ? 'mdi-chevron-down' : 'mdi-chevron-right'" size="18" />Tùy chọn nâng cao
        </button>
        <div v-show="advanced" id="create-advanced" class="form-grid">
          <v-text-field
            v-model="docId"
            label="Document ID"
            placeholder="Để trống để hệ thống tự tạo"
            :rules="rules.docId"
            persistent-placeholder
          />
          <v-select v-model="language" label="Ngôn ngữ" :items="[{ title: 'Tiếng Việt', value: 'vi' }, { title: '日本語', value: 'ja' }, { title: 'English', value: 'en' }]" />
        </div>
        <div class="form-actions">
          <v-btn variant="text" :disabled="busy" @click="close">Hủy</v-btn>
          <v-btn type="submit" color="primary" :loading="busy" :disabled="!modules.length || !state.project">
            Tạo bản nháp
          </v-btn>
        </div>
      </v-form>
    </v-card>
  </v-dialog>
</template>
