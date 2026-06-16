'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from '../admin.module.css'

type Props = {
  email: string
}

export function AdminUserFooter({ email }: Props) {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleLogout() {
    if (isSigningOut) return
    setIsSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/admin/login')
    router.refresh()
  }

  return (
    <div className={styles.user}>
      <span className={styles.userEmail} title={email}>
        {email}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isSigningOut}
        aria-label="Log out"
        title="Log out"
        className={styles.logoutBtn}
      >
        <LogOut size={15} strokeWidth={1.5} />
      </button>
    </div>
  )
}
