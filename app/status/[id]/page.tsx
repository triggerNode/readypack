// app/status/[id]/page.tsx
//
// The standalone Pack Progress screen has been merged into the unified customer
// portal (design brief 14): progress tracker + documents now live on ONE page
// at /portal/[id]. This route only exists to keep old email links and bookmarks
// working — it permanently redirects to the portal.

import { permanentRedirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export default async function PackProgressRedirect({ params }: { params: Params }) {
  const { id: orderId } = await params
  permanentRedirect(`/portal/${orderId}`)
}
