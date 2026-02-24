import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"

// GET: Fetch material requests for an event
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'active'

    // Fetch material requests
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
    console.error('Error fetching material requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch material requests', details: error instanceof Error ? error.message : String(error) },
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
