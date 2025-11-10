"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"
import { FileText, Video, BarChart, Users, Wand2, ClipboardList } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface Club {
  id: string
  name: string
  description: string
  leadId: string
  members: Member[]
}

interface Member {
  userId: string
  role: 'head' | 'report_admin' | 'social_media_manager' | 'team_lead' | 'member'
}

export default function ClubDashboardPage() {
  const { id: clubId } = useParams()
  const { user } = useAuth()
  const [club, setClub] = useState<Club | null>(null)
  const [userRole, setUserRole] = useState<'head' | 'report_admin' | 'social_media_manager' | 'team_lead' | 'member'>('member')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchClub = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/clubs/${clubId}`)
        if (!response.ok) throw new Error(`Failed to fetch club: ${response.statusText}`)
        const data = await response.json()
        setClub(data)

        // Find user's role in club
        const member = data.members?.find((m: Member) => m.userId === user?.id)
        if (member) {
          setUserRole(member.role)
        } else if (data.leadId === user?.id) {
          setUserRole('head')
        } else {
          setUserRole('member')
        }
      } catch (error) {
        console.error("Failed to fetch club:", error)
        setError(error instanceof Error ? error.message : 'Failed to load club data')
      } finally {
        setLoading(false)
      }
    }

    if (clubId && user?.id) {
      fetchClub()
    }
  }, [clubId, user?.id]) // Only depend on user.id instead of whole user object

  if (loading) {
    return (
      <div className="container flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Role-specific dashboard components
  const RoleBasedDashboard = () => {
    switch(userRole) {
      case 'head':
        return (
          <div className="space-y-4">
            {/* Club Head - Team Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Management
                </CardTitle>
                <CardDescription>Manage team formation and member roles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Link href={`/clubs/${clubId}/teams/form`}>
                    <Button className="w-full">
                      <Wand2 className="h-4 w-4 mr-2" />
                      AI Team Formation
                    </Button>
                  </Link>
                  <Link href={`/clubs/${clubId}/members`}>
                    <Button variant="outline" className="w-full">
                      Manage Team Roles
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
            
            {/* Club Head - Tasks Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Club Tasks
                </CardTitle>
                <CardDescription>Oversee all club activities and assignments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Link href={`/clubs/${clubId}/tasks/create`}>
                    <Button className="w-full">
                      Create Task
                    </Button>
                  </Link>
                  <Link href={`/clubs/${clubId}/tasks`}>
                    <Button variant="outline" className="w-full">
                      View All Tasks
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      
      case 'report_admin':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Report Generator
                </CardTitle>
                <CardDescription>Generate comprehensive event reports and analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Link href={`/clubs/${clubId}/reports/generate`}>
                    <Button className="w-full">
                      <BarChart className="h-4 w-4 mr-2" />
                      Generate New Report
                    </Button>
                  </Link>
                  <Link href={`/clubs/${clubId}/reports`}>
                    <Button variant="outline" className="w-full">
                      View Past Reports
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      
      case 'social_media_manager':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Social Media Hub
                </CardTitle>
                <CardDescription>Create and manage social media content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Link href={`/clubs/${clubId}/social/reels/create`}>
                    <Button className="w-full">
                      <Video className="h-4 w-4 mr-2" />
                      Create New Reel
                    </Button>
                  </Link>
                  <Link href={`/clubs/${clubId}/social/reels`}>
                    <Button variant="outline" className="w-full">
                      Manage Reels
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      
      case 'team_lead':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Dashboard
                </CardTitle>
                <CardDescription>Manage your team and tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Link href={`/clubs/${clubId}/tasks/team/create`}>
                    <Button className="w-full">
                      <ClipboardList className="h-4 w-4 mr-2" />
                      Assign Team Tasks
                    </Button>
                  </Link>
                  <Link href={`/clubs/${clubId}/tasks/team`}>
                    <Button variant="outline" className="w-full">
                      View Team Tasks
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      
      default:
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Member Dashboard
                </CardTitle>
                <CardDescription>View your tasks and club activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Link href={`/clubs/${clubId}/tasks/my`}>
                    <Button className="w-full">
                      <ClipboardList className="h-4 w-4 mr-2" />
                      View My Tasks
                    </Button>
                  </Link>
                  <Link href={`/clubs/${clubId}/events`}>
                    <Button variant="outline" className="w-full">
                      Club Events
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        );
    }
  };
  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Club Dashboard</h1>
        <p className="text-muted-foreground">
          {club?.name} • Your role: <span className="font-medium capitalize">{userRole}</span>
        </p>
      </div>

      <Tabs defaultValue="role-dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="role-dashboard">Role Dashboard</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="role-dashboard" className="space-y-4">
          <RoleBasedDashboard />
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Club Information</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{club?.description}</p>
                <p className="text-sm mt-2">
                  <strong>Members:</strong> {club?.members?.length || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Link href={`/clubs/${clubId}/manage`}>
                  <Button variant="outline" className="w-full justify-start">
                    Manage Club
                  </Button>
                </Link>
                <Link href={`/clubs/${clubId}/events/create`}>
                  <Button variant="outline" className="w-full justify-start">
                    Create Event
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

