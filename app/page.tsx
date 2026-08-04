import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarClock,
  Check,
  ClipboardList,
  Clock,
  Cpu,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Inbox,
  Layers,
  List,
  Lock,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'

import styles from './landing.module.css'
import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { TopTicker } from '@/components/layout/TopTicker'
import { HeroSection } from '@/components/landing/HeroSection'
import { PricingSection } from '@/components/landing/PricingSection'
import { FaqSection } from '@/components/landing/FaqSection'

const ICON_STROKE = 1.5

const DOCUMENTS = [
  {
    icon: FileText,
    num: '01',
    title: 'AI Use Statement',
    description:
      'Declares how your organisation uses AI systems, formatted for regulatory and enterprise customer review.',
    reg: 'EU AI Act',
    tooltip: '~4 pages · Tailored to your business.',
  },
  {
    icon: Shield,
    num: '02',
    title: 'Privacy Notice Addendum',
    description:
      'Updates your existing privacy notice to address AI-specific data processing activities.',
    reg: 'UK GDPR',
    tooltip: '~3 pages · Tailored to your business.',
  },
  {
    icon: AlertTriangle,
    num: '03',
    title: 'AI Risk Register',
    description:
      'A structured log of your AI system risks, mitigations, and review schedule.',
    reg: 'EU AI Act',
    tooltip: '~6 pages · Tailored to your business.',
  },
  {
    icon: Search,
    num: '04',
    title: 'DPIA-Lite Template',
    description:
      'A streamlined Data Protection Impact Assessment for your highest-risk data processing activities.',
    reg: 'UK GDPR',
    tooltip: '~5 pages · Tailored to your business.',
  },
  {
    icon: Users,
    num: '05',
    title: 'Internal AI Use Policy',
    description:
      'Your staff-facing policy governing responsible AI use within the organisation.',
    reg: 'UK GDPR / AI Act',
    tooltip: '~4 pages · Tailored to your business.',
  },
  {
    icon: MessageSquare,
    num: '06',
    title: 'Customer Disclosure Snippets',
    description:
      'Ready-to-use, legally sound copy for disclosing AI use on your website and in customer communications.',
    reg: 'EU AI Act',
    tooltip: '~2 pages · Tailored to your business.',
  },
  {
    icon: List,
    num: '07',
    title: 'Vendor AI Register',
    description:
      'A structured register of every third-party AI tool your business uses and the data it touches.',
    reg: 'UK GDPR',
    tooltip: '~4 pages · Tailored to your business.',
  },
  {
    icon: Inbox,
    num: '08',
    title: 'Complaints Procedure Pack',
    description:
      'A compliant complaints handling process and public-facing procedure, meeting the DUAA Section 103 requirement.',
    reg: 'DUAA',
    tooltip: '~5 pages · Tailored to your business.',
  },
  {
    icon: FileCheck,
    num: '09',
    title: 'Procurement Response Memo',
    description:
      'An executive-ready summary of your compliance position, formatted for procurement questionnaire responses and enterprise bid submissions.',
    reg: 'All three',
    tooltip: '~6 pages · Tailored to your business.',
  },
] as const

