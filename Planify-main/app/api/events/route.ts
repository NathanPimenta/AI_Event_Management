import { NextResponse } from "next/server"
import { getEvents as dbGetEvents, getEventsByClub as dbGetClubEvents, getEventsByCommunity as dbGetEventsByCommunity, createEvent as dbCreateEvent } from "@/lib/db"
import { notifyNewEvent } from "@/lib/notifications"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clubId = searchParams.get("clubId")
    const userId = searchParams.get("userId")
    const communityId = searchParams.get("communityId")

    if (clubId) {
      const events = await dbGetClubEvents(clubId)
      return NextResponse.json(events)
    } else if (communityId) {
      const events = await dbGetEventsByCommunity(communityId)
      return NextResponse.json(events)
    } else if (userId) {
      const events = await dbGetEvents(userId)
      return NextResponse.json(events)
    } else {
      const events = await dbGetEvents()
      return NextResponse.json(events)
    }
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json({ error: "An error occurred while fetching events" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    console.log("📝 Creating event:", { title: data.title, communityId: data.community_id || data.communityId, createdBy: data.createdByUserId })

    const event = await dbCreateEvent({
      ...data,
      attendees: [],
      createdAt: new Date(),
    })

    console.log("✅ Event created:", { eventId: event.id, title: event.title, communityId: event.communityId })

    // Send notification to community members asynchronously (fire and forget)
    if (event.id && event.communityId && data.createdByUserId) {
      console.log("📧 Triggering notification for event:", event.id)
      
      // Fire the notification in the background without awaiting
      // This ensures the API response is returned immediately
      ;(async () => {
        try {
          await notifyNewEvent(event.id, data.createdByUserId)
        } catch (err) {
          console.error("Failed to send event notification:", err)
        }
      })()
    } else {
      console.warn("⚠️  Notification not triggered. Missing:", {
        eventId: event.id,
        communityId: event.communityId,
        createdBy: data.createdByUserId
      })
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error("Error creating event:", error)
    return NextResponse.json({ error: "An error occurred while creating the event" }, { status: 500 })
  }
}
