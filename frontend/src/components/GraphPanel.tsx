import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Network, RefreshCw } from 'lucide-react'
import { getGraphNeighborhood, type GraphResponse } from '../api'

const LazyGraphExplorer = lazy(async () => {
  const module = await import('./GraphExplorer')
  return { default: module.GraphExplorer }
})

const visibleGraphErrors = new Set([
  '未找到对应实体',
  '图数据库暂时不可用',
  '无法连接图谱服务',
  '图谱服务返回的数据格式无效',
  '图谱加载失败，请稍后重试',
])

export function GraphPanel({ entityId }: { entityId: string }) {
  return <GraphPanelRequest key={entityId} entityId={entityId} />
}

export function GraphPanelRequest({ entityId }: { entityId: string }) {
  const [graph, setGraph] = useState<GraphResponse | null>(null)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)
  const activeRequestRef = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    const requestId = ++activeRequestRef.current
    void getGraphNeighborhood(entityId, controller.signal)
      .then((response) => {
        if (controller.signal.aborted || activeRequestRef.current !== requestId) return
        setGraph(response)
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted || activeRequestRef.current !== requestId) return
        const message = requestError instanceof Error ? requestError.message : ''
        setError(visibleGraphErrors.has(message) ? message : '图谱加载失败，请稍后重试')
      })

    return () => {
      controller.abort()
      if (activeRequestRef.current === requestId) activeRequestRef.current += 1
    }
  }, [entityId, requestVersion])

  const retry = () => {
    activeRequestRef.current += 1
    setGraph(null)
    setError('')
    setRequestVersion((value) => value + 1)
  }

  return (
    <section className="graph-panel" aria-labelledby="graph-heading">
      <header className="graph-panel__header">
        <div>
          <p className="section-label">实体邻域</p>
          <h2 id="graph-heading"><Network size={18} aria-hidden="true" />知识图谱</h2>
        </div>
        {graph && <span>{graph.nodes.length} 个实体</span>}
      </header>
      {!graph && !error && <div className="graph-state" role="status">正在加载图谱</div>}
      {error && (
        <div className="graph-state graph-state--error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={retry}>
            <RefreshCw size={15} aria-hidden="true" />重试图谱
          </button>
        </div>
      )}
      {graph && (
        <Suspense fallback={(
          <div className="graph-state" role="status">正在准备图谱画布</div>
        )}>
          <LazyGraphExplorer graph={graph} />
        </Suspense>
      )}
    </section>
  )
}
