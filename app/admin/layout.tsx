import { headers } from 'next/headers'
import { requireAdmin } from '@/lib/auth'
import { AdminSidebar } from './_components/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  // /admin/login must skip the guard — calling requireAdmin() there would
  // redirect back to itself in an infinite loop. Render the bare page on its
  // own background, no sidebar.
  if (pathname.startsWith('/admin/login')) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
        {children}
      </div>
    )
  }

  const user = await requireAdmin()
  const email = user.email ?? ''

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      <AdminSidebar email={email} />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        {children}
      </main>
    </div>
  )
}
