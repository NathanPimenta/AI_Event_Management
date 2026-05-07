import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"

// GET: Get judge assignments for the current user
export async function GET(request: Request) {
  try {
    const session = await verifyAuth(request)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a judge
    if (session.user.role !== 'judge') {
      return NextResponse.json(
        { error: 'Only judges can access assignments' },
        { status: 403 }
      )
    }

    // Get all active judge assignments for this user
    const assignmentsResult = await query(
      `SELECT 
        ja.id,
        ja.event_id,
        ja.assigned_at,
        e.title as event_title,
        e.description as event_description,
        e.date as event_date,
        e.location as event_location,
        organizer.name as organizer_name
       FROM judge_assignments ja
       JOIN events e ON ja.event_id = e.id
       LEFT JOIN users organizer ON e.organizer_id = organizer.id
       WHERE ja.judge_id = $1 AND ja.status = 'active'
       ORDER BY e.date DESC`,
      [session.user.id]
    )

    // For each assignment, get material requests and scoring progress
    const assignments = []
    
    for (const assignment of assignmentsResult.rows) {
      // Get material requests for this event
      const requestsResult = await query(
        `SELECT 
          mr.id,
          mr.title,
          mr.description,
          mr.material_type,
          mr.due_date,
          COUNT(ms.id) as submission_count,
          COUNT(mscore.id) as scored_count
         FROM material_requests mr
         LEFT JOIN material_submissions ms ON mr.id = ms.request_id
         LEFT JOIN material_scores mscore ON ms.id = mscore.submission_id AND mscore.judge_id = $1
         WHERE mr.event_id = $2 AND mr.status = 'active'
         GROUP BY mr.id, mr.title, mr.description, mr.material_type, mr.due_date
         ORDER BY mr.due_date ASC`,
        [session.user.id, assignment.event_id]
      )

      assignments.push({
        id: assignment.id,
        event_id: assignment.event_id,
        assigned_at: assignment.assigned_at,
        event: {
          id: assignment.event_id,
          title: assignment.event_title,
          description: assignment.event_description,
          date: assignment.event_date,
          location: assignment.event_location,
          organizer_name: assignment.organizer_name
        },
        material_requests: requestsResult.rows
      })
    }

    return NextResponse.json(assignments)
  } catch (error) {
    console.error('Error fetching judge assignments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assignments', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}