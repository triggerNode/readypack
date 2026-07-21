// PDF fidelity helpers for Group 7 — does the delivered pack LOOK right?
// Downloads the real PDF bytes and inspects the TEXT LAYER (pdf-parse v2). The
// core checks are all text-layer, so no rasterising is needed:
//   • business name present  → the company string appears
//   • logo present           → a MISSING logo renders the text "CLIENT LOGO"
//                              placeholder, so logo-present === that string ABSENT
//                              (validated against real ReadyPack PDFs on disk)
//   • watermark              → the template draws a standalone <Text>DRAFT</Text>;
//                              present on drafts, ABSENT on finals
//   • read-me MOFE line      → the trading-disclosure line appears
//
// See lib/documents/react-pdf-templates.tsx (DRAFT watermark + CLIENT LOGO placeholder).
//
// NOTE on matching: react-pdf's text layer often comes out letter-spaced
// ("D O C U M E N T"), so name/placeholder matches compare on alphanumerics only.
// The watermark is matched precisely (standalone UPPERCASE "DRAFT", spacing-
// tolerant) so it never false-matches body words like "drafted"/"Drafting".

import { PDFParse } from 'pdf-parse'

export interface PdfInspection {
  text: string
  pageCount: number
}

/** Parse a PDF's text layer + page count. */
export async function inspectPdf(bytes: Buffer | Uint8Array): Promise<PdfInspection> {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  const parser = new PDFParse({ data: buf })
  try {
    const result = await parser.getText()
    return { text: result.text ?? '', pageCount: result.total ?? result.pages?.length ?? 0 }
  } finally {
    await parser.destroy().catch(() => undefined)
  }
}

function alnum(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** True if `needle` appears in the PDF text (spacing/case/punctuation-insensitive). */
export function pdfHasText(inspection: PdfInspection, needle: string): boolean {
  return alnum(inspection.text).includes(alnum(needle))
}

/** The template's placeholder for a MISSING logo — its absence means the logo rendered. */
export const LOGO_PLACEHOLDER = 'CLIENT LOGO'

/**
 * True if the draft watermark is present. Matches a standalone UPPERCASE "DRAFT"
 * (optionally letter-spaced by the text layer) with non-letter boundaries, so it
 * catches the <Text>DRAFT</Text> watermark but NOT body words like "drafted",
 * "Drafting", or lowercase "draft". Validated against watermark-free finals on
 * disk (which contain "drafted"/"Drafting" in body text) → returns false for them.
 */
export function pdfHasDraftWatermark(inspection: PdfInspection): boolean {
  return /(^|[^A-Za-z])D\s*R\s*A\s*F\s*T([^A-Za-z]|$)/.test(inspection.text)
}
