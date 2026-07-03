// lib/email.ts
// All customer- and admin-facing transactional emails.
//
// Every email is built from ONE shared layout (`wrapEmail`) plus a small set of
// reusable block helpers (eyebrow, heading, body, info box, button, link
// fallback, footer). This is what keeps them uniform and on-brand: same header,
// logo, type, colour, footer, and button across every message.
//
// Light theme is deliberate — email clients flip dark emails unpredictably, so a
// light email (off-white canvas, white card, dark text, green accent) renders
// consistently everywhere. Design source: design/email/ (Claude Design, signed
// off 2026-06-30). Table-based layout + inline CSS for client compatibility.

// ---------------------------------------------------------------------------
// Brand tokens (light email adaptation)
// ---------------------------------------------------------------------------
const C = {
  canvas: '#eef2f6',
  card: '#ffffff',
  border: '#e2e8ee',
  accent: '#16a34a',
  accentText: '#15803d', // darker green for legible text/links on white
  heading: '#0d141d',
  body: '#52606e',
  muted: '#6b7785',
  infoBg: '#f4f8fb',
} as const

const FONT =
  "'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

// The ReadyPack logo mark, as a hosted PNG. Gmail/Outlook strip inline
// <svg> from emails, so we reference a served image; the "ReadyPack"
// wordmark beside it carries the brand where images are blocked.
const LOGO_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || 'https://readypack.vercel.app').replace(/\/+$/, '')
const LOGO_SVG = `<img src="${LOGO_ORIGIN}/brand/readypack-mark.png" width="22" height="26" alt="ReadyPack" style="display:block; border:0; outline:none; text-decoration:none; height:26px; width:auto;" />`

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ---------------------------------------------------------------------------
// Reusable block helpers — each returns one table row (<tr>…</tr>)
// ---------------------------------------------------------------------------
function eyebrowRow(label: string): string {
  return `<tr><td class="rp-pad" style="padding:24px 40px 0 40px;">
    <span style="display:inline-block; background-color:${C.accent}; color:#ffffff; font-family:${FONT}; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; line-height:1; padding:7px 12px 6px; border-radius:999px;">${label}</span>
  </td></tr>`
}

function headingRow(text: string, topPadding = 20): string {
  return `<tr><td class="rp-pad" style="padding:${topPadding}px 40px 0 40px;">
    <h1 style="margin:0; font-family:${FONT}; font-size:25px; line-height:1.25; font-weight:700; letter-spacing:-0.015em; color:${C.heading};">${text}</h1>
  </td></tr>`
}

/** `innerHtml` is the paragraph markup (use <p style="margin:0 0 14px 0;">…</p>). */
function bodyRow(innerHtml: string, topPadding = 16): string {
  return `<tr><td class="rp-pad rp-body" style="padding:${topPadding}px 40px 0 40px; font-family:${FONT}; font-size:16px; line-height:1.6; color:${C.body};">${innerHtml}</td></tr>`
}

function infoBoxRow(label: string, innerHtml: string, topPadding = 24): string {
  return `<tr><td class="rp-pad" style="padding:${topPadding}px 40px 0 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.infoBg}; border-radius:12px;">
      <tr><td style="padding:18px 20px; border-left:3px solid ${C.accent}; border-top-left-radius:12px; border-bottom-left-radius:12px;">
        <p style="margin:0 0 6px 0; font-family:${FONT}; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:${C.heading};">${label}</p>
        <p style="margin:0; font-family:${FONT}; font-size:15px; line-height:1.6; color:${C.body};">${innerHtml}</p>
      </td></tr>
    </table>
  </td></tr>`
}

function buttonRow(href: string, label: string, topPadding = 28): string {
  // Rough Outlook (VML) width so the button doesn't clip the label.
  const approxChars = label.replace(/&[^;]+;/g, 'x').length
  const msoWidth = Math.max(180, Math.round(approxChars * 10) + 56)
  return `<tr><td class="rp-pad" style="padding:${topPadding}px 40px 0 40px;">
    <table role="presentation" class="rp-btn" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="border-radius:8px; background-color:${C.accent};">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:${msoWidth}px;" arcsize="17%" strokecolor="${C.accent}" fillcolor="${C.accent}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:600;">${label}</center></v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${href}" style="display:inline-block; padding:14px 30px; font-family:${FONT}; font-size:16px; font-weight:600; line-height:1; color:#ffffff; background-color:${C.accent}; border-radius:8px;">${label}</a>
      <!--<![endif]-->
    </td></tr></table>
  </td></tr>`
}

