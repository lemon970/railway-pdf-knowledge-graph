import { CircleCheck, Tags } from 'lucide-react'
import {
  entityTypeLabels,
  processingMethodLabels,
  type QuestionAnswer,
} from '../api'
import { EvidenceList } from './EvidenceList'

export function AnswerPanel({ result }: { result: QuestionAnswer }) {
  if (!result.found) {
    return (
      <section className="answer-panel answer-panel--empty" aria-labelledby="answer-heading">
        <h2 id="answer-heading">查询结论</h2>
        <p>未找到证据</p>
      </section>
    )
  }

  return (
    <section className="answer-panel" aria-labelledby="answer-heading">
      <header className="answer-panel__header">
        <div>
          <p className="section-label">检索结果</p>
          <h2 id="answer-heading"><CircleCheck size={19} aria-hidden="true" />查询结论</h2>
        </div>
        <p className="method-label">处理方式：<strong>{processingMethodLabels[result.processing_method]}</strong></p>
      </header>
      <p className="answer-text">{result.answer}</p>

      <section className="entity-section" aria-labelledby="entity-heading">
        <h3 id="entity-heading"><Tags size={17} aria-hidden="true" />相关实体</h3>
        <ul className="entity-list">
          {result.entities.map((entity) => (
            <li key={entity.entity_id}>
              <span>{entity.name}</span>
              <small>{entityTypeLabels[entity.entity_type]}</small>
            </li>
          ))}
        </ul>
      </section>

      <EvidenceList evidence={result.evidence} />
    </section>
  )
}
