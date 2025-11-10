import { NextResponse } from "next/server"
import { getEventById, addAttendeeToEvent } from "@/lib/db"

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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error registering for event:", error)
    return NextResponse.json({ error: "An error occurred while registering for the event" }, { status: 500 })
  }
}