/** Plain-text "paste this link" fallback, with an optional security/expiry line. */
function linkFallbackRow(href: string, expiryHtml?: string, topPadding = 24): string {
  const expiry = expiryHtml ? `<p style="margin:0;">${expiryHtml}</p>` : ''
  const linkMargin = expiryHtml ? '0 0 14px 0' : '0'
  return `<tr><td class="rp-pad" style="padding:${topPadding}px 40px 0 40px; font-family:${FONT}; font-size:13px; line-height:1.6; color:${C.muted};">
    <p style="margin:0 0 4px 0;">Or paste this link into your browser:</p>
    <p style="margin:${linkMargin}; word-break:break-all;"><a href="${href}" style="color:${C.accentText}; font-weight:600;">${href}</a></p>
    ${expiry}
  </td></tr>`
}

/** Small muted note (e.g. "Track your pack live and return any time"). */
function mutedNoteRow(innerHtml: string, topPadding = 12): string {
  return `<tr><td class="rp-pad" style="padding:${topPadding}px 40px 0 40px; font-family:${FONT}; font-size:13px; line-height:1.6; color:${C.muted};">${innerHtml}</td></tr>`
}

// ---------------------------------------------------------------------------
// The shared layout
// ---------------------------------------------------------------------------
type WrapInput = {
  title: string
  preheader: string
  /** Pre-formed block rows, in order, between the header and the footer. */
  rows: string[]
  /** Internal admin emails drop the "not legal advice" disclaimer line. */
  variant?: 'customer' | 'admin'
}

