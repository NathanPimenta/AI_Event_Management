import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"

/**
 * GET: Get all teams and their status in a specific round
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  try {
    const { id, roundId } = await params

    // Get round details
    const roundResult = await query(
      `SELECT * FROM event_rounds WHERE id = $1 AND event_id = $2`,
      [roundId, id]
    )

    if (roundResult.rows.length === 0) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }

    // Get all teams and their status for this round
    const teamsResult = await query(
      `SELECT 
        et.id,
        et.team_name,
        et.team_lead_id,
        u.name as team_lead_name,
        u.email as team_lead_email,
        trs.status,
        trs.score,
        trs.advancement_reason,
        trs.elimination_feedback,
        trs.reviewed_by,
        ru.name as reviewed_by_name,
        COUNT(tm.id) as member_count,
        (SELECT COUNT(*) FROM round_submissions 
         WHERE team_id = et.id AND round_id = $2) as submission_count
       FROM event_teams et
       LEFT JOIN users u ON et.team_lead_id = u.id
       LEFT JOIN team_round_status trs ON et.id = trs.team_id AND trs.round_id = $2
       LEFT JOIN users ru ON trs.reviewed_by = ru.id
       LEFT JOIN team_members tm ON et.id = tm.team_id
       WHERE et.event_id = $1
       GROUP BY et.id, et.team_name, et.team_lead_id, u.id, trs.id, ru.id`,
      [id, roundId]
    )

    return NextResponse.json({
      round: roundResult.rows[0],
      teams: teamsResult.rows
    })
  } catch (error) {
    console.error('Error fetching round teams:', error)
    return NextResponse.json(
      { error: 'Failed to fetch round teams' },
      { status: 500 }
    )
  }
}
