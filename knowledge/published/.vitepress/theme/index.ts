import type { Theme } from 'vitepress'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import Layout from './Layout.vue'
import './styles.css'
export default {
  Layout,
  enhanceApp({ app }) { app.use(createVuetify({ components, directives, theme: { defaultTheme: 'atlas', themes: { atlas: { dark: false, colors: { primary: '#3978c5', secondary: '#62748a', success: '#388979', background: '#f6f8fc', surface: '#ffffff' } } } }, defaults: { VBtn: { rounded: 'lg', elevation: 0, style: 'text-transform: none; letter-spacing: 0' }, VTextField: { variant: 'outlined', density: 'compact', color: 'primary' }, VSelect: { variant: 'outlined', density: 'compact', color: 'primary' }, VChip: { size: 'small', rounded: 'lg' } } })) }
} satisfies Theme
