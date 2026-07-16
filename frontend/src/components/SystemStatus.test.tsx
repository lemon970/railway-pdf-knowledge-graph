import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SystemStatus } from './SystemStatus'

describe('SystemStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('初次检测时显示中文加载状态', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}))

    render(<SystemStatus />)

    expect(screen.getByRole('status')).toHaveTextContent('正在检测数据库连接')
  })

  it('健康检查通过时显示数据库已连接', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', database: 'connected' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(<SystemStatus />)

    expect(await screen.findByText('数据库已连接')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/health', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('数据库离线时显示不可用状态', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: 'degraded', database: 'unavailable' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(<SystemStatus />)

    expect(await screen.findByText('数据库暂不可用')).toBeInTheDocument()
  })

  it('HTTP 错误时显示不可用状态', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }))

    render(<SystemStatus />)

    expect(await screen.findByText('数据库暂不可用')).toBeInTheDocument()
  })

  it('网络错误后可点击重新检测', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok', database: 'connected' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    render(<SystemStatus />)
    expect(await screen.findByText('数据库暂不可用')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '重新检测' }))

    expect(await screen.findByText('数据库已连接')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
