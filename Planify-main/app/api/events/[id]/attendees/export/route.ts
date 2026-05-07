import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"

// Helper to create Excel file using CSV format (compatible with Excel)
function createExcelCSV(attendees: any[], eventTitle: string) {
  const headers = ["Name", "Email", "Registration Date", "User ID"]
  
  // Create CSV content
  let csv = headers.join(",") + "\n"
  
  attendees.forEach((attendee) => {
    const row = [
      `"${attendee.name?.replace(/"/g, '""') || ''}"`,
      `"${attendee.email?.replace(/"/g, '""') || ''}"`,
      `"${attendee.registeredAt ? new Date(attendee.registeredAt).toISOString().split('T')[0] : ''}"`,
      `"${attendee.userId || ''}"`,
    ]
    csv += row.join(",") + "\n"
  })
  
  return csv
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const eventTitle = searchParams.get('title') || 'Event'
    
    // Fetch event details
    const eventResult = await query(
      `SELECT title FROM events WHERE id = $1`,
      [id]
    )
    
    if (eventResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      )
    }

    const event = eventResult.rows[0]
    
    // Fetch attendees
    const result = await query(
      `SELECT 
        ea.id,
        ea.name,
        ea.email,
        ea.registered_at as "registeredAt",
        ea.user_id as "userId"
       FROM event_attendees ea
       WHERE ea.event_id = $1
       ORDER BY ea.registered_at DESC`,
      [id]
    )

    const attendees = result.rows
    
    // Create CSV content
    const csvContent = createExcelCSV(attendees, event.title)
    
    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_attendees_${timestamp}.csv`
    
    // Return as Excel-compatible file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Error exporting attendees:", error)
    return NextResponse.json(
      { error: "An error occurred while exporting attendees" },
      { status: 500 }
    )
  }
}
