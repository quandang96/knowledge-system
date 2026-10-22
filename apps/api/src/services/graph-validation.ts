import { graphSchema, type Graph } from '../../../../packages/schemas/src/index'
import { AppError } from './filesystem'
export function validateGraph(value: unknown): Graph {
  const graph = graphSchema.parse(value)
  const ids = new Set(graph.nodes.map((n) => n.id))
  if (ids.size !== graph.nodes.length || new Set(graph.edges.map((e) => e.id)).size !== graph.edges.length)
    throw new AppError(400, 'ID node/edge bị trùng.')
  if (graph.edges.some((e) => !ids.has(e.source) || !ids.has(e.target)))
    throw new AppError(400, 'Edge tham chiếu node không tồn tại.')
  return graph
}
export { toMermaid } from '../../../../packages/schemas/src/graph-utils'
