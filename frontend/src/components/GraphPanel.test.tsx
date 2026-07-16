import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { GraphResponse } from '../api'
import { getGraphNeighborhood } from '../api'
import { GraphPanel } from './GraphPanel'

vi.mock('../api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api')>(),
  getGraphNeighborhood: vi.fn(),
}))

vi.mock('./GraphExplorer', () => ({
  GraphExplorer: ({ graph }: { graph: GraphResponse }) => <div>画布中心：{graph.center_id}</div>,
}))

const graph = { center_id: 'D001', nodes: [], edges: [] } as GraphResponse

beforeEach(() => {
  vi.mocked(getGraphNeighborhood).mockReset()
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
