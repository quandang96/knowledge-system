import { defineConfig } from 'vitepress'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const repository = process.env.ATLAS_PROJECT_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export default defineConfig({
  title: 'Atlas · Business Knowledge Hub', description: 'Tri thức nghiệp vụ được kết nối cho đội ngũ BA, Developer và Tester.', lang: 'vi-VN',
  cleanUrls: true, outDir: process.env.ATLAS_BUILD_OUTPUT || path.resolve(repository, 'knowledge/published/.vitepress/dist'),
  vite: { build: { assetsInlineLimit: 0 }, resolve: { alias: { '@atlas/ui': path.join(repository, 'packages/ui/src'), '@atlas/schemas': path.join(repository, 'packages/schemas/src/index.ts') } }, server: { proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true, configure: proxy => { proxy.on('proxyReq', (proxyReq, req) => { if (req.headers.origin) proxyReq.setHeader('origin', 'http://127.0.0.1:3001') }) } } }, fs: { allow: [repository] } }, ssr: { noExternal: ['vuetify'] } },
  markdown: { config(md) { const original = md.renderer.rules.fence!; md.renderer.rules.fence = (tokens, index, options, env, self) => tokens[index].info.trim() === 'mermaid' ? `<pre class="mermaid-source">${md.utils.escapeHtml(tokens[index].content)}</pre>` : original(tokens, index, options, env, self) } }
})
