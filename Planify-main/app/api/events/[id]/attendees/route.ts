import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const result = await query(
      `SELECT 
        ea.id,
        ea.name,
        ea.email,
        ea.registered_at as "registeredAt",
        ea.user_id as "userId"
       FROM event_attendees ea
       WHERE ea.event_id = $1
       ORDER BY ea.registered_at DESC`,
      [id]
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching attendees:", error)
    return NextResponse.json(
      { error: "An error occurred while fetching attendees" },
      { status: 500 }
    )
  }
}
