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
      'No. ReadyPack produces compliance documentation, not legal advice. The documents are built from current ICO guidance, the EU AI Act text and DUAA provisions, and every pack is quality-checked before delivery. For advice specific to your situation, you should speak to a solicitor.',
  },
  {
    question: 'What happens to my data after I submit the questionnaire?',
    answer:
      'Your questionnaire data is used solely to generate your pack. It is encrypted in transit and at rest, and is never used to train any AI model. Full detail on retention and your rights is in our privacy notice.',
  },
  {
    question: "What if I don't have technical knowledge about our data systems?",
    answer:
      'The questionnaire is written in plain English. We ask how your business uses data and AI, not about servers or technical architecture. Set aside 20 to 35 minutes depending on how many AI tools you use, and you can save your progress and come back to it.',
  },
  {
    question: 'Do I need all nine documents?',
    answer:
      'Most businesses in scope for UK GDPR and the EU AI Act will need the majority. The questionnaire identifies which obligations apply to you specifically. All nine documents are included in every pack, and you deploy the ones that are relevant to your current situation.',
  },
  {
    question: 'What regulations do the documents cover?',
    answer:
      'UK GDPR, the EU AI Act (Article 50 and related transparency provisions), and the UK Data (Use and Access) Act 2025, including the Section 103 complaints handling obligation, which has been in force since 19 June 2026. The Procurement Response Memo pulls all three together into one document you can send to a buyer.',
  },
  {
    question: "What if I'm not satisfied?",
    answer:
      'Email us within 14 days of delivery and we will issue a full refund. No questions asked.',
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
    question: 'How does the checking work?',
    answer:
      'Once your documents are generated they go through a quality check before delivery: completeness, consistency with your answers, and accuracy against current guidance. Where your answers flag something higher-risk or uncertain, the pack is held back for a closer manual review rather than sent automatically. You never receive raw, unchecked output.',
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
