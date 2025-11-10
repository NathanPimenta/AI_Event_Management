import { NextResponse } from "next/server"
import { getClubById, updateClubMemberRoles } from "@/lib/db"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const clubId = params.id
    const { teams } = await request.json()

    // Verify club exists
    const club = await getClubById(clubId)
    if (!club) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 })
    }

    // Update member roles based on team assignments
    const roleUpdates = teams.flatMap((team: any) =>
      team.members.map((member: any) => ({
        userId: member.userId,
        role: member.suggestedRole,
      }))
    )

    await updateClubMemberRoles(clubId, roleUpdates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error assigning teams:", error)
    return NextResponse.json(
      { error: "An error occurred while assigning teams" },
      { status: 500 }
    )
  }
}