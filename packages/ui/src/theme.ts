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
  'on-surface': '#203047',
  'surface-variant': '#F1F7FF',
  'on-surface-variant': '#4C617B',
  'text-secondary': '#4C617B',
  'text-muted': '#5D7187',
  outline: '#D8E4F0',
  'outline-subtle': '#E6EFF8',
  'outline-strong': '#9CB4CD',
  'primary-soft': '#E7F1FF',
  'primary-hover': '#075BC2',
  'primary-pressed': '#064DA8',
  'focus-ring': '#CFE5FF',
  'control-outline': '#7D91A6',
  'control-outline-hover': '#526F8D',
  'input-line': '#8195AA',
  'input-line-hover': '#536F8B',
  'control-disabled': '#F3F6FB',
  'control-disabled-outline': '#C2D0DF',
  'text-disabled': '#67788C',
  // Accessible foreground over disabled surfaces; the V3 base token stays available.
  'on-disabled': '#596F88',
  icon: '#476581',
  'row-hover': '#F2F8FF',
  'row-selected': '#E7F1FF',
  success: '#137D52',
  'on-success': '#ffffff',
  'success-soft': '#E8F7EF',
  warning: '#A26107',
  'on-warning': '#ffffff',
  'warning-soft': '#FFF5DF',
  error: '#BF3546',
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
    'hover-opacity': .06,
    'focus-opacity': .1
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
export const reviewColors = { draft: 'info', in_review: 'warning', changes_requested: 'error', approved: 'success' } as const
// Shared semantic mapping; MDI remains the existing icon library.
export const typeIconGroups: Record<string, string> = { overview:'primary', 'business-flow':'diagram', module:'primary', screen:'media', function:'primary', role:'warning', permission:'warning', 'business-rule':'warning', reference:'info' }
export const iconGroup = (type: string) => typeIconGroups[type] || 'utility'
