import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"
import { 
  sendRoundAdvancementNotification, 
  sendRoundEliminationNotification 
} from "@/lib/email"

/**
 * POST: Advance a team to the next round
 * Request body: { teamId, roundId, reason }
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
    const { teamId, reason = 'Excellent performance' } = body

    // Verify user is event organizer
    const eventResult = await query(
      `SELECT organizer_id, title, event_type FROM events WHERE id = $1`,
      [id]
    )

    if (eventResult.rows.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const event = eventResult.rows[0]
    if (event.organizer_id !== session.user.id && session.user.role !== 'community_admin') {
      return NextResponse.json(
        { error: 'Only event organizers can advance teams' },
        { status: 403 }
      )
    }

    // Get round info
    const roundResult = await query(
      `SELECT * FROM event_rounds WHERE id = $1 AND event_id = $2`,
      [roundId, id]
    )

    if (roundResult.rows.length === 0) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }

    const currentRound = roundResult.rows[0]

    // Get next round
    const nextRoundResult = await query(
      `SELECT id FROM event_rounds 
       WHERE event_id = $1 AND round_number = $2`,
      [id, currentRound.round_number + 1]
    )

    if (nextRoundResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No next round available' },
        { status: 400 }
      )
    }

    const nextRound = nextRoundResult.rows[0]

    // Update team status for current round
    const updateResult = await query(
      `UPDATE team_round_status 
       SET status = 'advanced', advancement_reason = $3, reviewed_by = $4, reviewed_at = NOW()
       WHERE team_id = $1 AND round_id = $2
       RETURNING *`,
      [teamId, roundId, reason, session.user.id]
    )

    // Create team_round_status entry for next round
    await query(
      `INSERT INTO team_round_status (team_id, round_id, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (team_id, round_id) DO NOTHING`,
      [teamId, nextRound.id]
    )

    // Send advancement notification
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
        
        await sendRoundAdvancementNotification(
          emails,
          {
            title: event.title,
            id: event.id,
            eventType: event.event_type
          },
          {
            teamName: teamResult.rows[0].team_name,
            currentRound: currentRound.round_number,
            nextRound: currentRound.round_number + 1
          },
          session.user.name
        )
      }
    } catch (emailError) {
      console.error(' Failed to send advancement notification:', emailError)
    }

    return NextResponse.json({
      success: true,
      message: 'Team advanced to next round',
      data: updateResult.rows[0]
    })
  } catch (error) {
    console.error('Error advancing team:', error)
    return NextResponse.json(
      { error: 'Failed to advance team' },
      { status: 500 }
    )
  }
}
