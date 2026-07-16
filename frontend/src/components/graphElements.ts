import { type ElementDefinition } from 'cytoscape'
import {
  entityTypeLabels,
  relationTypeLabels,
  type GraphResponse,
} from '../api'

export function graphToElements(graph: GraphResponse): ElementDefinition[] {
  const nodes: ElementDefinition[] = graph.nodes.map((node) => ({
    group: 'nodes',
    data: {
      ...node,
      id: node.entity_id,
      entityType: node.entity_type,
      label: `${node.name}\n${entityTypeLabels[node.entity_type]}`,
    },
  }))
  const edges: ElementDefinition[] = graph.edges.map((edge) => ({
    group: 'edges',
    data: {
      ...edge,
      id: edge.relation_id,
      source: edge.source_id,
      target: edge.target_id,
      label: relationTypeLabels[edge.relation_type],
    },
  }))
  return [...nodes, ...edges]
}
