import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Check,
  Dot,
  Lock,
  CheckCircle2,
  ListChecks,
  Coffee,
  Clock,
  Flag,
  PackageCheck,
  MessagesSquare,
  UserCheck,
} from 'lucide-react'
import type { RiskLevel } from '@/types/database'
import type { Runbook, RunbookStep } from '../../../_lib/runbook'
import type { LifecycleStep } from '../../../_lib/lifecycle'
import type { FlagView, FlagPath, FlagSummary } from '../../../_lib/flag-view'
import type { CaseStatus } from '../../../_lib/cases'
import { DeadlineCountdown } from './DeadlineCountdown'
import { SignOffFlagForm } from './SignOffFlagForm'
import { QueryFlagForm } from './QueryFlagForm'
import {
  ReleaseForReviewButton,
  GeneratePackButton,
  RequestMoreInfoForm,
  EscalateCaseForm,
  RegenerateRevisionButton,
  ReleaseRevisionButton,
  ResolveInfoRequestButton,
  RequestMoreInfoForFlagButton,
} from './ActionForms'
import styles from './runbook.module.css'

// The delivery-gate banner state, decided in page.tsx from the loaded rows.
export type GateState =
  | { show: false }
  | { show: true; blocked: true; openHighFlags: number }
  | { show: true; blocked: false }

export type CaseRunbookProps = {
  caseId: string
  displayName: string
  customerEmail: string | null
  tierLabel: string
  riskLevel: RiskLevel | null
  deliveryDeadline: string
  caseStatus: CaseStatus
  orderedAtLabel: string
  stripePaymentId: string | null
  runbook: Runbook
  lifecycle: LifecycleStep[]
  /** Flags already ordered (hold → query → signed-off → handled). */
  flags: FlagView[]
  flagSummary: FlagSummary
  gate: GateState
  alreadyReleased: boolean
  /** The single open revision (else null); count decides button-vs-pointer. */
  openRevision: { id: string; awaitingRerelease: boolean } | null
  openRevisionCount: number
  /** The single answered info-request (else null); count decides button-vs-pointer. */
  answeredInfoRequest: { id: string } | null
  answeredInfoRequestCount: number
}

