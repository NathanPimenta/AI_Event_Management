import { NextResponse } from "next/server"
import { query } from "@/lib/postgres"
import { addMemberToClub } from "@/lib/db"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params
    
    const result = await query(`
      SELECT cm.*, u.name as user_name, u.email as user_email, u.image as user_image
      FROM club_members cm
      INNER JOIN users u ON cm.user_id = u.id
      WHERE cm.club_id = $1
      ORDER BY cm.joined_at DESC
    `, [id])

    const members = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      userImage: row.user_image,
      role: row.role,
      joinedAt: row.joined_at
    }))

    return NextResponse.json(members)
  } catch (error) {
    console.error("Error fetching club members:", error)
    return NextResponse.json(
      { error: "An error occurred while fetching club members" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params
    const { userId } = await request.json()

    const member = await addMemberToClub(id, { userId, role: 'member' })

    return NextResponse.json(member)
  } catch (error) {
    console.error("Error adding club member:", error)
    return NextResponse.json(
      { error: "An error occurred while adding the member" },
      { status: 500 }
    )
  }
}
