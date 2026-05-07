import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/postgres'

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

    try {
      // First, get judge assignments
      const judgeAssignmentsResult = await query(
        `SELECT event_id FROM judge_assignments 
         WHERE judge_id = $1 AND status = 'active'`,
        [userId]
      )

      console.log('Judge assignments query result:', judgeAssignmentsResult.rows)

      // If no assignments found, return empty array
      if (!judgeAssignmentsResult.rows || judgeAssignmentsResult.rows.length === 0) {
        console.log('No judge assignments found for user')
        return NextResponse.json({ events: [] })
      }

      // Get event details for assigned events
      const eventIds = judgeAssignmentsResult.rows.map(a => a.event_id)
      const placeholders = eventIds.map((_, index) => `$${index + 1}`).join(',')
      
      const eventsResult = await query(
        `SELECT id, title, description, date, end_date 
         FROM events 
         WHERE id IN (${placeholders})`,
        eventIds
      )

      console.log('Events found:', eventsResult.rows.length)

      // Build response with basic data first
      const eventsWithCounts = await Promise.all(
        eventsResult.rows.map(async (event) => {
          try {
            // Get submission count
            let submissionCount = 0
            try {
              const submissionResult = await query(
                `SELECT COUNT(*) as count FROM material_submissions WHERE event_id = $1`,
                [event.id]
              )
              submissionCount = parseInt(submissionResult.rows[0]?.count || '0')
            } catch (error) {
              console.warn('Could not fetch submission count for event:', event.id, error)
            }

            // Get scored count for this judge
            let scoredCount = 0
            try {
              const scoredResult = await query(
                `SELECT COUNT(DISTINCT ms.submission_id) as count 
                 FROM material_scores ms
                 JOIN material_submissions sub ON ms.submission_id = sub.id
                 WHERE sub.event_id = $1 AND ms.judge_id = $2`,
                [event.id, userId]
              )
              scoredCount = parseInt(scoredResult.rows[0]?.count || '0')
            } catch (error) {
              console.warn('Could not fetch scored count for event:', event.id, error)
            }

            // Determine event status based on dates
            const now = new Date()
            const startDate = new Date(event.date)
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
              start_date: event.date,
              end_date: event.end_date,
              status,
              submission_count: submissionCount,
              scored_submissions: scoredCount
            }
          } catch (error) {
            console.error('Error processing event:', event.id, error)
            // Return basic event data even if counting fails
            return {
              id: event.id,
              title: event.title,
              description: event.description,
              start_date: event.date,
              end_date: event.end_date,
              status: 'active',
              submission_count: 0,
              scored_submissions: 0
            }
          }
        })
      )

      return NextResponse.json({ events: eventsWithCounts })
    } catch (dbError: any) {
      console.error('Database connection error:', dbError?.message)
      
      // If it's a connection error, return a user-friendly response with empty events
      if (dbError?.message?.includes('ENOTFOUND') || dbError?.message?.includes('connect')) {
        console.warn('Database connection issue, returning empty events')
        return NextResponse.json({ events: [] })
      }
      
      // Re-throw for other database errors
      throw dbError
    }
  } catch (error) {
    console.error('Error in judge events endpoint:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}