import type { Metadata } from 'next'
import {
  AlertTriangle,
  Check,
  FileCheck,
  FileText,
  Inbox,
  List,
  MessageSquare,
  Search,
  Shield,
  Users,
  X,
} from 'lucide-react'

import styles from './samples.module.css'
import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { ReadyPackLogo } from '@/components/ReadyPackLogo'
import { DocumentPage } from './_components/DocumentPage'
import { SectionHeading } from './_components/SectionHeading'
import { NoticeBlock } from './_components/NoticeBlock'
import { WarningBlock } from './_components/WarningBlock'
import { DocTable } from './_components/DocTable'
import { DocumentControl } from './_components/DocumentControl'
import { SnippetCard } from './_components/SnippetCard'

export const metadata: Metadata = {
  title: 'Sample Compliance Documents — ReadyPack',
  description:
    'Preview the 9 premium compliance documents included in every ReadyPack. AI Use Statement, Privacy Notice Addendum, Risk Register, DPIA, and more.',
}

const ICON_STROKE = 1.5
const COMPANY = 'Brightfield Digital Ltd'

const DOC_THUMBS = [
  { num: '01', title: 'AI Use Statement', pages: 3, icon: FileText },
  { num: '02', title: 'Privacy Notice Addendum', pages: 3, icon: Shield },
  { num: '03', title: 'AI Risk Register', pages: 3, icon: AlertTriangle },
  { num: '04', title: 'DPIA-Lite Template', pages: 3, icon: Search },
  { num: '05', title: 'Internal AI Use Policy', pages: 3, icon: Users },
  { num: '06', title: 'Customer Disclosure Snippets', pages: 3, icon: MessageSquare },
  { num: '07', title: 'Vendor AI Register', pages: 3, icon: List },
  { num: '08', title: 'Complaints Procedure Pack', pages: 3, icon: Inbox },
  { num: '09', title: 'Procurement Response Memo', pages: 3, icon: FileCheck },
] as const

type DocMeta = (typeof DOC_THUMBS)[number]

function PageBreak() {
  return <div className={styles['page-break']}>— Page Break —</div>
}

function DocSectionHead({ doc }: { doc: DocMeta }) {
  const Icon = doc.icon
  return (
    <div className={styles['doc-section-head']} id={`doc-${doc.num}`}>
      <div className={styles['doc-section-head-ico']}>
        <Icon width={22} height={22} strokeWidth={ICON_STROKE} />
      </div>
      <div>
        <div className={styles['doc-section-head-num']}>Document {doc.num}</div>
        <h2 className={styles['doc-section-head-title']}>{doc.title}</h2>
      </div>
      <div className={styles['doc-section-head-meta']}>{doc.pages} pages</div>
    </div>
  )
}

