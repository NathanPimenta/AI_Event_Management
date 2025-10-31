import { NextResponse } from "next/server"
import { getEvents as dbGetEvents, getClubEvents as dbGetClubEvents, getUserEvents as dbGetUserEvents, createEvent as dbCreateEvent } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clubId = searchParams.get("clubId")
    const userId = searchParams.get("userId")

    if (clubId) {
      const events = await dbGetClubEvents(clubId)
      return NextResponse.json(events)
    } else if (userId) {
      const events = await dbGetUserEvents(userId)
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

    const event = await dbCreateEvent({
      ...data,
      attendees: [],
      createdAt: new Date(),
    })

    return NextResponse.json(event)
  } catch (error) {
    console.error("Error creating event:", error)
    return NextResponse.json({ error: "An error occurred while creating the event" }, { status: 500 })
  }
}

