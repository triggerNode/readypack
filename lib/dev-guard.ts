// lib/dev-guard.ts
//
// The /api/admin/dev/* routes perform destructive operations (wiping documents,
// re-running generation, deleting jobs). They are admin-gated, but should not be
// reachable at all in production: a compromised admin session would otherwise be
// able to destroy live customer data. This makes them 404 in production unless
// ENABLE_DEV_TOOLS=true is explicitly set (e.g. a staging environment). They
// stay available in local development.

import { NextResponse } from 'next/server'

export function devToolsBlocked(): NextResponse | null {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_TOOLS !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return null
}
