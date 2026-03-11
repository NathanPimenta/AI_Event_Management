import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"

// POST: Assign judge to an event
export async function POST(
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

    const body = await request.json()
    const { judgeEmail } = body

    if (!judgeEmail) {
      return NextResponse.json(
        { error: 'Judge email is required' },
        { status: 400 }
      )
    }

    // Check if user can assign judges (admin or club lead)
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

    // Check permissions: community admin, event organizer, or club lead
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

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Only community admins, event organizers, or club leads can assign judges' },
        { status: 403 }
      )
    }

    // Find the user by email
    const userResult = await query(
      `SELECT id, name, email, role FROM users WHERE email = $1`,
      [judgeEmail]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User with this email not found' },
        { status: 404 }
      )
    }

    const judgeUser = userResult.rows[0]

    // Update user role to judge if not already
    if (judgeUser.role !== 'judge') {
      await query(
        `UPDATE users SET role = 'judge', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [judgeUser.id]
      )
    }

    // Check if judge is already assigned to this event (any status)
    const existingAssignmentResult = await query(
      `SELECT * FROM judge_assignments 
       WHERE event_id = $1 AND judge_id = $2`,
      [eventId, judgeUser.id]
    )

    if (existingAssignmentResult.rows.length > 0) {
      const existingAssignment = existingAssignmentResult.rows[0]
      
      if (existingAssignment.status === 'active') {
        return NextResponse.json(
          { error: 'User is already assigned as judge for this event' },
          { status: 400 }
        )
      } else {
        // Reactivate the existing assignment instead of creating new one
        await query(
          `UPDATE judge_assignments 
           SET status = 'active', assigned_at = CURRENT_TIMESTAMP, assigned_by = $1 
           WHERE event_id = $2 AND judge_id = $3`,
          [session.user.id, eventId, judgeUser.id]
        )
        
        // Get the updated assignment with judge details
        const fullAssignmentResult = await query(
          `SELECT ja.*, u.name as judge_name, u.email as judge_email,
                  assigner.name as assigned_by_name
           FROM judge_assignments ja
           JOIN users u ON ja.judge_id = u.id
           LEFT JOIN users assigner ON ja.assigned_by = assigner.id
           WHERE ja.event_id = $1 AND ja.judge_id = $2`,
          [eventId, judgeUser.id]
        )
        
        return NextResponse.json(fullAssignmentResult.rows[0], { status: 201 })
      }
    }

    // Create judge assignment
    const assignmentResult = await query(
      `INSERT INTO judge_assignments (event_id, judge_id, assigned_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [eventId, judgeUser.id, session.user.id]
    )

    // Get the assignment with judge details
    const fullAssignmentResult = await query(
      `SELECT ja.*, u.name as judge_name, u.email as judge_email,
              assigner.name as assigned_by_name
       FROM judge_assignments ja
       JOIN users u ON ja.judge_id = u.id
       LEFT JOIN users assigner ON ja.assigned_by = assigner.id
       WHERE ja.id = $1`,
      [assignmentResult.rows[0].id]
    )

    return NextResponse.json(fullAssignmentResult.rows[0], { status: 201 })
  } catch (error) {
    console.error('Error assigning judge:', error)
    return NextResponse.json(
      { error: 'Failed to assign judge', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// GET: Get all judges for an event
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

    // Verify event exists and user has permission to view judges
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
    if (!hasPermission) {
      const judgeResult = await query(
        `SELECT * FROM judge_assignments 
         WHERE event_id = $1 AND judge_id = $2 AND status = 'active'`,
        [eventId, session.user.id]
      )
      hasPermission = judgeResult.rows.length > 0
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view judges' },
        { status: 403 }
      )
    }

    // Get all active judges for the event
    const judgesResult = await query(
      `SELECT ja.*, u.name as judge_name, u.email as judge_email,
              assigner.name as assigned_by_name
       FROM judge_assignments ja
       JOIN users u ON ja.judge_id = u.id
       LEFT JOIN users assigner ON ja.assigned_by = assigner.id
       WHERE ja.event_id = $1 AND ja.status = 'active'
       ORDER BY ja.assigned_at DESC`,
      [eventId]
    )

    return NextResponse.json(judgesResult.rows)
  } catch (error) {
    console.error('Error fetching judges:', error)
    return NextResponse.json(
      { error: 'Failed to fetch judges', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}