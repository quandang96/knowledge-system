<script setup lang="ts">
import { ref } from 'vue'
import { ApiError, fail, notify, state } from './state'
const props = withDefaults(defineProps<{ url: string; filename: string; icon?: string; iconOnly?: boolean; label?: string }>(), {icon:'mdi-download-outline',iconOnly:false,label:'Tải file'})
const busy = ref(false); const error = ref('')
async function load() {
  if(busy.value) return
  busy.value = true; error.value = ''
  try {
    const response = await fetch(props.url,{credentials:'same-origin'})
    if(!response.ok) { if(response.status===401)state.session=null; const payload=await response.json().catch(()=>null);throw new ApiError(response.status,payload?.error?.message || `Không tải được file (${response.status}).`) }
    const blob = await response.blob(); const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href=url; link.download=props.filename; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000)
    notify(`Đã chuẩn bị file ${props.filename}.`)
  } catch(failure) { error.value = failure instanceof TypeError ? 'Mất kết nối khi tải file. Kiểm tra mạng rồi thử lại.' : failure instanceof Error ? failure.message : 'Không thể tải file. Kiểm tra kết nối rồi thử lại.'; fail(new Error(error.value)) }
  finally { busy.value = false }
}
</script>
<template><span class="download-action"><v-btn size="small" variant="text" :prepend-icon="iconOnly ? undefined : icon" :icon="iconOnly ? icon : undefined" :loading="busy" :disabled="busy" :aria-label="label" :title="error || label" @click="load"><template v-if="!iconOnly"><slot>{{ label }}</slot></template></v-btn><span v-if="error" class="download-error" role="alert">{{ error }} Nhấn lại để thử.</span></span></template>
