"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"
import { PlusCircle, Users, Calendar, ClipboardList, Wand2 } from "lucide-react"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import ClubMembers from "@/components/clubs/club-members"
import ClubEvents from "@/components/clubs/club-events"
import ClubTasks from "@/components/clubs/club-tasks"
import AITools from "@/components/clubs/ai-tools"

export default function ManageClubPage() {
  const { id } = useParams()
  const [club, setClub] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    const fetchClub = async () => {
      try {
        const response = await fetch(`/api/clubs/${id}`)
        if (!response.ok) {
          throw new Error("Failed to fetch club")
        }

        const data = await response.json()
        setClub(data)

        // Check if user is a lead of this club
        const member = data.members?.find((m: any) => m.userId === user.id)
        setUserRole(member ? member.role : null)

        // Only leads can manage the club
        if (!member || member.role !== 'lead') {
          toast({
            title: "Access Denied",
            description: "You must be a club lead to manage this club",
            variant: "destructive",
          })
          router.push(`/clubs/${id}`)
          return
        }
      } catch (error) {
        console.error("Failed to fetch club:", error)
        toast({
          title: "Error",
          description: "Failed to load club details",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchClub()
  }, [id, user, router])

  if (loading) {
    return (
      <div className="container flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading club details...</p>
        </div>
      </div>
    )
  }

  if (!club) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Club Not Found</h1>
          <p className="mb-6">The club you're trying to manage doesn't exist or you don't have access.</p>
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Club: {club.name}</h1>
          <p className="text-muted-foreground">
            {club.communityName && `Part of ${club.communityName} • `}{club.memberCount || 0} members
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/clubs/${id}/events/create`}>
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Create Event
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2">
            <Calendar className="h-4 w-4" />
            Events
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="ai-tools" className="gap-2">
            <Wand2 className="h-4 w-4" />
            AI Tools
          </TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <ClubMembers clubId={id as string} />
        </TabsContent>
        <TabsContent value="events">
          <ClubEvents clubId={id as string} />
        </TabsContent>
        <TabsContent value="tasks">
          <ClubTasks clubId={id as string} />
        </TabsContent>
        <TabsContent value="ai-tools">
          <AITools clubId={id as string} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

