import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    // Check material_submissions table
    const submissions = await query(
      `SELECT * FROM material_submissions ${eventId ? `WHERE event_id = $1` : ''} LIMIT 10`,
      eventId ? [eventId] : []
    )

    // Check material_requests table
    const requests = await query(
      `SELECT * FROM material_requests ${eventId ? `WHERE event_id = $1` : ''} LIMIT 10`,
      eventId ? [eventId] : []
    )

    // Check events table to verify the event exists
    const events = await query(
      `SELECT id, title FROM events ${eventId ? `WHERE id = $1` : ''} LIMIT 10`,
      eventId ? [eventId] : []
    )

    // Check judge_assignments for this event
    const judges = await query(
      `SELECT * FROM judge_assignments ${eventId ? `WHERE event_id = $1` : ''} LIMIT 10`,
      eventId ? [eventId] : []
    )

    return NextResponse.json({
      eventId,
      submissions: submissions.rows,
      requests: requests.rows,  
      events: events.rows,
      judges: judges.rows,
      tables_info: {
        submissions_count: submissions.rows.length,
        requests_count: requests.rows.length,
        events_count: events.rows.length,
        judges_count: judges.rows.length
      }
    })
  } catch (error) {
    console.error('Debug materials error:', error)
    return NextResponse.json(
      { error: 'Debug failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}