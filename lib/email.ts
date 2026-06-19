type MagicLinkEmailInput = {
  magicLink: string
  planName: string
  packReference?: string | null
}

type DeliveryEmailInput = {
  magicLink: string
  customerName?: string | null
  packReference?: string | null
  documentCount?: number
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildMagicLinkEmail({ magicLink, planName, packReference }: MagicLinkEmailInput): string {
  const safeLink = escapeHtml(magicLink)
  const safePlan = escapeHtml(planName)
  const safeRef = packReference ? escapeHtml(packReference) : null

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Your ReadyPack intake questionnaire is ready</title>
</head>
<body style="margin:0;padding:0;background:#0f1623;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e6ecf3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1623;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#162030;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:40px;">
          <tr>
            <td style="padding-bottom:24px;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-weight:700;font-size:20px;letter-spacing:-0.01em;color:#f0f4f8;">
                Ready<span style="color:#16A34A;">Pack</span>
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:16px;">
              <h1 style="margin:0;font-size:24px;line-height:1.3;color:#f0f4f8;font-weight:700;">
                Your intake questionnaire is ready
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:24px;">
              <p style="margin:0;font-size:16px;line-height:1.6;color:#b6c0cf;">
                Thanks for buying the <strong style="color:#16A34A;">${safePlan}</strong>.
                Click the button below to open your secure intake questionnaire.
                Your progress saves automatically, so you can pause and return any time.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 0 24px;">
              <a href="${safeLink}"
                 style="display:inline-block;background:#16A34A;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:16px;">
                Open my questionnaire
              </a>
            </td>
          </tr>
          ${safeRef ? `<tr>
            <td style="padding-bottom:16px;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#7a8699;">
                Your order reference: <span style="color:#16A34A;font-weight:600;">${safeRef}</span> — quote this if you contact support.
              </p>
            </td>
          </tr>` : ''}
          <tr>
            <td style="padding-bottom:8px;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#7a8699;">
                Or paste this link into your browser:
              </p>
              <p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:#b6c0cf;word-break:break-all;">
                <a href="${safeLink}" style="color:#16A34A;text-decoration:underline;">${safeLink}</a>
              </p>
              <p style="color:#888; font-size:13px; margin-top:16px;">
                This secure link expires in 1 hour. If it has expired, contact us at
                <a href="mailto:hello@readypack.co.uk" style="color:#16A34A;">hello@readypack.co.uk</a>
                and we'll send you a fresh one.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:32px;border-top:1px solid rgba(255,255,255,0.06);margin-top:32px;">
              <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#7a8699;">
                hello@readypack.co.uk &middot; MOFE LTD &middot; Company No. 16633320 &middot; Not legal advice — documentation support.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Your ReadyPack compliance documents are ready to review</title>
</head>
<body style="margin:0;padding:0;background:#0d141d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f0f4f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d141d;padding:48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111a24;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:0;overflow:hidden;">
          <tr>
            <td style="height:3px;background:#16A34A;line-height:0;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:36px 40px 0;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-weight:700;font-size:20px;letter-spacing:-0.01em;color:#f0f4f8;">
                Ready<span style="color:#16A34A;">Pack</span>
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 8px;">
              <span style="display:inline-block;background:rgba(22,163,74,0.10);border:1px solid rgba(22,163,74,0.28);color:#4ade80;font-size:11px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;padding:5px 12px;border-radius:99px;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,monospace;">
                Pack ready for review
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 40px 0;">
              <h1 style="margin:0;font-size:26px;line-height:1.25;color:#f0f4f8;font-weight:700;letter-spacing:-0.015em;">
                ${safeName ? `${safeName}, your compliance pack is ready` : 'Your compliance pack is ready to review'}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 0;">
              <p style="margin:0;font-size:15px;line-height:1.65;color:#8fa3b8;">
                We've prepared <strong style="color:#f0f4f8;">${safeCount} compliance documents</strong> tailored to your business${safeRef ? ` &mdash; pack reference <span style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,monospace;color:#4ade80;">${safeRef}</span>` : ''}. Open the secure portal below to review the watermarked drafts. You can request changes on specific documents or approve the whole pack to unlock the final, un-watermarked PDFs.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 40px 8px;">
              <a href="${safeLink}"
                 style="display:inline-block;background:#16A34A;color:#ffffff;text-decoration:none;padding:15px 30px;border-radius:8px;font-weight:600;font-size:15px;letter-spacing:0.01em;box-shadow:0 8px 24px rgba(22,163,74,0.35);">
                Open my secure portal &nbsp;&rarr;
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 0;">
              <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#5a7080;text-align:center;">
                Or paste this single-use link into your browser:
              </p>
              <p style="margin:6px 0 0;font-size:12px;line-height:1.5;text-align:center;word-break:break-all;">
                <a href="${safeLink}" style="color:#4ade80;text-decoration:underline;">${safeLink}</a>
              </p>
              <p style="color:#888; font-size:13px; margin-top:16px; text-align:center;">
                This secure link expires in 1 hour. If it has expired, contact us at
                <a href="mailto:hello@readypack.co.uk" style="color:#16A34A;">hello@readypack.co.uk</a>
                and we'll send you a fresh one.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#162030;border:1px solid #1e2d3d;border-radius:12px;padding:18px 20px;">
                <tr>
                  <td style="font-size:13px;line-height:1.6;color:#8fa3b8;">
                    <strong style="color:#f0f4f8;display:block;margin-bottom:4px;">What happens next</strong>
                    Review the documents in your portal. Select any individual document to request a revision, or approve the full pack. Once approved, watermarks are removed and your final PDFs are unlocked for immediate download.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 40px 32px;">
              <p style="margin:0;font-size:11px;line-height:1.6;color:#5a7080;border-top:1px solid #1e2d3d;padding-top:18px;">
                Delivered over a secure, single-use link.<br/>
                ReadyPack &middot; MOFE LTD &middot; Company No. 16633320 &middot; Documentation support &mdash; not legal advice.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>We need a bit more information for your ReadyPack order</title>
</head>
<body style="margin:0;padding:0;background:#0f1623;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e6ecf3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1623;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#162030;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:40px;">
          <tr>
            <td style="padding-bottom:24px;">
              <span style="font-weight:700;font-size:20px;letter-spacing:-0.01em;color:#f0f4f8;">
                Ready<span style="color:#16A34A;">Pack</span>
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:16px;">
              <h1 style="margin:0;font-size:24px;line-height:1.3;color:#f0f4f8;font-weight:700;">
                We need a bit more information
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:20px;">
              <p style="margin:0;font-size:16px;line-height:1.6;color:#b6c0cf;">
                ${safeName ? `Hi ${safeName},` : 'Hi,'} our compliance team has reviewed your answers and
                needs a little more detail before we can finish building your pack:
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1623;border:1px solid rgba(255,255,255,0.08);border-left:3px solid #16A34A;border-radius:8px;padding:16px 18px;">
                <tr>
                  <td style="font-size:15px;line-height:1.6;color:#e6ecf3;">
                    ${safeMessage}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 0 24px;">
              <a href="${safeLink}"
                 style="display:inline-block;background:#16A34A;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:16px;">
                Open your portal
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:8px;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#7a8699;">
                Or paste this link into your browser:
              </p>
              <p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:#b6c0cf;word-break:break-all;">
                <a href="${safeLink}" style="color:#16A34A;text-decoration:underline;">${safeLink}</a>
              </p>
              <p style="color:#888; font-size:13px; margin-top:16px;">
                This secure link expires in 1 hour. If it has expired, contact us at
                <a href="mailto:hello@readypack.co.uk" style="color:#16A34A;">hello@readypack.co.uk</a>
                and we'll send you a fresh one.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:32px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#7a8699;">
                hello@readypack.co.uk &middot; MOFE LTD &middot; Company No. 16633320 &middot; Not legal advice — documentation support.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

type SubmitConfirmationEmailInput = {
  customerName?: string | null
  riskLevel: string
  planName?: string | null
  /** Absolute URL to the live Pack Progress screen. Omitted for critical cases
   *  (a specialist makes contact first — there is no live progress to show). */
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
  const progressCta = safeStatusUrl
    ? `<tr>
            <td style="padding-bottom:24px;">
              <a href="${safeStatusUrl}"
                 style="display:inline-block;background:#16A34A;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 26px;border-radius:8px;">
                View pack progress &nbsp;&rarr;
              </a>
              <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#7a8699;">
                Track your pack live and return any time via this link.
              </p>
            </td>
          </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>We've received your ReadyPack answers</title>
</head>
<body style="margin:0;padding:0;background:#0f1623;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e6ecf3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1623;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#162030;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:40px;">
          <tr>
            <td style="padding-bottom:24px;">
              <span style="font-weight:700;font-size:20px;letter-spacing:-0.01em;color:#f0f4f8;">
                Ready<span style="color:#16A34A;">Pack</span>
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:16px;">
              <h1 style="margin:0;font-size:24px;line-height:1.3;color:#f0f4f8;font-weight:700;">
                We&rsquo;ve received your answers
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:20px;">
              <p style="margin:0;font-size:16px;line-height:1.6;color:#b6c0cf;">
                ${safeName ? `Thanks, ${safeName}.` : 'Thanks.'} Your questionnaire${safePlan ? ` for the <strong style="color:#16A34A;">${safePlan}</strong>` : ''} has been submitted successfully.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1623;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:16px 18px;">
                <tr>
                  <td style="font-size:15px;line-height:1.6;color:#e6ecf3;">
                    <strong style="color:#f0f4f8;display:block;margin-bottom:4px;">What happens next</strong>
                    ${timeline}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${progressCta}
          <tr>
            <td style="padding-top:8px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#b6c0cf;">
                We&rsquo;ll email you again as soon as your pack is ready to review. Questions in the meantime?
                Reach us at <a href="mailto:hello@readypack.co.uk" style="color:#16A34A;">hello@readypack.co.uk</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:32px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#7a8699;">
                hello@readypack.co.uk &middot; MOFE LTD &middot; Company No. 16633320 &middot; Not legal advice — documentation support.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
