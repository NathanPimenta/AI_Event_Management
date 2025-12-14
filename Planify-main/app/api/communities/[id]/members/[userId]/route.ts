import { NextRequest, NextResponse } from 'next/server'
import { removeMemberFromCommunity, getCommunityById } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: communityId, userId } = await params
    const { searchParams } = new URL(request.url)
    const requestingUserId = searchParams.get('requestingUserId')

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
      return NextResponse.json({ error: 'Forbidden: Only community admins can remove members' }, { status: 403 })
    }

    // Prevent removing the community owner
    if (userId === community.adminId) {
      return NextResponse.json({ error: 'Cannot remove the community owner' }, { status: 400 })
    }

    // Remove the member
    const removedMember = await removeMemberFromCommunity(communityId, userId)

    if (!removedMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Member removed from community successfully',
      member: removedMember
    })
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }
}
