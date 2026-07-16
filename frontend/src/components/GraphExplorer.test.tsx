import { StrictMode } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  const run = vi.fn()
  const destroy = vi.fn()
  const fit = vi.fn()
  const on = vi.fn()
  const off = vi.fn()
  const unselect = vi.fn()
  const select = vi.fn()
  const root = { id: () => graph.center_id, select }
  const layout = vi.fn(() => ({ run }))
  const getElementById = vi.fn((id: string) => id === graph.center_id ? root : { select })
  const nodes = vi.fn(() => ({ unselect }))
  const factory = vi.fn(() => ({ layout, getElementById, destroy, fit, on, off, nodes })) as unknown as CytoscapeFactory
  return { factory, root, run, destroy, fit, on, off, select, unselect, layout, getElementById }
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
        on: vi.fn(),
        off: vi.fn(),
        nodes: vi.fn(() => ({ unselect: vi.fn() })),
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

describe('GraphExplorer 可访问替代路径', () => {
  it('显示带中文类型的实体列表、关系列表和完整节点详情', async () => {
    const user = userEvent.setup()
    render(<GraphExplorer graph={graph} cytoscapeFactory={fakeFactory().factory} />)

    expect(screen.getByRole('heading', { name: '实体列表' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '关系列表' })).toBeInTheDocument()
    expect(screen.getByText('踏面擦伤', { selector: '.graph-entity-list__name' })).toBeInTheDocument()
    expect(screen.getByText('缺陷', { selector: '.graph-type-label' })).toBeInTheDocument()
    expect(screen.getByText(/踏面擦伤.*需要处理.*旋修处理/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /旋修处理.*处理措施/ }))
    const details = screen.getByRole('region', { name: '实体详情' })
    expect(details).toHaveTextContent('旋修处理')
    expect(details).toHaveTextContent('处理措施')
    expect(details).toHaveTextContent('旋修踏面')
    expect(details).toHaveTextContent('按要求旋修处理。')
    expect(details).toHaveTextContent('PDF 第 8 页')
  })

  it('实体 button 可用 Enter 和 Space 选择并更新详情', async () => {
    const user = userEvent.setup()
    render(<GraphExplorer graph={graph} cytoscapeFactory={fakeFactory().factory} />)
    const action = screen.getByRole('button', { name: /旋修处理.*处理措施/ })
    const defect = screen.getByRole('button', { name: /踏面擦伤.*缺陷/ })

    action.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('region', { name: '实体详情' })).toHaveTextContent('旋修踏面')

    defect.focus()
    await user.keyboard(' ')
    expect(screen.getByRole('region', { name: '实体详情' })).toHaveTextContent('踏面缺陷')
  })

  it('画布 node select 事件同步实体列表和详情选中状态', () => {
    const fake = fakeFactory()
    render(<GraphExplorer graph={graph} cytoscapeFactory={fake.factory} />)
    const selectHandler = fake.on.mock.calls.find((call) => call[0] === 'select' && call[1] === 'node')?.[2]

    act(() => selectHandler({ target: { id: () => 'A001' } }))

    expect(screen.getByRole('button', { name: /旋修处理.*处理措施/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('region', { name: '实体详情' })).toHaveTextContent('旋修踏面')
  })

  it('重置选择会清空画布与语义列表的选中状态', async () => {
    const user = userEvent.setup()
    const fake = fakeFactory()
    render(<GraphExplorer graph={graph} cytoscapeFactory={fake.factory} />)
    await user.click(screen.getByRole('button', { name: /旋修处理.*处理措施/ }))

    await user.click(screen.getByRole('button', { name: '重置选择' }))

    expect(fake.unselect).toHaveBeenCalled()
    expect(screen.getByText('请选择实体查看详情')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /旋修处理.*处理措施/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('适应视图按钮调用 Cytoscape fit', async () => {
    const user = userEvent.setup()
    const fake = fakeFactory()
    render(<GraphExplorer graph={graph} cytoscapeFactory={fake.factory} />)

    await user.click(screen.getByRole('button', { name: '适应视图' }))

    expect(fake.fit).toHaveBeenCalledWith(undefined, 32)
  })

  it('工具栏按钮有中文 aria-label、title 和固定尺寸类，长文本有换行语义类', () => {
    render(<GraphExplorer graph={graph} cytoscapeFactory={fakeFactory().factory} />)

    expect(screen.getByRole('toolbar', { name: '图谱工具' })).toBeInTheDocument()
    const fitButton = screen.getByRole('button', { name: '适应视图' })
    expect(fitButton).toHaveAttribute('title', '适应视图')
    expect(fitButton).toHaveClass('graph-toolbar__button')
    expect(screen.getByRole('button', { name: '重置选择' })).toHaveAttribute('title', '重置选择')
    expect(document.querySelectorAll('.graph-text-wrap').length).toBeGreaterThan(0)
  })

  it('空图显示中文空状态且仍显示空的实体和关系列表', () => {
    render(<GraphExplorer
      graph={{ center_id: 'missing', nodes: [], edges: [] }}
      cytoscapeFactory={fakeFactory().factory}
    />)

    expect(screen.getByText('暂无图谱实体')).toBeInTheDocument()
    expect(screen.getByText('暂无实体')).toBeInTheDocument()
    expect(screen.getByText('暂无关系')).toBeInTheDocument()
  })
})
