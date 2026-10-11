import type { Graph } from './index'
export function toMermaid(graph: Graph) {
  const label = (value: string) => value.replace(/["<>\n\r]/g, ' ').replace(/[&|{}[\]`]/g, ' ')
  const ids = new Map(graph.nodes.map((n, i) => [n.id, `n${i}`]))
  return ['flowchart LR', ...graph.nodes.map(n => `  ${ids.get(n.id)}${n.type === 'decision' ? '{' : '['}"${label(n.label)}"${n.type === 'decision' ? '}' : ']'}`), ...graph.edges.map(e => `  ${ids.get(e.source)} -->${e.label ? `|"${label(e.label)}"|` : ''} ${ids.get(e.target)}`)].join('\n')
}
