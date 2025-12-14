import { NextResponse } from "next/server"
import { getClubById, updateClubMemberRole } from "@/lib/db"

export async function PUT(
  request: Request,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const clubId = params.id
    const userId = params.userId
    const { role } = await request.json()

    // Verify club exists
    const club = await getClubById(clubId)
    if (!club) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 })
    }

    // Check if member exists in club
    const member = club.members?.find((m: any) => m.userId === userId)
    if (!member) {
      return NextResponse.json({ error: "Member not found in club" }, { status: 404 })
    }

    // Update member role
    await updateClubMemberRole(clubId, userId, role)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating member role:", error)
    return NextResponse.json(
      { error: "An error occurred while updating member role" },
      { status: 500 }
    )
  }
}