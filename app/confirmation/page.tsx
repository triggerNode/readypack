import Link from 'next/link'
import { Check, FileCheck, Mail, ShieldCheck } from 'lucide-react'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ReadyPackLogo } from '@/components/ReadyPackLogo'
import styles from './confirmation.module.css'

export const dynamic = 'force-dynamic'

type Tier = 'solo' | 'procurement_ready' | 'adviser'

type Props = {
  searchParams: Promise<{ session_id?: string }>
}

type TierDisplay = {
  name: string
  price: string
}

const TIER_DISPLAY: Record<Tier, TierDisplay> = {
  solo: { name: 'Solo Pack', price: '£249 · one-off' },
  procurement_ready: { name: 'Procurement-Ready Pack', price: '£499 · one-off' },
  adviser: { name: 'Adviser Pack', price: '£799 · one-off' },
}

function isTier(value: unknown): value is Tier {
  return value === 'solo' || value === 'procurement_ready' || value === 'adviser'
}

// Map a customer's email domain to its webmail inbox, so the "open inbox" CTA
// actually takes them somewhere. Returns null for domains we can't resolve
// (e.g. corporate mailboxes) — those keep the non-interactive prompt instead.
const WEBMAIL_BY_DOMAIN: Record<string, string> = {
  'gmail.com': 'https://mail.google.com/mail/u/0/',
  'googlemail.com': 'https://mail.google.com/mail/u/0/',
  'outlook.com': 'https://outlook.live.com/mail/',
  'hotmail.com': 'https://outlook.live.com/mail/',
  'hotmail.co.uk': 'https://outlook.live.com/mail/',
  'live.com': 'https://outlook.live.com/mail/',
  'live.co.uk': 'https://outlook.live.com/mail/',
  'msn.com': 'https://outlook.live.com/mail/',
  'yahoo.com': 'https://mail.yahoo.com/',
  'yahoo.co.uk': 'https://mail.yahoo.com/',
  'ymail.com': 'https://mail.yahoo.com/',
  'icloud.com': 'https://www.icloud.com/mail/',
  'me.com': 'https://www.icloud.com/mail/',
  'mac.com': 'https://www.icloud.com/mail/',
  'proton.me': 'https://mail.proton.me/u/0/',
  'protonmail.com': 'https://mail.proton.me/u/0/',
  'aol.com': 'https://mail.aol.com/',
}

function inboxUrlFor(email: string): string | null {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null
  return WEBMAIL_BY_DOMAIN[domain] ?? null
}

type ViewModel = {
  email: string
  tier: Tier
  orderRef: string
}

async function fetchViewModel(sessionId: string | undefined): Promise<ViewModel> {
  if (!sessionId) {
    return { email: '', tier: 'solo', orderRef: '' }
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const email = session.customer_details?.email ?? ''
    const rawPlan = session.metadata?.plan_selected
    const tier: Tier = isTier(rawPlan) ? rawPlan : 'solo'
    const computedRef = `RP-${sessionId.slice(-8).toUpperCase()}`

    // Prefer the stored reference (set by the Stripe webhook) so it matches the
    // value shown in emails and the admin tools. Fall back to the computed value
    // if the order row hasn't been written yet (webhook race) or the column is empty.
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('display_reference')
      .eq('stripe_session_id', sessionId)
      .maybeSingle()
    const orderRef = order?.display_reference ?? computedRef

    return { email, tier, orderRef }
  } catch (err) {
    console.error('Confirmation page — failed to retrieve session:', err)
    return { email: '', tier: 'solo', orderRef: '' }
  }
}

