export default function PortalNotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
      <div style={{ maxWidth: 360 }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', color: '#1a3a5c', textTransform: 'uppercase', marginBottom: 24 }}>
          Mauritius Holidays Direct
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>Link not found</h1>
        <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.6, marginBottom: 32 }}>
          This link may have expired or been revoked. Please contact your consultant for a new link.
        </p>
        <a href="mailto:enquiries@mauritiusholidaysdirect.co.uk" style={{ display: 'inline-block', padding: '12px 24px', background: '#1a3a5c', color: '#fff', borderRadius: 8, fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>
          Contact us
        </a>
      </div>
    </div>
  )
}
