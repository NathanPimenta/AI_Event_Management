import { NextResponse } from "next/server"
import { getUserClubs } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const clubs = await getUserClubs(userId)
    
    return NextResponse.json(clubs)
  } catch (error) {
    console.error("Error fetching user clubs:", error)
    return NextResponse.json({ error: "An error occurred while fetching your clubs" }, { status: 500 })
  }
}
