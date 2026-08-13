import type { ReactNode } from 'react'
import { ClientThemeScope } from '@/components/theme/ClientThemeScope'

/**
 * The portal is a CLIENT-facing surface, so it gets the same theme scope as the
 * questionnaire. `ClientThemeScope`'s own docstring has always said
 * "questionnaire/portal"; the portal simply never had a layout to hang it on,
 * which is why it stayed dark-only while /start could switch.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <ClientThemeScope>{children}</ClientThemeScope>
}
