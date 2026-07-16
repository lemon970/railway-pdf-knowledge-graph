import { StrictMode } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GraphResponse } from '../api'
import { GraphExplorer, type CytoscapeFactory } from './GraphExplorer'
import { graphToElements } from './graphElements'

const graph: GraphResponse = {
  center_id: 'D001',
  nodes: [
    {
      entity_id: 'D001', name: '踏面擦伤', entity_type: 'Defect', description: '踏面缺陷',
      pdf_page: 8, printed_page: 31, source_text: '踏面擦伤需旋修。',
    },
    {
      entity_id: 'A001', name: '旋修处理', entity_type: 'Action', description: '旋修踏面',
      pdf_page: 8, printed_page: 31, source_text: '按要求旋修处理。',
    },
  ],
  edges: [
    {
      relation_id: 'R001', relation_type: 'REQUIRES_ACTION', source_id: 'D001', target_id: 'A001',
      pdf_page: 8, printed_page: 31, source_text: '踏面擦伤需要旋修处理。',
    },
  ],
}

function fakeFactory() {
  const root = { id: () => graph.center_id }
  const run = vi.fn()
  const destroy = vi.fn()
  const layout = vi.fn(() => ({ run }))
  const getElementById = vi.fn(() => root)
  const factory = vi.fn(() => ({ layout, getElementById, destroy })) as unknown as CytoscapeFactory
  return { factory, root, run, destroy, layout, getElementById }
}

describe('graphToElements', () => {
  it('生成正确节点、边 ID 和中文标签', () => {
    expect(graphToElements(graph)).toEqual([
      expect.objectContaining({
        group: 'nodes',
        data: expect.objectContaining({ id: 'D001', label: '踏面擦伤\n缺陷', entityType: 'Defect' }),
      }),
      expect.objectContaining({
        group: 'nodes',
        data: expect.objectContaining({ id: 'A001', label: '旋修处理\n处理措施', entityType: 'Action' }),
      }),
      expect.objectContaining({
        group: 'edges',
        data: expect.objectContaining({
          id: 'R001', source: 'D001', target: 'A001', label: '需要处理',
        }),
      }),
    ])
  })
})

describe('GraphExplorer Cytoscape 生命周期', () => {
  it('以中心节点为根执行确定性 breadthfirst 布局并在卸载时销毁', () => {
    const fake = fakeFactory()
    const view = render(<GraphExplorer graph={graph} cytoscapeFactory={fake.factory} />)

    expect(fake.getElementById).toHaveBeenCalledWith('D001')
    expect(fake.layout).toHaveBeenCalledWith(expect.objectContaining({
      name: 'breadthfirst', directed: true, roots: fake.root, animate: false,
    }))
    expect(fake.run).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(fake.destroy).toHaveBeenCalledTimes(1)
  })

  it('StrictMode 每次 setup 都有对应 cleanup，不残留实例', () => {
    const destroys: Array<ReturnType<typeof vi.fn>> = []
    const factory = vi.fn(() => {
      const destroy = vi.fn()
      destroys.push(destroy)
      return {
        getElementById: vi.fn(() => ({})),
        layout: vi.fn(() => ({ run: vi.fn() })),
        destroy,
      }
    }) as unknown as CytoscapeFactory

    const view = render(<StrictMode><GraphExplorer graph={graph} cytoscapeFactory={factory} /></StrictMode>)
    view.unmount()

    expect(factory).toHaveBeenCalledTimes(2)
    expect(destroys).toHaveLength(2)
    expect(destroys.every((destroy) => destroy.mock.calls.length === 1)).toBe(true)
  })
})
