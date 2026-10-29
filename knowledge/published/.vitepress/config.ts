import { defineConfig } from 'vitepress'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
const apiOrigin = process.env.ATLAS_API_TARGET || 'http://127.0.0.1:3001'
const repository = process.env.ATLAS_PROJECT_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export default defineConfig({
  title: 'Atlas · Business Knowledge Hub', description: 'Tri thức nghiệp vụ được kết nối cho đội ngũ BA, Developer và Tester.', lang: 'vi-VN',
  cleanUrls: true, outDir: process.env.ATLAS_BUILD_OUTPUT || path.resolve(repository, 'knowledge/published/.vitepress/dist'),
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]],
  vite: { plugins: [{name:'atlas-legacy-tombstone',enforce:'pre',transform(code,id){
    if(!id.endsWith('.md')||!code.startsWith('---'))return
    const {data}=matter(code)
    if(data.type==='test-scenario'||data.entity_type==='test-scenario')return `---\ntitle: Kho lưu trữ legacy\natlas_view: legacy\n${data.doc_id?`legacy_doc_id: ${JSON.stringify(data.doc_id)}\n`:''}---\n`
    // DocumentPage renders bodies from the API, so drop them here: author HTML and `{{ }}` must
    // never reach the Vue compiler. Revisit if a page starts using <Content /> or local search.
    const end=code.indexOf('\n---',3)
    if(data.doc_id&&end>0)return `${code.slice(0,end+4)}\n`
  }}], build: { assetsInlineLimit: 0 }, resolve: { alias: { '@atlas/ui': path.join(repository, 'packages/ui/src'), '@atlas/schemas': path.join(repository, 'packages/schemas/src/index.ts') } }, server: { proxy: { '/api': { target: apiOrigin, changeOrigin: true, configure: proxy => { proxy.on('proxyReq', (proxyReq, req) => { if (req.headers.origin) proxyReq.setHeader('origin', apiOrigin) }) } } }, fs: { allow: [repository] } }, ssr: { noExternal: ['vuetify'] } },
  markdown: { config(md) { const original = md.renderer.rules.fence!; md.renderer.rules.fence = (tokens, index, options, env, self) => tokens[index].info.trim() === 'mermaid' ? `<MermaidPreview :source="${md.utils.escapeHtml(JSON.stringify(tokens[index].content))}" />` : original(tokens, index, options, env, self) } }
})
