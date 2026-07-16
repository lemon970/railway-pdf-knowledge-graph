import { useEffect, useState } from 'react'
import { Network, RefreshCw } from 'lucide-react'
import { getGraphNeighborhood, type GraphResponse } from '../api'
import { GraphExplorer } from './GraphExplorer'

const visibleGraphErrors = new Set([
  '未找到对应实体',
  '图数据库暂时不可用',
  '无法连接图谱服务',
  '图谱服务返回的数据格式无效',
  '图谱加载失败，请稍后重试',
])

export function GraphPanel({ entityId }: { entityId: string }) {
  const [graph, setGraph] = useState<GraphResponse | null>(null)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void getGraphNeighborhood(entityId, controller.signal)
      .then(setGraph)
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        const message = requestError instanceof Error ? requestError.message : ''
        setError(visibleGraphErrors.has(message) ? message : '图谱加载失败，请稍后重试')
      })

    return () => controller.abort()
  }, [entityId, requestVersion])

  const retry = () => {
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
      {graph && <GraphExplorer graph={graph} />}
    </section>
  )
}
