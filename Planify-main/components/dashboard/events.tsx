"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Calendar, MapPin, Users, Clock } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useState, useEffect } from "react"
import { Protected } from "@/components/protected"
import { toast } from "@/hooks/use-toast"

type Event = {
  id: string
  title: string
  clubName: string
  communityName: string
  date: string
  endDate: string
  location: string
  attendeeCount: number
  isOrganizer: boolean
}

export default function DashboardEvents() {
  const { user } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")

  useEffect(() => {
    if (user?.id) {
      fetchEvents()
    }
  }, [user?.id])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/events?userId=${user?.id}`)
      if (response.ok) {
        const data = await response.json()
        setEvents(data)
      }
    } catch (error) {
      console.error('Failed to fetch events:', error)
      toast({
        title: "Error",
        description: "Failed to load events",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredEvents = events.filter((event) => {
    if (filter === "all") return true
    const eventDate = new Date(event.date)
    const now = new Date()
    const isUpcoming = eventDate > now
    const isPast = eventDate <= now
    
    if (filter === "upcoming") return isUpcoming
    if (filter === "past") return isPast
    if (filter === "organizing") return event.isOrganizer
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Your Events</h2>
        <div className="flex gap-2">
          <Protected resource="events" action="create">
            <Link href="/events/create">
              <Button className="gap-2">
                <PlusCircle className="h-4 w-4" />
                Create Event
              </Button>
            </Link>
          </Protected>
          <div className="flex gap-2">
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
              All
            </Button>
            <Button
              variant={filter === "upcoming" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("upcoming")}
            >
              Upcoming
            </Button>
            <Button variant={filter === "past" ? "default" : "outline"} size="sm" onClick={() => setFilter("past")}>
              Past
            </Button>
            <Button
              variant={filter === "organizing" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("organizing")}
            >
              Organizing
            </Button>
          </div>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No events found</p>
            <p className="text-muted-foreground text-center mb-4">
              {filter !== "all"
                ? `You don't have any ${filter} events`
                : "You haven't created or joined any events yet"}
            </p>
            <Protected resource="events" action="create">
              <Link href="/events/create">
                <Button className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Create Event
                </Button>
              </Link>
            </Protected>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => {
            const eventDate = new Date(event.date)
            const isUpcoming = eventDate > new Date()
            
            return (
              <Card key={event.id} className={!isUpcoming ? "opacity-70" : ""}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl">{event.title}</CardTitle>
                    <Badge variant={isUpcoming ? "default" : "secondary"}>
                      {isUpcoming ? "Upcoming" : "Past"}
                    </Badge>
                  </div>
                  <CardDescription>
                    {event.clubName || 'No Club'} • {event.communityName || 'No Community'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{eventDate.toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{event.attendeeCount} attendees</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Link href={`/events/${event.id}`}>
                    <Button variant="outline">View Details</Button>
                  </Link>
                  {event.isOrganizer && isUpcoming && (
                    <Link href={`/events/${event.id}/manage`}>
                      <Button>Manage</Button>
                    </Link>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

