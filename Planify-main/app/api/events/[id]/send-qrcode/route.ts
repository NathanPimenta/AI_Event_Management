import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"
import { sendQRCodeToParticipants } from "@/lib/email"
import QRCode from "qrcode"

/**
 * POST: Admin sends QR code to event participants
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await verifyAuth(request)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is event admin/organizer
    const eventResult = await query(
      `SELECT organizer_id, title, date FROM events WHERE id = $1`,
      [id]
    )

    if (eventResult.rows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const event = eventResult.rows[0]
    if (event.organizer_id !== session.user.id && session.user.role !== 'community_admin') {
      return NextResponse.json(
        { error: 'Only event organizers can send QR codes' },
        { status: 403 }
      )
    }

    // Get all participants
    const attendeesResult = await query(
      `SELECT DISTINCT email, name FROM event_attendees 
       WHERE event_id = $1 AND email IS NOT NULL`,
      [id]
    )

    if (attendeesResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No attendees found for this event' },
        { status: 400 }
      )
    }

    const participantEmails = attendeesResult.rows.map(row => row.email)

    // Generate QR code
    const eventUrl = `${process.env.NEXT_PUBLIC_APP_URL}/events/${id}`
    const qrCodeDataUrl = await QRCode.toDataURL(eventUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    })

    console.log(`📱 Generated QR code for event distribution: ${id}`)

    // Format event date
    const eventDate = event.date
      ? new Date(event.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : 'TBA'

    // Send emails to all participants
    const emailSent = await sendQRCodeToParticipants(
      participantEmails,
      {
        title: event.title,
        id: event.id,
        date: eventDate
      },
      qrCodeDataUrl,
      session.user.name
    )

    if (emailSent) {
      console.log(`✅ QR code sent to ${participantEmails.length} participants`)
      return NextResponse.json({
        success: true,
        message: `QR code sent to ${participantEmails.length} participants`,
        recipientCount: participantEmails.length
      })
    } else {
      console.warn(`⚠️ Failed to send QR code emails`)
      return NextResponse.json(
        { error: 'Failed to send QR codes to participants' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error sending QR codes:', error)
    return NextResponse.json(
      {
        error: 'Failed to send QR codes',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
