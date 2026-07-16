import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, LoaderCircle, RefreshCw } from 'lucide-react'
import { z } from 'zod'

const healthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  database: z.enum(['connected', 'unavailable']),
})

type ConnectionState = 'checking' | 'connected' | 'unavailable'
const healthCheckTimeout = Symbol('health-check-timeout')
const healthCheckTimeoutMs = 5_000

async function readConnection(signal: AbortSignal): Promise<ConnectionState> {
  try {
    const response = await fetch('/health', {
      headers: { Accept: 'application/json' },
      signal,
    })

    if (!response.ok) {
      throw new Error('health request failed')
    }

    const health = healthSchema.parse(await response.json())
    return health.status === 'ok' && health.database === 'connected'
      ? 'connected'
      : 'unavailable'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    return 'unavailable'
  }
}

interface SystemStatusProps {
  onConnectionChange?: (connection: ConnectionState) => void
}

export function SystemStatus({ onConnectionChange }: SystemStatusProps) {
  const [connection, setConnection] = useState<ConnectionState>('checking')
  const activeControllerRef = useRef<AbortController | null>(null)

  const publishConnection = useCallback((nextConnection: ConnectionState) => {
    setConnection(nextConnection)
    onConnectionChange?.(nextConnection)
  }, [onConnectionChange])

  const runHealthCheck = useCallback(async () => {
    activeControllerRef.current?.abort()

    const controller = new AbortController()
    activeControllerRef.current = controller
    let timeoutId: number | undefined

    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(healthCheckTimeout)
        controller.abort()
      }, healthCheckTimeoutMs)
    })

    let result: ConnectionState
    try {
      result = await Promise.race([readConnection(controller.signal), timeout])
    } catch (error) {
      if (error !== healthCheckTimeout && controller.signal.aborted) {
        return
      }
      result = 'unavailable'
    } finally {
      window.clearTimeout(timeoutId)
    }

    if (activeControllerRef.current !== controller) {
      return
    }

    activeControllerRef.current = null
    publishConnection(result)
  }, [publishConnection])

  useEffect(() => {
    void runHealthCheck()
    return () => {
      activeControllerRef.current?.abort()
      activeControllerRef.current = null
    }
  }, [runHealthCheck])

  const handleRetry = () => {
    publishConnection('checking')
    void runHealthCheck()
  }

  const isChecking = connection === 'checking'

  return (
    <div className={`system-status system-status--${connection}`}>
      <div className="system-status__message" role="status" aria-live="polite">
        {connection === 'checking' && (
          <LoaderCircle className="status-icon status-icon--loading" size={22} aria-hidden="true" />
        )}
        {connection === 'connected' && (
          <CircleCheck className="status-icon" size={22} aria-hidden="true" />
        )}
        {connection === 'unavailable' && (
          <CircleAlert className="status-icon" size={22} aria-hidden="true" />
        )}
        <div>
          <strong>
            {connection === 'checking' && '正在检测数据库连接'}
            {connection === 'connected' && '数据库已连接'}
            {connection === 'unavailable' && '数据库暂不可用'}
          </strong>
          <span>
            {connection === 'checking' && '正在读取 Neo4j 健康状态'}
            {connection === 'connected' && 'Neo4j 服务响应正常'}
            {connection === 'unavailable' && '请确认后端与 Neo4j 服务已启动'}
          </span>
        </div>
      </div>

      <button type="button" onClick={handleRetry} disabled={isChecking}>
        <RefreshCw size={16} aria-hidden="true" />
        {isChecking ? '检测中' : '重新检测'}
      </button>
    </div>
  )
}
