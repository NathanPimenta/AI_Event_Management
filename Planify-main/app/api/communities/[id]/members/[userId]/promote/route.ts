import { NextRequest, NextResponse } from 'next/server'
import { promoteCommunityMemberToAdmin, getCommunityById } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: communityId, userId } = await params
    const body = await request.json()
    const { requestingUserId } = body

    if (!requestingUserId) {
      return NextResponse.json({ error: 'Requesting user ID is required' }, { status: 400 })
    }

    // Get community to check if requesting user is admin
    const community = await getCommunityById(communityId)
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 })
    }

    // Check if requesting user is community admin or owner
    const isOwner = community.adminId === requestingUserId
    const memberRole = community.members?.find((m: any) => m.userId === requestingUserId)?.role

    if (!isOwner && memberRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Only community admins can promote members' }, { status: 403 })
    }

    // Promote the member
    const updatedMember = await promoteCommunityMemberToAdmin(communityId, userId)

    if (!updatedMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Member promoted to admin successfully',
      member: updatedMember
    })
  } catch (error) {
    console.error('Error promoting member:', error)
    return NextResponse.json({ error: 'Failed to promote member' }, { status: 500 })
  }
}
