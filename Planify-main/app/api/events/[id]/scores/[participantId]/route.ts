import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"

// GET: Get detailed scores for a specific participant
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  try {
    const { id: eventId, participantId } = await params
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

    // Check permissions: community admin, event organizer, club lead, assigned judge, or the participant themselves
    let hasPermission = false

    if (session.user.role === 'community_admin') {
      hasPermission = true
    } else if (event.organizer_id === session.user.id) {
      hasPermission = true
    } else if (participantId === session.user.id) {
      hasPermission = true // Users can view their own scores
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
        { error: 'Insufficient permissions to view detailed scores' },
        { status: 403 }
      )
    }

    // Get participant overall score
    const participantResult = await query(
      `SELECT ps.*, u.name, u.email,
              RANK() OVER (ORDER BY ps.total_score DESC) as rank,
              COUNT(ps2.*) as total_participants
       FROM participant_scores ps
       JOIN users u ON ps.participant_id = u.id
       CROSS JOIN participant_scores ps2
       WHERE ps.event_id = $1 AND ps.participant_id = $2
         AND ps2.event_id = $1
       GROUP BY ps.id, ps.event_id, ps.participant_id, ps.participant_name, ps.participant_email, 
                ps.total_score, ps.material_score, ps.bonus_score, ps.penalty_score, 
                ps.judge_count, ps.last_updated_by, ps.created_at, ps.updated_at,
                u.name, u.email`,
      [eventId, participantId]
    )

    if (participantResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Participant not found in this event' },
        { status: 404 }
      )
    }

    const participant = participantResult.rows[0]

    // Get detailed material scores
    const materialScoresResult = await query(
      `SELECT 
        ms.*, 
        msub.original_filename,
        mr.title as request_title,
        mr.material_type,
        u.name as judge_name
       FROM material_scores ms
       JOIN material_submissions msub ON ms.submission_id = msub.id
       JOIN material_requests mr ON msub.request_id = mr.id
       JOIN users u ON ms.judge_id = u.id
       WHERE msub.attendee_id = $1 AND msub.event_id = $2
       ORDER BY mr.title, ms.scored_at DESC`,
      [participantId, eventId]
    )

    // Get material submissions without scores (pending scoring)
    const pendingSubmissionsResult = await query(
      `SELECT 
        msub.*,
        mr.title as request_title,
        mr.material_type,
        COUNT(ms.id) as score_count,
        (SELECT COUNT(*) FROM judge_assignments WHERE event_id = $2 AND status = 'active') as total_judges
       FROM material_submissions msub
       JOIN material_requests mr ON msub.request_id = mr.id
       LEFT JOIN material_scores ms ON msub.id = ms.submission_id
       WHERE msub.attendee_id = $1 AND msub.event_id = $2
       GROUP BY msub.id, msub.request_id, msub.event_id, msub.attendee_id, 
                msub.attendee_name, msub.attendee_email, msub.file_name, 
                msub.file_path, msub.file_size_bytes, msub.file_type, 
                msub.original_filename, msub.uploaded_at, msub.updated_at,
                mr.title, mr.material_type
       ORDER BY mr.title`,
      [participantId, eventId]
    )

    return NextResponse.json({
      participant,
      materialScores: materialScoresResult.rows,
      pendingSubmissions: pendingSubmissionsResult.rows
    })
  } catch (error) {
    console.error('Error fetching participant scores:', error)
    return NextResponse.json(
      { error: 'Failed to fetch participant scores', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}