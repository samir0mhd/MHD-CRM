'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Supplier = {
  id: number
  name: string
  account_code: string | null
  type: string | null
  company_reg: string | null
  description: string | null
  street_1: string | null
  street_2: string | null
  town: string | null
  country: string | null
  post_code: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  fax: string | null
  website: string | null
  account_contact_name: string | null
  account_contact_email: string | null
  account_contact_phone: string | null
  account_contact_fax: string | null
  sales_contact_name: string | null
  sales_contact_email: string | null
  sales_contact_phone: string | null
  sales_contact_fax: string | null
  bank_name: string | null
  bank_account_name: string | null
  bank_street_1: string | null
  bank_street_2: string | null
  bank_town: string | null
  bank_telephone: string | null
  bank_post_code: string | null
  bank_account_number: string | null
  bank_sort_code: string | null
  bank_iban: string | null
  bank_swift_code: string | null
  vat_number: string | null
  vat_registered: boolean | null
  product_types: string | null
  trading_terms_text: string | null
  commission_rate: number | null
  payment_due_days: number | null
  account_open_date: string | null
  payment_currency: string | null
  abta: string | null
  atol: string | null
  iata: string | null
  remarks: string | null
  payment_terms: string | null
  credit_agreement: boolean | null
  notes: string | null
}

function fmtDate(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function asLink(url: string | null) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

function Field({ label, value, href }: { label: string; value: string | number | null | undefined; href?: string | null }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '14px', fontSize: '13px' }}>
      <div style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
        {href && value ? <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{value}</a> : (value || '—')}
      </div>
    </div>
  )
}

export default function SupplierDetailsPage() {
  const params = useParams<{ id: string }>()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const response = await fetch(`/api/suppliers/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setSupplier(data || null)
      } else {
        setSupplier(null)
      }
      setLoading(false)
    })()
  }, [params.id])

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', color: 'var(--text-muted)', fontSize: '14px' }}>Loading supplier…</div>
  }

  if (!supplier) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', color: 'var(--text-muted)', fontSize: '14px' }}>Supplier not found</div>
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/suppliers" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', fontFamily: 'Outfit,sans-serif' }}>← Suppliers</Link>
          <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
          <div>
            <div className="page-title">View Supplier Details</div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Supplier profile, banking and terms</div>
          </div>
        </div>
        <Link href={`/suppliers?edit=${supplier.id}`}>
          <button className="btn btn-secondary">Edit Supplier</button>
        </Link>
      </div>

      <div className="page-body" style={{ maxWidth: '980px' }}>
        <div className="card" style={{ padding: '22px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Name" value={supplier.name} />
            <Field label="Account Code" value={supplier.account_code} />
            <Field label="Company Reg" value={supplier.company_reg} />
            <Field label="Description" value={supplier.description} />
          </div>
        </div>

        <div className="card" style={{ padding: '22px', marginBottom: '16px' }}>
          <div style={{ fontFamily: 'Fraunces,serif', fontSize: '18px', marginBottom: '14px' }}>Supplier Address Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Street 1" value={supplier.street_1} />
            <Field label="Email" value={supplier.email} href={supplier.email ? `mailto:${supplier.email}` : null} />
            <Field label="Street 2" value={supplier.street_2} />
            <Field label="Website" value={supplier.website} href={asLink(supplier.website)} />
            <Field label="Town" value={supplier.town} />
            <Field label="Telephone" value={supplier.phone} href={supplier.phone ? `tel:${supplier.phone}` : null} />
            <Field label="Country" value={supplier.country} />
            <Field label="Fax" value={supplier.fax} />
            <Field label="Post Code" value={supplier.post_code} />
            <Field label="Main Contact" value={supplier.contact_name} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div className="card" style={{ padding: '22px' }}>
            <div style={{ fontFamily: 'Fraunces,serif', fontSize: '18px', marginBottom: '14px' }}>Supplier Account Department Contact Information</div>
            <div style={{ display: 'grid', gap: '12px' }}>
              <Field label="Contact Name" value={supplier.account_contact_name} />
              <Field label="Email" value={supplier.account_contact_email} href={supplier.account_contact_email ? `mailto:${supplier.account_contact_email}` : null} />
              <Field label="Account Dep Phone" value={supplier.account_contact_phone} />
              <Field label="Account Dep Fax" value={supplier.account_contact_fax} />
            </div>
          </div>

          <div className="card" style={{ padding: '22px' }}>
            <div style={{ fontFamily: 'Fraunces,serif', fontSize: '18px', marginBottom: '14px' }}>Supplier Sale Department Contact Information</div>
            <div style={{ display: 'grid', gap: '12px' }}>
              <Field label="Contact Name" value={supplier.sales_contact_name} />
              <Field label="Email" value={supplier.sales_contact_email} href={supplier.sales_contact_email ? `mailto:${supplier.sales_contact_email}` : null} />
              <Field label="Sale Dep Phone" value={supplier.sales_contact_phone} />
              <Field label="Sale Dep Fax" value={supplier.sales_contact_fax} />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '22px', marginBottom: '16px' }}>
          <div style={{ fontFamily: 'Fraunces,serif', fontSize: '18px', marginBottom: '14px' }}>Supplier Bank Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Bank Name" value={supplier.bank_name} />
            <Field label="Account Name" value={supplier.bank_account_name} />
            <Field label="Street 1" value={supplier.bank_street_1} />
            <Field label="Account Number" value={supplier.bank_account_number} />
            <Field label="Street 2" value={supplier.bank_street_2} />
            <Field label="Sort Code" value={supplier.bank_sort_code} />
            <Field label="Town" value={supplier.bank_town} />
            <Field label="IBAN No" value={supplier.bank_iban} />
            <Field label="Telephone" value={supplier.bank_telephone} />
            <Field label="Swift Code" value={supplier.bank_swift_code} />
            <Field label="Post Code" value={supplier.bank_post_code} />
          </div>
        </div>

        <div className="card" style={{ padding: '22px' }}>
          <div style={{ fontFamily: 'Fraunces,serif', fontSize: '18px', marginBottom: '14px' }}>Entering Supplier Terms</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
            <Field label="Vat Number" value={supplier.vat_number} />
            <Field label="Vat" value={supplier.vat_registered == null ? '—' : (supplier.vat_registered ? 'yes' : 'no')} />
            <Field label="Type of Products" value={supplier.product_types} />
            <Field label="Commission Rate" value={supplier.commission_rate != null ? supplier.commission_rate.toFixed(2) : '—'} />
            <Field label="Payment Due Days" value={supplier.payment_due_days} />
            <Field label="Account Open Date" value={fmtDate(supplier.account_open_date)} />
            <Field label="Payment Currency" value={supplier.payment_currency} />
            <Field label="Payment Terms" value={supplier.payment_terms} />
            <Field label="ABTA" value={supplier.abta} />
            <Field label="ATOL" value={supplier.atol} />
            <Field label="IATA" value={supplier.iata} />
            <Field label="Credit Agreement" value={supplier.credit_agreement == null ? '—' : (supplier.credit_agreement ? 'yes' : 'no')} />
          </div>

          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Trading Terms Text</div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{supplier.trading_terms_text || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Remarks</div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{supplier.remarks || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Internal Notes</div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{supplier.notes || '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
