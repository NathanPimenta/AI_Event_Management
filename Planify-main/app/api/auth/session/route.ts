import { NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const session = await verifyAuth(request)
    
    if (!session) {
      return NextResponse.json(
        { error: 'No active session' },
        { status: 401 }
      )
    }

    return NextResponse.json(session)
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}
