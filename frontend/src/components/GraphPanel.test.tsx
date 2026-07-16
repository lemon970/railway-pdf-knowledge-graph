import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { GraphResponse } from '../api'
import { getGraphNeighborhood } from '../api'
import { GraphPanel } from './GraphPanel'

const lazyModule = vi.hoisted(() => {
  let resolve!: () => void
  let ready = false
  const promise = new Promise<void>((done) => { resolve = done })
  return {
    promise,
    release: () => {
      ready = true
      resolve()
    },
    isReady: () => ready,
  }
})

vi.mock('../api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api')>(),
  getGraphNeighborhood: vi.fn(),
}))

vi.mock('./GraphExplorer', () => ({
  GraphExplorer: ({ graph }: { graph: GraphResponse }) => {
    if (!lazyModule.isReady()) throw lazyModule.promise
    return <div>画布中心：{graph.center_id}</div>
  }
}))

const graph: GraphResponse = {
  center_id: 'D001',
  nodes: [{
    entity_id: 'D001', name: '踏面擦伤', entity_type: 'Defect', description: '踏面缺陷',
    pdf_page: 8, printed_page: 31, source_text: '踏面擦伤需旋修。',
  }],
  edges: [],
}

beforeEach(() => {
  vi.mocked(getGraphNeighborhood).mockReset()
})

function deferredGraph() {
  let resolve!: (graph: GraphResponse) => void
  const promise = new Promise<GraphResponse>((done) => { resolve = done })
  return { promise, resolve }
}

it('图数据返回后按需加载画布模块并显示中文 fallback', async () => {
  vi.mocked(getGraphNeighborhood).mockResolvedValue(graph)
  render(<GraphPanel entityId="D001" />)

  try {
    expect(await screen.findByText('正在准备图谱画布')).toBeInTheDocument()
  } finally {
    lazyModule.release()
  }
  expect(await screen.findByText('画布中心：D001')).toBeInTheDocument()
})

it('图谱加载状态与答案区域独立', () => {
  vi.mocked(getGraphNeighborhood).mockReturnValue(new Promise(() => {}))
  render(<GraphPanel entityId="D001" />)

  expect(screen.getByRole('status')).toHaveTextContent('正在加载图谱')
})

it('图谱失败只在图谱区域显示中文错误并可重试', async () => {
  const user = userEvent.setup()
  vi.mocked(getGraphNeighborhood)
    .mockRejectedValueOnce(new Error('图数据库暂时不可用'))
    .mockResolvedValueOnce(graph)
  render(<GraphPanel entityId="D001" />)

  expect(await screen.findByRole('alert')).toHaveTextContent('图数据库暂时不可用')
  await user.click(screen.getByRole('button', { name: '重试图谱' }))

  expect(await screen.findByText('画布中心：D001')).toBeInTheDocument()
  expect(getGraphNeighborhood).toHaveBeenCalledTimes(2)
})

it('entityId 快速变化时忽略不遵守 abort 的旧响应', async () => {
  const oldRequest = deferredGraph()
  const newRequest = deferredGraph()
  vi.mocked(getGraphNeighborhood)
    .mockReturnValueOnce(oldRequest.promise)
    .mockReturnValueOnce(newRequest.promise)
  const view = render(<GraphPanel entityId="D001" />)

  view.rerender(<GraphPanel entityId="D002" />)
  await act(() => {
    newRequest.resolve({ ...graph, center_id: 'D002' })
  })
  expect(await screen.findByText('画布中心：D002')).toBeInTheDocument()

  await act(() => { oldRequest.resolve(graph) })
  expect(screen.queryByText('画布中心：D001')).not.toBeInTheDocument()
})

it('重试请求延迟返回时保持独立状态并展示新结果', async () => {
  const user = userEvent.setup()
  const retryRequest = deferredGraph()
  let rejectOld!: (error: Error) => void
  const oldRequest = new Promise<GraphResponse>((_resolve, reject) => { rejectOld = reject })
  vi.mocked(getGraphNeighborhood)
    .mockReturnValueOnce(oldRequest)
    .mockReturnValueOnce(retryRequest.promise)
  render(<GraphPanel entityId="D001" />)

  await act(() => { rejectOld(new Error('图数据库暂时不可用')) })
  await user.click(await screen.findByRole('button', { name: '重试图谱' }))
  await act(() => { retryRequest.resolve({ ...graph, center_id: 'D002' }) })
  expect(await screen.findByText('画布中心：D002')).toBeInTheDocument()
})

it('卸载后中止请求并忽略延迟响应', async () => {
  const request = deferredGraph()
  let signal: AbortSignal | undefined
  vi.mocked(getGraphNeighborhood).mockImplementation((_entityId, requestSignal) => {
    signal = requestSignal
    return request.promise
  })
  const view = render(<GraphPanel entityId="D001" />)

  view.unmount()
  expect(signal?.aborted).toBe(true)
  await act(() => { request.resolve(graph) })
})
