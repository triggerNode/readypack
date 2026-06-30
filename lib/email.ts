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

// The ReadyPack logo mark, inlined as SVG (renders in clients that support it;
// the "ReadyPack" wordmark beside it carries the brand where SVG is stripped).
const LOGO_SVG = `<svg width="22" height="26" viewBox="0 0 598 715" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:block;"><path d="M382.405 0.083C403.09 0.076 423.246 0.142 443.4 0.0005C447.262-0.027 449.989 1.063 452.638 3.59C487.666 37.018 522.194 70.852 555.747 105.487C568.865 119.028 582.062 132.508 595.282 145.969C597.006 147.725 598.012 149.518 598 151.929C597.923 166.559 597.939 181.19 597.962 195.82C597.965 197.993 597.56 199.815 595.306 201.152C583.949 207.895 572.658 214.73 561.325 221.507C560.467 222.02 559.53 222.553 558.212 222.227C556.542 220.948 557.183 219.079 557.173 217.432C557.107 206.619 556.918 195.8 557.237 184.993C557.373 180.386 555.684 179.003 550.6 179.022C510.644 179.174 470.687 179.102 430.73 179.095C423.488 179.094 423.461 179.085 423.46 172.509C423.448 129.572 423.376 86.634 423.551 43.698C423.57 38.96 422.162 37.405 416.714 37.41C294.722 37.525 172.73 37.486 50.7387 37.477C49.5011 37.477 48.2613 37.532 47.0265 37.482C43.0154 37.318 41.1812 39.055 41.2055 42.625C41.2443 48.349 41.1913 54.074 41.1911 59.799C41.1875 194.018 41.1556 328.237 41.302 462.456C41.3074 467.413 39.767 470.21 34.7104 472.426C24.871 476.739 15.4088 481.748 5.77869 486.449C4.27215 487.184 2.91281 488.402 0.885129 487.869C-0.436508 486.33 0.113592 484.518 0.113187 482.835C0.0751633 324.285 0.0660819 165.735 0.0595429 7.185C0.0592512 0.110 0.0781903 0.081 7.94292 0.081C132.587 0.077 257.23 0.082 382.405 0.083ZM477.233 80.560C472.806 76.477 469.277 71.560 463.592 67.901C463.362 69.257 463.167 69.878 463.165 70.499C463.115 93.376 463.122 116.253 463.008 139.129C462.991 142.571 464.835 143.442 468.25 143.432C489.445 143.368 510.640 143.408 531.835 143.373C533.532 143.370 535.680 143.835 536.626 142.124C537.732 140.122 535.691 138.916 534.458 137.681C515.581 118.785 496.666 99.919 477.233 80.560Z" fill="#0d141d"/><path d="M226.876 525.752C249.639 540.361 272.168 554.678 294.477 569.267C298.321 571.781 301 571.745 304.729 569.336C333.023 551.059 361.413 532.902 389.808 514.751C417.771 496.875 445.730 478.993 473.812 461.270C477.537 458.919 479.081 456.421 479.100 452.271C479.208 427.961 478.570 403.648 479.509 379.339C479.864 370.140 479.599 360.922 479.561 351.712C479.553 349.740 479.548 347.885 481.852 346.795C493.588 341.245 505.309 335.671 517.053 330.136C517.465 329.941 518.067 330.072 518.610 330.049C520.273 331.506 519.714 333.342 519.717 334.999C519.813 382.198 519.843 429.398 520 476.598C520.011 479.813 518.189 481.443 515.589 483.062C490.003 498.987 464.395 514.886 438.915 530.948C400.407 555.222 361.996 579.621 323.543 603.965C317.037 608.084 310.398 612.045 304.073 616.375C300.857 618.576 298.572 618.506 295.240 616.377C253.872 589.940 212.476 563.535 170.902 537.359C143.671 520.214 116.287 503.256 88.6399 486.661C81.6119 482.442 78.9699 478.074 79.0003 470.220C79.3844 370.733 79.242 271.245 79.2371 171.757C79.2356 140.766 79.2378 109.774 79.2524 78.783C79.2555 72.131 79.2837 72.103 86.3855 72.102C167.967 72.091 249.548 72.124 331.130 72C336.188 71.992 338.045 73.305 337.856 77.925C337.525 86.020 337.795 94.133 337.727 102.238C337.671 108.873 337.550 108.945 330.325 108.945C262.900 108.938 195.476 108.927 128.052 108.917C120.185 108.916 120.185 108.918 120.186 115.969C120.196 227.378 120.251 338.787 120.085 450.196C120.077 455.682 121.626 459.127 126.879 462.286C160.694 482.622 193.476 504.285 226.876 525.752Z" fill="#16a34a"/><path d="M263.489 692.005C206.473 655.230 148.900 619.763 91.5559 584.003C62.375 565.805 33.0962 547.735 3.87044 529.595C2.44724 528.712 0.809684 528.004 0 526.504C0.70351 524.275 3.01966 523.838 4.70064 522.824C14.6779 516.805 24.7775 510.947 34.6779 504.828C37.8036 502.897 40.1612 503.033 43.2362 504.939C123.098 554.442 202.708 604.265 281.323 655.359C286.763 658.895 292.226 662.406 297.555 666.074C299.734 667.573 301.363 667.559 303.638 666.099C347.219 638.144 390.827 610.222 434.493 582.375C475.277 556.366 516.140 530.457 556.952 504.484C558.931 503.224 560.684 502.263 563.150 503.767C574.260 510.543 585.447 517.219 596.588 523.956C596.981 524.194 597.180 524.693 598 525.761C591.427 529.983 584.955 534.247 578.363 538.356C502.731 585.499 427.834 633.573 353.060 681.802C336.989 692.167 320.997 702.631 305.063 713.166C301.618 715.443 299.019 715.770 295.322 713.176C285.021 705.947 274.334 699.160 263.489 692.005Z" fill="#16a34a"/><path opacity="0.45" d="M160.049 322.420C160.047 264.702 160.041 207.461 160.047 150.220C160.048 143.044 160.079 143.010 167.949 143.008C211.938 142.997 255.927 142.999 299.916 143.006C306.694 143.008 306.806 143.126 306.817 149.047C306.831 157.153 306.614 165.265 306.932 173.360C307.097 177.592 305.450 178.784 300.845 178.760C269.754 178.602 238.661 178.669 207.568 178.672C200.556 178.673 200.481 178.689 200.480 184.989C200.472 259.879 200.515 334.769 200.428 409.659C200.423 413.914 202.021 416.736 205.872 419.216C238.335 440.117 270.640 461.218 303.134 482.079C307.295 484.751 309.181 487.499 308.986 492.240C308.550 502.878 308.853 513.541 308.815 524.194C308.810 525.743 309.244 527.379 308.040 528.877C305.607 529.477 304.141 527.745 302.551 526.712C256.283 496.677 210.080 466.563 163.787 436.559C160.583 434.483 159.994 431.998 160 428.792C160.071 393.494 160.047 358.195 160.049 322.420Z" fill="#0d141d"/><path d="M596.998 438.340C597 454.840 597 470.867 597 486.819C594.036 487.530 592.421 485.972 590.672 485.120C580.739 480.283 570.930 475.237 560.973 470.441C558.116 469.064 556.997 467.363 557 464.422C557.083 393.509 557.080 322.597 557.071 251.684C557.071 249.376 557.283 247.332 559.687 245.829C570.853 238.849 581.947 231.777 593.086 224.761C593.923 224.234 594.808 223.581 596.996 224.358C596.996 295.294 596.996 366.581 596.998 438.340Z" fill="#16a34a"/></svg>`

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
