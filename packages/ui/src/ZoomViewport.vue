<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ title: string }>()
const fullscreen = ref(false); const scale = ref(1); const x = ref(0); const y = ref(0)
const fullscreenTarget = ref<HTMLElement>()
let drag: { x: number; y: number; left: number; top: number } | null = null
function reset() { scale.value = 1; x.value = 0; y.value = 0 }
function zoom(delta: number) { scale.value = Math.max(.25, Math.min(4, Number((scale.value + delta).toFixed(2)))) }
function start(event: PointerEvent) { if (event.button !== 0 || (event.target as Element).closest('button,a')) return; drag = { x: event.clientX, y: event.clientY, left: x.value, top: y.value }; (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId) }
function move(event: PointerEvent) { if (!drag) return; x.value = drag.left + event.clientX - drag.x; y.value = drag.top + event.clientY - drag.y }
function keyboard(event: KeyboardEvent) { if (event.key === '+' || event.key === '=') zoom(.25); else if (event.key === '-') zoom(-.25); else if (event.key === '0') reset(); else return; event.preventDefault() }
</script>
<template>
  <div class="zoom-viewer">
    <div class="viewer-toolbar"><span>{{ title }}</span><v-spacer /><v-btn icon="mdi-minus" variant="text" aria-label="Thu nhỏ" title="Thu nhỏ (-)" @click="zoom(-.25)" /><output aria-live="polite">{{ Math.round(scale * 100) }}%</output><v-btn icon="mdi-plus" variant="text" aria-label="Phóng to" title="Phóng to (+)" @click="zoom(.25)" /><v-btn icon="mdi-fit-to-screen-outline" variant="text" aria-label="Vừa khung / Đặt lại" title="Vừa khung / Đặt lại (0)" @click="reset" /><slot name="actions" /><v-btn icon="mdi-fullscreen" variant="text" aria-label="Toàn màn hình" title="Toàn màn hình" @click="reset(); fullscreen = true" /></div>
    <Teleport :to="fullscreenTarget || 'body'" :disabled="!fullscreen || !fullscreenTarget"><div class="viewer-canvas" tabindex="0" :aria-label="`${title}. Phím cộng/trừ để zoom, 0 để đặt lại; kéo để di chuyển.`" @keydown="keyboard" @pointerdown="start" @pointermove="move" @pointerup="drag = null" @pointercancel="drag = null"><div class="viewer-transform" :style="{transform:`translate(${x}px, ${y}px) scale(${scale})`}"><slot /></div></div></Teleport>
    <v-dialog v-model="fullscreen" fullscreen><section class="viewer-fullscreen"><header class="viewer-toolbar"><strong>{{ title }}</strong><v-spacer /><v-btn icon="mdi-minus" variant="text" aria-label="Thu nhỏ toàn màn hình" @click="zoom(-.25)" /><output>{{ Math.round(scale * 100) }}%</output><v-btn icon="mdi-plus" variant="text" aria-label="Phóng to toàn màn hình" @click="zoom(.25)" /><v-btn icon="mdi-fit-to-screen-outline" variant="text" aria-label="Đặt lại toàn màn hình" @click="reset" /><v-btn icon="mdi-close" variant="text" aria-label="Đóng toàn màn hình" @click="fullscreen = false; reset()" /></header><div ref="fullscreenTarget" class="viewer-fullscreen-host"></div></section></v-dialog>
  </div>
</template>
