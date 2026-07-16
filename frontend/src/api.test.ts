import { describe, expect, it, vi } from 'vitest'
import {
  askNaturalQuestion,
  entityTypeLabels,
  getGraphNeighborhood,
  graphResponseSchema,
  processingMethodLabels,
  relationTypeLabels,
} from './api'

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

export const validGraph = {
  center_id: 'D001',
  nodes: [
    {
      entity_id: 'D001',
      name: '车轮直径小于限值',
      entity_type: 'Defect',
      description: '车轮直径不足',
      pdf_page: 6,
      printed_page: 29,
      source_text: '车轮直径小于限值时需要处理。',
    },
    {
      entity_id: 'A001',
      name: '整体更换车轮',
      entity_type: 'Action',
      description: '更换车轮及轮盘',
      pdf_page: 6,
      printed_page: 29,
      source_text: '整体更换车轮（含轮盘）。',
    },
  ],
  edges: [
    {
      relation_id: 'R001',
      relation_type: 'REQUIRES_ACTION',
      source_id: 'D001',
      target_id: 'A001',
      pdf_page: 6,
      printed_page: 29,
      source_text: '车轮直径不足需要整体更换车轮。',
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

  it('拒绝非法关系类型', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      ...validAnswer,
      relations: [{ ...validAnswer.relations[0], relation_type: 'RELATED_TO' }],
    }))

    await expect(askNaturalQuestion('测试问题', undefined, fetcher)).rejects.toMatchObject({
      message: '查询服务返回的数据格式无效',
    })
  })
})

describe('graphResponseSchema', () => {
  it('接受字段完整且枚举已知的图谱响应', () => {
    expect(graphResponseSchema.parse(validGraph)).toEqual(validGraph)
  })

  it.each([
    [{ ...validGraph, extra: true }],
    [{ ...validGraph, nodes: [{ ...validGraph.nodes[0], pdf_page: 0 }] }],
    [{ ...validGraph, edges: [{ ...validGraph.edges[0], relation_type: 'RELATED_TO' }] }],
    [{ ...validGraph, nodes: [{ ...validGraph.nodes[0], entity_type: 'Unknown' }] }],
  ])('拒绝额外字段、非法页码或未知枚举', (payload) => {
    expect(graphResponseSchema.safeParse(payload).success).toBe(false)
  })

  it.each([
    ['中心实体不存在', { ...validGraph, center_id: 'D999' }],
    ['边端点悬空', {
      ...validGraph,
      edges: [{ ...validGraph.edges[0], target_id: 'A999' }],
    }],
    ['节点 ID 重复', {
      ...validGraph,
      nodes: [...validGraph.nodes, { ...validGraph.nodes[1], name: '重复节点' }],
    }],
    ['关系 ID 重复', {
      ...validGraph,
      edges: [...validGraph.edges, {
        ...validGraph.edges[0], source_id: 'A001', target_id: 'D001',
      }],
    }],
    ['节点与关系 ID 冲突', {
      ...validGraph,
      edges: [{ ...validGraph.edges[0], relation_id: 'D001' }],
    }],
  ])('拒绝%s', (_caseName, payload) => {
    expect(graphResponseSchema.safeParse(payload).success).toBe(false)
  })
})

describe('getGraphNeighborhood', () => {
  it('编码实体 ID 并使用 GET 请求图谱邻域', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(validGraph))

    await expect(getGraphNeighborhood('D/001 空格', undefined, fetcher)).resolves.toEqual(validGraph)
    expect(fetcher).toHaveBeenCalledWith(
      '/api/graph/D%2F001%20%E7%A9%BA%E6%A0%BC',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it.each([
    ['ENTITY_NOT_FOUND', '未找到对应实体'],
    ['DATABASE_UNAVAILABLE', '图数据库暂时不可用'],
  ])('将 %s 映射为固定中文错误', async (code, message) => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ error: { code, message: '内部服务细节' } }, 404),
    )

    await expect(getGraphNeighborhood('D001', undefined, fetcher)).rejects.toMatchObject({ message })
  })

  it('网络失败和无效格式均使用固定中文错误', async () => {
    const offline = vi.fn().mockRejectedValue(new TypeError('socket details'))
    const invalid = vi.fn().mockResolvedValue(jsonResponse({ center_id: 'D001' }))

    await expect(getGraphNeighborhood('D001', undefined, offline)).rejects.toMatchObject({
      message: '无法连接图谱服务',
    })
    await expect(getGraphNeighborhood('D001', undefined, invalid)).rejects.toMatchObject({
      message: '图谱服务返回的数据格式无效',
    })
  })
})

it('集中提供全部处理方式和实体类型中文映射', () => {
  expect(processingMethodLabels).toEqual({
    structured: '结构化查询',
    rule: '规则识别',
    ai: 'AI 辅助',
  })
  expect(entityTypeLabels).toEqual({
    Component: '部件',
    Defect: '缺陷',
    Action: '处理措施',
    Standard: '限度标准',
    Procedure: '工序',
  })
  expect(relationTypeLabels).toEqual({
    PART_OF: '组成关系',
    HAS_DEFECT: '存在缺陷',
    REQUIRES_ACTION: '需要处理',
    HAS_STANDARD: '符合标准',
    NEXT_STEP: '下一工序',
  })
})
