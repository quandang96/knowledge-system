import type { MermaidConfig } from 'mermaid'
import { atlasColors as c } from './theme'

export const mermaidOptions: MermaidConfig = {
  startOnLoad: false, securityLevel: 'strict', theme: 'base', suppressErrorRendering: true,
  fontFamily: 'Be Vietnam Pro, Noto Sans JP, Yu Gothic, Meiryo, sans-serif',
  maxTextSize: 50000, maxEdges: 500, htmlLabels: false,
  secure: ['secure','securityLevel','startOnLoad','maxTextSize','maxEdges','suppressErrorRendering','htmlLabels','theme','themeVariables','themeCSS','fontFamily','flowchart'],
  themeVariables: { primaryColor: c['diagram-process'], primaryTextColor: c['on-surface'], primaryBorderColor: c.primary, lineColor: c['diagram-edge'], secondaryColor: c['diagram-role'], tertiaryColor: c['diagram-decision'], edgeLabelBackground: c.surface, fontSize: '15px', clusterBkg: c['surface-variant'], clusterBorder: c.outline },
  flowchart: { htmlLabels: false, curve: 'basis', nodeSpacing: 64, rankSpacing: 80, padding: 18 },
  themeCSS: [
    ['atlasProcess',c['diagram-process'],c.primary],['atlasDecision',c['diagram-decision'],c.warning],['atlasTerminal',c['diagram-terminal'],c.success],['atlasRole',c['diagram-role'],c.diagram]
  ].map(([name,fill,stroke]) => `.${name} > :is(rect,polygon,path,circle,ellipse) {fill:${fill};stroke:${stroke};stroke-width:1.5px}`).join('\n')
}

let renderer: Promise<typeof import('mermaid')['default']> | undefined
export function mermaidRenderer() {
  renderer ||= import('mermaid').then(({default: mermaid}) => { mermaid.initialize(mermaidOptions); return mermaid }).catch(error => { renderer = undefined; throw error })
  return renderer
}
export const mermaidPlaceholder = (source: string) => `<div class="atlas-mermaid-block atlas-wide-block" data-atlas-mermaid="${encodeURIComponent(source).replace(/'/g,'%27')}"></div>`
