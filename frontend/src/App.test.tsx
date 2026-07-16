import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import App from './App'

const answer = {
  intent: 'defect_action',
  subject: '车轮直径小于Φ800mm',
  found: true,
  answer: '车轮直径小于Φ800mm需要整体更换车轮（含轮盘）',
  processing_method: 'rule',
  focus_entity_id: 'D001',
  entities: [
    { entity_id: 'D001', name: '车轮直径小于Φ800mm', entity_type: 'Defect' },
    { entity_id: 'A001', name: '整体更换车轮（含轮盘）', entity_type: 'Action' },
  ],
  relations: [
    { relation_type: 'REQUIRES_ACTION', source_id: 'D001', target_id: 'A001' },
  ],
  evidence: [
    {
      pdf_page: 6,
      printed_page: 29,
      source_text: '车轮直径小于Φ800mm时，车轮（含轮盘）整体更换。',
    },
  ],
}

function response(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function mockConnectedQuestion(result: unknown = answer) {
  vi.mocked(fetch).mockImplementation((input) => {
    const url = String(input)
    return url === '/health'
      ? response({ status: 'ok', database: 'connected' })
      : response(result)
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

it('显示成功答案、中文处理方式、中文实体类型和双页码证据', async () => {
  const user = userEvent.setup()
  mockConnectedQuestion()
  render(<App />)
  await screen.findByText('数据库已连接')

  expect(screen.getByRole('textbox')).toBeEnabled()
  expect(screen.getByRole('button', { name: '查询规程' })).toBeEnabled()

  await user.type(screen.getByRole('textbox'), '车轮直径小于Φ800mm时如何处理？')
  await user.click(screen.getByRole('button', { name: '查询规程' }))

  expect(await screen.findByRole('heading', { name: '查询结论' })).toBeInTheDocument()
  expect(screen.getByText(answer.answer)).toBeInTheDocument()
  expect(screen.getByText('规则识别')).toBeInTheDocument()
  expect(screen.getByText('车轮直径小于Φ800mm')).toBeInTheDocument()
  expect(screen.getByText('缺陷')).toBeInTheDocument()
  expect(screen.getByText('处理措施')).toBeInTheDocument()
  expect(screen.getByText(answer.evidence[0].source_text)).toBeInTheDocument()
  expect(screen.getByText('PDF 页码：6')).toBeInTheDocument()
  expect(screen.getByText('印刷页码：29')).toBeInTheDocument()
})

it('found=false 时只显示未找到证据', async () => {
  const user = userEvent.setup()
  mockConnectedQuestion({
    intent: 'procedure_steps', subject: '不存在的工序', found: false, answer: '未找到证据',
    processing_method: 'structured', focus_entity_id: null, entities: [], relations: [], evidence: [],
  })
  render(<App />)
  await screen.findByText('数据库已连接')

  await user.type(screen.getByRole('textbox'), '不存在的工序有哪些步骤？')
  await user.click(screen.getByRole('button', { name: '查询规程' }))

  expect(await screen.findByText('未找到证据')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '相关实体' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '规程原文' })).not.toBeInTheDocument()
})

it('错误可重试且保留输入', async () => {
  const user = userEvent.setup()
  let queryCount = 0
  vi.mocked(fetch).mockImplementation((input) => {
    if (String(input) === '/health') return response({ status: 'ok', database: 'connected' })
    queryCount += 1
    return queryCount === 1
      ? response({ error: { code: 'UNKNOWN_INTENT', message: 'unknown' } }, 422)
      : response(answer)
  })
  render(<App />)
  await screen.findByText('数据库已连接')
  const input = screen.getByRole('textbox')

  await user.type(input, '车轮怎么处理？')
  await user.click(screen.getByRole('button', { name: '查询规程' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('暂不支持这类问题')
  expect(input).toHaveValue('车轮怎么处理？')

  await user.click(screen.getByRole('button', { name: '重试查询' }))
  expect(await screen.findByText(answer.answer)).toBeInTheDocument()
  expect(input).toHaveValue('车轮怎么处理？')
})

it('数据库离线时禁用查询', async () => {
  vi.mocked(fetch).mockImplementation((input) => String(input) === '/health'
    ? response({ status: 'degraded', database: 'unavailable' }, 503)
    : response(answer))
  render(<App />)

  expect(await screen.findByText('数据库暂不可用')).toBeInTheDocument()
  expect(screen.getByRole('textbox')).toBeDisabled()
  expect(screen.getByRole('button', { name: '查询规程' })).toBeDisabled()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
})