export default function SamplesPage() {
  return (
    <>
      <Nav />
      <main>
        {/* ZONE 1 — Hero */}
        <section className={styles.hero}>
          <div className={styles.container}>
            <div className={styles['hero-head']}>
              <span className={styles['hero-pill']}>
                <span className={styles['hero-pill-dot']} />
                Specimen pack
              </span>
              <h1>See what you&apos;re getting before you buy</h1>
              <p className={styles['hero-sub']}>
                Every document in your pack follows these premium templates. Scroll
                through a specimen pack prepared for a fictional company.
              </p>
            </div>
            <div className={styles['thumb-strip-wrap']}>
              <div className={styles['thumb-strip-label']}>
                <span>Jump to document</span>
              </div>
              <div className={styles['thumb-strip']}>
                {DOC_THUMBS.map((doc) => {
                  const Icon = doc.icon
                  return (
                    <a key={doc.num} href={`#doc-${doc.num}`} className={styles.thumb}>
                      <div className={styles['thumb-head']}>
                        <span className={styles['thumb-icon']}>
                          <Icon width={18} height={18} strokeWidth={ICON_STROKE} />
                        </span>
                        <span className={styles['thumb-num']}>{doc.num}</span>
                      </div>
                      <h3 className={styles['thumb-title']}>{doc.title}</h3>
                      <span className={styles['thumb-meta']}>{doc.pages} pages</span>
                    </a>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ZONE 2 — Document showcase */}
        <section className={styles.showcase}>
          <Doc01 />
          <Doc02 />
          <Doc03 />
          <Doc04 />
          <Doc05 />
          <Doc06 />
          <Doc07 />
          <Doc08 />
          <Doc09 />
          <CombinedPackCover />
        </section>
      </main>
      <Footer />
    </>
  )
}

/* ───────── Document 01 — AI Use Statement ───────── */
function Doc01() {
  const doc = DOC_THUMBS[0]
  return (
    <>
      <DocSectionHead doc={doc} />
      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        isFirstPage
        pageNumber={1}
        totalPages={doc.pages}
      >
        <SectionHeading number="1." level={1}>
          Introduction and Scope
        </SectionHeading>
        <p className={styles['doc-p']}>
          This AI Use Statement describes how {COMPANY} (the &ldquo;Company&rdquo;) uses
          artificial intelligence systems within its digital marketing operations. It is
          published in accordance with our transparency commitments under Article 50 of
          the EU AI Act and our UK GDPR Article 13–14 obligations.
        </p>
        <p className={styles['doc-p']}>
          The Company is a 15-person UK digital marketing agency headquartered in London,
          serving SME and mid-market clients across the UK and EU. Approximately 15% of
          our revenue is attributable to EU-established clients, bringing in-scope
          processing within the territorial reach of the EU AI Act.
        </p>
        <SectionHeading number="2." level={1}>
          Purpose of This Document
        </SectionHeading>
        <p className={styles['doc-p']}>
          We publish this statement so that clients, prospective clients, regulators, and
          our own staff understand which AI systems we operate, what those systems do, and
          what controls we have placed around them. It is a living document and is
          reviewed at least annually.
        </p>
        <NoticeBlock title="Regulatory Reference">
          Article 50 of the EU AI Act requires providers and deployers of certain AI
          systems to inform natural persons that they are interacting with an AI system,
          unless this is obvious from the circumstances. This statement, combined with
          our Customer Disclosure Snippets (Document 06), satisfies that obligation for
          our deployment context.
        </NoticeBlock>
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={2}
        totalPages={doc.pages}
      >
        <SectionHeading number="3." level={1}>
          AI Systems in Use
        </SectionHeading>
        <p className={styles['doc-p']}>
          The following table sets out the AI systems used internally by the Company,
          their purpose, and the regulatory classification we have applied to each system
          following our internal risk assessment.
        </p>
        <DocTable
          headers={['System', 'Vendor', 'Purpose', 'AI Act Classification']}
          rows={[
            [
              'ChatGPT (Team plan)',
              'OpenAI, OpenAI Ireland Ltd',
              'Drafting client copy, internal research, summarisation of meeting notes.',
              'Limited risk (Article 50)',
            ],
            [
              'Notion AI',
              'Notion Labs Inc.',
              'Knowledge-base summarisation and internal documentation drafting.',
              'Limited risk (Article 50)',
            ],
            [
              'Grammarly Business',
              'Grammarly Inc.',
              'Grammar and tone checking on outbound client deliverables.',
              'Limited risk',
            ],
            [
              'Microsoft Copilot for M365',
              'Microsoft Corporation',
              'Email drafting and document assistance within Microsoft 365.',
              'Limited risk (Article 50)',
            ],
          ]}
        />
        <SectionHeading number="4." level={1}>
          Systems Not in Use
        </SectionHeading>
        <p className={styles['doc-p']}>
          For the avoidance of doubt, the Company does not currently deploy any AI system
          falling within the &ldquo;high-risk&rdquo; categories of Annex III of the EU AI
          Act. We do not use AI for biometric identification, employment decision-making,
          access to essential services, or any other Annex III use case.
        </p>
        <SectionHeading number="5." level={1}>
          Human Oversight
        </SectionHeading>
        <p className={styles['doc-p']}>
          All AI-generated output that is delivered to clients or used in
          customer-facing communications is reviewed by a named human employee before
          release. The Founder retains overall accountability for AI use across the
          business.
        </p>
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={3}
        totalPages={doc.pages}
      >
        <SectionHeading number="6." level={1}>
          Controls and Safeguards
        </SectionHeading>
        <SectionHeading number="6.1" level={2}>
          Data minimisation
        </SectionHeading>
        <p className={styles['doc-p']}>
          Staff are instructed not to enter client personal data, financial information,
          or contractually-restricted material into general-purpose AI tools. Where
          processing of client-confidential information is required, only enterprise
          tiers with documented zero-retention commitments are used.
        </p>
        <SectionHeading number="6.2" level={2}>
          Training and acceptable use
        </SectionHeading>
        <p className={styles['doc-p']}>
          All staff have completed the Company&apos;s Internal AI Use Policy training
          (see Document 05). New starters complete this training within their first week.
        </p>
        <SectionHeading number="6.3" level={2}>
          Review schedule
        </SectionHeading>
        <p className={styles['doc-p']}>
          This statement is reviewed annually, and on a triggered basis whenever a new AI
          system is adopted or an existing system materially changes its function.
        </p>
        <DocumentControl
          documentTitle={doc.title}
          documentNumber={doc.num}
          companyName={COMPANY}
        />
      </DocumentPage>
    </>
  )
}

/* ───────── Document 02 — Privacy Notice Addendum ───────── */
function Doc02() {
  const doc = DOC_THUMBS[1]
  return (
    <>
      <DocSectionHead doc={doc} />
      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        isFirstPage
        pageNumber={1}
        totalPages={doc.pages}
      >
        <SectionHeading number="1." level={1}>
          About This Addendum
        </SectionHeading>
        <p className={styles['doc-p']}>
          This Privacy Notice Addendum supplements the Company&apos;s existing Privacy
          Notice. It describes the AI-specific personal data processing activities
          carried out by {COMPANY} and the lawful bases relied upon for each.
        </p>
        <SectionHeading number="2." level={1}>
          Controller Details
        </SectionHeading>
        <DocTable
          headers={['Field', 'Detail']}
          rows={[
            ['Controller', `${COMPANY}`],
            ['Address', '4th Floor, 87 Hatton Garden, London EC1N 8JT'],
            ['ICO Registration', 'ZA-XXXXXX'],
            ['Contact for data rights', 'privacy@brightfielddigital.example'],
          ]}
        />
        <SectionHeading number="3." level={1}>
          Scope
        </SectionHeading>
        <p className={styles['doc-p']}>
          This addendum applies to personal data we process about prospective clients,
          existing clients, end-user audiences of our clients&apos; campaigns, and our
          own staff, in connection with our use of artificial intelligence tools.
        </p>
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={2}
        totalPages={doc.pages}
      >
        <SectionHeading number="4." level={1}>
          AI-Specific Processing Activities
        </SectionHeading>
        <DocTable
          headers={['Activity', 'Personal Data', 'Lawful Basis', 'Retention']}
          rows={[
            [
              'Generative copy drafting',
              'Names and job titles where included in briefs',
              'Legitimate interests (Art. 6(1)(f))',
              'Source briefs: 24 months',
            ],
            [
              'Meeting summarisation',
              'Voice transcripts, attendee names',
              'Legitimate interests; consent where opt-in',
              'Transcripts: 90 days',
            ],
            [
              'Lead enrichment',
              'Business contact details',
              'Legitimate interests (Art. 6(1)(f))',
              'CRM lifecycle (3 years inactive)',
            ],
            [
              'Internal knowledge search',
              'Employee-authored content',
              'Legitimate interests; employment contract',
              'Duration of employment',
            ],
          ]}
        />
        <WarningBlock title="No Solely-Automated Decisions">
          The Company does not make decisions about individuals based solely on
          automated processing (including profiling) that produce legal or similarly
          significant effects on them. All AI output that informs decisions affecting
          individuals is reviewed by a named human employee before any action is taken.
        </WarningBlock>
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={3}
        totalPages={doc.pages}
      >
        <SectionHeading number="5." level={1}>
          Your Rights
        </SectionHeading>
        <p className={styles['doc-p']}>
          You retain all rights set out in the UK GDPR, including the right to access,
          rectify, erase, and restrict processing of your personal data, and to object
          to processing carried out on the basis of our legitimate interests.
        </p>
        <SectionHeading number="6." level={1}>
          International Transfers
        </SectionHeading>
        <p className={styles['doc-p']}>
          Several AI services we rely on are operated from the United States. We rely on
          the UK Extension to the EU-US Data Privacy Framework, supplemented by Standard
          Contractual Clauses where required, and we maintain a transfer impact
          assessment for each onward transfer.
        </p>
        <SectionHeading number="7." level={1}>
          Complaints
        </SectionHeading>
        <p className={styles['doc-p']}>
          You have the right to lodge a complaint with the Information Commissioner&apos;s
          Office (ICO) at any time. Our internal complaints procedure is set out in
          Document 08 of this pack.
        </p>
        <DocumentControl
          documentTitle={doc.title}
          documentNumber={doc.num}
          companyName={COMPANY}
        />
      </DocumentPage>
    </>
  )
}

/* ───────── Document 03 — AI Risk Register ───────── */
function Doc03() {
  const doc = DOC_THUMBS[2]
  return (
    <>
      <DocSectionHead doc={doc} />
      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        isFirstPage
        pageNumber={1}
        totalPages={doc.pages}
      >
        <SectionHeading number="1." level={1}>
          Purpose
        </SectionHeading>
        <p className={styles['doc-p']}>
          This Register records identified risks arising from the Company&apos;s use of
          artificial intelligence systems, the mitigations in place for each, and the
          residual risk position after those mitigations are applied. It is a living
          document and is reviewed at least quarterly.
        </p>
        <SectionHeading number="2." level={1}>
          Methodology
        </SectionHeading>
        <p className={styles['doc-p']}>
          Each risk is scored on two dimensions — likelihood of occurrence and severity
          of impact — each on a three-point scale (Low / Medium / High). The combined
          score determines the inherent risk band shown on the matrix overleaf.
        </p>
        <SectionHeading number="3." level={1}>
          Risk Matrix
        </SectionHeading>
        <div className={styles['risk-matrix']}>
          <div className={styles['risk-matrix-label']}>Severity ↑</div>
          <div className={styles['risk-matrix-label']}>Low likelihood</div>
          <div className={styles['risk-matrix-label']}>Medium</div>
          <div className={styles['risk-matrix-label']}>High likelihood</div>

          <div className={styles['risk-matrix-label']}>High</div>
          <div className={`${styles['risk-matrix-cell']} ${styles['risk-med']}`}>
            Medium
          </div>
          <div className={`${styles['risk-matrix-cell']} ${styles['risk-high']}`}>
            High
          </div>
          <div className={`${styles['risk-matrix-cell']} ${styles['risk-high']}`}>
            Critical
          </div>

          <div className={styles['risk-matrix-label']}>Medium</div>
          <div className={`${styles['risk-matrix-cell']} ${styles['risk-low']}`}>
            Low
          </div>
          <div className={`${styles['risk-matrix-cell']} ${styles['risk-med']}`}>
            Medium
          </div>
          <div className={`${styles['risk-matrix-cell']} ${styles['risk-high']}`}>
            High
          </div>

          <div className={styles['risk-matrix-label']}>Low</div>
          <div className={`${styles['risk-matrix-cell']} ${styles['risk-low']}`}>
            Low
          </div>
          <div className={`${styles['risk-matrix-cell']} ${styles['risk-low']}`}>
            Low
          </div>
          <div className={`${styles['risk-matrix-cell']} ${styles['risk-med']}`}>
            Medium
          </div>
        </div>
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={2}
        totalPages={doc.pages}
      >
        <SectionHeading number="4." level={1}>
          Risk Register
        </SectionHeading>
        <DocTable
          headers={['ID', 'Risk', 'Likelihood / Severity', 'Mitigation', 'Residual']}
          rows={[
            [
              'R-01',
              'Inadvertent disclosure of client-confidential content via prompts',
              'Medium / High',
              'Enterprise-tier accounts only; staff training; quarterly audit',
              'Low',
            ],
            [
              'R-02',
              'Hallucinated factual content reaching a client deliverable',
              'High / Medium',
              'Mandatory human review of all AI-assisted client output',
              'Low',
            ],
            [
              'R-03',
              'Vendor lock-in or unexpected service discontinuation',
              'Low / Medium',
              'Vendor register maintained; viable alternatives identified',
              'Low',
            ],
            [
              'R-04',
              'Cross-border data transfer non-compliance (US-hosted tools)',
              'Medium / High',
              'DPF reliance plus SCCs; annual transfer impact assessment',
              'Medium',
            ],
          ]}
        />
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={3}
        totalPages={doc.pages}
      >
        <SectionHeading number="5." level={1}>
          Review Schedule
        </SectionHeading>
        <p className={styles['doc-p']}>
          This Register is reviewed quarterly by the Founder. Material changes — including
          the introduction of a new AI system, a vendor change, or a near-miss incident —
          trigger an interim review.
        </p>
        <SectionHeading number="6." level={1}>
          Escalation
        </SectionHeading>
        <p className={styles['doc-p']}>
          Any risk rated &ldquo;High&rdquo; or &ldquo;Critical&rdquo; on the matrix is
          escalated immediately to the Founder and reviewed against the Company&apos;s
          continuity plan. Where the residual risk after mitigation remains High, the
          underlying AI system is either replaced or withdrawn pending further controls.
        </p>
        <NoticeBlock title="Cross-references">
          Mitigations are operationalised through the Internal AI Use Policy (Document
          05) and the Vendor AI Register (Document 07). High-impact processing activities
          are separately assessed through the DPIA-Lite Template (Document 04).
        </NoticeBlock>
        <DocumentControl
          documentTitle={doc.title}
          documentNumber={doc.num}
          companyName={COMPANY}
        />
      </DocumentPage>
    </>
  )
}

/* ───────── Document 04 — DPIA-Lite Template ───────── */
function Doc04() {
  const doc = DOC_THUMBS[3]
  return (
    <>
      <DocSectionHead doc={doc} />
      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        isFirstPage
        pageNumber={1}
        totalPages={doc.pages}
      >
        <SectionHeading number="1." level={1}>
          Processing Under Assessment
        </SectionHeading>
        <p className={styles['doc-p']}>
          This DPIA-Lite assesses the Company&apos;s use of generative AI tools to draft
          marketing copy and summarise client meetings. It is focused on the data
          protection impacts on natural persons whose personal data is incidentally
          processed during these activities.
        </p>
        <SectionHeading number="2." level={1}>
          Necessity and Proportionality
        </SectionHeading>
        <p className={styles['doc-p']}>
          AI-assisted drafting and summarisation deliver material productivity gains. The
          processing is limited to the minimum personal data required to complete the
          relevant task and uses enterprise-tier tools with documented zero-retention or
          short-retention commitments from the vendor.
        </p>
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={2}
        totalPages={doc.pages}
      >
        <SectionHeading number="3." level={1}>
          Risks to Individuals
        </SectionHeading>
        <DocTable
          headers={['Risk to Individual', 'Likelihood', 'Severity', 'Mitigation']}
          rows={[
            [
              'Disclosure of personal data in a prompt to a third-party vendor',
              'Medium',
              'High',
              'Enterprise plans; staff trained on prohibited inputs',
            ],
            [
              'Inaccurate output describing an identified individual',
              'Medium',
              'Medium',
              'Mandatory human review prior to any external release',
            ],
            [
              'Use of personal data for vendor model training',
              'Low',
              'High',
              'Contractually disabled on all enterprise tiers in use',
            ],
            [
              'Loss of meaningful human control over decisions affecting individuals',
              'Low',
              'High',
              'No solely-automated decisions; documented oversight',
            ],
          ]}
        />
        <NoticeBlock title="ICO Reference">
          This template follows the structure recommended by the Information
          Commissioner&apos;s Office in its &ldquo;DPIA template for AI&rdquo; guidance.
          Where a higher-risk processing activity is identified, a full DPIA is
          completed in place of this Lite version.
        </NoticeBlock>
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={3}
        totalPages={doc.pages}
      >
        <SectionHeading number="4." level={1}>
          Conclusion
        </SectionHeading>
        <p className={styles['doc-p']}>
          With the mitigations recorded above, the residual risk to the rights and
          freedoms of natural persons is assessed as Low. No prior consultation with the
          ICO is required.
        </p>
        <SectionHeading number="5." level={1}>
          Sign-off
        </SectionHeading>
        <div className={styles['sig-block']}>
          <div className={styles['sig-col']}>
            <span className={styles['sig-label']}>Prepared by</span>
            <div className={styles['sig-line']} />
            <span className={styles['sig-name']}>Mark Whitfield</span>
            <span className={styles['sig-role']}>Founder · {COMPANY}</span>
          </div>
          <div className={styles['sig-col']}>
            <span className={styles['sig-label']}>Date</span>
            <div className={styles['sig-line']} />
            <span className={styles['sig-name']}>7 June 2026</span>
            <span className={styles['sig-role']}>Next review: 7 June 2027</span>
          </div>
        </div>
        <DocumentControl
          documentTitle={doc.title}
          documentNumber={doc.num}
          companyName={COMPANY}
        />
      </DocumentPage>
    </>
  )
}

/* ───────── Document 05 — Internal AI Use Policy ───────── */
function Doc05() {
  const doc = DOC_THUMBS[4]
  return (
    <>
      <DocSectionHead doc={doc} />
      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        isFirstPage
        pageNumber={1}
        totalPages={doc.pages}
      >
        <SectionHeading number="1." level={1}>
          Purpose
        </SectionHeading>
        <p className={styles['doc-p']}>
          This Policy sets out how staff at {COMPANY} are permitted to use artificial
          intelligence tools in the course of their work. It is binding on all
          employees, contractors, and freelancers.
        </p>
        <SectionHeading number="2." level={1}>
          Scope
        </SectionHeading>
        <p className={styles['doc-p']}>
          This Policy covers all generative AI tools — including ChatGPT, Notion AI,
          Microsoft Copilot, and any tool subsequently approved by the Founder — and
          applies wherever those tools touch client data, internal business data, or
          public-facing deliverables.
        </p>
        <SectionHeading number="3." level={1}>
          Roles
        </SectionHeading>
        <p className={styles['doc-p']}>
          The Founder is accountable for AI governance. Each team lead is responsible for
          ensuring their team complies with this Policy in day-to-day work.
        </p>
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={2}
        totalPages={doc.pages}
      >
        <SectionHeading number="4." level={1}>
          Acceptable Use
        </SectionHeading>
        <div className={styles['do-dont-grid']}>
          <div className={styles['do-col']}>
            <div className={styles['do-dont-title']}>
              <Check width={16} height={16} strokeWidth={2.5} /> Do
            </div>
            <ul className={styles['do-dont-list']}>
              <li className={styles['do-dont-item']}>
                <Check
                  width={14}
                  height={14}
                  strokeWidth={2.5}
                  className={styles['do-dont-mark']}
                />
                <span>Use approved enterprise accounts for any work involving client
                  material.</span>
              </li>
              <li className={styles['do-dont-item']}>
                <Check
                  width={14}
                  height={14}
                  strokeWidth={2.5}
                  className={styles['do-dont-mark']}
                />
                <span>Review every AI-generated output before it leaves the Company.</span>
              </li>
              <li className={styles['do-dont-item']}>
                <Check
                  width={14}
                  height={14}
                  strokeWidth={2.5}
                  className={styles['do-dont-mark']}
                />
                <span>Disclose AI assistance in client deliverables where the client has
                  asked us to.</span>
              </li>
              <li className={styles['do-dont-item']}>
                <Check
                  width={14}
                  height={14}
                  strokeWidth={2.5}
                  className={styles['do-dont-mark']}
                />
                <span>Report suspected near-misses or breaches to the Founder within 24
                  hours.</span>
              </li>
            </ul>
          </div>
          <div className={styles['dont-col']}>
            <div className={styles['do-dont-title']}>
              <X width={16} height={16} strokeWidth={2.5} /> Don&apos;t
            </div>
            <ul className={styles['do-dont-list']}>
              <li className={styles['do-dont-item']}>
                <X
                  width={14}
                  height={14}
                  strokeWidth={2.5}
                  className={styles['do-dont-mark']}
                />
                <span>Paste client personal data, payment details, or confidential briefs
                  into consumer accounts.</span>
              </li>
              <li className={styles['do-dont-item']}>
                <X
                  width={14}
                  height={14}
                  strokeWidth={2.5}
                  className={styles['do-dont-mark']}
                />
                <span>Use AI to make hiring, performance, or disciplinary decisions
                  about colleagues.</span>
              </li>
              <li className={styles['do-dont-item']}>
                <X
                  width={14}
                  height={14}
                  strokeWidth={2.5}
                  className={styles['do-dont-mark']}
                />
                <span>Adopt a new AI tool for work purposes without written sign-off from
                  the Founder.</span>
              </li>
              <li className={styles['do-dont-item']}>
                <X
                  width={14}
                  height={14}
                  strokeWidth={2.5}
                  className={styles['do-dont-mark']}
                />
                <span>Treat AI output as factually verified — every claim must be
                  checked.</span>
              </li>
            </ul>
          </div>
        </div>
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={3}
        totalPages={doc.pages}
      >
        <SectionHeading number="5." level={1}>
          Enforcement
        </SectionHeading>
        <p className={styles['doc-p']}>
          Breaches of this Policy will be handled under the Company&apos;s normal
          disciplinary procedure. Significant breaches that result in a data protection
          incident are also assessed against the Company&apos;s personal data breach
          procedure.
        </p>
        <SectionHeading number="6." level={1}>
          Training and Acknowledgement
        </SectionHeading>
        <p className={styles['doc-p']}>
          Every member of staff must acknowledge this Policy at induction, and again
          whenever it is materially updated. The Founder maintains the record of
          acknowledgements.
        </p>
        <div className={styles['sig-block']}>
          <div className={styles['sig-col']}>
            <span className={styles['sig-label']}>Approved by</span>
            <div className={styles['sig-line']} />
            <span className={styles['sig-name']}>Mark Whitfield</span>
            <span className={styles['sig-role']}>Founder · {COMPANY}</span>
          </div>
          <div className={styles['sig-col']}>
            <span className={styles['sig-label']}>Effective Date</span>
            <div className={styles['sig-line']} />
            <span className={styles['sig-name']}>7 June 2026</span>
            <span className={styles['sig-role']}>Review annually</span>
          </div>
        </div>
        <DocumentControl
          documentTitle={doc.title}
          documentNumber={doc.num}
          companyName={COMPANY}
        />
      </DocumentPage>
    </>
  )
}

/* ───────── Document 06 — Customer Disclosure Snippets ───────── */
function Doc06() {
  const doc = DOC_THUMBS[5]
  return (
    <>
      <DocSectionHead doc={doc} />
      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        isFirstPage
        pageNumber={1}
        totalPages={doc.pages}
      >
        <SectionHeading number="1." level={1}>
          How to Use This Document
        </SectionHeading>
        <p className={styles['doc-p']}>
          The snippets in this pack are ready-to-paste disclosures designed to satisfy
          Article 50 of the EU AI Act and UK GDPR transparency expectations. Each snippet
          is tagged with the context where it is intended to appear. Replace the bracketed
          placeholders before use.
        </p>
        <NoticeBlock title="When to disclose">
          Article 50 of the EU AI Act requires that natural persons be informed when they
          are interacting with an AI system unless this is obvious from the circumstances.
          The snippets below are calibrated for the Company&apos;s use cases and should
          not be edited without sign-off from the Founder.
        </NoticeBlock>
        <SectionHeading number="2." level={1}>
          Snippet Index
        </SectionHeading>
        <DocTable
          headers={['Tag', 'Use case']}
          rows={[
            ['WEBSITE FOOTER', 'General disclosure on every public page'],
            ['SUPPORT HANDOVER', 'When a human takes over from an AI assistant'],
            ['PROPOSAL DISCLOSURE', 'Inside a client-facing proposal or SOW'],
            ['AUTO-RESPONDER', 'Email auto-replies generated by AI'],
          ]}
        />
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={2}
        totalPages={doc.pages}
      >
        <SectionHeading number="3." level={1}>
          Snippets — Public-Facing
        </SectionHeading>
        <SnippetCard
          label="Website footer · short form"
          tag="WEBSITE FOOTER"
          body={`Parts of this website and the services we deliver are produced with the assistance of generative AI tools. We review all output before publication. For details, see our AI Use Statement at [link].`}
        />
        <SnippetCard
          label="In-product banner · chat widget"
          tag="SUPPORT HANDOVER"
          body={`You're chatting with an automated assistant powered by AI. A human team member will join the conversation if your enquiry needs one. Read more about how we use AI: [link].`}
        />
        <SnippetCard
          label="Email auto-reply · out-of-hours"
          tag="AUTO-RESPONDER"
          body={`Thanks for your message. This reply was generated by an AI assistant on our team's behalf. A named colleague will be in touch within one working day. — Brightfield Digital`}
        />
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={3}
        totalPages={doc.pages}
      >
        <SectionHeading number="4." level={1}>
          Snippets — Client-Facing Deliverables
        </SectionHeading>
        <SnippetCard
          label="Proposal cover-page disclosure"
          tag="PROPOSAL DISCLOSURE"
          body={`Sections of this proposal have been drafted with the support of generative AI tools used under enterprise terms with no model training on our content. All recommendations have been reviewed by a named Brightfield Digital strategist before sending.`}
        />
        <SnippetCard
          label="Statement of Work — AI use clause"
          tag="PROPOSAL DISCLOSURE"
          body={`Brightfield Digital uses AI tools to assist with drafting, research and analysis. We do not enter client confidential information into consumer AI products and do not permit the use of client data for vendor model training. Our full AI Use Statement is available on request.`}
        />
        <DocumentControl
          documentTitle={doc.title}
          documentNumber={doc.num}
          companyName={COMPANY}
        />
      </DocumentPage>
    </>
  )
}

/* ───────── Document 07 — Vendor AI Register ───────── */
function Doc07() {
  const doc = DOC_THUMBS[6]
  return (
    <>
      <DocSectionHead doc={doc} />
      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        isFirstPage
        pageNumber={1}
        totalPages={doc.pages}
      >
        <SectionHeading number="1." level={1}>
          About This Register
        </SectionHeading>
        <p className={styles['doc-p']}>
          This Register lists every third-party AI tool used by {COMPANY}, the data
          categories that touch each tool, and the lawful basis on which we transfer that
          data. It supports our UK GDPR Article 30 record of processing activities.
        </p>
        <SectionHeading number="2." level={1}>
          Maintenance
        </SectionHeading>
        <p className={styles['doc-p']}>
          The Register is reviewed quarterly by the Founder. New vendors are added at the
          point of sign-off; decommissioned vendors are retained for two years before
          removal so that historical processing remains traceable.
        </p>
        <NoticeBlock title="Connected documents">
          Risk treatment for each vendor is recorded in the AI Risk Register (Document
          03). Customer-facing disclosure about these tools is covered by the AI Use
          Statement (Document 01) and Customer Disclosure Snippets (Document 06).
        </NoticeBlock>
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={2}
        totalPages={doc.pages}
      >
        <SectionHeading number="3." level={1}>
          Vendor Register
        </SectionHeading>
        <DocTable
          headers={['Vendor / Product', 'Data Touched', 'Region / Transfer Mechanism']}
          rows={[
            [
              <>
                <strong>OpenAI — ChatGPT Team</strong>
                <br />
                Use: drafting, summarisation, research.
              </>,
              <>
                Names, business email addresses (incidental). No special-category data.
              </>,
              <>
                US-hosted. DPF + SCCs. Training on Company data disabled at tenant level.
              </>,
            ],
            [
              <>
                <strong>Notion Labs — Notion AI</strong>
                <br />
                Use: knowledge-base search and drafting.
              </>,
              <>Employee-authored content; client names within internal notes.</>,
              <>US-hosted. SCCs. Enterprise tier; no training on Company workspace.</>,
            ],
            [
              <>
                <strong>Microsoft — Copilot for M365</strong>
                <br />
                Use: email and document drafting in M365.
              </>,
              <>All mailbox content available to the named user.</>,
              <>UK + EU data residency selected. UK Adequacy regulations apply.</>,
            ],
            [
              <>
                <strong>Grammarly Inc. — Business</strong>
                <br />
                Use: grammar and tone checking on outbound content.
              </>,
              <>Document text submitted for analysis.</>,
              <>US-hosted. DPF + SCCs. Knowledge-share disabled at tenant level.</>,
            ],
          ]}
        />
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={3}
        totalPages={doc.pages}
      >
        <SectionHeading number="4." level={1}>
          Decommissioning
        </SectionHeading>
        <p className={styles['doc-p']}>
          When a vendor relationship ends, the Founder ensures that any data the vendor
          retains is deleted in accordance with the contract, and the Register entry is
          marked &ldquo;Decommissioned&rdquo; with the effective date.
        </p>
        <SectionHeading number="5." level={1}>
          Onboarding New Vendors
        </SectionHeading>
        <p className={styles['doc-p']}>
          Before a new AI vendor is adopted, the Founder reviews the vendor&apos;s data
          processing terms, transfer mechanisms, and security posture against this
          Company&apos;s standards. Adoption is only authorised in writing.
        </p>
        <DocumentControl
          documentTitle={doc.title}
          documentNumber={doc.num}
          companyName={COMPANY}
        />
      </DocumentPage>
    </>
  )
}

/* ───────── Document 08 — Complaints Procedure Pack ───────── */
function Doc08() {
  const doc = DOC_THUMBS[7]
  return (
    <>
      <DocSectionHead doc={doc} />
      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        isFirstPage
        pageNumber={1}
        totalPages={doc.pages}
      >
        <SectionHeading number="1." level={1}>
          Purpose
        </SectionHeading>
        <p className={styles['doc-p']}>
          This Procedure sets out how {COMPANY} receives, acknowledges, investigates and
          resolves complaints about its processing of personal data, including processing
          carried out using AI tools. It satisfies the Company&apos;s obligation under
          Section 103 of the UK Data (Use and Access) Act 2025.
        </p>
        <NoticeBlock title="DUAA Section 103">
          From 19 June 2026, organisations that process personal data must operate a
          documented complaints handling procedure and must acknowledge complaints
          promptly. The Information Commissioner&apos;s Office can investigate
          non-compliance.
        </NoticeBlock>
        <SectionHeading number="2." level={1}>
          How to Complain
        </SectionHeading>
        <p className={styles['doc-p']}>
          Complaints may be made by email to{' '}
          <strong>privacy@brightfielddigital.example</strong>, by post to the registered
          address, or in person at any pre-arranged meeting with a member of staff.
        </p>
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={2}
        totalPages={doc.pages}
      >
        <SectionHeading number="3." level={1}>
          Process
        </SectionHeading>
        <div className={styles.timeline}>
          <div className={styles['timeline-step']}>
            <div className={styles['timeline-num']}>1</div>
            <div className={styles['timeline-body']}>
              <div className={styles['timeline-meta']}>Day 0</div>
              <h4 className={styles['timeline-title']}>Acknowledge receipt</h4>
              <p className={styles['timeline-text']}>
                We acknowledge every complaint within one working day, confirming the
                named individual handling the matter.
              </p>
            </div>
          </div>
          <div className={styles['timeline-step']}>
            <div className={styles['timeline-num']}>2</div>
            <div className={styles['timeline-body']}>
              <div className={styles['timeline-meta']}>Day 1 – 7</div>
              <h4 className={styles['timeline-title']}>Investigate</h4>
              <p className={styles['timeline-text']}>
                The handler reviews the relevant processing records, vendor logs and
                internal correspondence. Additional information may be requested from
                the complainant.
              </p>
            </div>
          </div>
          <div className={styles['timeline-step']}>
            <div className={styles['timeline-num']}>3</div>
            <div className={styles['timeline-body']}>
              <div className={styles['timeline-meta']}>Day 7 – 30</div>
              <h4 className={styles['timeline-title']}>Substantive response</h4>
              <p className={styles['timeline-text']}>
                A written response is issued setting out our findings and any remedial
                action. If we cannot respond within 30 days, we explain why and provide
                a revised timeline.
              </p>
            </div>
          </div>
          <div className={styles['timeline-step']}>
            <div className={styles['timeline-num']}>4</div>
            <div className={styles['timeline-body']}>
              <div className={styles['timeline-meta']}>Day 30+</div>
              <h4 className={styles['timeline-title']}>Escalation to the ICO</h4>
              <p className={styles['timeline-text']}>
                Complainants who remain dissatisfied are told how to escalate to the
                Information Commissioner&apos;s Office.
              </p>
            </div>
          </div>
        </div>
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={3}
        totalPages={doc.pages}
      >
        <SectionHeading number="4." level={1}>
          Records
        </SectionHeading>
        <p className={styles['doc-p']}>
          A record of every complaint received, the action taken and the outcome is
          retained for a minimum of six years. The Founder reviews the complaints log
          quarterly for trends and improvement opportunities.
        </p>
        <SectionHeading number="5." level={1}>
          Confidentiality and Non-Retaliation
        </SectionHeading>
        <p className={styles['doc-p']}>
          Complaints are handled in confidence so far as is consistent with carrying out
          an effective investigation. The Company prohibits any form of retaliation
          against an individual for raising a good-faith complaint.
        </p>
        <SectionHeading number="6." level={1}>
          Escalation Contacts
        </SectionHeading>
        <DocTable
          headers={['Route', 'Contact']}
          rows={[
            ['Internal — First contact', 'privacy@brightfielddigital.example'],
            ['Internal — Escalation', 'Mark Whitfield, Founder'],
            [
              'External — Regulator',
              'Information Commissioner’s Office (ICO) — ico.org.uk',
            ],
          ]}
        />
        <DocumentControl
          documentTitle={doc.title}
          documentNumber={doc.num}
          companyName={COMPANY}
        />
      </DocumentPage>
    </>
  )
}

/* ───────── Document 09 — Procurement Response Memo ───────── */
function Doc09() {
  const doc = DOC_THUMBS[8]
  return (
    <>
      <DocSectionHead doc={doc} />
      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        isFirstPage
        pageNumber={1}
        totalPages={doc.pages}
      >
        <SectionHeading number="1." level={1}>
          Executive Summary
        </SectionHeading>
        <p className={styles['doc-p']}>
          This Memo summarises {COMPANY}&apos;s compliance position with respect to UK
          GDPR, the EU AI Act, and the UK Data (Use and Access) Act 2025. It is intended
          to accompany procurement responses and supplier questionnaires from enterprise
          customers.
        </p>
        <SectionHeading number="2." level={1}>
          Compliance Snapshot
        </SectionHeading>
        <DocTable
          className={styles['status-table']}
          headers={['Area', 'Status', 'Evidence']}
          rows={[
            [
              'UK GDPR — Records of Processing (Art. 30)',
              <span key="s1" className={styles['status-ok']}>
                ✓ In place
              </span>,
              'Privacy Notice Addendum (Doc 02), Vendor AI Register (Doc 07)',
            ],
            [
              'EU AI Act — Article 50 Transparency',
              <span key="s2" className={styles['status-ok']}>
                ✓ In place
              </span>,
              'AI Use Statement (Doc 01), Customer Disclosure Snippets (Doc 06)',
            ],
            [
              'EU AI Act — Risk Management',
              <span key="s3" className={styles['status-ok']}>
                ✓ In place
              </span>,
              'AI Risk Register (Doc 03)',
            ],
            [
              'DUAA Section 103 — Complaints',
              <span key="s4" className={styles['status-ok']}>
                ✓ In place
              </span>,
              'Complaints Procedure Pack (Doc 08)',
            ],
            [
              'High-risk AI systems (Annex III)',
              <span key="s5" className={styles['status-warn']}>
                ⚠ Not in scope
              </span>,
              'No Annex III systems deployed; reviewed quarterly',
            ],
            [
              'Cross-border transfers — Adequacy',
              <span key="s6" className={styles['status-warn']}>
                ⚠ Reliance on DPF/SCCs
              </span>,
              'TIA on file; reviewed annually',
            ],
          ]}
        />
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={2}
        totalPages={doc.pages}
      >
        <SectionHeading number="3." level={1}>
          Documentation Index
        </SectionHeading>
        <p className={styles['doc-p']}>
          The following documents are available on request from any enterprise customer
          and form the complete ReadyPack compliance documentation set for the Company.
        </p>
        <DocTable
          headers={['Doc', 'Title', 'Owner']}
          rows={DOC_THUMBS.map(
            (d) =>
              [d.num, d.title, 'Mark Whitfield, Founder'] as [string, string, string],
          )}
        />
        <NoticeBlock title="Bid use">
          This Memo is the recommended single attachment when a vendor questionnaire
          asks for a high-level AI &amp; data governance summary. Individual documents
          can be released under NDA where the customer requires the underlying detail.
        </NoticeBlock>
      </DocumentPage>

      <PageBreak />

      <DocumentPage
        documentNumber={doc.num}
        documentTitle={doc.title}
        companyName={COMPANY}
        pageNumber={3}
        totalPages={doc.pages}
      >
        <SectionHeading number="4." level={1}>
          Points of Contact
        </SectionHeading>
        <DocTable
          headers={['Topic', 'Contact']}
          rows={[
            ['Data protection enquiries', 'privacy@brightfielddigital.example'],
            ['AI governance enquiries', 'Mark Whitfield, Founder'],
            ['Security and incident reporting', 'security@brightfielddigital.example'],
            ['Commercial / procurement', 'sales@brightfielddigital.example'],
          ]}
        />
        <SectionHeading number="5." level={1}>
          Review Cycle
        </SectionHeading>
        <p className={styles['doc-p']}>
          This Memo is refreshed at least annually, and on a triggered basis whenever any
          of the underlying documents in the documentation index materially change.
        </p>
        <DocumentControl
          documentTitle={doc.title}
          documentNumber={doc.num}
          companyName={COMPANY}
        />
      </DocumentPage>
    </>
  )
}

/* ───────── Combined Pack Cover Page ───────── */
function CombinedPackCover() {
  return (
    <div className={styles['cover-page']}>
      <div className={styles['cover-page-bar']} />
      <ReadyPackLogo
        className={styles['cover-logo']}
        style={
          {
            '--text-primary': 'var(--doc-heading)',
          } as React.CSSProperties
        }
      />
      <h2 className={styles['cover-pack-title']}>
        AI &amp; Data Governance Compliance Documentation Pack
      </h2>
      <p className={styles['cover-pack-sub']}>Prepared for {COMPANY}</p>
      <div className={styles['cover-client-logo']}>CLIENT LOGO</div>
      <div className={styles['cover-divider']} />
      <div className={styles['cover-meta-line-large']}>
        9 Documents · 35 Pages · Version 1.0
      </div>
      <div className={styles['cover-meta-line-large']}>Issued 7 June 2026</div>
      <div className={styles['cover-footer']}>
        <span>MOFE LTD · Registered in England &amp; Wales</span>
        <span>Confidential</span>
      </div>
    </div>
  )
}
