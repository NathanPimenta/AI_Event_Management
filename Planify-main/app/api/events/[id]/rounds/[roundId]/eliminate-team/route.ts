import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"
import { sendRoundEliminationNotification } from "@/lib/email"

/**
 * POST: Eliminate a team from the competition
 * Request body: { teamId, feedback }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  try {
    const { id, roundId } = await params
    const session = await verifyAuth(request)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { teamId, feedback = 'Did not meet the evaluation criteria' } = body

    // Verify user is event organizer
    const eventResult = await query(
      `SELECT organizer_id, title FROM events WHERE id = $1`,
      [id]
    )

    if (eventResult.rows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const event = eventResult.rows[0]
    if (event.organizer_id !== session.user.id && session.user.role !== 'community_admin') {
      return NextResponse.json(
        { error: 'Only event organizers can eliminate teams' },
        { status: 403 }
      )
    }

    // Get round info
    const roundResult = await query(
      `SELECT round_number FROM event_rounds WHERE id = $1 AND event_id = $2`,
      [roundId, id]
    )

    if (roundResult.rows.length === 0) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }

    const round = roundResult.rows[0]

    // Update team status
    const updateResult = await query(
      `UPDATE team_round_status 
       SET status = 'eliminated', elimination_feedback = $3, reviewed_by = $4, reviewed_at = NOW()
       WHERE team_id = $1 AND round_id = $2
       RETURNING *`,
      [teamId, roundId, feedback, session.user.id]
    )

    // Send elimination notification
    try {
      const teamResult = await query(
        `SELECT team_name FROM event_teams WHERE id = $1`,
        [teamId]
      )

      const teamMembersResult = await query(
        `SELECT u.email FROM team_members tm
         JOIN users u ON tm.user_id = u.id
         WHERE tm.team_id = $1`,
        [teamId]
      )

      if (teamResult.rows.length > 0 && teamMembersResult.rows.length > 0) {
        const emails = teamMembersResult.rows.map(r => r.email)
        
        await sendRoundEliminationNotification(
          emails,
          {
            title: event.title,
            id: event.id
          },
          {
            teamName: teamResult.rows[0].team_name,
            round: round.round_number
          },
          session.user.name,
          feedback
        )
      }
    } catch (emailError) {
      console.error('❌ Failed to send elimination notification:', emailError)
    }

    return NextResponse.json({
      success: true,
      message: 'Team eliminated from competition',
      data: updateResult.rows[0]
    })
  } catch (error) {
    console.error('Error eliminating team:', error)
    return NextResponse.json(
      { error: 'Failed to eliminate team' },
      { status: 500 }
    )
  }
}
