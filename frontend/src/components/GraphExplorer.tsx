import { useEffect, useRef, useState } from 'react'
import cytoscape, { type CytoscapeOptions } from 'cytoscape'
import { Maximize2, RotateCcw } from 'lucide-react'
import {
  entityTypeLabels,
  relationTypeLabels,
  type GraphResponse,
} from '../api'
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
  const cytoscapeRef = useRef<cytoscape.Core | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || graph.nodes.length === 0) return
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
    cytoscapeRef.current = cy
    const handleNodeSelect = (event: cytoscape.EventObject) => {
      setSelectedNodeId(event.target.id())
    }
    cy.on('select', 'node', handleNodeSelect)

    return () => {
      cy.off('select', 'node', handleNodeSelect)
      if (cytoscapeRef.current === cy) cytoscapeRef.current = null
      cy.destroy()
    }
  }, [cytoscapeFactory, graph])

  useEffect(() => {
    const cy = cytoscapeRef.current
    if (!cy || selectedNodeId === null) return
    cy.nodes().unselect()
    cy.getElementById(selectedNodeId).select()
  }, [selectedNodeId])

  const selectedNode = graph.nodes.find((node) => node.entity_id === selectedNodeId)
  const nodeNames = new Map(graph.nodes.map((node) => [node.entity_id, node.name]))

  const resetSelection = () => {
    cytoscapeRef.current?.nodes().unselect()
    setSelectedNodeId(null)
  }

  return (
    <div className="graph-explorer-shell">
      <div className="graph-toolbar" role="toolbar" aria-label="图谱工具">
        <button
          type="button"
          className="graph-toolbar__button"
          aria-label="适应视图"
          title="适应视图"
          onClick={() => cytoscapeRef.current?.fit(undefined, 32)}
        >
          <Maximize2 size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="graph-toolbar__button"
          aria-label="重置选择"
          title="重置选择"
          onClick={resetSelection}
        >
          <RotateCcw size={17} aria-hidden="true" />
        </button>
      </div>

      {graph.nodes.length === 0 ? (
        <div className="graph-explorer graph-explorer--empty" role="status">暂无图谱实体</div>
      ) : (
        <div
          ref={containerRef}
          className="graph-explorer"
          role="img"
          aria-label={`以 ${graph.center_id} 为中心的知识图谱，共 ${graph.nodes.length} 个实体`}
        />
      )}

      <div className="graph-semantic-content">
        <section className="graph-list-section" aria-labelledby="graph-entities-heading">
          <h3 id="graph-entities-heading">实体列表</h3>
          {graph.nodes.length === 0 ? <p className="graph-empty-copy">暂无实体</p> : (
            <ul className="graph-entity-list">
              {graph.nodes.map((node) => (
                <li key={node.entity_id}>
                  <button
                    type="button"
                    aria-pressed={selectedNodeId === node.entity_id}
                    onClick={() => setSelectedNodeId(node.entity_id)}
                  >
                    <span className="graph-entity-list__name graph-text-wrap">{node.name}</span>
                    <span className="graph-type-label">{entityTypeLabels[node.entity_type]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="graph-list-section" aria-labelledby="graph-relations-heading">
          <h3 id="graph-relations-heading">关系列表</h3>
          {graph.edges.length === 0 ? <p className="graph-empty-copy">暂无关系</p> : (
            <ul className="graph-relation-list">
              {graph.edges.map((edge) => (
                <li key={edge.relation_id}>
                  <p className="graph-text-wrap">
                    {nodeNames.get(edge.source_id) ?? edge.source_id} · {relationTypeLabels[edge.relation_type]} · {nodeNames.get(edge.target_id) ?? edge.target_id}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="graph-node-details" aria-labelledby="graph-details-heading">
          <h3 id="graph-details-heading">实体详情</h3>
          {selectedNode ? (
            <dl>
              <div><dt>名称</dt><dd className="graph-text-wrap">{selectedNode.name}</dd></div>
              <div><dt>类型</dt><dd>{entityTypeLabels[selectedNode.entity_type]}</dd></div>
              <div><dt>说明</dt><dd className="graph-text-wrap">{selectedNode.description || '暂无说明'}</dd></div>
              <div>
                <dt>来源</dt>
                <dd className="graph-text-wrap">
                  <span>PDF 第 {selectedNode.pdf_page} 页，印刷页第 {selectedNode.printed_page} 页</span>
                  <span>{selectedNode.source_text}</span>
                </dd>
              </div>
            </dl>
          ) : <p className="graph-empty-copy">请选择实体查看详情</p>}
        </section>
      </div>
    </div>
  )
}
