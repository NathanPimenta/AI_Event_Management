import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    console.log('Judge events API called with userId:', userId)

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // First, get judge assignments
    const { data: judgeAssignments, error: assignmentsError } = await supabase
      .from('judge_assignments')
      .select('event_id')
      .eq('user_id', userId)

    console.log('Judge assignments query result:', { judgeAssignments, assignmentsError })

    if (assignmentsError) {
      console.error('Error fetching judge assignments:', assignmentsError)
      return NextResponse.json(
        { error: 'Failed to fetch judge assignments', details: assignmentsError.message },
        { status: 500 }
      )
    }

    // If no assignments found, return empty array
    if (!judgeAssignments || judgeAssignments.length === 0) {
      console.log('No judge assignments found for user')
      return NextResponse.json({ events: [] })
    }

    // Get event details for assigned events
    const eventIds = judgeAssignments.map(a => a.event_id)
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, description, start_date, end_date')
      .in('id', eventIds)

    if (eventsError) {
      console.error('Error fetching events:', eventsError)
      return NextResponse.json(
        { error: 'Failed to fetch events', details: eventsError.message },
        { status: 500 }
      )
    }

    // Build response with basic data first
    const eventsWithCounts = await Promise.all(
      (events || []).map(async (event) => {
        try {
          // Get submission count
          const { count: submissionCount } = await supabase
            .from('material_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id)

          // Get scored count (simplified approach)
          let scoredCount = 0
          try {
            // First get all submissions for this event 
            const { data: submissions } = await supabase
              .from('material_submissions')
              .select('id')
              .eq('event_id', event.id)

            if (submissions && submissions.length > 0) {
              const submissionIds = submissions.map(s => s.id)
              
              // Then count scores by this judge for these submissions
              const { count } = await supabase
                .from('material_scores')
                .select('*', { count: 'exact', head: true })
                .eq('judge_id', userId)
                .in('submission_id', submissionIds)
              
              scoredCount = count || 0
            }
          } catch (error) {
            console.error('Error counting scored submissions:', error)
            scoredCount = 0
          }

          // Determine event status based on dates
          const now = new Date()
          const startDate = new Date(event.start_date)
          const endDate = new Date(event.end_date)
          
          let status: 'upcoming' | 'active' | 'completed'
          if (now < startDate) {
            status = 'upcoming'
          } else if (now > endDate) {
            status = 'completed'
          } else {
            status = 'active'
          }

          return {
            id: event.id,
            title: event.title,
            description: event.description,
            start_date: event.start_date,
            end_date: event.end_date,
            status,
            submission_count: submissionCount || 0,
            scored_submissions: scoredCount
          }
        } catch (error) {
          console.error('Error processing event:', event.id, error)
          // Return basic event data even if counting fails
          return {
            id: event.id,
            title: event.title,
            description: event.description,
            start_date: event.start_date,
            end_date: event.end_date,
            status: 'active' as const,
            submission_count: 0,
            scored_submissions: 0
          }
        }
      })
    )

    console.log('Returning events:', eventsWithCounts)
    return NextResponse.json({ events: eventsWithCounts })

  } catch (error) {
    console.error('Error in judge events API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    )
  }
}