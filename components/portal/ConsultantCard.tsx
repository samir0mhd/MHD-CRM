import type { PortalConsultantView } from '@/lib/modules/portal/portal.types'

export default function ConsultantCard({ consultant }: { consultant: PortalConsultantView }) {
  return (
    <div style={{ padding: '20px', background: '#fff' }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 12px' }}>Your Consultant</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {consultant.profile_photo_url ? (
          <img src={consultant.profile_photo_url} alt={consultant.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#1a3a5c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, flexShrink: 0 }}>
            {consultant.name[0]}
          </div>
        )}
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>{consultant.name}</p>
          {consultant.email && (
            <a href={`mailto:${consultant.email}`} style={{ fontSize: 13, color: '#1a3a5c', textDecoration: 'none' }}>
              {consultant.email}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
