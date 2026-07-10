// Standalone "What we noticed" read-me — a one-page PDF delivered as the completion
// email attachment (+ portal backup). ADDITIVE: self-contained, does NOT touch
// react-pdf-templates.tsx (the recently-fixed pack templates). Built-in Helvetica
// only (no external fonts); marks are drawn as SVG (unicode ticks render as tofu).
//
// eslint-disable jsx-a11y/alt-text — n/a here (no <Image>), kept for parity.
/* eslint-disable jsx-a11y/alt-text */

import React from 'react'
import { Document, Page, View, Text, Image, Svg, Path, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { ReadmeModel } from './readme-content'
import { READYPACK_MARK_DATA_URI } from './readme-logo'

const C = {
  heading: '#1e293b',
  body: '#334155',
  subtle: '#64748b',
  muted: '#94a3b8',
  border: '#e2e8f0',
  surface: '#f8fafc',
  accent: '#16a34a',
  greenBg: '#f0fdf4',
  greenBorder: '#bbf7d0',
  amberBg: '#fffbeb',
  amberBorder: '#ca8a04',
  amberText: '#854d0e',
  amberHead: '#a16207',
  white: '#ffffff',
} as const

const s = StyleSheet.create({
  page: { backgroundColor: C.white, fontFamily: 'Helvetica', fontSize: 10, color: C.body },
  brandBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: C.accent },
  body: { paddingHorizontal: 48, paddingTop: 40, paddingBottom: 64 },

  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  brandMark: { width: 21, height: 25, marginRight: 8, objectFit: 'contain' },
  wordmark: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.heading },
  eyebrow: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.accent, letterSpacing: 2, marginBottom: 5 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.heading, marginBottom: 5 },
  prepared: { fontSize: 10, color: C.subtle },
  rule: { height: 1, backgroundColor: C.border, marginVertical: 16 },
  lead: { fontSize: 11, color: C.body, lineHeight: 1.6, marginBottom: 4 },

  item: {
    flexDirection: 'row',
    backgroundColor: C.white,
    border: `1 solid ${C.border}`,
    borderLeft: `3 solid ${C.accent}`,
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  tickBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: C.greenBg,
    border: `1 solid ${C.greenBorder}`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  itemBody: { flex: 1 },
  fact: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.heading, lineHeight: 1.35, marginBottom: 4 },
  cover: { fontSize: 10.5, color: C.body, lineHeight: 1.55 },
  refs: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  ref: {
    flexDirection: 'row',
    alignItems: 'center',
    border: `1 solid ${C.border}`,
    backgroundColor: C.surface,
    borderRadius: 5,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginRight: 6,
    marginBottom: 4,
  },
  refNum: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.accent, marginRight: 5 },
  refTitle: { fontSize: 9, color: C.subtle },

  portalNote: {
    backgroundColor: C.amberBg,
    border: `1 solid ${C.amberBorder}`,
    borderLeft: `3 solid ${C.amberBorder}`,
    borderRadius: 6,
    padding: 15,
    marginTop: 16,
  },
  portalHead: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.amberHead, letterSpacing: 1, marginBottom: 4 },
  portalBody: { fontSize: 10, color: C.amberText, lineHeight: 1.5 },

  guard: { marginTop: 22, paddingTop: 14, borderTop: `1 solid ${C.border}` },
  guardText: { fontSize: 9, color: C.muted, fontStyle: 'italic', lineHeight: 1.55 },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: C.muted,
  },
})

function CheckMark() {
  return (
    <Svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
      <Path d="M20 6 9 17l-5-5" stroke={C.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function ReadmeDocument({ model }: { model: ReadmeModel }) {
  return (
    <Document title="What we noticed">
      <Page size="A4" style={s.page}>
        <View style={s.brandBar} fixed />
        <View style={s.body}>
          <View style={s.brandRow}>
            <Image src={READYPACK_MARK_DATA_URI} style={s.brandMark} />
            <Text style={s.wordmark}>ReadyPack</Text>
          </View>
          <Text style={s.eyebrow}>PACK SUMMARY</Text>
          <Text style={s.title}>What we noticed about your setup</Text>
          <Text style={s.prepared}>Prepared for {model.companyName}</Text>
          <View style={s.rule} />
          <Text style={s.lead}>{model.lead}</Text>

          {model.items.map((it, i) => (
            <View key={i} style={s.item} wrap={false}>
              <View style={s.tickBox}>
                <CheckMark />
              </View>
              <View style={s.itemBody}>
                <Text style={s.fact}>{it.fact}</Text>
                <Text style={s.cover}>{it.cover}</Text>
                {it.refs.length > 0 ? (
                  <View style={s.refs}>
                    {it.refs.map((r, j) => (
                      <View key={j} style={s.ref}>
                        <Text style={s.refNum}>{r.num}</Text>
                        <Text style={s.refTitle}>{r.title}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ))}

          {model.portalNote ? (
            <View style={s.portalNote} wrap={false}>
              <Text style={s.portalHead}>ONE THING TO CONFIRM</Text>
              <Text style={s.portalBody}>{model.portalNote}</Text>
            </View>
          ) : null}

          <View style={s.guard}>
            <Text style={s.guardText}>{model.guardrail}</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>Confidential · Prepared for {model.companyName}</Text>
          <Text>ReadyPack is a service of MOFE Ltd (No. 16633320)</Text>
        </View>
      </Page>
    </Document>
  )
}

/** The read-me as a React-PDF element (for a rendering harness / tests). */
export function renderReadmeElement(model: ReadmeModel): React.ReactElement {
  return <ReadmeDocument model={model} />
}

/** Render the read-me to a PDF Buffer for email attachment / portal download. */
export async function renderReadmePdf(model: ReadmeModel): Promise<Buffer> {
  const buffer = await renderToBuffer(<ReadmeDocument model={model} />)
  return Buffer.from(buffer as unknown as Uint8Array)
}
