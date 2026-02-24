import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"

// GET: Get attendee-wise submission summary
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

    // Verify user is event organizer
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
        { error: 'Only event organizer can view submissions' },
        { status: 403 }
      )
    }

    // Get all attendees with their submission status for each material request
    const result = await query(
      `SELECT 
        ea.id as attendee_id,
        ea.name,
        ea.email,
        ea.registered_at,
        jsonb_agg(
          jsonb_build_object(
            'request_id', mr.id,
            'request_title', mr.title,
            'material_type', mr.material_type,
            'due_date', mr.due_date,
            'is_mandatory', mr.is_mandatory,
            'submission_id', ms.id,
            'file_name', ms.file_name,
            'file_path', ms.file_path,
            'original_filename', ms.original_filename,
            'uploaded_at', ms.uploaded_at,
            'file_size_bytes', ms.file_size_bytes,
            'submitted', (ms.id IS NOT NULL)
          )
        ) as submissions
      FROM event_attendees ea
      CROSS JOIN material_requests mr
      LEFT JOIN material_submissions ms 
        ON ms.request_id = mr.id 
        AND ms.attendee_id = ea.user_id
      WHERE ea.event_id = $1 AND mr.event_id = $1 AND mr.status = 'active'
      GROUP BY ea.id, ea.name, ea.email, ea.registered_at
      ORDER BY ea.name ASC`,
      [id]
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching attendee submissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submission status', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
