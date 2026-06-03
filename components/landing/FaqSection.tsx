'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import styles from '@/app/landing.module.css'

const ICON_STROKE = 1.5

type FaqItem = {
  question: string
  answer: string
}

const FAQ_ITEMS: ReadonlyArray<FaqItem> = [
  {
    question: 'Is this legal advice?',
    answer:
      'No. ReadyPack provides compliance documentation support — not legal advice. Our documents are built from current ICO guidance, the EU AI Act text, and DUAA statutory provisions. They are reviewed by an experienced compliance professional. For legal advice specific to your situation, you should consult a solicitor.',
  },
  {
    question: 'What happens to my data after I submit the questionnaire?',
    answer:
      'Your questionnaire data is used solely to generate your pack. It is processed in the UK, encrypted in transit and at rest, and never used to train any AI model. Your data is deleted within 30 days of pack delivery. We are registered with the ICO as a data controller — [ICO registration: ZA-XXXXXX].',
  },
  {
    question: "What if I don't have technical knowledge about our data systems?",
    answer:
      'The questionnaire is written in plain English. We ask about how your business uses data and AI — not about server infrastructure or technical architecture. Most customers complete it in under 15 minutes.',
  },
  {
    question: 'Do I need all nine documents?',
    answer:
      'Most businesses in scope for UK GDPR and the EU AI Act will need the majority. The questionnaire identifies which obligations apply to you specifically. All nine documents are included in every pack — you deploy the ones that are relevant to your current situation.',
  },
  {
    question: 'What regulations do the documents cover?',
    answer:
      'UK GDPR, EU AI Act (Articles 50 and related transparency provisions), and the UK Data (Use and Access) Act 2025, including the Section 103 complaints handling obligation effective 19 June 2026. The Procurement Response Memo is formatted to address all three frameworks in a single enterprise-ready document.',
  },
  {
    question: "What if I'm not satisfied?",
    answer:
      'Email us within 14 days of delivery and we will issue a full refund — no questions asked.',
  },
  {
    question: 'Can I use these documents for more than one company?',
    answer:
      'Each pack is tailored to a specific business. If you need documentation for multiple companies or clients, the Adviser Pack tier includes three individually tailored packs. For larger volumes, contact us directly.',
  },
  {
    question: 'Do you cover EU businesses as well as UK?',
    answer:
      'Yes. The documents address both the UK GDPR framework and the EU AI Act directly. If you operate in both jurisdictions, your pack will address both. DUAA is UK-specific, but the Complaints Procedure Pack is structured to be adaptable for EU equivalents.',
  },
  {
    question: 'How does the human review work?',
    answer:
      'After your documents are generated, they are reviewed by an experienced compliance professional before delivery. The reviewer checks for completeness, accuracy against current guidance, and coherence with your specific questionnaire answers. You receive the reviewed version — not the raw AI output.',
  },
  {
    question: 'What is the Procurement Q&A Bank in the Procurement-Ready tier?',
    answer:
      'A set of 40 pre-written answers to the most common vendor questionnaire questions about AI governance, data protection, and compliance. Formatted for direct copy-paste into enterprise RFP responses. Included only in the Procurement-Ready tier.',
  },
]

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className={styles.section} id="faq">
      <div className={styles.container}>
        <div className={styles['sec-head']}>
          <span className={styles.pill}>FAQ</span>
          <h2>Frequently asked questions</h2>
        </div>
        <div className={styles['faq-grid']}>
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index
            const panelId = `faq-panel-${index}`
            const buttonId = `faq-button-${index}`
            return (
              <div
                key={item.question}
                className={`${styles['faq-item']}${isOpen ? ` ${styles.open}` : ''}`}
              >
                <button
                  id={buttonId}
                  type="button"
                  className={styles['faq-q']}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  {item.question}
                  <Plus
                    width={20}
                    height={20}
                    strokeWidth={ICON_STROKE}
                    className={styles['faq-icon']}
                  />
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={styles['faq-a']}
                >
                  <div className={styles['faq-a-inner']}>{item.answer}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
