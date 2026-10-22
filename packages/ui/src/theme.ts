// Shared by Vuetify and the semantic CSS tokens in workspace.css.
export const atlasColors = {
  primary: '#096FE8',
  'on-primary': '#ffffff',
  secondary: '#00A6C8',
  'on-secondary': '#1C2E46',
  'accent-soft': '#E6F9FD',
  'accent-text': '#007F97',
  background: '#FAFCFF',
  'on-background': '#203047',
  surface: '#ffffff',
  'on-surface': '#24344C',
  'surface-variant': '#F1F7FF',
  'on-surface-variant': '#4C617B',
  'text-secondary': '#455E79',
  'text-muted': '#5D7187',
  outline: '#D5E3F2',
  'outline-subtle': '#E6EFF8',
  'outline-strong': '#9CB4CD',
  'primary-soft': '#EAF4FF',
  'primary-hover': '#075BC4',
  'primary-pressed': '#064DA8',
  'focus-ring': '#CFE5FF',
  'control-outline': '#7D91A6',
  'control-outline-hover': '#526F8D',
  'input-line': '#7D91A6',
  'input-line-hover': '#526F8D',
  'control-disabled': '#F3F6FB',
  'control-disabled-outline': '#C2D0DF',
  'text-disabled': '#67788C',
  // Accessible foreground over disabled surfaces; the V3 base token stays available.
  'on-disabled': '#596F88',
  icon: '#426582',
  screen: '#0B7991',
  'screen-soft': '#E7F8FB',
  function: '#7453B6',
  'function-soft': '#F2EBFF',
  rule: '#B85D21',
  'rule-soft': '#FFF1E5',
  'row-hover': '#F2F8FF',
  'row-selected': '#E7F1FF',
  success: '#16814C',
  'on-success': '#ffffff',
  'success-soft': '#E9F9F0',
  warning: '#9B5A08',
  'on-warning': '#ffffff',
  'warning-soft': '#FFF5DF',
  error: '#BF2446',
  'on-error': '#ffffff',
  'error-soft': '#FFF0F2',
  info: '#0B7991',
  'on-info': '#ffffff',
  'info-soft': '#E7F8FB',
  diagram: '#7453B6',
  'diagram-soft': '#F2EBFF',
  media: '#B85D21',
  'media-soft': '#FFF1E5',
  'diagram-edge': '#6987A7',
  'diagram-process': '#E8F2FF',
  'diagram-decision': '#FFF4D9',
  'diagram-terminal': '#E6F7ED',
  'diagram-role': '#F1EBFF'
}

export const atlasTheme = {
  dark: false,
  colors: atlasColors,
  variables: {
    'high-emphasis-opacity': 1,
    'border-color': atlasColors.outline,
    'border-opacity': 1,
    'hover-opacity': 0.06,
    'focus-opacity': 0.1
  }
}

const fieldDefaults = { variant: 'underlined', density: 'comfortable', color: 'primary' }
export const atlasDefaults = {
  VBtn: { rounded: 'lg', elevation: 0, style: 'text-transform: none; letter-spacing: 0' },
  VTextField: { ...fieldDefaults },
  VSelect: { ...fieldDefaults },
  VTextarea: { ...fieldDefaults },
  VAutocomplete: { ...fieldDefaults },
  VChip: { size: 'small', rounded: 'lg' }
}
export const reviewColors = {
  draft: 'info',
  in_review: 'warning',
  changes_requested: 'error',
  approved: 'success'
} as const
// Shared semantic mapping; MDI remains the existing icon library.
import { typeIconGroups } from '../../schemas/src/document-types'
export { typeIconGroups }
export const iconGroup = (type: string) => typeIconGroups[type] || 'utility'
