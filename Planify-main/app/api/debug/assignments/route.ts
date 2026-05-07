import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // Get all judge assignments for debugging
    const allAssignments = await query(
      `SELECT ja.*, u.name as judge_name, u.email as judge_email, e.title as event_title
       FROM judge_assignments ja
       JOIN users u ON ja.judge_id = u.id  
       JOIN events e ON ja.event_id = e.id
       ORDER BY ja.assigned_at DESC
       LIMIT 20`
    )

    // Get specific user assignments if userId provided
    let userAssignments = []
    if (userId) {
      const userResult = await query(
        `SELECT ja.*, u.name as judge_name, u.email as judge_email, e.title as event_title
         FROM judge_assignments ja
         JOIN users u ON ja.judge_id = u.id  
         JOIN events e ON ja.event_id = e.id
         WHERE ja.judge_id = $1
         ORDER BY ja.assigned_at DESC`,
        [userId]
      )
      userAssignments = userResult.rows
    }

    // Get user info if userId provided
    let userInfo = null
    if (userId) {
      const userResult = await query(
        `SELECT id, email, name, role FROM users WHERE id = $1`,
        [userId]
      )
      userInfo = userResult.rows[0] || null
    }

    return NextResponse.json({
      userInfo,
      userAssignments,
      allAssignments: allAssignments.rows
    })
  } catch (error) {
    console.error('Debug assignments error:', error)
    return NextResponse.json(
      { error: 'Debug failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}