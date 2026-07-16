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

const knownErrorMessages: Record<string, string> = {
  UNKNOWN_INTENT: '暂不支持这类问题',
  DATABASE_UNAVAILABLE: '图数据库暂时不可用',
}

export class QuestionApiError extends Error {}

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
