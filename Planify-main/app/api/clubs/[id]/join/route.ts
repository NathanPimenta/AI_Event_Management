import { NextResponse } from "next/server"
import { getClubById, addMemberToClub } from "@/lib/db"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Get club to verify it exists
    const club = await getClubById(id)
    if (!club) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 })
    }

    // Check if user is already a member
    const isAlreadyMember = club.members && club.members.some((member: any) => member.userId === userId)
    if (isAlreadyMember) {
      return NextResponse.json({ error: "You are already a member of this club" }, { status: 400 })
    }

    // Add user to club
    await addMemberToClub(id, {
      userId,
      role: 'member',
    })

    console.log(`✅ User ${userId} joined club ${id}`)

    return NextResponse.json({ 
      success: true, 
      message: `Successfully joined ${club.name}` 
    })
  } catch (error) {
    console.error("Error joining club:", error)
    return NextResponse.json({ error: "An error occurred while joining the club" }, { status: 500 })
  }
}
