"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Users, Settings, Copy } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useState, useEffect } from "react"
import { toast } from "@/hooks/use-toast"
import { Protected } from "@/components/protected"

type Community = {
  id: string
  name: string
  description: string
  memberCount: number
  role: string
  inviteCode: string
}

export default function DashboardCommunities() {
  const { user } = useAuth()
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      fetchCommunities()
    }
  }, [user?.id])

  const fetchCommunities = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/communities?userId=${user?.id}`)
      if (response.ok) {
        const data = await response.json()
        setCommunities(data)
      }
    } catch (error) {
      console.error('Failed to fetch communities:', error)
      toast({
        title: "Error",
        description: "Failed to load communities",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast({
      title: "Invite code copied",
      description: "The invite code has been copied to your clipboard.",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Your Communities</h2>
        <Protected resource="communities" action="create">
          <Link href="/communities/create">
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Create Community
            </Button>
          </Link>
        </Protected>
      </div>

      {communities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No communities yet</p>
            <p className="text-muted-foreground text-center mb-4">
              {user?.role === 'community_admin' 
                ? 'Create a community to get started' 
                : 'Join a community using an invite code'}
            </p>
            <div className="flex gap-4">
              <Protected resource="communities" action="create">
                <Link href="/communities/create">
                  <Button className="gap-2">
                    <PlusCircle className="h-4 w-4" />
                    Create Community
                  </Button>
                </Link>
              </Protected>
              <Link href="/communities/join">
                <Button variant="outline">Join Community</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {communities.map((community) => (
            <Card key={community.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{community.name}</CardTitle>
                  <Badge variant={community.role === "admin" ? "default" : "secondary"}>
                    {community.role === "admin" ? "Admin" : "Member"}
                  </Badge>
                </div>
                <CardDescription>{community.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{community.memberCount} members</span>
                </div>
                {community.role === "admin" && (
                  <div className="mt-4 flex items-center gap-2">
                    <div className="text-sm font-medium">Invite Code:</div>
                    <code className="bg-muted px-2 py-1 rounded text-sm">{community.inviteCode}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyInviteCode(community.inviteCode)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex gap-2">
                <Link href={`/communities/${community.id}`} className="flex-1">
                  <Button variant="outline" className="w-full">
                    View Details
                  </Button>
                </Link>
                <Protected resource="communities" action="update">
                  {community.role === "admin" && (
                    <Link href={`/communities/${community.id}/settings`}>
                      <Button variant="ghost" size="icon">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </Protected>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}