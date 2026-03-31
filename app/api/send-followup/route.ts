import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { follow_up_id, to, subject, body } = await req.json()

    if (!follow_up_id || !to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Send the email via Resend
    const { data, error } = await resend.emails.send({
      from: 'noreply@mhd-crm.com', // Replace with your verified domain
      to,
      subject,
      html: body,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    console.log(`[Follow-up] Sent to: ${to} | Subject: ${subject}`)

    await supabase
      .from('follow_up_sequences')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', follow_up_id)

    return NextResponse.json({ success: true, note: 'Email sent successfully' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}