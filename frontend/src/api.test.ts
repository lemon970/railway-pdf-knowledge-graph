import { describe, expect, it, vi } from 'vitest'
import { askNaturalQuestion } from './api'

const validAnswer = {
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
} as const

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('askNaturalQuestion', () => {
  it('提交自然语言问题并完整校验答案', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(validAnswer))

    const result = await askNaturalQuestion('车轮直径小于Φ800mm怎么处理？', undefined, fetcher)

    expect(result).toEqual(validAnswer)
    expect(fetcher).toHaveBeenCalledWith(
      '/api/natural-questions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ question: '车轮直径小于Φ800mm怎么处理？' }),
      }),
    )
  })

  it.each([
    ['UNKNOWN_INTENT', '暂不支持这类问题'],
    ['DATABASE_UNAVAILABLE', '图数据库暂时不可用'],
  ])('将 %s 映射为中文错误', async (code, message) => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ error: { code, message: '不应直接显示的服务端消息' } }, 422),
    )

    await expect(askNaturalQuestion('测试问题', undefined, fetcher)).rejects.toMatchObject({ message })
  })

  it('网络失败时返回固定中文错误', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(askNaturalQuestion('测试问题', undefined, fetcher)).rejects.toMatchObject({
      message: '无法连接查询服务',
    })
  })

  it('无效响应时不暴露 Zod 细节', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ ...validAnswer, intent: 'other' }))

    await expect(askNaturalQuestion('测试问题', undefined, fetcher)).rejects.toMatchObject({
      message: '查询服务返回的数据格式无效',
    })
  })
})
