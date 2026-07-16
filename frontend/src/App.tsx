import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpenText, RefreshCw } from 'lucide-react'
import { askNaturalQuestion, type QuestionAnswer } from './api'
import { AnswerPanel } from './components/AnswerPanel'
import { QuestionForm } from './components/QuestionForm'
import { SystemStatus } from './components/SystemStatus'

export default function App() {
  const [connection, setConnection] = useState<'checking' | 'connected' | 'unavailable'>('checking')
  const [answer, setAnswer] = useState<QuestionAnswer | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const lastQuestionRef = useRef('')
  const activeRequestRef = useRef<{ id: number; controller: AbortController } | null>(null)
  const requestIdRef = useRef(0)

  const runQuestion = useCallback((question: string) => {
    activeRequestRef.current?.controller.abort()
    const controller = new AbortController()
    const id = ++requestIdRef.current
    activeRequestRef.current = { id, controller }
    lastQuestionRef.current = question
    setAnswer(null)
    setError('')
    setIsLoading(true)

    void askNaturalQuestion(question, controller.signal)
      .then((result) => {
        if (activeRequestRef.current?.id === id) setAnswer(result)
      })
      .catch((requestError: unknown) => {
        if (activeRequestRef.current?.id !== id || controller.signal.aborted) return
        setError(requestError instanceof Error ? requestError.message : '查询失败，请稍后重试')
      })
      .finally(() => {
        if (activeRequestRef.current?.id !== id) return
        activeRequestRef.current = null
        setIsLoading(false)
      })
  }, [])

  useEffect(() => () => activeRequestRef.current?.controller.abort(), [])

  const handleConnectionChange = useCallback((state: typeof connection) => {
    setConnection(state)
    if (state === 'unavailable') {
      activeRequestRef.current?.controller.abort()
      activeRequestRef.current = null
      setIsLoading(false)
    }
  }, [])

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <span className="site-mark" aria-hidden="true">
            <BookOpenText size={20} strokeWidth={1.8} />
          </span>
          <div>
            <p className="site-kicker">铁路规章资料检索台</p>
            <h1>铁路 PDF 知识图谱</h1>
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="scope-band" aria-labelledby="scope-heading">
          <div>
            <p className="section-label">当前资料库</p>
            <h2 id="scope-heading">数据范围：铁路规章 PDF 文档</h2>
          </div>
          <p>用于核对规章资料入库范围与图数据库连接情况。</p>
        </section>

        <section className="question-section" aria-labelledby="question-heading">
          <div className="section-heading">
            <p className="section-label">自然语言检索</p>
            <h2 id="question-heading">规章问答</h2>
          </div>
          <QuestionForm
            disabled={connection !== 'connected'}
            isLoading={isLoading}
            onSubmit={runQuestion}
          />
          {error && (
            <div className="query-error" role="alert" aria-live="assertive">
              <p>{error}</p>
              <button type="button" onClick={() => runQuestion(lastQuestionRef.current)}>
                <RefreshCw size={16} aria-hidden="true" />重试查询
              </button>
            </div>
          )}
          {answer && <AnswerPanel result={answer} />}
        </section>

        <section className="status-section" aria-labelledby="status-heading">
          <div className="section-heading">
            <p className="section-label">系统检查</p>
            <h2 id="status-heading">Neo4j 状态</h2>
          </div>
          <SystemStatus onConnectionChange={handleConnectionChange} />
        </section>
      </main>

      <footer className="site-footer">铁路规章知识库 · 系统状态台账</footer>
    </div>
  )
}
