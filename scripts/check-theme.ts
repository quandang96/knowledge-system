import { atlasColors } from '../packages/ui/src/theme.ts'

function luminance(hex: string) {
  const parts = hex.replace('#', '').match(/../g)!.map(value => parseInt(value, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  return parts[0] * .2126 + parts[1] * .7152 + parts[2] * .0722
}
const pairs = [
  ['body', atlasColors['on-surface'], atlasColors.surface, 4.5],
  ['secondary text', atlasColors['text-secondary'], atlasColors.background, 4.5],
  ['muted', atlasColors['text-muted'], atlasColors.background, 4.5],
  ['link', atlasColors.primary, atlasColors.surface, 4.5],
  ['primary button', atlasColors['on-primary'], atlasColors.primary, 4.5],
  ['primary hover', atlasColors['on-primary'], atlasColors['primary-hover'], 4.5],
  ['primary pressed', atlasColors['on-primary'], atlasColors['primary-pressed'], 4.5],
  ['selected navigation text', atlasColors['primary-hover'], atlasColors['primary-soft'], 4.5],
  ['selected navigation icon', atlasColors.primary, atlasColors['primary-soft'], 3],
  ['accent text', atlasColors['accent-text'], atlasColors.surface, 4.5],
  ['on accent', atlasColors['on-secondary'], atlasColors.secondary, 4.5],
  ['success', atlasColors.success, atlasColors['success-soft'], 4.5],
  ['warning', atlasColors.warning, atlasColors['warning-soft'], 4.5],
  ['error', atlasColors.error, atlasColors['error-soft'], 4.5],
  ['info', atlasColors.info, atlasColors['info-soft'], 4.5],
  ['field label', atlasColors['text-secondary'], atlasColors.surface, 4.5],
  ['placeholder', atlasColors['text-muted'], atlasColors.surface, 4.5],
  ['disabled rendered text', atlasColors['on-disabled'], atlasColors['control-disabled'], 4.5],
  ['underline', atlasColors['input-line'], atlasColors.surface, 3],
  ['underline hover', atlasColors['input-line-hover'], atlasColors.surface, 3],
  ['diagram icon', atlasColors.diagram, atlasColors['diagram-soft'], 3],
  ['media icon', atlasColors.media, atlasColors['media-soft'], 3],
  ['table row', atlasColors['on-surface'], atlasColors['row-hover'], 4.5],
  ['icon', atlasColors.icon, atlasColors.surface, 3],
  ['field border', atlasColors['control-outline'], atlasColors.surface, 3],
  ['field border on canvas', atlasColors['control-outline'], atlasColors.background, 3],
  ['field hover', atlasColors['control-outline-hover'], atlasColors.surface, 3],
  ['focus indicator', atlasColors.primary, atlasColors.surface, 3]
] as const
let failed = false
for (const [role, foreground, background, minimum] of pairs) {
  const fg = luminance(foreground); const bg = luminance(background)
  const contrast = (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05)
  console.log(`${role}: ${contrast.toFixed(2)}:1 (min ${minimum}) ${contrast >= minimum ? 'PASS' : 'FAIL'}`)
  if (contrast < minimum) failed = true
}
if (failed) process.exitCode = 1
