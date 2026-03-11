import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"

// POST: Submit or update score for a material submission
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; requestId: string; submissionId: string }> }
) {
  try {
    const { id: eventId, submissionId } = await params
    const session = await verifyAuth(request)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a judge for this event
    if (session.user.role !== 'judge') {
      return NextResponse.json(
        { error: 'Only judges can score materials' },
        { status: 403 }
      )
    }

    const judgeAssignmentResult = await query(
      `SELECT * FROM judge_assignments 
       WHERE event_id = $1 AND judge_id = $2 AND status = 'active'`,
      [eventId, session.user.id]
    )

    if (judgeAssignmentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'You are not assigned as a judge for this event' },
        { status: 403 }
      )
    }

    // Verify the material submission exists
    const submissionResult = await query(
      `SELECT ms.*, mr.title as request_title, mr.material_type
       FROM material_submissions ms
       JOIN material_requests mr ON ms.request_id = mr.id
       WHERE ms.id = $1 AND ms.event_id = $2`,
      [submissionId, eventId]
    )

    if (submissionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Material submission not found' },
        { status: 404 }
      )
    }

    const submission = submissionResult.rows[0]

    const body = await request.json()
    const { score, feedback, criteriaScores, maxScore = 100 } = body

    if (score === undefined || score < 0 || score > maxScore) {
      return NextResponse.json(
        { error: `Score must be between 0 and ${maxScore}` },
        { status: 400 }
      )
    }

    // Insert or update the score
    const scoreResult = await query(
      `INSERT INTO material_scores (
        submission_id, judge_id, event_id, score, max_score, 
        feedback, criteria_scores
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (submission_id, judge_id)
      DO UPDATE SET
        score = EXCLUDED.score,
        max_score = EXCLUDED.max_score,
        feedback = EXCLUDED.feedback,
        criteria_scores = EXCLUDED.criteria_scores,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        submissionId,
        session.user.id,
        eventId,
        score,
        maxScore,
        feedback || null,
        JSON.stringify(criteriaScores || {})
      ]
    )

    // Ensure participant score record exists
    await query(
      `INSERT INTO participant_scores (
        event_id, participant_id, participant_name, participant_email
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (event_id, participant_id) DO NOTHING`,
      [
        eventId,
        submission.attendee_id,
        submission.attendee_name,
        submission.attendee_email
      ]
    )

    // Get the updated score with judge details
    const fullScoreResult = await query(
      `SELECT ms.*, u.name as judge_name, u.email as judge_email,
              sub.attendee_name, sub.attendee_email, sub.original_filename
       FROM material_scores ms
       JOIN users u ON ms.judge_id = u.id
       JOIN material_submissions sub ON ms.submission_id = sub.id
       WHERE ms.id = $1`,
      [scoreResult.rows[0].id]
    )

    return NextResponse.json(fullScoreResult.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error submitting score:', error)
    return NextResponse.json(
      { error: 'Failed to submit score', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// GET: Get scores for a material submission
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; requestId: string; submissionId: string }> }
) {
  try {
    const { id: eventId, submissionId } = await params
    const session = await verifyAuth(request)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user can view scores (admin, organizer, club lead, or judge)
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

    // Get all scores for this submission
    const scoresResult = await query(
      `SELECT ms.*, u.name as judge_name, u.email as judge_email,
              sub.attendee_name, sub.attendee_email, sub.original_filename
       FROM material_scores ms
       JOIN users u ON ms.judge_id = u.id
       JOIN material_submissions sub ON ms.submission_id = sub.id
       WHERE ms.submission_id = $1 AND ms.event_id = $2
       ORDER BY ms.scored_at DESC`,
      [submissionId, eventId]
    )

    return NextResponse.json(scoresResult.rows)
  } catch (error) {
    console.error('Error fetching scores:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scores', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}