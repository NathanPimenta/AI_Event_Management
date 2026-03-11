import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // Check if judge_assignments table exists and get all assignments
    const { data: allJudgeAssignments, error: judgeError } = await supabase
      .from('judge_assignments')
      .select('*')
    
    // Get current user
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', userId || '')
      .limit(1)

    // Get all events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, start_date, end_date')
      .limit(10)

    // Get assignments for this specific user
    const { data: userAssignments, error: userAssignError } = await supabase
      .from('judge_assignments')
      .select(`
        *,
        events!inner(
          id,
          title,
          start_date,
          end_date
        )
      `)
      .eq('user_id', userId || '')

    return NextResponse.json({
      debug: {
        request_userId: userId,
        current_user: users?.[0] || null,
        all_judge_assignments: allJudgeAssignments || [],
        user_specific_assignments: userAssignments || [],
        available_events: events || [],
        errors: {
          judgeError: judgeError?.message,
          usersError: usersError?.message,
          eventsError: eventsError?.message,
          userAssignError: userAssignError?.message
        }
      }
    })
  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json(
      { error: 'Debug failed', details: error },
      { status: 500 }
    )
  }
}