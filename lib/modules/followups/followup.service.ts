import { Resend } from 'resend'
import * as repo from './followup.repository'

export type FollowUp = repo.FollowUp

const resend = new Resend(process.env.RESEND_API_KEY!)

export function defaultSubject(day: number, dealTitle: string): string {
  const subjects: Record<number, string> = {
    2: 'Following up — Your Mauritius Holiday Quote',
    5: 'Still Available — Your Mauritius Quote',
    10: 'Last Chance — Your Mauritius Holiday',
  }
  return subjects[day] || `Following up — ${dealTitle}`
}

export function defaultBody(day: number, clientName: string): string {
  const first = clientName.split(' ')[0]
  if (day === 2) return `
<p>Dear ${first},</p>
<p>I hope you've had a chance to review the Mauritius holiday quote I sent over. I wanted to follow up and see if you had any questions or if there's anything you'd like me to adjust.</p>
<p>As I mentioned, availability at this time of year moves quickly — I'd be happy to hold the current pricing for a little longer while you decide.</p>
<p>Please don't hesitate to call me directly on <strong>020 8951 6922</strong> or WhatsApp me on <strong>07881 551204</strong> — I'm always happy to talk through the details.</p>
<p>Warm regards,<br><strong>Samir Abattouy</strong><br>Mauritius Expert · Mauritius Holidays Direct<br>020 8951 6922 · samir@mauritiusholidaysdirect.co.uk</p>
<p style="font-size:11px;color:#888">ABTA · IATA · ATOL Protected 5744</p>
`.trim()

  if (day === 5) return `
<p>Dear ${first},</p>
<p>I wanted to reach out once more regarding your Mauritius holiday quote. I understand that planning a holiday is a big decision, and I want to make sure you have all the information you need.</p>
<p>I've been monitoring availability and the dates you're looking at are still available — but I wouldn't want you to miss out. A 10% deposit is all it takes to secure your holiday today.</p>
<p>If the quote needs any adjustments — different hotel, different dates, or a different budget — just say the word and I'll put something new together for you.</p>
<p>Call me on <strong>020 8951 6922</strong> or schedule a call at your convenience: <a href="https://calendly.com/mauritiusexpert">calendly.com/mauritiusexpert</a></p>
<p>Warm regards,<br><strong>Samir Abattouy</strong><br>Mauritius Expert · Mauritius Holidays Direct<br>020 8951 6922 · samir@mauritiusholidaysdirect.co.uk</p>
<p style="font-size:11px;color:#888">ABTA · IATA · ATOL Protected 5744</p>
`.trim()

  if (day === 10) return `
<p>Dear ${first},</p>
<p>I've been trying to reach you regarding your Mauritius holiday quote and I wanted to send one final message before I close off this enquiry.</p>
<p>If your plans have changed or you've decided to go elsewhere, that's completely fine — I just want to make sure you haven't been left waiting. If you're still interested, I'm here and ready to help.</p>
<p>Sometimes the timing just isn't right — and if that's the case, please keep my details. When you're ready to plan your Mauritius holiday, I'll be here.</p>
<p>With warm regards,<br><strong>Samir Abattouy</strong><br>Mauritius Expert · Mauritius Holidays Direct<br>020 8951 6922 · samir@mauritiusholidaysdirect.co.uk</p>
<p style="font-size:11px;color:#888">ABTA · IATA · ATOL Protected 5744</p>
`.trim()

  return `<p>Dear ${first},</p><p>Following up on your Mauritius holiday quote.</p><p>Warm regards,<br>Samir Abattouy</p>`
}

export async function fetchFollowUps() {
  return repo.getAllFollowUps()
}

export async function saveEmailDraft(id: number, email_subject: string, email_body: string) {
  return repo.updateFollowUp(id, { email_subject, email_body })
}

export async function skipFollowUp(id: number) {
  return repo.updateFollowUp(id, { status: 'skipped' })
}

export async function resetFollowUp(id: number) {
  return repo.updateFollowUp(id, { status: 'pending', sent_at: null })
}

export async function sendFollowUp(body: {
  follow_up_id?: number
  to?: string
  subject?: string
  body?: string
  deal_id?: number
  sequence_day?: number
}) {
  if (!body.follow_up_id || !body.to || !body.subject || !body.body || !body.deal_id || !body.sequence_day) {
    throw new Error('Missing required fields')
  }

  const { error } = await resend.emails.send({
    from: 'noreply@mhd-crm.com',
    to: body.to,
    subject: body.subject,
    html: body.body,
  })

  if (error) {
    throw new Error('Failed to send email')
  }

  await repo.updateFollowUp(body.follow_up_id, {
    status: 'sent',
    sent_at: new Date().toISOString(),
  })

  await repo.createActivity({
    deal_id: body.deal_id,
    activity_type: 'EMAIL',
    notes: `Follow-up Day ${body.sequence_day} sent — ${body.subject}`,
  })

  return { success: true }
}
