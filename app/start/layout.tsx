import type { ReactNode } from 'react'
import { ClientThemeScope } from '@/components/theme/ClientThemeScope'

export default function StartLayout({ children }: { children: ReactNode }) {
  return <ClientThemeScope>{children}</ClientThemeScope>
}
