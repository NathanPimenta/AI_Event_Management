import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"

/**
 * GET: Fetch all rounds for an event
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await query(
      `SELECT * FROM event_rounds 
       WHERE event_id = $1 
       ORDER BY round_number ASC`,
      [id]
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching rounds:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rounds' },
      { status: 500 }
    )
  }
}

/**
 * POST: Create a new round for an event
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

    // Verify user is event organizer
    const eventResult = await query(
      `SELECT organizer_id FROM events WHERE id = $1`,
      [id]
    )

    if (eventResult.rows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (eventResult.rows[0].organizer_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Only event organizers can create rounds' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      round_number,
      title,
      description,
      start_date,
      end_date,
      submission_deadline,
      max_teams,
      requirements,
      evaluation_criteria
    } = body

    // Insert round
    const result = await query(
      `INSERT INTO event_rounds (
        event_id,
        round_number,
        title,
        description,
        start_date,
        end_date,
        submission_deadline,
        max_teams,
        requirements,
        evaluation_criteria
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        id,
        round_number,
        title,
        description,
        start_date,
        end_date,
        submission_deadline,
        max_teams,
        requirements,
        evaluation_criteria
      ]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating round:', error)
    return NextResponse.json(
      { error: 'Failed to create round' },
      { status: 500 }
    )
  }
}
