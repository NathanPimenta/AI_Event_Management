"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MaterialScoring } from "@/components/materials/material-scoring"
import { 
  StarIcon, 
  FileIcon, 
  CalendarIcon, 
  UsersIcon,
  CheckCircleIcon,
  ClockIcon
} from "lucide-react"
import Link from "next/link"

interface MaterialRequest {
  id: string
  title: string
  description: string
  material_type: string
  due_date: string
  submission_count: number
  scored_count: number
}

interface Event {
  id: string
  title: string
  description: string
  date: string
  location: string
  organizer_name: string
}

interface JudgeAssignment {
  id: string
  event_id: string
  assigned_at: string
  event: Event
  material_requests: MaterialRequest[]
}

export default function JudgeScoringPage() {
  const { user, loading } = useAuth()
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [loadingAssignments, setLoadingAssignments] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (!loading && user?.role === 'judge') {
      fetchJudgeAssignments()
    }
  }, [user, loading])

  const fetchJudgeAssignments = async () => {
    try {
      const response = await fetch('/api/judge/assignments')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch assignments")
      }

      setAssignments(data)
    } catch (error) {
      console.error("Error fetching judge assignments:", error)
      toast({
        title: "Error",
        description: "Failed to load your judge assignments",
        variant: "destructive",
      })
    } finally {
      setLoadingAssignments(false)
    }
  }

  if (loading) {
    return (
      <div className="container flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  if (user?.role !== 'judge') {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only judges can access this page</CardDescription>
          </CardHeader>
          <CardContent>
            <p>You need to be assigned as a judge to access the scoring interface.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selectedEvent = assignments.find(a => a.event_id === selectedEventId)?.event
  const selectedRequest = selectedEvent && selectedEventId ? 
    assignments.find(a => a.event_id === selectedEventId)?.material_requests.find(r => r.id === selectedRequestId) : null

  const getTotalSubmissions = () => {
    return assignments.reduce((total, assignment) => {
      return total + assignment.material_requests.reduce((sum, req) => sum + req.submission_count, 0)
    }, 0)
  }

  const getTotalScored = () => {
    return assignments.reduce((total, assignment) => {
      return total + assignment.material_requests.reduce((sum, req) => sum + req.scored_count, 0)
    }, 0)
  }

  if (loadingAssignments) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Judge Scoring Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome, {user?.name}! Evaluate material submissions for your assigned events.
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex items-center p-6">
              <CalendarIcon className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Assigned Events</p>
                <p className="text-2xl font-bold">{assignments.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <FileIcon className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Submissions</p>
                <p className="text-2xl font-bold">{getTotalSubmissions()}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <CheckCircleIcon className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Scored</p>
                <p className="text-2xl font-bold">{getTotalScored()}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <ClockIcon className="h-8 w-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{getTotalSubmissions() - getTotalScored()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {assignments.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Assignments</CardTitle>
              <CardDescription>You haven't been assigned to judge any events yet</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Event organizers will assign you as a judge when they need material evaluations.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Event Assignments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Your Judge Assignments
                </CardTitle>
                <CardDescription>
                  Events where you've been assigned to judge material submissions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="border rounded-lg p-4 space-y-3">
                    <div>
                      <h3 className="font-semibold">{assignment.event.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {assignment.event.location} • {new Date(assignment.event.date).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                      </p>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Material Requests:</h4>
                      {assignment.material_requests.map((request) => (
                        <div key={request.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <div>
                            <p className="text-sm font-medium">{request.title}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {request.material_type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {request.submission_count} submissions
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">
                              {request.scored_count}/{request.submission_count} scored
                            </p>
                            <Button 
                              size="sm" 
                              variant="outline"
                              asChild
                            >
                              <Link href={`/events/${assignment.event_id}/score/${request.id}`}>
                                <StarIcon className="h-3 w-3 mr-1" />
                                Score
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/events/${assignment.event_id}/scores`}>
                          <UsersIcon className="h-4 w-4 mr-2" />
                          View Leaderboard
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and helpful links</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Scoring Guidelines</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Content Quality: Evaluate depth, accuracy, and relevance</li>
                    <li>• Presentation: Consider format, clarity, and organization</li>
                    <li>• Creativity: Look for innovation and original thinking</li>
                    <li>• Technical Accuracy: Check for correctness and best practices</li>
                    <li>• Clarity: Assess how well ideas are communicated</li>
                  </ul>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Need Help?</h4>
                  <p className="text-sm text-muted-foreground">
                    Contact event organizers if you have questions about scoring criteria or technical issues.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}