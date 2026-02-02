import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"

// GET: Get current user's submissions for all requests in an event
export async function GET(
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

    // Verify user is attendee of the event
    const attendeeResult = await query(
      `SELECT * FROM event_attendees 
       WHERE event_id = $1 AND user_id = $2`,
      [id, session.user.id]
    )

    if (attendeeResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'You must be registered for this event' },
        { status: 403 }
      )
    }

    // Fetch all material requests and user's submissions
    const result = await query(
      `SELECT 
        mr.id as request_id,
        mr.title,
        mr.description,
        mr.material_type,
        mr.file_format_allowed,
        mr.max_file_size_mb,
        mr.due_date,
        mr.is_mandatory,
        mr.created_at,
        u.name as created_by_name,
        ms.id as submission_id,
        ms.file_name,
        ms.file_path,
        ms.original_filename,
        ms.uploaded_at,
        ms.file_size_bytes,
        (ms.id IS NOT NULL) as has_submitted,
        (mr.due_date > CURRENT_TIMESTAMP) as is_pending,
        CASE 
          WHEN ms.id IS NOT NULL THEN 'submitted'
          WHEN mr.due_date < CURRENT_TIMESTAMP THEN 'overdue'
          ELSE 'pending'
        END as status
      FROM material_requests mr
      LEFT JOIN users u ON mr.created_by = u.id
      LEFT JOIN material_submissions ms 
        ON ms.request_id = mr.id 
        AND ms.attendee_id = $1
      WHERE mr.event_id = $2 AND mr.status = 'active'
      ORDER BY mr.due_date ASC`,
      [session.user.id, id]
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching user submissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch your submissions', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
