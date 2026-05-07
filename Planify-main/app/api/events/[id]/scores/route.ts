import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"

// GET: Get overall scores/leaderboard for an event
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const session = await verifyAuth(request)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify event exists and user has permission to view scores
    const eventResult = await query(
      `SELECT e.*, c.id as club_id 
       FROM events e 
       LEFT JOIN clubs c ON e.club_id = c.id 
       WHERE e.id = $1`,
      [eventId]
    )

    if (eventResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    const event = eventResult.rows[0]

    // Check permissions: community admin, event organizer, club lead, or assigned judge
    let hasPermission = false

    if (session.user.role === 'community_admin') {
      hasPermission = true
    } else if (event.organizer_id === session.user.id) {
      hasPermission = true
    } else if (event.club_id) {
      // Check if user is club lead
      const clubMemberResult = await query(
        `SELECT role FROM club_members 
         WHERE club_id = $1 AND user_id = $2 AND role = 'lead'`,
        [event.club_id, session.user.id]
      )
      hasPermission = clubMemberResult.rows.length > 0
    }

    // Check if user is assigned as judge for this event
    if (!hasPermission && session.user.role === 'judge') {
      const judgeResult = await query(
        `SELECT * FROM judge_assignments 
         WHERE event_id = $1 AND judge_id = $2 AND status = 'active'`,
        [eventId, session.user.id]
      )
      hasPermission = judgeResult.rows.length > 0
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view scores' },
        { status: 403 }
      )
    }

    // Get participant scores with ranking
    const scoresResult = await query(
      `SELECT 
        ps.*,
        RANK() OVER (ORDER BY ps.total_score DESC) as rank,
        COUNT(ms.*) as scored_submissions,
        AVG(ms.score) as avg_material_score
       FROM participant_scores ps
       LEFT JOIN material_submissions msub ON ps.participant_id = msub.attendee_id AND ps.event_id = msub.event_id
       LEFT JOIN material_scores ms ON msub.id = ms.submission_id
       WHERE ps.event_id = $1
       GROUP BY ps.id, ps.event_id, ps.participant_id, ps.participant_name, ps.participant_email, 
                ps.total_score, ps.material_score, ps.bonus_score, ps.penalty_score, 
                ps.judge_count, ps.last_updated_by, ps.created_at, ps.updated_at
       ORDER BY ps.total_score DESC, ps.participant_name ASC`,
      [eventId]
    )

    // Get summary statistics
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_participants,
        AVG(total_score) as avg_score,
        MAX(total_score) as max_score,
        MIN(total_score) as min_score,
        COUNT(CASE WHEN total_score > 0 THEN 1 END) as scored_participants
       FROM participant_scores 
       WHERE event_id = $1`,
      [eventId]
    )

    // Get judge count
    const judgeCountResult = await query(
      `SELECT COUNT(*) as judge_count 
       FROM judge_assignments 
       WHERE event_id = $1 AND status = 'active'`,
      [eventId]
    )

    return NextResponse.json({
      participants: scoresResult.rows,
      statistics: statsResult.rows[0],
      judgeCount: judgeCountResult.rows[0].judge_count,
      eventTitle: event.title
    })
  } catch (error) {
    console.error('Error fetching scores:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scores', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}