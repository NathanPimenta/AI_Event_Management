"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Mail, UserPlus } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ClubMembersProps {
  clubId: string
  isLead?: boolean
  onMemberUpdated?: () => void
}

export default function ClubMembers({ clubId, isLead = false, onMemberUpdated }: ClubMembersProps) {
  const { user } = useAuth()
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null)
  const [isPromoting, setIsPromoting] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  useEffect(() => {
    fetchMembers()
  }, [clubId])

  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/clubs/${clubId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch club members")
      }

      const data = await response.json()
      setMembers(data.members || [])
    } catch (error) {
      console.error("Error fetching members:", error)
      toast({
        title: "Error",
        description: "Failed to load club members",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredMembers = members.filter(
    (member) =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return

    setInviting(true)

    try {
      // TODO: Implement invite member API
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Invitation sent",
        description: `An invitation has been sent to ${inviteEmail}`,
      })

      setInviteEmail("")
      setInviteDialogOpen(false)
    } catch (error) {
      console.error("Failed to send invitation:", error)
      toast({
        title: "Invitation failed",
        description: "There was an error sending the invitation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setInviting(false)
    }
  }

  const handlePromoteToLead = async (memberId: string) => {
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
      const response = await fetch(`/api/clubs/${clubId}/members/${memberId}/promote`, {
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
        description: "Member has been promoted to club lead",
      })

      // Refresh the members list
      await fetchMembers()
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
      const response = await fetch(`/api/clubs/${clubId}/members/${memberId}?requestingUserId=${user.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove member')
      }

      toast({
        title: "Member removed",
        description: "Member has been removed from the club",
      })

      // Refresh the members list
      await fetchMembers()
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
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Club Members</CardTitle>
            <CardDescription>Manage members and their roles</CardDescription>
          </div>
          {isLead && (
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite New Member</DialogTitle>
                  <DialogDescription>Send an invitation to join this club</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email Address
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter email address"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                    {inviting ? "Sending..." : "Send Invitation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
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

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-sm text-muted-foreground">Loading members...</p>
            </div>
          ) : (
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
                          {member.role === "lead" && (
                            <Badge variant="default" className="text-xs">
                              Lead
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
                      {isLead && member.role !== "lead" && (
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
                              onClick={() => handlePromoteToLead(member.userId)}
                              disabled={isPromoting}
                            >
                              {isPromoting ? 'Promoting...' : 'Promote to Lead'}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setMemberToRemove(member.userId)}
                              disabled={isRemoving}
                              className="text-destructive"
                            >
                              Remove from Club
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the member from the club. They will lose access to all club events and tasks.
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
    </div>
  )
}

