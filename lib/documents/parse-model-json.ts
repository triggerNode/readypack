// lib/documents/parse-model-json.ts
// Tolerant JSON parse for model output, shared by the generation route and the
// chunked procurement-memo generator. Strips code fences, then recovers from
// leading/trailing prose by taking the outermost object span. Throws a clear,
// label-scoped error if no valid JSON object can be extracted.

export function parseModelJson(raw: string, label: string): unknown {
  let text = raw.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  }
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1))
    }
    throw new Error(
      `${label}: model did not return valid JSON (length ${text.length}): ${text.slice(0, 120)}…`,
    )
  }
}
