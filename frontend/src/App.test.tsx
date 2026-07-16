import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import App from './App'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', database: 'connected' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
})

it('显示唯一项目标题、数据范围和 Neo4j 状态', async () => {
  render(<App />)

  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('铁路 PDF 知识图谱')
  expect(screen.getByText('数据范围：铁路规章 PDF 文档')).toBeInTheDocument()
  expect(screen.getByText('Neo4j 状态')).toBeInTheDocument()
  expect(await screen.findByText('数据库已连接')).toBeInTheDocument()
})
