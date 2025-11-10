import { NextRequest, NextResponse } from 'next/server'
import { promoteClubMemberToLead, getClubById } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: clubId, userId } = await params
    const body = await request.json()
    const { requestingUserId } = body

    if (!requestingUserId) {
      return NextResponse.json({ error: 'Requesting user ID is required' }, { status: 400 })
    }

    // Get club to check if requesting user is a lead
    const club = await getClubById(clubId)
    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 })
    }

    // Check if requesting user is a club lead
    const isLead = club.members?.some((m: any) => m.userId === requestingUserId && m.role === 'lead')

    if (!isLead) {
      return NextResponse.json({ error: 'Forbidden: Only club leads can promote members' }, { status: 403 })
    }

    // Promote the member
    const updatedMember = await promoteClubMemberToLead(clubId, userId)

    if (!updatedMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Member promoted to lead successfully',
      member: updatedMember
    })
  } catch (error) {
    console.error('Error promoting member:', error)
    return NextResponse.json({ error: 'Failed to promote member' }, { status: 500 })
  }
}
