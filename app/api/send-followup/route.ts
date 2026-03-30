import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { follow_up_id, to, subject, body } = await req.json()

    if (!follow_up_id || !to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Send via Resend
    const { data, error } = await resend.emails.send({
      from: 'Samir Abattouy <onboarding@resend.dev>',
      to,
      subject,
      html: body,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Mark as sent in DB
    await supabase
      .from('follow_up_sequences')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', follow_up_id)

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
