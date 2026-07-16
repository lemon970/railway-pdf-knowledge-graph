import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./components/SystemStatus', () => ({
  SystemStatus: ({
    onConnectionChange,
  }: {
    onConnectionChange?: (connection: 'checking' | 'connected' | 'unavailable') => void
  }) => (
    <div>
      <button type="button" onClick={() => onConnectionChange?.('connected')}>模拟连接</button>
      <button type="button" onClick={() => onConnectionChange?.('unavailable')}>模拟离线</button>
    </div>
  ),
}))

const firstAnswer = {
  intent: 'defect_action',
  subject: '旧问题',
  found: true,
  answer: '旧查询答案',
  processing_method: 'rule',
  focus_entity_id: 'D001',
  entities: [{ entity_id: 'D001', name: '旧问题', entity_type: 'Defect' }],
  relations: [],
  evidence: [{ pdf_page: 6, printed_page: 29, source_text: '旧规程证据' }],
}

const secondAnswer = {
  ...firstAnswer,
  subject: '新问题',
  answer: '新查询答案',
  focus_entity_id: 'D002',
  entities: [{ entity_id: 'D002', name: '新问题', entity_type: 'Defect' }],
  evidence: [{ pdf_page: 7, printed_page: 30, source_text: '新规程证据' }],
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function connectAndSubmit(question: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: '模拟连接' }))
  const input = screen.getByRole('textbox')
  await user.clear(input)
  await user.type(input, question)
  await user.click(screen.getByRole('button', { name: '查询规程' }))
  return { input, user }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

it('App 卸载时取消活动查询请求', async () => {
  let questionSignal: AbortSignal | undefined
  vi.mocked(fetch).mockImplementation((_input, init) => {
    questionSignal = init?.signal ?? undefined
    return new Promise(() => {})
  })
  const view = render(<App />)

  await connectAndSubmit('待取消的问题')
  await waitFor(() => expect(questionSignal).toBeDefined())
  view.unmount()

  expect(questionSignal?.aborted).toBe(true)
})

it('开始新查询时立即清除旧答案', async () => {
  let queryCount = 0
  vi.mocked(fetch).mockImplementation(() => {
    queryCount += 1
    return queryCount === 1
      ? Promise.resolve(jsonResponse(firstAnswer))
      : new Promise(() => {})
  })
  render(<App />)

  const { input, user } = await connectAndSubmit('旧问题')
  expect(await screen.findByText('旧查询答案')).toBeInTheDocument()
  await user.clear(input)
  await user.type(input, '新问题')
  await user.click(screen.getByRole('button', { name: '查询规程' }))

  expect(screen.queryByText('旧查询答案')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '查询中' })).toBeDisabled()
})

it('已取消的旧请求结果不会覆盖后续查询结果', async () => {
  let resolveOldRequest: ((response: Response) => void) | undefined
  let oldSignal: AbortSignal | undefined
  let queryCount = 0
  vi.mocked(fetch).mockImplementation((_input, init) => {
    queryCount += 1
    if (queryCount === 1) {
      oldSignal = init?.signal ?? undefined
      return new Promise<Response>((resolve) => {
        resolveOldRequest = resolve
      })
    }
    return Promise.resolve(jsonResponse(secondAnswer))
  })
  render(<App />)

  const { input, user } = await connectAndSubmit('旧问题')
  await user.click(screen.getByRole('button', { name: '模拟离线' }))
  expect(oldSignal?.aborted).toBe(true)
  await user.click(screen.getByRole('button', { name: '模拟连接' }))
  await user.clear(input)
  await user.type(input, '新问题')
  await user.click(screen.getByRole('button', { name: '查询规程' }))
  expect(await screen.findByText('新查询答案')).toBeInTheDocument()

  resolveOldRequest?.(jsonResponse(firstAnswer))
  await waitFor(() => expect(screen.queryByText('旧查询答案')).not.toBeInTheDocument())
  expect(screen.getByText('新查询答案')).toBeInTheDocument()
})
