import { z } from 'zod'

const intentSchema = z.enum([
  'component_association',
  'defect_action',
  'limit_standard',
  'procedure_steps',
])
const processingMethodSchema = z.enum(['structured', 'rule', 'ai'])
const entityTypeSchema = z.enum(['Component', 'Defect', 'Action', 'Standard', 'Procedure'])
const relationTypeSchema = z.enum([
  'PART_OF',
  'HAS_DEFECT',
  'REQUIRES_ACTION',
  'HAS_STANDARD',
  'NEXT_STEP',
])

const entitySchema = z.strictObject({
  entity_id: z.string().min(1),
  name: z.string().min(1),
  entity_type: entityTypeSchema,
})
const relationSchema = z.strictObject({
  relation_type: relationTypeSchema,
  source_id: z.string().min(1),
  target_id: z.string().min(1),
})
const evidenceSchema = z.strictObject({
  pdf_page: z.number().int().positive(),
  printed_page: z.number().int().positive(),
  source_text: z.string().min(1),
})

const graphNodeSchema = z.strictObject({
  entity_id: z.string().min(1),
  name: z.string().min(1),
  entity_type: entityTypeSchema,
  description: z.string(),
  pdf_page: z.number().int().positive(),
  printed_page: z.number().int().positive(),
  source_text: z.string().min(1),
})

const graphEdgeSchema = z.strictObject({
  relation_id: z.string().min(1),
  relation_type: relationTypeSchema,
  source_id: z.string().min(1),
  target_id: z.string().min(1),
  pdf_page: z.number().int().positive(),
  printed_page: z.number().int().positive(),
  source_text: z.string().min(1),
})

export const graphResponseSchema = z.strictObject({
  center_id: z.string().min(1),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
})

export const questionAnswerSchema = z.strictObject({
  intent: intentSchema,
  subject: z.string(),
  found: z.boolean(),
  answer: z.string().min(1),
  processing_method: processingMethodSchema,
  focus_entity_id: z.string().min(1).nullable(),
  entities: z.array(entitySchema),
  relations: z.array(relationSchema),
  evidence: z.array(evidenceSchema),
}).superRefine((answer, context) => {
  const entityIds = new Set(answer.entities.map((entity) => entity.entity_id))
  if (answer.found && (!answer.focus_entity_id || !entityIds.has(answer.focus_entity_id))) {
    context.addIssue({ code: 'custom', message: 'invalid focus entity' })
  }
  if (answer.found && answer.evidence.length === 0) {
    context.addIssue({ code: 'custom', message: 'missing evidence' })
  }
  if (!answer.found && (
    answer.answer !== '未找到证据'
    || answer.focus_entity_id !== null
    || answer.entities.length > 0
    || answer.relations.length > 0
    || answer.evidence.length > 0
  )) {
    context.addIssue({ code: 'custom', message: 'invalid empty result' })
  }
})

const errorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
})

export type QuestionAnswer = z.infer<typeof questionAnswerSchema>
export type ProcessingMethod = z.infer<typeof processingMethodSchema>
export type EntityType = z.infer<typeof entityTypeSchema>
export type RelationType = z.infer<typeof relationTypeSchema>
export type GraphResponse = z.infer<typeof graphResponseSchema>

export const processingMethodLabels = {
  structured: '结构化查询',
  rule: '规则识别',
  ai: 'AI 辅助',
} satisfies Record<ProcessingMethod, string>

export const entityTypeLabels = {
  Component: '部件',
  Defect: '缺陷',
  Action: '处理措施',
  Standard: '限度标准',
  Procedure: '工序',
} satisfies Record<EntityType, string>

export const relationTypeLabels = {
  PART_OF: '组成关系',
  HAS_DEFECT: '存在缺陷',
  REQUIRES_ACTION: '需要处理',
  HAS_STANDARD: '符合标准',
  NEXT_STEP: '下一工序',
} satisfies Record<RelationType, string>

const knownErrorMessages: Record<string, string> = {
  UNKNOWN_INTENT: '暂不支持这类问题',
  DATABASE_UNAVAILABLE: '图数据库暂时不可用',
}

export class QuestionApiError extends Error {}
export class GraphApiError extends Error {}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export async function askNaturalQuestion(
  question: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<QuestionAnswer> {
  let response: Response
  try {
    response = await fetcher('/api/natural-questions', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
      signal,
    })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new QuestionApiError('无法连接查询服务')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new QuestionApiError('查询服务返回的数据格式无效')
  }

  if (!response.ok) {
    const parsedError = errorResponseSchema.safeParse(body)
    if (!parsedError.success) {
      throw new QuestionApiError('查询服务返回的数据格式无效')
    }
    throw new QuestionApiError(
      knownErrorMessages[parsedError.data.error.code] ?? '查询失败，请稍后重试',
    )
  }

  const parsedAnswer = questionAnswerSchema.safeParse(body)
  if (!parsedAnswer.success) {
    throw new QuestionApiError('查询服务返回的数据格式无效')
  }
  return parsedAnswer.data
}

export async function getGraphNeighborhood(
  entityId: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<GraphResponse> {
  let response: Response
  try {
    response = await fetcher(`/api/graph/${encodeURIComponent(entityId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new GraphApiError('无法连接图谱服务')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new GraphApiError('图谱服务返回的数据格式无效')
  }

  if (!response.ok) {
    const parsedError = errorResponseSchema.safeParse(body)
    if (!parsedError.success) {
      throw new GraphApiError('图谱服务返回的数据格式无效')
    }
    const message = {
      ENTITY_NOT_FOUND: '未找到对应实体',
      DATABASE_UNAVAILABLE: '图数据库暂时不可用',
    }[parsedError.data.error.code] ?? '图谱加载失败，请稍后重试'
    throw new GraphApiError(message)
  }

  const parsedGraph = graphResponseSchema.safeParse(body)
  if (!parsedGraph.success) {
    throw new GraphApiError('图谱服务返回的数据格式无效')
  }
  return parsedGraph.data
}
