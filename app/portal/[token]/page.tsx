import { notFound } from 'next/navigation'
import { validatePortalToken, assemblePortalView } from '@/lib/modules/portal/portal.service'
import PortalShell from '@/components/portal/PortalShell'

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const validation = await validatePortalToken(token)
  if (!validation.valid) notFound()

  const view = await assemblePortalView((validation as { valid: true; bookingId: number; clientId: number }).bookingId)
  if (!view) notFound()

  return <PortalShell booking={view} token={token} />
}