function wrapEmail({ title, preheader, rows, variant = 'customer' }: WrapInput): string {
  const footerLine =
    variant === 'admin'
      ? 'ReadyPack admin &middot; MOFE LTD &middot; Company No. 16633320'
      : `<a href="mailto:hello@readypack.co.uk" style="color:${C.muted}; font-weight:600;">hello@readypack.co.uk</a> &middot; MOFE LTD &middot; Company No. 16633320<br>Documentation support — not legal advice.`

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table { border-collapse:collapse; }
    img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    a { text-decoration:none; }
    @media only screen and (max-width:620px) {
      .rp-card { width:100% !important; border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
      .rp-pad { padding-left:24px !important; padding-right:24px !important; }
      .rp-pad-t { padding-top:32px !important; }
      .rp-body { font-size:15px !important; }
      .rp-btn { width:100% !important; }
      .rp-btn a { display:block !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:${C.canvas};">

  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:${C.canvas}; opacity:0;">
    ${preheader}
    &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.canvas};">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" class="rp-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:${C.card}; border:1px solid ${C.border}; border-radius:16px; overflow:hidden;">

        <tr><td style="height:3px; line-height:3px; font-size:3px; background-color:${C.accent};">&nbsp;</td></tr>

        <tr><td class="rp-pad rp-pad-t" style="padding:40px 40px 8px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle" style="padding-right:10px; line-height:0;">${LOGO_SVG}</td>
            <td valign="middle"><span style="font-family:${FONT}; font-size:20px; font-weight:700; letter-spacing:-0.01em; color:${C.heading};">ReadyPack</span></td>
          </tr></table>
        </td></tr>

        ${rows.join('\n')}

        <tr><td class="rp-pad" style="padding:32px 40px 40px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${C.border}; height:1px; line-height:1px; font-size:1px;">&nbsp;</td></tr></table>
          <p style="margin:20px 0 0 0; font-family:${FONT}; font-size:12px; line-height:1.6; color:${C.muted};">${footerLine}</p>
        </td></tr>

      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;"><tr><td style="height:24px; line-height:24px; font-size:24px;">&nbsp;</td></tr></table>
    </td></tr>
  </table>

</body>
</html>`
}

const SECURE_EXPIRY = `This secure link expires in 1 hour. If it has expired, contact us at <a href="mailto:hello@readypack.co.uk" style="color:${C.accentText}; font-weight:600;">hello@readypack.co.uk</a> and we&rsquo;ll send you a fresh one.`

// ---------------------------------------------------------------------------
// Email builders (signatures unchanged — call sites untouched)
// ---------------------------------------------------------------------------
type MagicLinkEmailInput = {
  magicLink: string
  planName: string
  packReference?: string | null
}

export function buildMagicLinkEmail({ magicLink, planName, packReference }: MagicLinkEmailInput): string {
  const safeLink = escapeHtml(magicLink)
  const safePlan = escapeHtml(planName)
  const safeRef = packReference ? escapeHtml(packReference) : null

  const refLine = safeRef
    ? `<p style="margin:14px 0 0 0;">Your order reference: <strong style="color:${C.accentText}; font-weight:700;">${safeRef}</strong> — quote this if you contact support.</p>`
    : ''

  return wrapEmail({
    title: 'Your ReadyPack intake questionnaire is ready',
    preheader: 'Open your secure intake questionnaire. Your progress saves automatically as you go.',
    rows: [
      headingRow('Your intake questionnaire is ready'),
      bodyRow(
        `<p style="margin:0 0 14px 0;">Thanks for buying the <strong style="color:${C.accentText}; font-weight:700;">${safePlan}</strong>. Click the button below to open your secure intake questionnaire.</p>
         <p style="margin:0;">Your progress saves automatically, so you can pause and return any time.</p>${refLine}`,
      ),
      buttonRow(safeLink, 'Open my questionnaire'),
      linkFallbackRow(safeLink, SECURE_EXPIRY),
    ],
  })
}

/**
 * Sent from the /resume flow when a customer asks for a fresh secure link.
 */
export function buildResumeLinkEmail({ magicLink }: { magicLink: string }): string {
  const safeLink = escapeHtml(magicLink)

  return wrapEmail({
    title: 'Your ReadyPack secure link',
    preheader: 'Here’s a fresh secure link to pick up where you left off.',
    rows: [
      headingRow('Here’s your fresh secure link'),
      bodyRow(
        `<p style="margin:0;">You asked to pick up where you left off. Click the button below to continue securely. Your progress is saved.</p>`,
      ),
      buttonRow(safeLink, 'Continue securely'),
      linkFallbackRow(
        safeLink,
        'This secure link expires in 1 hour and can be used once. If you didn&rsquo;t request it, you can ignore this email.',
      ),
    ],
  })
}

type DeliveryEmailInput = {
  magicLink: string
  customerName?: string | null
  packReference?: string | null
  documentCount?: number
}

export function buildDeliveryEmail({
  magicLink,
  customerName,
  packReference,
  documentCount = 9,
}: DeliveryEmailInput): string {
  const safeLink = escapeHtml(magicLink)
  const safeName = customerName ? escapeHtml(customerName) : null
  const safeRef = packReference ? escapeHtml(packReference) : null
  const safeCount = String(Math.max(1, Math.floor(documentCount)))
  const refClause = safeRef
    ? ` — pack reference <strong style="color:${C.accentText}; font-weight:700;">${safeRef}</strong>`
    : ''

  return wrapEmail({
    title: 'Your ReadyPack compliance documents are ready for review',
    preheader: 'Your compliance pack is ready. Review the watermarked drafts in your secure portal.',
    rows: [
      eyebrowRow('Pack ready for review'),
      headingRow(
        safeName ? `${safeName}, your compliance pack is ready` : 'Your compliance pack is ready to review',
        16,
      ),
      bodyRow(
        `<p style="margin:0 0 14px 0;">We&rsquo;ve prepared <strong style="color:${C.accentText}; font-weight:700;">${safeCount} compliance documents</strong> tailored to your business${refClause}.</p>
         <p style="margin:0;">Open the secure portal below to review the watermarked drafts. You can request changes on specific documents or approve the whole pack to unlock the final, un-watermarked PDFs.</p>`,
      ),
      buttonRow(safeLink, 'Open my secure portal &rarr;'),
      linkFallbackRow(safeLink, SECURE_EXPIRY),
      infoBoxRow(
        'What happens next',
        'Review the watermarked drafts in your portal. Request changes on any document, or approve the pack. Once everything is approved, the watermark is removed and your final PDFs unlock for download.',
      ),
    ],
  })
}

type ReviewHoldEmailInput = {
  customerName?: string | null
  packReference?: string | null
}

/**
 * Sent when a self-serve (low/medium) pack was generated but the automated QA
 * layer HELD it for a final human review instead of auto-releasing. The customer
 * is deliberately NOT given a portal link yet — the pack is not reviewable until
 * our team releases it, at which point the normal delivery email (with a fresh
 * secure link) goes out. This message exists so a held self-serve customer who
 * has already paid is never left in silence.
 */
export function buildReviewHoldEmail({
  customerName,
  packReference,
}: ReviewHoldEmailInput): string {
  const safeName = customerName ? escapeHtml(customerName) : null
  const safeRef = packReference ? escapeHtml(packReference) : null
  const refClause = safeRef
    ? ` — pack reference <strong style="color:${C.accentText}; font-weight:700;">${safeRef}</strong>`
    : ''

  return wrapEmail({
    title: 'Your ReadyPack compliance pack is in final review',
    preheader: 'Your pack has been prepared and is getting a final quality check from our compliance team.',
    rows: [
      eyebrowRow('Final review'),
      headingRow(
        safeName ? `${safeName}, your pack is in final review` : 'Your pack is in final review',
        16,
      ),
      bodyRow(
        `<p style="margin:0 0 14px 0;">Good news — we&rsquo;ve prepared your compliance pack${refClause}. Before we release it, one of our compliance team is giving it a final quality check.</p>
         <p style="margin:0;">You don&rsquo;t need to do anything. We&rsquo;ll email you a secure link to review and approve your documents as soon as that check is complete — usually within one business day.</p>`,
      ),
      infoBoxRow(
        'What happens next',
        'Our team finishes the review, then you&rsquo;ll get an email with a secure portal link to review the watermarked drafts, request any changes, and approve the pack to unlock your final PDFs.',
      ),
    ],
  })
}

type RequestInfoEmailInput = {
  magicLink: string
  customerName?: string | null
  adminMessage: string
}

export function buildRequestInfoEmail({
  magicLink,
  customerName,
  adminMessage,
}: RequestInfoEmailInput): string {
  const safeLink = escapeHtml(magicLink)
  const safeName = customerName ? escapeHtml(customerName) : null
  // Preserve line breaks in the admin's message while escaping everything else.
  const safeMessage = escapeHtml(adminMessage).replace(/\n/g, '<br/>')

  return wrapEmail({
    title: 'We need a bit more information for your ReadyPack order',
    preheader: 'Our compliance team needs a little more detail before we can finish building your pack.',
    rows: [
      headingRow('We need a bit more information'),
      bodyRow(
        `<p style="margin:0;">${safeName ? `Hi ${safeName},` : 'Hi,'} our compliance team has reviewed your answers and needs a little more detail before we can finish building your pack:</p>`,
      ),
      infoBoxRow('From the compliance team', safeMessage, 20),
      buttonRow(safeLink, 'Open your portal'),
      linkFallbackRow(safeLink, SECURE_EXPIRY),
    ],
  })
}

type RevisedDocEmailInput = {
  magicLink: string
  customerName?: string | null
  documentTitle: string
  packReference?: string | null
}

/**
 * Sent when our team has revised a single document and re-released it.
 */
export function buildRevisedDocReadyEmail({
  magicLink,
  customerName,
  documentTitle,
  packReference,
}: RevisedDocEmailInput): string {
  const safeLink = escapeHtml(magicLink)
  const safeName = customerName ? escapeHtml(customerName) : null
  const safeDoc = escapeHtml(documentTitle)
  const safeRef = packReference ? escapeHtml(packReference) : null

  return wrapEmail({
    title: 'Your revised ReadyPack document is ready to review',
    preheader: 'We’ve made the changes you asked for. Review the updated document in your portal.',
    rows: [
      headingRow('Your revised document is ready'),
      bodyRow(
        `<p style="margin:0;">${safeName ? `Hi ${safeName},` : 'Hi,'} we&rsquo;ve made the changes you asked for to your <strong style="color:${C.accentText}; font-weight:700;">${safeDoc}</strong>${safeRef ? ` (pack ${safeRef})` : ''}. Open your portal to review the updated version and approve it when you&rsquo;re happy.</p>`,
      ),
      buttonRow(safeLink, 'Review the revised document'),
      linkFallbackRow(safeLink, SECURE_EXPIRY),
    ],
  })
}

type PackCompleteEmailInput = {
  magicLink: string
  customerName?: string | null
  packReference?: string | null
  documentCount?: number
}

/**
 * Sent when every document in the pack is final (all approved).
 */
export function buildPackCompleteEmail({
  magicLink,
  customerName,
  packReference,
  documentCount = 9,
}: PackCompleteEmailInput): string {
  const safeLink = escapeHtml(magicLink)
  const safeName = customerName ? escapeHtml(customerName) : null
  const safeRef = packReference ? escapeHtml(packReference) : null
  const safeCount = String(Math.max(1, Math.floor(documentCount)))
  const refClause = safeRef
    ? ` — pack reference <strong style="color:${C.accentText}; font-weight:700;">${safeRef}</strong>`
    : ''

  return wrapEmail({
    title: 'Your ReadyPack compliance pack is complete',
    preheader: 'Your final, un-watermarked compliance PDFs are ready to download from your portal.',
    rows: [
      eyebrowRow('Pack complete'),
      headingRow(safeName ? `${safeName}, your pack is complete` : 'Your compliance pack is complete', 16),
      bodyRow(
        `<p style="margin:0 0 14px 0;">All <strong style="color:${C.accentText}; font-weight:700;">${safeCount} documents</strong> have been approved and finalised${refClause}.</p>
         <p style="margin:0;">Your final, un-watermarked PDFs are ready to download from your secure portal.</p>`,
      ),
      buttonRow(safeLink, 'Download your pack &rarr;'),
      linkFallbackRow(safeLink, SECURE_EXPIRY),
    ],
  })
}

export function buildAdminLoginEmail({ magicLink }: { magicLink: string }): string {
  const safeLink = escapeHtml(magicLink)

  return wrapEmail({
    title: 'Your ReadyPack admin sign-in link',
    preheader: 'Sign in to the ReadyPack admin from any browser or device.',
    variant: 'admin',
    rows: [
      headingRow('Admin sign-in link'),
      bodyRow(
        `<p style="margin:0;">Click the button below to sign in to the ReadyPack admin. This link works from any browser or device.</p>`,
      ),
      buttonRow(safeLink, 'Sign in to admin'),
      linkFallbackRow(
        safeLink,
        'This link expires in 1 hour and can be used once. If you didn&rsquo;t request it, ignore this email.',
      ),
    ],
  })
}

type SubmitConfirmationEmailInput = {
  customerName?: string | null
  riskLevel: string
  planName?: string | null
  /** Absolute URL to the live Pack Progress screen. Omitted for critical cases. */
  statusUrl?: string | null
}

function timelineForRisk(riskLevel: string): string {
  switch (riskLevel) {
    case 'critical':
      return 'Your answers flagged some higher-risk areas, so a compliance specialist will personally review your case. We&rsquo;ll be in touch directly with next steps.'
    case 'high':
      return 'Your pack involves some higher-risk areas that need a closer review. You can expect your documents within 72 hours.'
    case 'medium':
    case 'low':
    default:
      return 'Your documents are being generated now and you can expect your pack within 48 hours.'
  }
}

export function buildSubmitConfirmationEmail({
  customerName,
  riskLevel,
  planName,
  statusUrl,
}: SubmitConfirmationEmailInput): string {
  const safeName = customerName ? escapeHtml(customerName) : null
  const safePlan = planName ? escapeHtml(planName) : null
  const timeline = timelineForRisk(riskLevel)
  const safeStatusUrl = statusUrl ? escapeHtml(statusUrl) : null

  const rows: string[] = [
    headingRow('We’ve received your answers'),
    bodyRow(
      `<p style="margin:0;">${safeName ? `Thanks, ${safeName}.` : 'Thanks.'} Your questionnaire${safePlan ? ` for the <strong style="color:${C.accentText}; font-weight:700;">${safePlan}</strong>` : ''} has been submitted successfully.</p>`,
    ),
    infoBoxRow('What happens next', timeline),
  ]

  if (safeStatusUrl) {
    rows.push(buttonRow(safeStatusUrl, 'View pack progress &rarr;'))
    rows.push(mutedNoteRow('Track your pack live and return any time via this link.'))
  }

  rows.push(
    bodyRow(
      `<p style="margin:0;">We&rsquo;ll email you again as soon as your pack is ready to review. Questions in the meantime? Reach us at <a href="mailto:hello@readypack.co.uk" style="color:${C.accentText}; font-weight:600;">hello@readypack.co.uk</a>.</p>`,
      24,
    ),
  )

  return wrapEmail({
    title: 'We’ve received your ReadyPack answers',
    preheader: 'Your questionnaire has been submitted. Here’s what happens next.',
    rows,
  })
}
