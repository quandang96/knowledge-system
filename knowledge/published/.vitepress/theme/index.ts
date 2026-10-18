import type { Theme } from 'vitepress'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import Layout from './Layout.vue'
import MermaidPreview from '@atlas/ui/MermaidPreview.vue'
import { atlasDefaults, atlasTheme } from '@atlas/ui/theme'
import './styles.css'
export default {
  Layout,
  enhanceApp({ app }) {
    app.component('MermaidPreview', MermaidPreview)
    app.use(createVuetify({
      components,
      directives,
      theme: { defaultTheme: 'atlas', themes: { atlas: atlasTheme } },
      defaults: atlasDefaults
    }))
  }
} satisfies Theme
