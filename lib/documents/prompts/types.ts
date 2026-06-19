// lib/documents/prompts/types.ts
// Shared type for the intake data passed to each per-document prompt builder.

export interface PromptAiTool {
  tool_name: string
  vendor: string | null
  purpose: string | null
  internal_or_customer_facing: string | null
  risk_classification: string | null
  decision_making_role?: string | null
  data_involved?: string[] | null
}

export interface PromptVendor {
  vendor_name: string
  product: string | null
  processor_controller_role: string | null
  jurisdiction: string | null
  data_categories: string[] | null
  dpa_status: string | null
  transfer_mechanism: string | null
  training_data_reuse: boolean | null
  security_certifications: string[] | null
}

export interface PromptRiskFlag {
  severity: string
  explanation: string
  required_action: string | null
}

export interface PromptIntake {
  companyName: string
  tradingName?: string
  industry: string
  employeeCount: string
  aiTools: PromptAiTool[]
  vendors: PromptVendor[]
  riskFlags: PromptRiskFlag[]
  hasEuCustomers: boolean
  euRevenuePercentage?: string
  contactName: string
  contactRole: string
  contactEmail?: string
  riskLevel: string
  preparedDate: string
  reviewDate: string
  tier: string
  targetTenderContext?: Record<string, unknown> | string
}

export type PromptBuilder = (intake: PromptIntake) => string

function wrapCustomerInput(value: string | null | undefined): string {
  const v = value ?? ''
  return `<customer_input>${v}</customer_input>`
}

export function formatAiTools(tools: PromptAiTool[]): string {
  if (tools.length === 0) return '  (No AI tools declared)'
  return tools
    .map(
      (t, i) =>
        `${i + 1}. ${wrapCustomerInput(t.tool_name)} (${wrapCustomerInput(t.vendor || 'unknown vendor')}) — ${wrapCustomerInput(t.purpose || 'purpose not specified')} — ${t.internal_or_customer_facing || 'internal'} — EU AI Act: ${t.risk_classification || 'limited'} risk`,
    )
    .join('\n')
}

export function formatVendors(vendors: PromptVendor[]): string {
  if (vendors.length === 0) return '  (No vendors declared)'
  return vendors
    .map(
      (v, i) =>
        `${i + 1}. ${wrapCustomerInput(v.vendor_name)}${v.product ? ' / ' + wrapCustomerInput(v.product) : ''} — Role: ${v.processor_controller_role || 'unspecified'} — Jurisdiction: ${v.jurisdiction || 'unspecified'} — DPA: ${v.dpa_status || 'unspecified'} — Transfer: ${wrapCustomerInput(v.transfer_mechanism || 'unspecified')} — Training reuse: ${v.training_data_reuse === false ? 'No' : v.training_data_reuse === true ? 'Yes' : 'unspecified'} — Data: ${(v.data_categories || []).join(', ') || 'unspecified'}`,
    )
    .join('\n')
}

export function companyProfileBlock(intake: PromptIntake): string {
  return `COMPANY PROFILE:
- Name: ${intake.companyName}${intake.tradingName ? ` (trading as ${intake.tradingName})` : ''}
- Industry: ${wrapCustomerInput(intake.industry)}
- Employees: ${intake.employeeCount}
- EU customers: ${intake.hasEuCustomers ? 'Yes' : 'No'}${intake.euRevenuePercentage ? ` (~${intake.euRevenuePercentage}% of revenue)` : ''}
- Primary contact: ${intake.contactName}, ${wrapCustomerInput(intake.contactRole)}${intake.contactEmail ? ` (${intake.contactEmail})` : ''}
- Overall risk level: ${intake.riskLevel}
- Prepared date: ${intake.preparedDate}
- Review date: ${intake.reviewDate}`
}