const RISK_CHIP: Record<RiskLevel, { label: string; className: string; icon: typeof AlertTriangle }> = {
  critical: { label: 'Critical risk', className: styles.rlvlCritical, icon: AlertTriangle },
  high: { label: 'High risk', className: styles.rlvlHigh, icon: AlertTriangle },
  medium: { label: 'Medium risk', className: styles.rlvlMedium, icon: ShieldAlert },
  low: { label: 'Low risk', className: styles.rlvlLow, icon: ShieldCheck },
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// ── Story header ──────────────────────────────────────────
function StoryHeader({ p }: { p: CaseRunbookProps }) {
  const chip = p.riskLevel ? RISK_CHIP[p.riskLevel] : null
  const ChipIcon = chip?.icon
  return (
    <div className={styles.story}>
      <div className={styles.storyTop}>
        <div style={{ minWidth: 0 }}>
          <div className={styles.storyNameLine}>
            <span className={styles.storyName}>{p.displayName}</span>
            {chip && ChipIcon ? (
              <span className={`${styles.rlvl} ${chip.className}`}>
                <ChipIcon size={13} aria-hidden /> {chip.label}
              </span>
            ) : null}
            <span className={styles.tier}>{p.tierLabel}</span>
          </div>
          <div className={styles.storyMeta}>
            {p.customerEmail ?? '—'} · {p.orderedAtLabel}
          </div>
        </div>
        <DeadlineCountdown deadlineIso={p.deliveryDeadline} status={p.caseStatus} />
      </div>
      <LifecycleStepper steps={p.lifecycle} />
    </div>
  )
}

// ── Lifecycle stepper ─────────────────────────────────────
function LifecycleStepper({ steps }: { steps: LifecycleStep[] }) {
  return (
    <div className={styles.life} aria-label="Case lifecycle">
      {steps.map((step, i) => {
        const stateClass =
          step.state === 'done'
            ? styles.lifeStepDone
            : step.state === 'current'
            ? styles.lifeStepCurrent
            : ''
        return (
          <span key={step.key} style={{ display: 'contents' }}>
            {i > 0 ? (
              <span className={`${styles.lifeBar} ${steps[i - 1].state === 'done' ? styles.lifeBarDone : ''}`} />
            ) : null}
            <span
              className={`${styles.lifeStep} ${stateClass}`}
              aria-current={step.state === 'current' ? 'step' : undefined}
            >
              <span className={styles.lifeDot}>
                {step.state === 'done' ? <Check size={12} aria-hidden /> : <Dot size={12} aria-hidden />}
              </span>
              <span className={styles.lifeLabel}>{step.label}</span>
            </span>
          </span>
        )
      })}
    </div>
  )
}

// ── Gate banner ───────────────────────────────────────────
function GateBanner({ gate, caseId, alreadyReleased }: { gate: GateState; caseId: string; alreadyReleased: boolean }) {
  if (!gate.show) return null

  if (gate.blocked) {
    const n = gate.openHighFlags
    return (
      <div className={`${styles.gate} ${styles.gateBlocked}`} role="status">
        <span className={styles.gateIco}>
          <Lock size={20} aria-hidden />
        </span>
        <div className={styles.gateBody}>
          <div className={styles.gateTitle}>
            Can&apos;t release — {n} high flag{n === 1 ? '' : 's'} still need{n === 1 ? 's' : ''} sign-off
          </div>
          <div className={styles.gateSub}>
            A person must sign off {n === 1 ? 'the high-risk flag' : 'each high-risk flag'}, recording the decision,
            before the pack can go to the customer.
          </div>
        </div>
        <div className={styles.gateCta}>
          <button type="button" className={styles.releaseLocked} disabled>
            <Lock size={15} aria-hidden /> Release for review
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.gate} ${styles.gateClear}`} role="status">
      <span className={styles.gateIco}>
        <CheckCircle2 size={20} aria-hidden />
      </span>
      <div className={styles.gateBody}>
        <div className={styles.gateTitle}>Cleared to release</div>
        <div className={styles.gateSub}>No flag needs a human. Everything raised is handled by the pack.</div>
      </div>
      <div className={styles.gateCta}>
        <ReleaseForReviewButton caseId={caseId} alreadyReleased={alreadyReleased} />
      </div>
    </div>
  )
}

// ── Runbook ───────────────────────────────────────────────
function RunbookBlock({ p }: { p: CaseRunbookProps }) {
  const rb = p.runbook
  if (rb.kind === 'calm') {
    const waiting = rb.tone === 'waiting'
    const Icon = rb.tone === 'done' ? CheckCircle2 : waiting ? Clock : Coffee
    return (
      <div className={`${styles.runbook} ${styles.runbookCalm}`}>
        <span className={`${styles.calmIco} ${waiting ? styles.calmIcoWaiting : ''}`}>
          <Icon size={22} aria-hidden />
        </span>
        <div>
          <div className={styles.calmTitle}>{rb.title}</div>
          <div className={styles.calmSub}>{rb.sub}</div>
        </div>
      </div>
    )
  }

  return (
    <ol className={styles.runbook}>
      {rb.steps.map((step, i) => (
        <RunbookStepRow key={i} step={step} index={i} p={p} />
      ))}
    </ol>
  )
}

const TAG: Record<'done' | 'now' | 'wait', { text: string; className: string }> = {
  done: { text: 'Done', className: styles.rbTagDone },
  now: { text: 'Do this now', className: styles.rbTagNow },
  wait: { text: 'Waiting', className: styles.rbTagWait },
}

function RunbookStepRow({ step, index, p }: { step: RunbookStep; index: number; p: CaseRunbookProps }) {
  // The revision two-step is the one place the pure runbook can't know the
  // sub-state (regenerated-yet-unreleased). Correct its status + button here from
  // the real open revision so the admin always sees the right action, never a
  // stale one. Everything else renders the brain's status verbatim.
  let status = step.status
  if (step.action === 'regenerate_revision' && p.openRevision) {
    status = p.openRevision.awaitingRerelease ? 'done' : 'active'
  } else if (step.action === 'rerelease_revision' && p.openRevision) {
    status = p.openRevision.awaitingRerelease ? 'active' : 'locked'
  }

  const stepClass =
    status === 'done' ? styles.rbStepDone : status === 'active' ? styles.rbStepActive : styles.rbStepLocked

  const tag =
    status === 'done' ? TAG.done : status === 'active' ? TAG.now : null

  const { action, pointer } = stepActionUi(step.action, status, p)

  return (
    <li className={`${styles.rbStep} ${stepClass}`}>
      <span className={styles.rbNum}>{status === 'done' ? <Check size={14} aria-hidden /> : index + 1}</span>
      <div className={styles.rbBody}>
        <div className={styles.rbTitle}>
          {step.title}
          {tag ? <span className={`${styles.rbTag} ${tag.className}`}>{tag.text}</span> : null}
        </div>
        <div className={styles.rbDesc}>{step.desc}</div>
        {action ? <div className={styles.rbAction}>{action}</div> : null}
        {pointer ? <div className={styles.rbPointer}>{pointer}</div> : null}
      </div>
    </li>
  )
}

// Maps a runbook step's action key → the real wired button (or a pointer to the
// tab that owns it). No dead buttons: a step only shows a button when it is the
// live action; sign-off + release are pointed at the flag cards / gate banner.
function stepActionUi(
  key: RunbookStep['action'],
  status: RunbookStep['status'],
  p: CaseRunbookProps,
): { action: ReactNode | null; pointer: ReactNode | null } {
  if (status !== 'active') return { action: null, pointer: null }

  switch (key) {
    case 'generate':
      return { action: <GeneratePackButton caseId={p.caseId} />, pointer: null }
    case 'regenerate_revision':
      return p.openRevisionCount === 1 && p.openRevision
        ? { action: <RegenerateRevisionButton caseId={p.caseId} revisionId={p.openRevision.id} />, pointer: null }
        : { action: null, pointer: 'Multiple revisions are open — handle them in the Revisions tab below.' }
    case 'rerelease_revision':
      return p.openRevisionCount === 1 && p.openRevision
        ? { action: <ReleaseRevisionButton caseId={p.caseId} revisionId={p.openRevision.id} />, pointer: null }
        : { action: null, pointer: 'Multiple revisions are open — handle them in the Revisions tab below.' }
    case 'review_answer':
      return p.answeredInfoRequestCount === 1 && p.answeredInfoRequest
        ? {
            action: <ResolveInfoRequestButton caseId={p.caseId} infoRequestId={p.answeredInfoRequest.id} />,
            pointer: 'Read the customer’s answer in the Info Requests tab, then mark it resolved.',
          }
        : { action: null, pointer: 'The customer answered — review it in the Info Requests tab below.' }
    case 'sign_off':
      return { action: null, pointer: 'Sign each one off in the red flags below.' }
    case 'release':
      return { action: null, pointer: 'Use the Release button in the banner above.' }
    default:
      return { action: null, pointer: null }
  }
}

// ── Flag cards ────────────────────────────────────────────
const PATH_BADGE: Record<FlagPath, { label: string; icon: typeof PackageCheck; cardClass: string }> = {
  hold: { label: 'Hold for a human', icon: UserCheck, cardClass: styles.flagHold },
  query: { label: 'Query the customer', icon: MessagesSquare, cardClass: styles.flagQuery },
  handled: { label: 'Handled by the pack', icon: PackageCheck, cardClass: styles.flagHandled },
  'signed-off': { label: 'Signed off', icon: CheckCircle2, cardClass: styles.flagSignedOff },
}

const SEV_PILL: Record<FlagView['severity'], { label: string; className: string }> = {
  critical: { label: 'Critical', className: styles.sevCritical },
  high: { label: 'High', className: styles.sevHigh },
  medium: { label: 'Medium', className: styles.sevMed },
  low: { label: 'Low', className: styles.sevLow },
}

function FlagCard({ flag, caseId }: { flag: FlagView; caseId: string }) {
  const badge = PATH_BADGE[flag.path]
  const BadgeIcon = badge.icon
  const sev = SEV_PILL[flag.severity]
  const showSeverity = flag.path === 'hold' || flag.path === 'query'
  const actionLabel = flag.path === 'handled' ? 'Covered by:' : 'Required:'

  return (
    <article className={`${styles.flag} ${badge.cardClass}`}>
      <div className={styles.flagHead}>
        <span className={styles.flagPath}>
          <BadgeIcon size={12} aria-hidden /> {badge.label}
        </span>
        <span className={styles.flagTitle}>{flag.title}</span>
        {showSeverity ? <span className={`${styles.flagSev} ${sev.className}`}>{sev.label}</span> : null}
        {flag.path === 'handled' ? (
          <span className={styles.handledNote}>
            <Check size={14} aria-hidden /> No action needed
          </span>
        ) : null}
      </div>

      <div className={styles.flagLaw}>
        <span className={styles.k}>Why:</span> {flag.explanation}
      </div>
      {flag.requiredAction ? (
        <div className={styles.flagAction}>
          <span className={styles.k}>{actionLabel}</span> {flag.requiredAction}
        </div>
      ) : null}

      {flag.triggeringAnswer && flag.path !== 'signed-off' ? (
        <div className={styles.flagAffected}>
          <span className={styles.flagAffectedLbl}>Triggered by</span>
          <span className={styles.chip}>{flag.triggeringAnswer}</span>
        </div>
      ) : null}

      {flag.path === 'hold' ? (
        <div className={styles.flagActions}>
          <SignOffFlagForm caseId={caseId} flagId={flag.id} />
          <RequestMoreInfoForFlagButton caseId={caseId} />
        </div>
      ) : null}

      {flag.path === 'query' ? (
        <div className={styles.flagActions}>
          <QueryFlagForm caseId={caseId} flagId={flag.id} />
        </div>
      ) : null}

      {flag.path === 'signed-off' ? (
        <div className={styles.resolvedBox}>
          <div className={styles.resolvedRow}>
            <CheckCircle2 size={15} aria-hidden /> Signed off — {flag.title}
          </div>
          <div className={styles.resolvedMeta}>
            <span className={styles.decis}>{flag.resolutionLabel}</span>
            {flag.resolvedAt ? ` · ${formatDateTime(flag.resolvedAt)}` : ''}
          </div>
          {flag.resolutionNote ? <div className={styles.resolvedQuote}>“{flag.resolutionNote}”</div> : null}
        </div>
      ) : null}
    </article>
  )
}

// ── Main surface ──────────────────────────────────────────
export function CaseRunbook(props: CaseRunbookProps) {
  const { flagSummary: sum } = props
  const countLine = `· ${sum.needsYou} need${sum.needsYou === 1 ? 's' : ''} you · ${sum.outWithCustomer} out with customer · ${sum.handled} handled`

  return (
    <div className={styles.surface}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/admin">Cases</Link>
        <span className={styles.breadcrumbChev} aria-hidden>›</span>
        <span className={styles.breadcrumbCurrent}>{props.displayName}</span>
      </nav>
      <StoryHeader p={props} />
      <GateBanner gate={props.gate} caseId={props.caseId} alreadyReleased={props.alreadyReleased} />

      <div className={styles.secLabel}>
        <ListChecks className={styles.secLabelIcon} style={{ color: 'var(--text-accent)' }} aria-hidden />
        What to do next
      </div>
      <RunbookBlock p={props} />

      {props.flags.length > 0 ? (
        <>
          <div className={styles.secLabel} style={{ marginTop: 28 }}>
            <Flag className={styles.secLabelIcon} style={{ color: '#fb923c' }} aria-hidden />
            Red flags <span className={styles.secCount}>{countLine}</span>
          </div>
          <p className={styles.secSub}>
            Every flag closes one of three ways. Most are handled by the pack and need nothing from you. Only the
            ones marked <b>Hold for a human</b> block delivery.
          </p>
          <div className={styles.flags}>
            {props.flags.map((flag) => (
              <FlagCard key={flag.id} flag={flag} caseId={props.caseId} />
            ))}
          </div>
        </>
      ) : null}

      <div className={styles.moreActions}>
        <span className={styles.moreActionsLabel}>More actions</span>
        <RequestMoreInfoForm caseId={props.caseId} />
        <EscalateCaseForm caseId={props.caseId} />
        {props.stripePaymentId ? (
          <a
            href={`https://dashboard.stripe.com/payments/${encodeURIComponent(props.stripePaymentId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.tier}
            style={{ textDecoration: 'none', padding: '10px 16px' }}
          >
            View in Stripe →
          </a>
        ) : null}
      </div>
    </div>
  )
}
