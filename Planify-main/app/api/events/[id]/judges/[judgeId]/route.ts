import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { verifyAuth } from "@/lib/auth"

// DELETE: Revoke judge assignment
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; judgeId: string }> }
) {
  try {
    const { id: eventId, judgeId } = await params
    const session = await verifyAuth(request)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user can revoke judges (admin or club lead)
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
        { error: 'Only community admins, event organizers, or club leads can revoke judge assignments' },
        { status: 403 }
      )
    }

    // Check if judge assignment exists
    const assignmentResult = await query(
      `SELECT * FROM judge_assignments 
       WHERE event_id = $1 AND judge_id = $2 AND status = 'active'`,
      [eventId, judgeId]
    )

    if (assignmentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Judge assignment not found or already revoked' },
        { status: 404 }
      )
    }

    // Revoke the assignment
    await query(
      `UPDATE judge_assignments 
       SET status = 'revoked'
       WHERE event_id = $1 AND judge_id = $2 AND status = 'active'`,
      [eventId, judgeId]
    )

    // Check if judge has other active assignments, if not, revert role to community_member
    const otherAssignmentsResult = await query(
      `SELECT COUNT(*) as count FROM judge_assignments 
       WHERE judge_id = $1 AND status = 'active'`,
      [judgeId]
    )

    if (otherAssignmentsResult.rows[0].count === 0) {
      await query(
        `UPDATE users SET role = 'community_member', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND role = 'judge'`,
        [judgeId]
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Judge assignment revoked successfully' 
    })
  } catch (error) {
    console.error('Error revoking judge assignment:', error)
    return NextResponse.json(
      { error: 'Failed to revoke judge assignment', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}