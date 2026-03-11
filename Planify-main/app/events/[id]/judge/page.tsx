"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/use-permissions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MaterialScoring } from "@/components/materials/material-scoring"
import { ArrowLeftIcon, FileText, Users, Calendar } from "lucide-react"
import Link from "next/link"

interface EventJudgePageProps {
  params: Promise<{ 
    id: string
  }>
}

interface MaterialSubmission {
  id: string
  participant_name: string
  participant_email: string
  submission_type: string
  file_url: string
  description: string
  submitted_at: string
  request_title: string
  scored: boolean
}

interface Event {
  id: string
  title: string
  description: string
  start_date: string
  end_date: string
}

export default function EventJudgePage({ params }: EventJudgePageProps) {
  const { id: eventId } = React.use(params)
  const { user, loading } = useAuth()
  const { can } = usePermissions()
  const { toast } = useToast()
  const [event, setEvent] = useState<Event | null>(null)
  const [materials, setMaterials] = useState<MaterialSubmission[]>([])
  const [loadingMaterials, setLoadingMaterials] = useState(true)
  const [isAssignedJudge, setIsAssignedJudge] = useState<boolean | null>(null)

  useEffect(() => {
    if (!loading && user) {
      checkJudgeAssignment()
      fetchEvent()
      fetchMaterials()
    }
  }, [eventId, user, loading])

  const checkJudgeAssignment = async () => {
    if (!user?.id) return
    
    try {
      const response = await fetch(`/api/events/${eventId}/judges`)
      if (response.ok) {
        const judges = await response.json()
        const isAssigned = judges.some((judge: any) => judge.judge_id === user.id && judge.status === 'active')
        setIsAssignedJudge(isAssigned)
      }
    } catch (error) {
      console.error('Error checking judge assignment:', error)
      setIsAssignedJudge(false)
    }
  }

  const fetchEvent = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}`)
      const data = await response.json()
      if (response.ok) {
        setEvent(data)
      }
    } catch (error) {
      console.error("Error fetching event:", error)
    }
  }

  const fetchMaterials = async () => {
    try {
      setLoadingMaterials(true)
      console.log('Fetching materials for eventId:', eventId, 'userId:', user?.id)
      
      const response = await fetch(`/api/events/${eventId}/materials?judgeView=true&judgeId=${user?.id}`)
      console.log('Materials API response status:', response.status, response.statusText)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Materials API response data:', data)
        setMaterials(data.materials || [])
        console.log('Set materials to:', data.materials || [])
      } else {
        const errorData = await response.text()
        console.error('Materials API error response:', errorData)
        throw new Error(`API returned ${response.status}: ${errorData}`)
      }
    } catch (error) {
      console.error("Error fetching materials:", error)
      toast({
        title: "Error",
        description: "Failed to load material submissions",
        variant: "destructive",
      })
    } finally {
      setLoadingMaterials(false)
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

  if (!can('materials', 'score')) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-8">You don't have permission to score materials.</p>
          <Link href="/dashboard">
            <Button variant="outline">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Check if user is assigned as judge for this specific event
  if (isAssignedJudge === false) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Not Assigned</h1>
          <p className="text-muted-foreground mb-8">You are not assigned as a judge for this event.</p>
          <Link href="/dashboard">
            <Button variant="outline">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Still checking assignment
  if (isAssignedJudge === null) {
    return (
      <div className="container flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Verifying permissions...</p>
        </div>
      </div>
    )
  }

  const unscoredMaterials = materials.filter(m => !m.scored)
  const scoredMaterials = materials.filter(m => m.scored)

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2">
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Judge Material Submissions</h1>
            <p className="text-muted-foreground">{event?.title}</p>
          </div>
        </div>

        {/* Event Info */}
        {event && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {event.title}
              </CardTitle>
              <CardDescription>{event.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {materials.length} submissions total
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {scoredMaterials.length} scored, {unscoredMaterials.length} pending
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Materials Tabs */}
        <Tabs defaultValue="unscored" className="space-y-4">
          <TabsList>
            <TabsTrigger value="unscored" className="gap-2">
              Pending Review
              {unscoredMaterials.length > 0 && (
                <Badge variant="destructive">{unscoredMaterials.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="scored" className="gap-2">
              Completed
              {scoredMaterials.length > 0 && (
                <Badge variant="secondary">{scoredMaterials.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unscored" className="space-y-4">
            {loadingMaterials ? (
              <div className="space-y-4">
                <div className="h-32 bg-muted animate-pulse rounded-lg" />
                <div className="h-32 bg-muted animate-pulse rounded-lg" />
              </div>
            ) : unscoredMaterials.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No pending submissions to score.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {unscoredMaterials.map((material) => (
                  <MaterialScoring 
                    key={material.id}
                    material={material}
                    eventId={eventId}
                    onScoreSubmitted={fetchMaterials}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="scored" className="space-y-4">
            {loadingMaterials ? (
              <div className="space-y-4">
                <div className="h-32 bg-muted animate-pulse rounded-lg" />
                <div className="h-32 bg-muted animate-pulse rounded-lg" />
              </div>
            ) : scoredMaterials.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No submissions have been scored yet.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {scoredMaterials.map((material) => (
                  <MaterialScoring 
                    key={material.id}
                    material={material}
                    eventId={eventId}
                    onScoreSubmitted={fetchMaterials}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}