import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarClock,
  CalendarX,
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
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'

import styles from './landing.module.css'
import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { HeroSection } from '@/components/landing/HeroSection'
import { GapScanSection } from '@/components/landing/GapScanSection'
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
      {/* 1. Announcement bar */}
      <div className={styles.ann}>
        <span className={styles['ann-dot']} />
        <span>
          EU AI Act enforcement begins{' '}
          <span className={styles['ann-strong']}>2 August 2026</span> · DUAA Section 103
          takes effect <span className={styles['ann-strong']}>19 June 2026</span>
        </span>
        <span className={styles['ann-sep']}>·</span>
        <a href="#pricing">Get compliant →</a>
      </div>

      {/* 2. Nav */}
      <Nav />

      <main>
        {/* 3. Hero */}
        <HeroSection />

        {/* 4. Gap Scan */}
        <GapScanSection />

        {/* 5. Three deadlines */}
        <section className={`${styles.section} ${styles['tinted-section']}`}>
          <div className={styles.container}>
            <div className={styles['sec-head']}>
              <span className={styles.pill}>
                <span className={styles['pill-dot']} />
                Regulatory calendar
              </span>
              <h2>Three deadlines. One pack.</h2>
              <p>
                The regulatory calendar is set. Here is exactly what changes — and why it
                matters to your business.
              </p>
            </div>
            <div className={styles['dl-grid']}>
              <div className={`${styles.card} ${styles['dl-card']}`}>
                <div className={styles['card-icon']}>
                  <CalendarClock width={22} height={22} strokeWidth={ICON_STROKE} />
                </div>
                <span className={`${styles['dl-date']} ${styles.red}`}>19 June 2026</span>
                <h3>UK Data (Use and Access) Act — Section 103</h3>
                <p className={styles['dl-body']}>
                  From this date, organisations that process personal data must have a
                  formal complaints handling procedure in place. The ICO can investigate
                  and act on non-compliance. ReadyPack&apos;s Complaints Procedure Pack is
                  built specifically around this obligation.
                </p>
              </div>
              <div className={`${styles.card} ${styles['dl-card']}`}>
                <div className={styles['card-icon']}>
                  <Cpu width={22} height={22} strokeWidth={ICON_STROKE} />
                </div>
                <span className={`${styles['dl-date']} ${styles.red}`}>2 August 2026</span>
                <h3>EU AI Act — Transparency &amp; Enforcement</h3>
                <p className={styles['dl-body']}>
                  The majority of the AI Act&apos;s rules come into force. Article 50
                  transparency requirements begin applying — meaning organisations using
                  AI in customer-facing or decision-making contexts must disclose it. Our
                  AI Use Statement and Customer Disclosure Snippets cover this directly.
                </p>
              </div>
              <div className={`${styles.card} ${styles['dl-card']}`}>
                <div className={styles['card-icon']}>
                  <Lock width={22} height={22} strokeWidth={ICON_STROKE} />
                </div>
                <span className={`${styles['dl-date']} ${styles.amber}`}>Ongoing</span>
                <h3>UK GDPR — Data Protection by Design</h3>
                <p className={styles['dl-body']}>
                  The ICO&apos;s enforcement of data protection documentation requirements
                  doesn&apos;t pause. Privacy notices, DPIAs, and vendor registers are
                  procurement table-stakes. All three are in your pack.
                </p>
              </div>
            </div>
            <p className={styles['dl-bottom']}>
              These aren&apos;t future considerations. They are live obligations. If you
              sell to enterprise customers, those customers are already checking for this
              documentation.
            </p>
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
                <h3>Answer 15 minutes of questions</h3>
                <p>
                  Walk through a guided questionnaire about how your business uses data
                  and AI. No technical background needed — we ask in plain English about
                  your products, your customers, and your tools.
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
                <h3>AI drafts it. An expert reviews it.</h3>
                <p>
                  Our document engine maps your answers to current regulatory frameworks
                  and builds all nine documents. An experienced compliance reviewer then
                  checks every pack before it leaves us — not just the AI output.
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
                <p>From questionnaire to completed pack, guaranteed.</p>
              </div>
              <div className={styles['feat-item']}>
                <div className={styles['feat-item-head']}>
                  <span className={styles['feat-item-icon']}>
                    <UserCheck width={22} height={22} strokeWidth={ICON_STROKE} />
                  </span>
                  <span className={styles.h4}>Expert review on every pack</span>
                </div>
                <p>
                  Every document is checked by a human compliance reviewer before
                  delivery.
                </p>
              </div>
              <div className={styles['feat-item']}>
                <div className={styles['feat-item-head']}>
                  <span className={styles['feat-item-icon']}>
                    <Layers width={22} height={22} strokeWidth={ICON_STROKE} />
                  </span>
                  <span className={styles.h4}>Three regulations, one process</span>
                </div>
                <p>UK GDPR, EU AI Act, and DUAA — covered in a single intake.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 9. Who this is for */}
        <section className={`${styles.section} ${styles['tinted-section']}`}>
          <div className={styles.container}>
            <div className={styles['sec-head']}>
              <span className={styles.pill}>Trigger moments</span>
              <h2>Built for the moment when compliance lands on your desk</h2>
            </div>
            <div className={styles['scn-grid']}>
              <div className={`${styles.card} ${styles.scn}`}>
                <div className={styles['card-icon']}>
                  <Mail width={22} height={22} strokeWidth={ICON_STROKE} />
                </div>
                <h3>Your enterprise customer just sent a vendor questionnaire</h3>
                <p>
                  They want to see your AI governance documentation, your privacy notice,
                  and your complaints procedure. You have two weeks to respond credibly.
                  ReadyPack gives you exactly what they&apos;re asking for.
                </p>
              </div>
              <div className={`${styles.card} ${styles.scn}`}>
                <div className={styles['card-icon']}>
                  <Briefcase width={22} height={22} strokeWidth={ICON_STROKE} />
                </div>
                <h3>Your tender requires AI and data governance documentation</h3>
                <p>
                  You&apos;re bidding for a contract that lists compliance documentation
                  as a qualifying requirement. Without it, you don&apos;t make the
                  shortlist. With ReadyPack, you make the deadline.
                </p>
              </div>
              <div className={`${styles.card} ${styles.scn}`}>
                <div className={styles['card-icon']}>
                  <CalendarX width={22} height={22} strokeWidth={ICON_STROKE} />
                </div>
                <h3>You&apos;ve seen the August 2026 deadline and have nothing ready</h3>
                <p>
                  The EU AI Act enforcement date is approaching. You know you should have
                  documentation in place. You don&apos;t know where to start. The
                  questionnaire takes 15 minutes. The pack arrives in 48 hours.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 10. Founder note */}
        <section className={styles.section}>
          <div className={styles.container}>
            <div className={styles.founder}>
              <div className={styles['founder-head']}>
                <div className={styles['founder-photo']}>OT</div>
                <div className={styles['founder-meta']}>
                  <span className={styles.pill}>From the founder</span>
                  <h3>Why I built this</h3>
                </div>
              </div>
              <div className={styles['founder-body']}>
                <p>
                  For two years I ran compliance readiness workshops for SMEs. The
                  question I heard most wasn&apos;t &ldquo;which regulation applies to
                  me?&rdquo; — they&apos;d already Googled that. It was: &ldquo;we know we
                  need to sort this. We just haven&apos;t had time.&rdquo;
                </p>
                <p>
                  These weren&apos;t careless organisations. They were teams under real
                  pressure — a founder who&apos;d just taken on a new enterprise client,
                  an operations lead who&apos;d been handed the DPO role alongside their
                  other responsibilities, a recruitment firm trying to respond to an AI
                  governance clause in a bid.
                </p>
                <p>
                  The existing options were a consulting invoice starting at £3,000 or a
                  generic template that wouldn&apos;t pass a procurement review. I
                  thought there was a better way.
                </p>
                <p>
                  ReadyPack is a delivery problem, not a knowledge problem. The documents
                  aren&apos;t complicated — getting them done is. That&apos;s what we
                  solve.
                </p>
              </div>
              <div className={styles['founder-attr']}>
                <strong>Olu Tayo</strong> · Founder, ReadyPack · Compliance delivery
                specialist
              </div>
            </div>
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
            <div className={styles.pullquote}>
              &ldquo;The DPIA template was exactly what our enterprise customer needed to
              see. It would have cost us four times this in consulting fees.&rdquo;
              <span className={styles['pullquote-attr']}>
                — James O&apos;Brien, Operations Director
              </span>
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
                  We don&apos;t have a wall of testimonials to show you — and we
                  won&apos;t manufacture them. We&apos;re a new product and we&apos;re
                  honest about that.
                </p>
                <p>
                  What we can offer is this: if your pack doesn&apos;t meet the standard
                  you expected within 14 days of delivery, we will refund you in full. No
                  questions. No forms. Email us and it&apos;s done.
                </p>
                <p>We stand behind every pack that leaves us.</p>
              </div>
              <div className={styles['guarantee-pills']}>
                <span className={`${styles.pill} ${styles['pill-rounded']}`}>
                  14-day full refund
                </span>
                <span className={`${styles.pill} ${styles['pill-rounded']}`}>
                  Expert-reviewed before delivery
                </span>
                <span className={`${styles.pill} ${styles['pill-rounded']}`}>
                  Delivered in 48 hours or it&apos;s free
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
                  Every pack is tailored to your business — but the quality is
                  consistent. View a redacted sample of our AI Use Statement to see the
                  standard you can expect.
                </p>
                <a
                  href="#"
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
            <h2>The deadline is coming. Your documents aren&apos;t ready.</h2>
            <p className={styles['finalcta-sub']}>
              The questionnaire takes 15 minutes. The pack arrives in 48 hours. The
              deadlines are fixed.
            </p>
            <a
              href="#pricing"
              className={`${styles.btn} ${styles['btn-primary']} ${styles['btn-lg']}`}
            >
              Get Your Pack — from £249
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
