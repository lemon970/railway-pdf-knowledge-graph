import { FileText } from 'lucide-react'
import type { QuestionAnswer } from '../api'

type Evidence = QuestionAnswer['evidence'][number]

export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  return (
    <section className="evidence-section" aria-labelledby="evidence-heading">
      <h3 id="evidence-heading"><FileText size={17} aria-hidden="true" />规程原文</h3>
      <ol className="evidence-list">
        {evidence.map((item, index) => (
          <li key={`${item.pdf_page}-${item.printed_page}-${index}`}>
            <blockquote>{item.source_text}</blockquote>
            <p>
              <span>PDF 页码：{item.pdf_page}</span>
              <span>印刷页码：{item.printed_page}</span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
