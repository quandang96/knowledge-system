<script setup lang="ts">
import { computed } from 'vue'
import { dialogQueue, type DialogTone } from './dialog'

const current = computed(() => dialogQueue[0])
const icons: Record<DialogTone, string> = {
  info: 'mdi-information-outline',
  success: 'mdi-check-circle-outline',
  warning: 'mdi-alert-outline',
  error: 'mdi-alert-circle-outline'
}

function close(confirmed: boolean) {
  const request = dialogQueue.shift()
  request?.resolve(confirmed)
}
// Escape and outside clicks count as "cancel" (or as "close" for a plain notice).
function toggle(open: boolean) {
  if (!open) close(false)
}
</script>

<template>
  <v-dialog
    :model-value="!!current"
    max-width="460"
    role="alertdialog"
    aria-labelledby="app-dialog-title"
    aria-describedby="app-dialog-message"
    @update:model-value="toggle"
  >
    <v-card v-if="current" class="app-dialog" :class="`app-dialog--${current.tone}`">
      <div class="app-dialog-body">
        <span class="icon-tile" :class="`semantic-${current.tone}`"><v-icon :icon="icons[current.tone]" size="22" /></span>
        <div>
          <h2 id="app-dialog-title">{{ current.title }}</h2>
          <p id="app-dialog-message">{{ current.message }}</p>
        </div>
      </div>
      <div class="form-actions">
        <v-btn v-if="current.cancelText" variant="text" @click="close(false)">{{ current.cancelText }}</v-btn>
        <v-btn :color="current.tone === 'error' && current.cancelText ? 'error' : 'primary'" autofocus @click="close(true)">
          {{ current.confirmText }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>
