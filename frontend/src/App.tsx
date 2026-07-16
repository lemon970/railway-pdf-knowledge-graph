import { BookOpenText } from 'lucide-react'
import { SystemStatus } from './components/SystemStatus'

export default function App() {
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

        <section className="status-section" aria-labelledby="status-heading">
          <div className="section-heading">
            <p className="section-label">系统检查</p>
            <h2 id="status-heading">Neo4j 状态</h2>
          </div>
          <SystemStatus />
        </section>
      </main>

      <footer className="site-footer">铁路规章知识库 · 系统状态台账</footer>
    </div>
  )
}
