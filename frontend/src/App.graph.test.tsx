import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { GraphResponse } from './api'
import App from './App'

vi.mock('./components/SystemStatus', () => ({
  SystemStatus: ({ onConnectionChange }: {
    onConnectionChange?: (state: 'connected') => void
  }) => <button type="button" onClick={() => onConnectionChange?.('connected')}>模拟连接</button>,
}))

vi.mock('./components/GraphExplorer', () => ({
  GraphExplorer: ({ graph }: { graph: GraphResponse }) => <div>图谱画布：{graph.center_id}</div>,
}))

const foundAnswer = {
  intent: 'defect_action', subject: '踏面擦伤', found: true, answer: '需要旋修处理',
  processing_method: 'rule', focus_entity_id: 'D/001',
  entities: [{ entity_id: 'D/001', name: '踏面擦伤', entity_type: 'Defect' }],
  relations: [], evidence: [{ pdf_page: 8, printed_page: 31, source_text: '踏面擦伤需旋修。' }],
}

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }))
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))

async function submit() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: '模拟连接' }))
  await user.type(screen.getByRole('textbox'), '踏面擦伤怎么处理？')
  await user.click(screen.getByRole('button', { name: '查询规程' }))
}

it('found=true 且有 focus_entity_id 时请求并展示图谱', async () => {
  vi.mocked(fetch).mockImplementation((input) => String(input).startsWith('/api/graph/')
    ? jsonResponse({
      center_id: 'D/001',
      nodes: [{
        entity_id: 'D/001', name: '踏面擦伤', entity_type: 'Defect', description: '踏面缺陷',
        pdf_page: 8, printed_page: 31, source_text: '踏面擦伤需旋修。',
      }],
      edges: [],
    })
    : jsonResponse(foundAnswer))

  await submit()

  expect(await screen.findByText('图谱画布：D/001')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/api/graph/D%2F001', expect.objectContaining({ method: 'GET' }))
})

it('found=false 时不请求图谱', async () => {
  vi.mocked(fetch).mockImplementation(() => jsonResponse({
    ...foundAnswer, found: false, answer: '未找到证据', focus_entity_id: null,
    entities: [], relations: [], evidence: [],
  }))

  await submit()

  expect(await screen.findByText('未找到证据')).toBeInTheDocument()
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.every(([input]) => (
    !String(input).startsWith('/api/graph/')
  ))).toBe(true))
})
