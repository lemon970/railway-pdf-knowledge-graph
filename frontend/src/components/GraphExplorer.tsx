import { useEffect, useRef } from 'react'
import cytoscape, { type CytoscapeOptions } from 'cytoscape'
import { type GraphResponse } from '../api'
import { graphToElements } from './graphElements'

export type CytoscapeFactory = (options: CytoscapeOptions) => cytoscape.Core

const graphStyles: cytoscape.StylesheetJson = [
  {
    selector: 'node',
    style: {
      'background-color': '#3f6f54',
      'border-color': '#ffffff',
      'border-width': 2,
      color: '#17221b',
      label: 'data(label)',
      'font-family': 'Microsoft YaHei, Noto Sans SC, sans-serif',
      'font-size': 11,
      'font-weight': 600,
      'text-background-color': '#ffffff',
      'text-background-opacity': 0.88,
      'text-background-padding': '3px',
      'text-halign': 'center',
      'text-margin-y': 8,
      'text-overflow-wrap': 'anywhere',
      'text-valign': 'bottom',
      'text-wrap': 'wrap',
      'text-max-width': '110px',
      height: 32,
      width: 32,
    },
  },
  { selector: 'node[entityType = "Defect"]', style: { 'background-color': '#a04b3d' } },
  { selector: 'node[entityType = "Action"]', style: { 'background-color': '#356f91' } },
  { selector: 'node[entityType = "Standard"]', style: { 'background-color': '#8b6c2f' } },
  { selector: 'node[entityType = "Procedure"]', style: { 'background-color': '#6b5a84' } },
  {
    selector: 'edge',
    style: {
      'curve-style': 'bezier',
      'line-color': '#849087',
      'target-arrow-color': '#849087',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.8,
      label: 'data(label)',
      color: '#4d5b52',
      'font-family': 'Microsoft YaHei, Noto Sans SC, sans-serif',
      'font-size': 9,
      'text-background-color': '#f8faf8',
      'text-background-opacity': 0.9,
      'text-background-padding': '2px',
      'text-overflow-wrap': 'anywhere',
      'text-rotation': 'autorotate',
      'text-wrap': 'wrap',
      'text-max-width': '80px',
      width: 1.5,
    },
  },
]

export function GraphExplorer({
  graph,
  cytoscapeFactory = cytoscape,
}: {
  graph: GraphResponse
  cytoscapeFactory?: CytoscapeFactory
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const cy = cytoscapeFactory({
      container: containerRef.current,
      elements: graphToElements(graph),
      style: graphStyles,
      minZoom: 0.35,
      maxZoom: 2.5,
    })
    const root = cy.getElementById(graph.center_id)
    const layoutOptions = {
      name: 'breadthfirst',
      directed: true,
      roots: root,
      animate: false,
      fit: true,
      padding: 32,
      spacingFactor: 1.15,
    }
    // Cytoscape accepts a node collection here, while its bundled declaration only lists IDs.
    cy.layout(layoutOptions as unknown as cytoscape.LayoutOptions).run()

    return () => cy.destroy()
  }, [cytoscapeFactory, graph])

  return (
    <div
      ref={containerRef}
      className="graph-explorer"
      role="img"
      aria-label={`以 ${graph.center_id} 为中心的知识图谱，共 ${graph.nodes.length} 个实体`}
    />
  )
}
