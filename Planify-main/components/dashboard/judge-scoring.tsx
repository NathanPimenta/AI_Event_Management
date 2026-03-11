"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'
import { Calendar, Users, FileText, Award, ExternalLink } from 'lucide-react'

interface JudgeEvent {
  id: string
  title: string
  description: string
  start_date: string
  end_date: string
  status: 'upcoming' | 'active' | 'completed'
  submission_count: number
  scored_submissions: number
}

export default function JudgeScoring() {
  const { user } = useAuth()
  const [events, setEvents] = useState<JudgeEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      fetchJudgeEvents()
    }
  }, [user?.id])

  const fetchJudgeEvents = async () => {
    try {
      console.log('Fetching judge events for user:', user?.id)
      const response = await fetch(`/api/judge/events?userId=${user?.id}`)
      console.log('Judge events response:', response.status, response.statusText)
      
      if (!response.ok) {
        const errorData = await response.text()
        console.error('API error response:', errorData)
        throw new Error(`Failed to fetch judge events: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Judge events data received:', data)
      setEvents(data.events || [])
    } catch (error) {
      console.error('Error fetching judge events:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-500'
      case 'active': return 'bg-green-500'
      case 'completed': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getProgressPercentage = (scored: number, total: number) => {
    return total === 0 ? 0 : Math.round((scored / total) * 100)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Judge Scoring Dashboard</h2>
        <p className="text-muted-foreground">
          Evaluate material submissions and provide scores for assigned events.
        </p>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Events</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming Events</TabsTrigger>
          <TabsTrigger value="completed">Completed Events</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="space-y-4">
          <div className="grid gap-4">
            {events.filter(event => event.status === 'active').length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No active events to judge at the moment.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              events
                .filter(event => event.status === 'active')
                .map((event) => (
                  <Card key={event.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            {event.title}
                            <Badge className={getStatusColor(event.status)}>
                              {event.status}
                            </Badge>
                          </CardTitle>
                          <CardDescription>{event.description}</CardDescription>
                        </div>
                        <Link href={`/events/${event.id}/judge`}>
                          <Button>
                            Start Scoring
                            <ExternalLink className="h-4 w-4 ml-2" />
                          </Button>
                        </Link>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              {event.submission_count} submissions
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Scoring Progress</span>
                            <span>{event.scored_submissions} of {event.submission_count} scored</span>
                          </div>
                          <Progress 
                            value={getProgressPercentage(event.scored_submissions, event.submission_count)} 
                            className="w-full"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          <div className="grid gap-4">
            {events.filter(event => event.status === 'upcoming').length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No upcoming events to judge.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              events
                .filter(event => event.status === 'upcoming')
                .map((event) => (
                  <Card key={event.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            {event.title}
                            <Badge variant="outline">
                              {event.status}
                            </Badge>
                          </CardTitle>
                          <CardDescription>{event.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Starts {new Date(event.start_date).toLocaleDateString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <div className="grid gap-4">
            {events.filter(event => event.status === 'completed').length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No completed events found.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              events
                .filter(event => event.status === 'completed')
                .map((event) => (
                  <Card key={event.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            {event.title}
                            <Badge variant="secondary">
                              {event.status}
                            </Badge>
                          </CardTitle>
                          <CardDescription>{event.description}</CardDescription>
                        </div>
                        <Link href={`/events/${event.id}/scores`}>
                          <Button variant="outline">
                            View Scores
                            <ExternalLink className="h-4 w-4 ml-2" />
                          </Button>
                        </Link>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Completed {new Date(event.end_date).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <Award className="h-4 w-4" />
                            {event.scored_submissions} submissions scored
                          </div>
                        </div>
                        <Badge variant="outline" className="text-green-600">
                          ✓ Complete
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}