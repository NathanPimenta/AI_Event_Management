import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"

// GET: Fetch material requests OR material submissions for an event
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'active'
    const judgeView = searchParams.get('judgeView')
    const judgeId = searchParams.get('judgeId')

    console.log('Materials API called - eventId:', id, 'judgeView:', judgeView, 'judgeId:', judgeId)

    // Add authentication for judge view
    if (judgeView === 'true') {
      const session = await verifyAuth(request)
      if (!session) {
        console.log('Authentication failed for judge view')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      console.log('Authenticated user:', session.user.id, 'requested judgeId:', judgeId)
    }

    // If judge view is requested, fetch submissions instead of requests
    if (judgeView === 'true' && judgeId) {
      console.log('Judge view requested - fetching submissions for event:', id, 'judge:', judgeId)
      
      // First, let's check if material_submissions table exists and has data
      const testSubmissionsResult = await query(
        `SELECT id, event_id, attendee_name FROM material_submissions WHERE event_id = $1`,
        [id]
      )
      console.log('All submissions for this event:', testSubmissionsResult.rows)
      
      const submissionsResult = await query(
        `SELECT 
          ms.id,
          ms.attendee_name as participant_name,
          ms.attendee_email as participant_email, 
          ms.file_type as submission_type,
          ms.file_path as file_url,
          ms.original_filename as description,
          ms.uploaded_at as submitted_at,
          mr.title as request_title,
          CASE 
            WHEN msc.id IS NOT NULL THEN true 
            ELSE false 
          END as scored
         FROM material_submissions ms
         LEFT JOIN material_requests mr ON ms.request_id = mr.id
         LEFT JOIN material_scores msc ON ms.id = msc.submission_id AND msc.judge_id = $2
         WHERE ms.event_id = $1
         ORDER BY ms.uploaded_at DESC`,
        [id, judgeId]
      )

      console.log('Found submissions for judge (with joins):', submissionsResult.rows)
      console.log('Raw query params - eventId:', id, 'judgeId:', judgeId)

      const materials = submissionsResult.rows.map(row => ({
        id: row.id,
        participant_name: row.participant_name,
        participant_email: row.participant_email,
        submission_type: row.submission_type,
        file_url: row.file_url,
        description: row.description,
        submitted_at: row.submitted_at,
        request_title: row.request_title,
        scored: row.scored
      }))

      return NextResponse.json({ materials })
    }

    // Default behavior - fetch material requests
    const result = await query(
      `SELECT 
        mr.id,
        mr.event_id,
        mr.created_by,
        mr.title,
        mr.description,
        mr.material_type,
        mr.file_format_allowed,
        mr.max_file_size_mb,
        mr.due_date,
        mr.is_mandatory,
        mr.status,
        mr.created_at,
        mr.updated_at,
        u.name as creator_name,
        COUNT(DISTINCT ms.id) as submission_count
      FROM material_requests mr
      LEFT JOIN users u ON mr.created_by = u.id
      LEFT JOIN material_submissions ms ON mr.id = ms.request_id
      WHERE mr.event_id = $1 AND mr.status = $2
      GROUP BY mr.id, mr.event_id, mr.created_by, mr.title, mr.description, 
               mr.material_type, mr.file_format_allowed, mr.max_file_size_mb,
               mr.due_date, mr.is_mandatory, mr.status, mr.created_at, 
               mr.updated_at, u.id, u.name
      ORDER BY mr.created_at DESC`,
      [id, status]
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching materials:', error)
    return NextResponse.json(
      { error: 'Failed to fetch materials', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// POST: Create a new material request (admin only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await verifyAuth(request)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      title,
      description,
      material_type,
      file_format_allowed,
      max_file_size_mb = 50,
      due_date,
      is_mandatory = true
    } = body

    // Verify user is event organizer or admin
    const eventResult = await query(
      `SELECT organizer_id FROM events WHERE id = $1`,
      [id]
    )

    if (eventResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    const event = eventResult.rows[0]
    if (event.organizer_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Only event organizer can create material requests' },
        { status: 403 }
      )
    }

    // Create material request
    const result = await query(
      `INSERT INTO material_requests (
        event_id,
        created_by,
        title,
        description,
        material_type,
        file_format_allowed,
        max_file_size_mb,
        due_date,
        is_mandatory,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
      RETURNING *`,
      [
        id,
        session.user.id,
        title,
        description,
        material_type,
        file_format_allowed,
        max_file_size_mb,
        due_date,
        is_mandatory
      ]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error creating material request:', error)
    return NextResponse.json(
      { error: 'Failed to create material request', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
