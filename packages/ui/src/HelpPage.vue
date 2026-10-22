<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import guide from '../../../docs/HUONG_DAN_SU_DUNG.md?raw'
const parser = new MarkdownIt({ html: false, linkify: false })
// The guide is also read on GitHub; links to repository files have no target inside the app, so keep their text only.
const html = computed(() => parser.render(guide.replace(/\[([^\]]+)\]\((?!https?:|#)[^)]*\)/g, '$1')))
</script>
<template>
  <div class="breadcrumb-line"><a href="/">Knowledge Hub</a><v-icon icon="mdi-chevron-right" size="16" /><span>Hướng dẫn sử dụng</span></div>
  <!-- eslint-disable-next-line vue/no-v-html -- html:false renders the bundled guide only -->
  <article class="narrow-page prose" v-html="html" />
</template>
