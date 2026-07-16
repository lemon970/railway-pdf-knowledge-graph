import { useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'

const exampleQuestions = [
  '轮对由哪些部件组成？',
  '车轮直径小于Φ800mm时如何处理？',
  '车轮轮缘厚度的限度标准是什么？',
  '更换闸瓦需要经过哪些工序？',
]
const maximumQuestionLength = 500

interface QuestionFormProps {
  disabled: boolean
  isLoading: boolean
  onSubmit: (question: string) => void
}

export function QuestionForm({ disabled, isLoading, onSubmit }: QuestionFormProps) {
  const [question, setQuestion] = useState('')
  const [validationError, setValidationError] = useState('')
  const isDisabled = disabled || isLoading

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) {
      setValidationError('请输入要查询的问题')
      return
    }
    if (trimmedQuestion.length > maximumQuestionLength) {
      setValidationError('问题不能超过 500 字')
      return
    }
    setValidationError('')
    onSubmit(trimmedQuestion)
  }

  return (
    <form className="question-form" onSubmit={handleSubmit}>
      <label htmlFor="natural-question">请输入铁路检修问题</label>
      <div className="question-form__controls">
        <textarea
          id="natural-question"
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value)
            if (validationError) setValidationError('')
          }}
          placeholder="例如：车轮直径小于Φ800mm时如何处理？"
          rows={3}
          maxLength={maximumQuestionLength}
          disabled={isDisabled}
          aria-describedby={validationError ? 'question-validation' : undefined}
          aria-invalid={Boolean(validationError)}
        />
        <button className="primary-button" type="submit" disabled={isDisabled}>
          <Search size={17} aria-hidden="true" />
          {isLoading ? '查询中' : '查询规程'}
        </button>
      </div>
      {validationError && (
        <p id="question-validation" className="form-error" role="alert" aria-live="assertive">
          {validationError}
        </p>
      )}
      <div className="question-examples" aria-label="示例问题">
        <span>示例问题</span>
        <div>
          {exampleQuestions.map((example) => (
            <button
              key={example}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                setQuestion(example)
                setValidationError('')
              }}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
      {disabled && !isLoading && <p className="form-note">数据库恢复连接后可查询</p>}
    </form>
  )
}
