<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import guide from './help/HUONG_DAN_SU_DUNG.md?raw'
import sizes from './help/images/sizes.json'
// Screenshots ship with the bundle. The guide refers to them as images/<file> so it also renders on GitHub;
// tests/e2e/help-screenshots.ts regenerates them and their sizes.
const images = import.meta.glob<string>('./help/images/*.webp', { eager: true, query: '?url', import: 'default' })
const parser = new MarkdownIt({ html: false, linkify: false })
// Same anchors as GitHub, so the table of contents works in both places.
const anchor = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '').replace(/\s/g, '-')
parser.renderer.rules.heading_open = (tokens, index, options, _env, self) => {
  tokens[index].attrSet('id', anchor(tokens[index + 1]?.content || ''))
  return self.renderToken(tokens, index, options)
}
const renderImage = parser.renderer.rules.image!
parser.renderer.rules.image = (tokens, index, options, env, self) => {
  const token = tokens[index]
  const src = token.attrGet('src') || ''
  const url = images[`./help/${src}`]
  if (!url) return renderImage(tokens, index, options, env, self)
  const size = (sizes as Record<string, number[]>)[src.replace(/^images\//, '')]
  // Reserving the box keeps lazy images from pushing the page while it scrolls to an anchor.
  if (size) {
    token.attrSet('width', String(size[0]))
    token.attrSet('height', String(size[1]))
  }
  token.attrSet('src', url)
  token.attrSet('loading', 'lazy')
  token.attrSet('class', 'guide-image')
  return `<a href="${url}" target="_blank" rel="noopener" class="guide-image-link">${renderImage(tokens, index, options, env, self)}</a>`
}
const html = parser.render(guide)
</script>
<template>
  <div class="breadcrumb-line"><a href="/">Knowledge Hub</a><v-icon icon="mdi-chevron-right" size="16" /><span>Hướng dẫn sử dụng</span></div>
  <!-- eslint-disable-next-line vue/no-v-html -- html:false renders the bundled guide only -->
  <article class="narrow-page prose help-guide" v-html="html" />
</template>
