import { NextResponse } from "next/server"
import { getEventById, addAttendeeToEvent, isUserClubMember } from "@/lib/db"
import { sendRegistrationConfirmationWithQRCode } from "@/lib/email"
import QRCode from "qrcode"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, name, email } = await request.json()

    // Get event
    const event = await getEventById(id)
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Check if user is already registered
    const isRegistered = event.attendees && event.attendees.some((attendee: any) => attendee.userId === userId)
    if (isRegistered) {
      return NextResponse.json({ error: "You are already registered for this event" }, { status: 400 })
    }

    // If event is associated with a club, check if user is a club member
    if (event.clubId) {
      const isClubMember = await isUserClubMember(event.clubId, userId)
      if (!isClubMember) {
        return NextResponse.json({ 
          error: "You must be a member of the club to register for this event",
          code: "NOT_CLUB_MEMBER",
          clubId: event.clubId,
          clubName: event.clubName
        }, { status: 403 })
      }
    }

    // Check if event is full
    const currentAttendees = event.attendeeCount || (event.attendees ? event.attendees.length : 0)
    if (event.maxAttendees && currentAttendees >= event.maxAttendees) {
      return NextResponse.json({ error: "This event is full" }, { status: 400 })
    }

    // Register user for event
    await addAttendeeToEvent(id, {
      userId,
      name,
      email,
      registeredAt: new Date(),
    })

    console.log(`✅ User ${userId} registered for event ${id}`)

    // Generate QR code and send registration email (non-blocking)
    try {
      const eventUrl = `${process.env.NEXT_PUBLIC_APP_URL}/events/${id}`
      const qrCodeDataUrl = await QRCode.toDataURL(eventUrl, {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      })

      console.log(`📱 Generated QR code for event ${id}`)

      // Format event date
      const eventDate = event.date 
        ? new Date(event.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'TBA'

      // Send registration confirmation with QR code
      const emailSent = await sendRegistrationConfirmationWithQRCode(
        email,
        name,
        {
          title: event.title,
          id: event.id,
          date: eventDate,
          location: event.location || 'TBA',
          description: event.description || ''
        },
        qrCodeDataUrl
      )

      if (emailSent) {
        console.log(`✅ Registration confirmation email sent to ${email}`)
      } else {
        console.warn(`⚠️ Failed to send registration email to ${email}`)
      }
    } catch (emailError) {
      console.error('❌ Error sending registration email:', emailError)
      // Don't fail the registration if email fails, just log it
    }

    return NextResponse.json({ 
      success: true, 
      message: "Successfully registered for the event. Check your email for confirmation." 
    })
  } catch (error) {
    console.error("Error registering for event:", error)
    return NextResponse.json({ error: "An error occurred while registering for the event" }, { status: 500 })
  }
}

