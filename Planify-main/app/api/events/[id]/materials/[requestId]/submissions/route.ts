import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

// POST: Upload material submission
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id, requestId } = await params
    const session = await verifyAuth(request)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify material request exists and is active
    const requestResult = await query(
      `SELECT mr.* FROM material_requests mr
       WHERE mr.id = $1 AND mr.event_id = $2 AND mr.status = 'active'`,
      [requestId, id]
    )

    if (requestResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Material request not found or is inactive' },
        { status: 404 }
      )
    }

    const materialRequest = requestResult.rows[0]

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

    const attendee = attendeeResult.rows[0]

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > materialRequest.max_file_size_mb) {
      return NextResponse.json(
        { error: `File size exceeds limit of ${materialRequest.max_file_size_mb}MB` },
        { status: 400 }
      )
    }

    // Validate file format if specified
    if (materialRequest.file_format_allowed) {
      const allowedFormats = materialRequest.file_format_allowed.split(',').map(f => f.trim())
      const fileExt = '.' + file.name.split('.').pop()
      if (!allowedFormats.includes(fileExt)) {
        return NextResponse.json(
          { error: `File format not allowed. Allowed formats: ${materialRequest.file_format_allowed}` },
          { status: 400 }
        )
      }
    }

    // Create upload directory
    const uploadDir = join(
      process.cwd(),
      'public',
      'uploads',
      'materials',
      id,
      requestId
    )

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    const fileExtension = file.name.split('.').pop()
    const newFileName = `${session.user.id}-${timestamp}-${randomStr}.${fileExtension}`
    const filePath = join(uploadDir, newFileName)

    // Save file
    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    // Store submission in database
    const submissionResult = await query(
      `INSERT INTO material_submissions (
        request_id,
        event_id,
        attendee_id,
        attendee_name,
        attendee_email,
        file_name,
        file_path,
        file_size_bytes,
        file_type,
        original_filename
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (request_id, attendee_id)
      DO UPDATE SET
        file_name = EXCLUDED.file_name,
        file_path = EXCLUDED.file_path,
        file_size_bytes = EXCLUDED.file_size_bytes,
        file_type = EXCLUDED.file_type,
        original_filename = EXCLUDED.original_filename,
        uploaded_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        requestId,
        id,
        session.user.id,
        session.user.name,
        session.user.email,
        newFileName,
        `/uploads/materials/${id}/${requestId}/${newFileName}`,
        file.size,
        file.type,
        file.name
      ]
    )

    return NextResponse.json(submissionResult.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error uploading material:', error)
    return NextResponse.json(
      { error: 'Failed to upload material', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// GET: Get submissions for a material request
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id, requestId } = await params
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

    // Fetch all submissions for this material request
    const result = await query(
      `SELECT 
        ms.id,
        ms.request_id,
        ms.event_id,
        ms.attendee_id,
        ms.attendee_name,
        ms.attendee_email,
        ms.file_name,
        ms.file_path,
        ms.file_size_bytes,
        ms.file_type,
        ms.original_filename,
        ms.uploaded_at,
        mr.title as request_title,
        mr.material_type
      FROM material_submissions ms
      JOIN material_requests mr ON ms.request_id = mr.id
      WHERE ms.request_id = $1 AND ms.event_id = $2
      ORDER BY ms.uploaded_at DESC`,
      [requestId, id]
    )

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Error fetching submissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submissions', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
