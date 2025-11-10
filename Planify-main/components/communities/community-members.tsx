"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Mail } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface CommunityMembersProps {
  communityId: string
  isAdmin: boolean
  members: any[]
  onMemberUpdated?: () => void
}

export default function CommunityMembers({ communityId, isAdmin, members = [], onMemberUpdated }: CommunityMembersProps) {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null)
  const [isPromoting, setIsPromoting] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const filteredMembers = members.filter(
    (member) =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handlePromoteToAdmin = async (memberId: string) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to perform this action",
        variant: "destructive",
      })
      return
    }

    setIsPromoting(true)
    try {
      const response = await fetch(`/api/communities/${communityId}/members/${memberId}/promote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestingUserId: user.id }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to promote member')
      }

      toast({
        title: "Member promoted",
        description: "Member has been promoted to admin",
      })

      // Refresh the members list
      if (onMemberUpdated) {
        onMemberUpdated()
      }
    } catch (error: any) {
      console.error("Error promoting member:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to promote member",
        variant: "destructive",
      })
    } finally {
      setIsPromoting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to perform this action",
        variant: "destructive",
      })
      return
    }

    setIsRemoving(true)
    try {
      const response = await fetch(`/api/communities/${communityId}/members/${memberId}?requestingUserId=${user.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove member')
      }

      toast({
        title: "Member removed",
        description: "Member has been removed from the community",
      })

      // Refresh the members list
      if (onMemberUpdated) {
        onMemberUpdated()
      }
    } catch (error: any) {
      console.error("Error removing member:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      })
    } finally {
      setIsRemoving(false)
      setMemberToRemove(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Community Members</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No members found</p>
            </div>
          ) : (
            filteredMembers.map((member) => (
              <div key={member.userId} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={member.image} alt={member.name} />
                    <AvatarFallback>{member.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {member.name}
                      {member.role === "admin" && (
                        <Badge variant="default" className="text-xs">
                          Admin
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{member.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Mail className="h-4 w-4" />
                  </Button>
                  {isAdmin && member.role !== "admin" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={isPromoting || isRemoving}>
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Member Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handlePromoteToAdmin(member.userId)}
                          disabled={isPromoting}
                        >
                          {isPromoting ? 'Promoting...' : 'Promote to Admin'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setMemberToRemove(member.userId)}
                          disabled={isRemoving}
                          className="text-destructive"
                        >
                          Remove from Community
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the member from the community. They will lose access to all clubs and events in this community.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => memberToRemove && handleRemoveMember(memberToRemove)}
                disabled={isRemoving}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isRemoving ? 'Removing...' : 'Remove Member'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

