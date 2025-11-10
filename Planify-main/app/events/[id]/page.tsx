"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Clock, MapPin, Users, Share2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"
import EventQueries from "@/components/events/event-queries"
import { AdminOnly } from "@/components/protected"

export default function EventPage() {
  const { id } = useParams()
  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [attendees, setAttendees] = useState<any[]>([])
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/events/${id}`)
        if (!response.ok) {
          throw new Error("Failed to fetch event")
        }
        const data = await response.json()
        setEvent(data)
        
        // Check if user is already registered
        if (user && data.attendees) {
          const userRegistered = data.attendees.some((a: any) => a.userId === user.id)
          setIsRegistered(userRegistered)
        }
      } catch (error) {
        console.error("Failed to fetch event:", error)
        toast({
          title: "Error",
          description: "Failed to load event details",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchEvent()
  }, [id, user])

  useEffect(() => {
    // Fetch attendees list for admin
    const fetchAttendees = async () => {
      if (!user || user.role !== 'community_admin') return
      
      try {
        const response = await fetch(`/api/events/${id}/attendees`)
        if (response.ok) {
          const data = await response.json()
          setAttendees(data)
        }
      } catch (error) {
        console.error("Failed to fetch attendees:", error)
      }
    }

    if (event) {
      fetchAttendees()
    }
  }, [id, user, event])

  const handleRegister = async () => {
    // Wait for auth to load
    if (authLoading) return
    
    if (!user) {
      router.push("/login")
      return
    }

    setRegistering(true)

    try {
      const response = await fetch(`/api/events/${id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: user.name,
          email: user.email
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to register')
      }

      setIsRegistered(true)
      
      // Refresh event data to get updated attendee count
      const eventResponse = await fetch(`/api/events/${id}`)
      if (eventResponse.ok) {
        const updatedEvent = await eventResponse.json()
        setEvent(updatedEvent)
      }

      toast({
        title: "Registration successful",
        description: `You have registered for ${event.title}`,
      })
    } catch (error: any) {
      console.error("Failed to register for event:", error)
      toast({
        title: "Registration failed",
        description: error.message || "There was an error registering for this event. Please try again.",
        variant: "destructive",
      })
    } finally {
      setRegistering(false)
    }
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: event.title,
          text: `Check out this event: ${event.title}`,
          url: window.location.href,
        })
        .catch((error) => {
          console.error("Error sharing:", error)
          fallbackShare()
        })
    } else {
      fallbackShare()
    }
  }

  const fallbackShare = () => {
    navigator.clipboard.writeText(window.location.href)
    toast({
      title: "Link copied",
      description: "Event link has been copied to clipboard",
    })
  }

  if (loading) {
    return (
      <div className="container flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading event details...</p>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Event Not Found</h1>
          <p className="mb-6">The event you're looking for doesn't exist.</p>
          <Button onClick={() => router.push('/events')}>Back to Events</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold">{event.title}</h1>
            <p className="text-muted-foreground">
              {event.clubName && `${event.clubName} • `}{event.communityName}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            {!isRegistered ? (
              <Button onClick={handleRegister} disabled={registering}>
                {registering ? 'Registering...' : 'Register Now'}
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Registered
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                {event.tags && event.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {event.tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <CardDescription className="text-base">{event.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="details">
                  <TabsList className={user?.role === 'community_admin' ? "grid w-full grid-cols-3" : "grid w-full grid-cols-2"}>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="queries">Queries</TabsTrigger>
                    {user?.role === 'community_admin' && (
                      <TabsTrigger value="attendees">Attendees ({attendees.length})</TabsTrigger>
                    )}
                  </TabsList>
                  <TabsContent value="details" className="space-y-4 mt-4">
                    <div className="prose dark:prose-invert max-w-none">
                      <p>{event.description}</p>
                    </div>

                    {event.organizerName && (
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-2">Organizer</h3>
                        <div className="flex items-center gap-2">
                          <Avatar>
                            <AvatarFallback>{event.organizerName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>{event.organizerName}</span>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="queries" className="mt-4">
                    <EventQueries eventId={event.id} />
                  </TabsContent>
                  {user?.role === 'community_admin' && (
                    <TabsContent value="attendees" className="mt-4">
                      <div className="space-y-3">
                        {attendees.length === 0 ? (
                          <p className="text-muted-foreground text-center py-8">No attendees yet</p>
                        ) : (
                          attendees.map((attendee: any) => (
                            <div key={attendee.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarFallback>{attendee.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{attendee.name}</p>
                                  <p className="text-sm text-muted-foreground">{attendee.email}</p>
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(attendee.registeredAt).toLocaleDateString()}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Event Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Date</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(event.date || event.startDate).toLocaleDateString(undefined, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Time</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(event.date || event.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {event.endDate && ` - ${new Date(event.endDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Location</div>
                    <div className="text-sm text-muted-foreground">{event.location || 'TBA'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Attendees</div>
                    <div className="text-sm text-muted-foreground">
                      {event.attendeeCount || 0} / {event.maxAttendees || 'Unlimited'} registered
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                {!isRegistered ? (
                  <Button className="w-full" onClick={handleRegister} disabled={registering}>
                    {registering ? 'Registering...' : 'Register Now'}
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    Registered
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

