import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QuestionForm } from './QuestionForm'

describe('QuestionForm', () => {
  it('四个真实中文示例只填入输入框', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<QuestionForm disabled={false} isLoading={false} onSubmit={onSubmit} />)

    const examples = [
      '轮对由哪些部件组成？',
      '车轮直径小于Φ800mm时如何处理？',
      '车轮轮缘厚度的限度标准是什么？',
      '更换闸瓦需要经过哪些工序？',
    ]

    for (const example of examples) {
      await user.click(screen.getByRole('button', { name: example }))
      expect(screen.getByRole('textbox', { name: '请输入铁路检修问题' })).toHaveValue(example)
    }
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('空白提交显示中文校验错误', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<QuestionForm disabled={false} isLoading={false} onSubmit={onSubmit} />)

    await user.type(screen.getByRole('textbox'), '   ')
    await user.click(screen.getByRole('button', { name: '查询规程' }))

    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent('请输入要查询的问题')
    expect(error).toHaveAttribute('aria-live', 'assertive')
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('允许提交 500 字问题并阻止超过 500 字的问题', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<QuestionForm disabled={false} isLoading={false} onSubmit={onSubmit} />)
    const input = screen.getByRole('textbox')
    const submit = screen.getByRole('button', { name: '查询规程' })
    const boundaryQuestion = '问'.repeat(500)

    expect(input).toHaveAttribute('maxLength', '500')
    fireEvent.change(input, { target: { value: boundaryQuestion } })
    await user.click(submit)
    expect(onSubmit).toHaveBeenLastCalledWith(boundaryQuestion)

    fireEvent.change(input, { target: { value: `${boundaryQuestion}题` } })
    await user.click(submit)
    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent('问题不能超过 500 字')
    expect(error).toHaveAttribute('aria-live', 'assertive')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('查询期间禁用输入和提交并显示查询中', () => {
    render(<QuestionForm disabled={false} isLoading onSubmit={vi.fn()} />)

    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: '查询中' })).toBeDisabled()
  })
})