export default async function ConfirmationPage({ searchParams }: Props) {
  const { session_id: sessionId } = await searchParams
  const { email, tier, orderRef } = await fetchViewModel(sessionId)
  const display = TIER_DISPLAY[tier]
  const inboxUrl = email ? inboxUrlFor(email) : null

  return (
    <>
      <nav className={styles.nav}>
        <div className={`${styles.container} ${styles.navInner}`}>
          <Link href="/" className={styles.logo} aria-label="ReadyPack">
            <ReadyPackLogo className={styles.logoMark} />
            <span className={styles.logoWord}>ReadyPack</span>
          </Link>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.glow} aria-hidden="true" />
        <div className={styles.wrap}>
          <div className={styles.successBlock}>
            <span className={styles.successCircle}>
              <ShieldCheck width={40} height={40} strokeWidth={1.8} />
            </span>
            <span className={styles.badge}>Payment confirmed</span>
          </div>

          <h1 className={styles.headline}>You&apos;re in. Let&apos;s build your pack.</h1>
          <p className={styles.subhead}>
            Your intake questionnaire link has been sent to{' '}
            <span className={styles.email}>{email || 'the email on file'}</span>. Click the link in
            that email to begin — your progress saves automatically so you can pause and return at
            any time.
          </p>

          <div className={styles.orderCard}>
            <div className={styles.orderRow1}>
              <span className={styles.orderProduct}>
                <FileCheck width={20} height={20} /> {display.name}
              </span>
              <span className={styles.orderPrice}>{display.price}</span>
            </div>
            <div className={styles.orderDivider} />
            <div className={styles.orderFeats}>
              <span className={styles.orderFeat}>
                <Check width={14} height={14} /> Nine compliance documents
              </span>
              <span className={styles.orderFeat}>
                <Check width={14} height={14} /> Delivered within 48 hours
              </span>
              <span className={styles.orderFeat}>
                <Check width={14} height={14} /> 14-day money-back guarantee
              </span>
            </div>
            {orderRef ? (
              <div className={styles.orderRef}>
                <span className={styles.orderRefK}>Order reference:</span>
                <span className={styles.orderRefV}>{orderRef}</span>
              </div>
            ) : null}
          </div>

          <div className={styles.next}>
            <div className={styles.nextLabel}>What happens next</div>
            <div className={styles.timeline}>
              <div className={styles.step}>
                <div className={styles.stepRail}>
                  <span className={styles.stepNum}>1</span>
                  <span className={styles.stepLine} />
                </div>
                <div className={styles.stepContent}>
                  <span className={`${styles.timingBadge} ${styles.timingBadgeNow}`}>Now</span>
                  <p className={styles.stepHeading}>Check your inbox</p>
                  <p className={styles.stepBody}>
                    We&apos;ve sent your intake link to your email. Click it to start your
                    questionnaire — most businesses take 20–35 minutes, and you can save and
                    return at any point.
                  </p>
                </div>
              </div>

              <div className={styles.step}>
                <div className={styles.stepRail}>
                  <span className={styles.stepNum}>2</span>
                  <span className={styles.stepLine} />
                </div>
                <div className={styles.stepContent}>
                  <span className={styles.timingBadge}>Within 24 hours of submission</span>
                  <p className={styles.stepHeading}>Your pack is generated and QA-checked</p>
                  <p className={styles.stepBody}>
                    ReadyPack generates your nine documents from your answers and runs them through
                    our structured quality assurance process. Higher-risk use cases are flagged for
                    manual review.
                  </p>
                </div>
              </div>

              <div className={styles.step}>
                <div className={styles.stepRail}>
                  <span className={styles.stepNum}>3</span>
                </div>
                <div className={styles.stepContent}>
                  <span className={styles.timingBadge}>Within 48 hours</span>
                  <p className={styles.stepHeading}>
                    Your complete pack arrives in your inbox
                  </p>
                  <p className={styles.stepBody}>
                    Nine professionally formatted documents, ready to share with customers,
                    procurement teams, and auditors.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {inboxUrl ? (
            <a
              className={styles.btn}
              href={inboxUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: '40px', textDecoration: 'none' }}
            >
              Open my inbox <Mail width={16} height={16} />
            </a>
          ) : (
            <div
              className={styles.btn}
              style={{ marginTop: '40px', cursor: 'default', opacity: 0.85 }}
            >
              Check your inbox to get started <Mail width={16} height={16} />
            </div>
          )}
          <p className={styles.ctaFoot}>
            We&apos;ve sent a secure link to{' '}
            <strong>{email || 'the email on file'}</strong>. Click it to open your questionnaire.
            Use the same link to return later if you need to pause.
          </p>

          <p className={styles.support}>
            Didn&apos;t receive the email? Check your spam folder, or contact us at{' '}
            <a href="mailto:hello@readypack.co.uk">hello@readypack.co.uk</a>
          </p>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <span className={styles.footerLegal}>
            ReadyPack · MOFE LTD · Company No. 16633320 · Not legal advice — documentation
            support.
          </span>
          <span className={styles.footerLinks}>
            <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms</a>
          </span>
        </div>
      </footer>
    </>
  )
}