export default function HomePage() {
  return (
    <>
      {/* 1. Ticker: announcement + Article 50 disclosure */}
      <TopTicker />

      {/* 2. Nav */}
      <Nav />

      <main>
        {/* 3. Hero */}
        <HeroSection />

        {/* 4. The problem — how this lands on your desk */}
        <section className={`${styles.section} ${styles['tinted-section']}`}>
          <div className={styles.container}>
            <div className={styles['sec-head']}>
              <span className={styles.pill}>
                <span className={styles['pill-dot']} />
                The moment it lands
              </span>
              <h2>It usually starts with an email</h2>
              <p>
                Nobody goes looking for AI paperwork. It turns up attached to something
                you were already trying to win.
              </p>
            </div>
            <div className={styles['scn-grid']}>
              <div className={`${styles.card} ${styles.scn}`}>
                <div className={styles['card-icon']}>
                  <Mail width={22} height={22} strokeWidth={ICON_STROKE} />
                </div>
                <h3>A client sends a vendor questionnaire</h3>
                <p>
                  They want your AI use statement, your privacy notice and your complaints
                  procedure. You have a fortnight to reply and nothing written down. The
                  work is already yours to lose.
                </p>
              </div>
              <div className={`${styles.card} ${styles.scn}`}>
                <div className={styles['card-icon']}>
                  <Briefcase width={22} height={22} strokeWidth={ICON_STROKE} />
                </div>
                <h3>A tender asks whether AI is involved</h3>
                <p>
                  Government buyers now ask suppliers, in writing, whether AI or machine
                  learning is used in the services they intend to provide. You need an
                  answer you can put your name to.
                </p>
              </div>
              <div className={`${styles.card} ${styles.scn}`}>
                <div className={styles['card-icon']}>
                  <RefreshCw width={22} height={22} strokeWidth={ICON_STROKE} />
                </div>
                <h3>A renewal comes back with AI clauses in it</h3>
                <p>
                  The standard UK advertiser–agency agreement was updated in December
                  2025. It expects you to name the AI tools you use, show your safeguards
                  and keep records. Most small firms have none of that written down.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. The guide — why I built this */}
        <section className={styles.section}>
          <div className={styles.container}>
            <div className={styles.founder}>
              <div className={styles['founder-head']}>
                <div className={styles['founder-photo']}>OA</div>
                <div className={styles['founder-meta']}>
                  <span className={styles.pill}>From the founder</span>
                  <h3>Why I built this</h3>
                </div>
              </div>
              <div className={styles['founder-body']}>
                <p>
                  Small firms don&apos;t skip this paperwork because they&apos;re
                  careless. They skip it because there is always something more urgent,
                  and because the two obvious routes both feel wrong: a consultant&apos;s
                  quote that starts around £3,000, or a free template that falls apart the
                  moment a client reads it properly.
                </p>
                <p>
                  ReadyPack is the middle option. You answer questions about how your
                  business actually works, including which AI tools you use, who they
                  touch and what data goes near them. You get nine documents built around those
                  answers, rather than someone else&apos;s policy with your name pasted
                  into it.
                </p>
                <p>
                  I&apos;ll be straight about what this is and isn&apos;t. It&apos;s
                  paperwork, done properly and quickly. It is not legal advice and it is
                  not a certificate. If your situation is complicated enough to need a
                  solicitor, I&apos;d rather tell you that than sell you a pack.
                </p>
              </div>
              <div className={styles['founder-attr']}>
                <strong>Olu A.</strong> · Founder, ReadyPack · MOFE Ltd
              </div>
            </div>
          </div>
        </section>

        {/* 6. Nine documents */}
        <section className={styles.section} id="documents">
          <div className={styles.container}>
            <div className={styles['sec-head']}>
              <span className={styles.pill}>The pack</span>
              <h2>Nine documents. Every one you need.</h2>
              <p>
                Your complete compliance pack covers three regulatory frameworks in one
                delivery.
              </p>
            </div>
            <div className={styles['docs-grid']}>
              {DOCUMENTS.map((doc) => {
                const Icon = doc.icon
                return (
                  <div key={doc.num} className={`${styles.card} ${styles['doc-card']}`}>
                    <div className={styles['doc-card-head']}>
                      <div
                        className={`${styles['card-icon']} ${styles['card-icon-flush']}`}
                      >
                        <Icon width={22} height={22} strokeWidth={ICON_STROKE} />
                      </div>
                      <span className={styles['doc-num']}>{doc.num}</span>
                    </div>
                    <h4 className={styles['doc-card-title']}>{doc.title}</h4>
                    <p className={styles['doc-card-desc']}>{doc.description}</p>
                    <span className={styles['doc-reg']}>{doc.reg}</span>
                    <div className={styles['doc-tooltip']}>{doc.tooltip}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* 7. How it works */}
        <section
          className={`${styles.section} ${styles['tinted-section']}`}
          id="how"
        >
          <div className={styles.container}>
            <div className={styles['sec-head']}>
              <span className={styles.pill}>Process</span>
              <h2>From questionnaire to compliance pack in 48 hours.</h2>
            </div>
            <div className={styles['how-grid']}>
              <div className={styles['how-step']}>
                <div className={styles['how-step-head']}>
                  <div className={styles['how-dot']}>
                    <ClipboardList width={24} height={24} strokeWidth={ICON_STROKE} />
                  </div>
                  <span className={styles['how-num']}>01</span>
                </div>
                <div className={styles['how-time']}>Day 0</div>
                <h3>Answer questions about your business</h3>
                <p>
                  A guided questionnaire about how you use data and AI, asked in plain
                  English. No technical background needed. Set aside 20 to 35 minutes,
                  depending on how many AI tools you use. You can save and come back to
                  it.
                </p>
              </div>
              <div className={styles['how-step']}>
                <div className={styles['how-step-head']}>
                  <div className={styles['how-dot']}>
                    <Cpu width={24} height={24} strokeWidth={ICON_STROKE} />
                  </div>
                  <span className={styles['how-num']}>02</span>
                </div>
                <div className={styles['how-time']}>Within 24 hours</div>
                <h3>It gets drafted, then checked</h3>
                <p>
                  Your answers are mapped to the relevant rules and all nine documents are
                  generated from them. Every pack is quality-checked before it goes out,
                  and anything higher-risk gets pulled aside for a proper manual look.
                </p>
              </div>
              <div className={styles['how-step']}>
                <div className={styles['how-step-head']}>
                  <div className={styles['how-dot']}>
                    <Download width={24} height={24} strokeWidth={ICON_STROKE} />
                  </div>
                  <span className={styles['how-num']}>03</span>
                </div>
                <div className={styles['how-time']}>Within 48 hours</div>
                <h3>Delivered, ready to use</h3>
                <p>
                  You receive your full document suite as a professionally formatted PDF
                  pack, along with guidance on how and where to deploy each document.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Features bar */}
        <section>
          <div className={styles.container}>
            <div className={styles['feat-bar']}>
              <div className={styles['feat-item']}>
                <div className={styles['feat-item-head']}>
                  <span className={styles['feat-item-icon']}>
                    <Clock width={22} height={22} strokeWidth={ICON_STROKE} />
                  </span>
                  <span className={styles.h4}>48-hour delivery</span>
                </div>
                <p>From finished questionnaire to completed pack.</p>
              </div>
              <div className={styles['feat-item']}>
                <div className={styles['feat-item-head']}>
                  <span className={styles['feat-item-icon']}>
                    <UserCheck width={22} height={22} strokeWidth={ICON_STROKE} />
                  </span>
                  <span className={styles.h4}>Checked before it ships</span>
                </div>
                <p>
                  Every pack is quality-checked, and higher-risk cases are held back for
                  manual review.
                </p>
              </div>
              <div className={styles['feat-item']}>
                <div className={styles['feat-item-head']}>
                  <span className={styles['feat-item-icon']}>
                    <Layers width={22} height={22} strokeWidth={ICON_STROKE} />
                  </span>
                  <span className={styles.h4}>Three regulations, one process</span>
                </div>
                <p>UK GDPR, the EU AI Act and DUAA, covered in a single intake.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 9. Where the rules stand */}
        <section className={`${styles.section} ${styles['tinted-section']}`}>
          <div className={styles.container}>
            <div className={styles['sec-head']}>
              <span className={styles.pill}>
                <span className={styles['pill-dot']} />
                Where the rules stand
              </span>
              <h2>These aren&apos;t deadlines to prepare for</h2>
              <p>They already apply. Here is the honest state of each one.</p>
            </div>
            <div className={styles['dl-grid']}>
              <div className={`${styles.card} ${styles['dl-card']}`}>
                <div className={styles['card-icon']}>
                  <CalendarClock width={22} height={22} strokeWidth={ICON_STROKE} />
                </div>
                <span className={`${styles['dl-date']} ${styles.amber}`}>
                  In force since June 2026
                </span>
                <h3>Section 103 of the UK Data (Use and Access) Act</h3>
                <p className={styles['dl-body']}>
                  Organisations that handle personal data need a formal complaints
                  procedure. That date has passed, so this is a live obligation rather
                  than something to get ready for. The Complaints Procedure Pack covers
                  it.
                </p>
              </div>
              <div className={`${styles.card} ${styles['dl-card']}`}>
                <div className={styles['card-icon']}>
                  <Cpu width={22} height={22} strokeWidth={ICON_STROKE} />
                </div>
                <span className={`${styles['dl-date']} ${styles.amber}`}>
                  Phasing in through 2026–2027
                </span>
                <h3>EU AI Act transparency rules</h3>
                <p className={styles['dl-body']}>
                  If you have customers in the EU and AI touches them, you are expected to
                  say so. The obligations arrive in stages, and the dates have already
                  moved once. The AI Use Statement and Customer Disclosure Snippets are
                  built for this.
                </p>
              </div>
              <div className={`${styles.card} ${styles['dl-card']}`}>
                <div className={styles['card-icon']}>
                  <Lock width={22} height={22} strokeWidth={ICON_STROKE} />
                </div>
                <span className={`${styles['dl-date']} ${styles.amber}`}>Ongoing</span>
                <h3>Data protection by design, under UK GDPR</h3>
                <p className={styles['dl-body']}>
                  Privacy notices, impact assessments and vendor registers have been
                  expected for years. They are table stakes in most procurement reviews.
                  All three are in your pack.
                </p>
              </div>
            </div>
            <p className={styles['dl-bottom']}>
              The bigger point isn&apos;t the regulator. It&apos;s that your clients are
              starting to ask, and &ldquo;we&apos;re working on it&rdquo; is a weak answer
              when a contract is on the table.
            </p>
          </div>
        </section>

        {/* 11. Comparison */}
        <section className={`${styles.section} ${styles['tinted-section']}`}>
          <div className={styles.container}>
            <div className={styles['sec-head']}>
              <span className={styles.pill}>Price anchor</span>
              <h2>ReadyPack vs. the alternatives</h2>
              <p>The same documentation. Very different price points.</p>
            </div>
            <div className={styles.compare}>
              <div className={`${styles['compare-col']} ${styles.label}`}>
                <div className={styles['compare-head']}>
                  <div className={styles['ch-name']}>&nbsp;</div>
                </div>
                <div className={styles['compare-cell']}>Cost</div>
                <div className={styles['compare-cell']}>Timeline</div>
                <div className={styles['compare-cell']}>Documents</div>
                <div className={styles['compare-cell']}>Tailored to your business</div>
                <div className={styles['compare-cell']}>Regulatory deadlines covered</div>
              </div>
              <div className={styles['compare-col']}>
                <div className={styles['compare-head']}>
                  <div className={styles['ch-name']}>Solicitor / DPO Consultant</div>
                  <div className={styles['ch-sub']}>Traditional route</div>
                </div>
                <div className={styles['compare-cell']}>£3,000 – £8,000+</div>
                <div className={styles['compare-cell']}>4 – 12 weeks</div>
                <div className={styles['compare-cell']}>Varies</div>
                <div className={`${styles['compare-cell']} ${styles.center}`}>
                  <Check
                    width={20}
                    height={20}
                    strokeWidth={ICON_STROKE}
                    className={styles.check}
                  />
                </div>
                <div className={`${styles['compare-cell']} ${styles.center}`}>
                  <span className={styles.maybe}>Maybe</span>
                </div>
              </div>
              <div className={`${styles['compare-col']} ${styles.featured}`}>
                <div className={styles['compare-head']}>
                  <div className={styles['ch-name']}>ReadyPack</div>
                  <div className={styles['ch-sub']}>Procurement-Ready</div>
                </div>
                <div
                  className={`${styles['compare-cell']} ${styles['compare-cell-rp-price']}`}
                >
                  £499 <span className={styles['one-off']}>one-off</span>
                </div>
                <div
                  className={`${styles['compare-cell']} ${styles['compare-cell-rp-time']}`}
                >
                  48 hours
                </div>
                <div
                  className={`${styles['compare-cell']} ${styles['compare-cell-rp-docs']}`}
                >
                  9 documents, defined upfront
                </div>
                <div className={`${styles['compare-cell']} ${styles.center}`}>
                  <Check
                    width={20}
                    height={20}
                    strokeWidth={ICON_STROKE}
                    className={styles.check}
                  />
                </div>
                <div
                  className={`${styles['compare-cell']} ${styles.center} ${styles['compare-cell-rp-regs']}`}
                >
                  GDPR + AI Act + DUAA ✓
                </div>
              </div>
              <div className={styles['compare-col']}>
                <div className={styles['compare-head']}>
                  <div className={styles['ch-name']}>DPO Retainer</div>
                  <div className={styles['ch-sub']}>Recurring engagement</div>
                </div>
                <div className={styles['compare-cell']}>£1,500 – £2,500/month</div>
                <div className={styles['compare-cell']}>Ongoing</div>
                <div className={styles['compare-cell']}>Varies</div>
                <div className={`${styles['compare-cell']} ${styles.center}`}>
                  <Check
                    width={20}
                    height={20}
                    strokeWidth={ICON_STROKE}
                    className={styles.check}
                  />
                </div>
                <div className={`${styles['compare-cell']} ${styles.center}`}>
                  <span className={styles.maybe}>Maybe</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 12. Pricing */}
        <PricingSection />

        {/* 13. Guarantee */}
        <section className={styles.section}>
          <div className={styles.container}>
            <div className={styles.guarantee}>
              <div className={styles['guarantee-icon']}>
                <ShieldCheck width={36} height={36} strokeWidth={ICON_STROKE} />
              </div>
              <h2>Our guarantee</h2>
              <div className={styles['guarantee-body']}>
                <p>
                  If your pack isn&apos;t what you expected, email us within 14 days of
                  delivery and we refund you in full. No questions. No forms.
                </p>
                <p>We stand behind every pack that leaves us.</p>
              </div>
              <div className={styles['guarantee-pills']}>
                <span className={`${styles.pill} ${styles['pill-rounded']}`}>
                  14-day full refund
                </span>
                <span className={`${styles.pill} ${styles['pill-rounded']}`}>
                  Quality-checked before delivery
                </span>
                <span className={`${styles.pill} ${styles['pill-rounded']}`}>
                  Delivered within 48 hours
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 14. Sample document */}
        <section className={`${styles.section} ${styles['tinted-section']}`}>
          <div className={styles.container}>
            <div className={styles['sample-grid']}>
              <div>
                <span className={styles.pill}>Sample</span>
                <h3 className={styles['sample-title']}>
                  See what you&apos;re getting before you buy
                </h3>
                <p className={styles['sample-desc']}>
                  Every pack is tailored to your business, but the quality is
                  consistent. View a redacted sample of our AI Use Statement to see the
                  standard you can expect.
                </p>
                <a
                  href="/samples"
                  className={`${styles.btn} ${styles['btn-secondary']} ${styles['btn-lg']}`}
                >
                  View Sample Document
                  <ExternalLink width={16} height={16} strokeWidth={ICON_STROKE} />
                </a>
              </div>
              <div>
                <div className={styles['sample-doc']}>
                  <div className={styles['sample-doc-bar']} />
                  <div className={styles['sample-doc-head']}>
                    <div className={styles['sdh-title']}>
                      ReadyPack · AI Use Statement
                    </div>
                    <div className={styles['sdh-sub']}>
                      Prepared for [Company Name] · May 2026
                    </div>
                  </div>
                  <div className={styles['sample-doc-body']}>
                    <div className={styles['section-h']} />
                    <div className={styles.sl} />
                    <div className={`${styles.sl} ${styles.med}`} />
                    <div className={`${styles.sl} ${styles.short}`} />
                    <div className={styles.sl} />
                    <div className={styles['section-h']} />
                    <div className={`${styles.sl} ${styles.med}`} />
                    <div className={styles.sl} />
                    <div className={`${styles.sl} ${styles.short}`} />
                    <div className={styles['sample-doc-watermark']}>SAMPLE — REDACTED</div>
                  </div>
                  <div className={styles['sample-doc-foot']}>
                    ReadyPack Compliance Documentation · AI Use Statement · Page 1 of 4
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 15. FAQ */}
        <FaqSection />

        {/* 16. Final CTA */}
        <section className={styles['finalcta-wrap']}>
          <div className={styles['finalcta-glow']} />
          <div className={`${styles.container} ${styles.finalcta}`}>
            <h2>Be the supplier who already has it ready.</h2>
            <p className={styles['finalcta-sub']}>
              Answer the questionnaire today and the documents land in your inbox within
              48 hours, ready to send to the next client who asks.
            </p>
            <a
              href="#pricing"
              className={`${styles.btn} ${styles['btn-primary']} ${styles['btn-lg']}`}
            >
              Get Your Pack from £249
              <ArrowRight width={16} height={16} strokeWidth={ICON_STROKE} />
            </a>
            <div className={styles['finalcta-foot']}>
              14-day money-back guarantee · No subscription · Delivered within 48 hours
            </div>
          </div>
        </section>
      </main>

      {/* 17. Footer */}
      <Footer />
    </>
  )
}
