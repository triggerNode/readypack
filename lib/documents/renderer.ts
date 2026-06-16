// lib/documents/renderer.ts
// Document renderer abstraction.
// MVP renderer: ReactPdfRenderer (Stage 5).
// Future option: TypstRenderer — drop-in replacement via this interface.

import { renderToBuffer } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'

// Read the true page count from a rendered PDF buffer. @react-pdf/renderer does
// not expose the page count, so we parse it from the output. pdf-lib is the
// primary path; the raw `/Type /Page` scan is a defensive fallback.
async function countPdfPages(buffer: Buffer): Promise<number> {
  try {
    const doc = await PDFDocument.load(buffer)
    const count = doc.getPageCount()
    if (count > 0) return count
  } catch {
    // fall through to byte-scan fallback
  }
  const matches = buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g)
  return matches && matches.length > 0 ? matches.length : 1
}

export type DocumentRendererName = 'react_pdf' | 'typst' | 'playwright'

// The structured content shape that AI produces and templates consume.
export interface DocumentContent {
  document_type: string
  title: string
  prepared_for: string
  prepared_by: string
  version: string
  prepared_date: string
  review_date: string
  sections: DocumentSection[]
  tables?: DocumentTable[]
  appendices?: DocumentSection[]
  metadata?: Record<string, unknown>
}

export interface DocumentSection {
  section_id: string
  heading: string
  section_number?: string
  blocks: DocumentBlock[]
  subsections?: DocumentSection[]
}

export interface DocumentBlock {
  type: 'paragraph' | 'list' | 'clause' | 'notice' | 'signature_block'
  text?: string
  items?: string[]
  style?: 'normal' | 'warning' | 'definition'
}

export interface DocumentTable {
  table_id: string
  title?: string
  columns: string[]
  rows: string[][]
}

export interface RenderResult {
  buffer: Buffer
  page_count: number
  file_size_bytes: number
  renderer: DocumentRendererName
  template_version: string
  render_metadata: Record<string, unknown>
}

export interface RenderOpts {
  showWatermark: boolean
  logoUrl?: string
  companyName: string
}

// All renderers implement this interface.
export interface DocumentRenderer {
  render(content: DocumentContent, opts: RenderOpts): Promise<RenderResult>
  readonly name: DocumentRendererName
}

export class ReactPdfRenderer implements DocumentRenderer {
  readonly name: DocumentRendererName = 'react_pdf'

  async render(content: DocumentContent, opts: RenderOpts): Promise<RenderResult> {
    // Lazy import templates to avoid a circular type reference at module init.
    const { renderDocumentPdf } = await import('./react-pdf-templates')
    type SpecificDocumentContent =
      import('./content-schemas').SpecificDocumentContent

    const element = renderDocumentPdf(content as unknown as SpecificDocumentContent, opts)
    const buffer = await renderToBuffer(element)
    const nodeBuffer = Buffer.from(buffer as unknown as Uint8Array)
    const pageCount = await countPdfPages(nodeBuffer)

    return {
      buffer: nodeBuffer,
      page_count: pageCount,
      file_size_bytes: nodeBuffer.byteLength,
      renderer: 'react_pdf',
      template_version: '1.0.0',
      render_metadata: {
        watermarked: opts.showWatermark,
        generated_at: new Date().toISOString(),
      },
    }
  }

  async renderCombinedCover(opts: {
    companyName: string
    logoUrl?: string
    documentCount: number
    totalPages: number
    issueDate: string
  }): Promise<Buffer> {
    const { renderCombinedPackCover } = await import('./react-pdf-templates')
    const element = renderCombinedPackCover(opts)
    const buffer = await renderToBuffer(element)
    return Buffer.from(buffer as unknown as Uint8Array)
  }
}
