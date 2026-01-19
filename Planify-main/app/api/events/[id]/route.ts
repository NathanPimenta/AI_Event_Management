import { NextResponse } from "next/server"
import { getEventById, updateEvent } from "@/lib/db"
import { notifyEventUpdate, notifyEventCancellation } from "@/lib/notifications"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const event = await getEventById(params.id)

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error("Error fetching event:", error)
    return NextResponse.json({ error: "An error occurred while fetching the event" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await request.json()
    const event = await updateEvent(params.id, data)

    // Send update notification if event details changed
    if (data.updateDetails && data.updatedByUserId) {
      notifyEventUpdate(params.id, data.updatedByUserId, data.updateDetails).catch(err =>
        console.error("Failed to send event update notification:", err)
      )
    }

    // Handle event cancellation
    if (data.status === 'cancelled' && data.cancellationReason && data.updatedByUserId) {
      notifyEventCancellation(params.id, data.updatedByUserId, data.cancellationReason).catch(err =>
        console.error("Failed to send cancellation notification:", err)
      )
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error("Error updating event:", error)
    return NextResponse.json({ error: "An error occurred while updating the event" }, { status: 500 })
  }
}
