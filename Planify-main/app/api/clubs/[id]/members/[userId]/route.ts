import { NextRequest, NextResponse } from 'next/server'
import { removeMemberFromClub, getClubById } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: clubId, userId } = await params
    const { searchParams } = new URL(request.url)
    const requestingUserId = searchParams.get('requestingUserId')

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
      return NextResponse.json({ error: 'Forbidden: Only club leads can remove members' }, { status: 403 })
    }

    // Prevent removing all leads
    const leadCount = club.members?.filter((m: any) => m.role === 'lead').length || 0
    const isTargetLead = club.members?.some((m: any) => m.userId === userId && m.role === 'lead')
    
    if (isTargetLead && leadCount <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last lead from the club' }, { status: 400 })
    }

    // Remove the member
    const removedMember = await removeMemberFromClub(clubId, userId)

    if (!removedMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Member removed from club successfully',
      member: removedMember
    })
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }
}
