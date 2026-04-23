import type { PortalBalanceView } from '@/lib/modules/portal/portal.types'

function fmt(n: number) {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BalanceSection({ balance }: { balance: PortalBalanceView }) {
  const paid = balance.total_paid >= balance.total_sell

  return (
    <div style={{ padding: '20px', background: '#fff' }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 16px' }}>Balance</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 16 }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 12, color: '#9ca3af' }}>Booking total</p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>{fmt(balance.total_sell)}</p>
        </div>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 12, color: '#9ca3af' }}>Paid</p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#10b981' }}>{fmt(balance.total_paid)}</p>
        </div>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 12, color: '#9ca3af' }}>Balance due</p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: balance.balance_due > 0 ? '#dc2626' : '#10b981' }}>
            {paid ? 'Fully paid' : fmt(balance.balance_due)}
          </p>
        </div>
        {balance.balance_due_date && !paid && (
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 12, color: '#9ca3af' }}>Due by</p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#374151' }}>{fmtDate(balance.balance_due_date)}</p>
          </div>
        )}
      </div>

      {!paid && (
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
          To arrange payment, please contact your consultant directly.
        </p>
      )}
    </div>
  )
}
