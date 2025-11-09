"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Calendar, MapPin, Users, Clock, Search } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"

interface ClubEventsProps {
  clubId: string
}

export default function ClubEvents({ clubId }: ClubEventsProps) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState("all")

  useEffect(() => {
    async function fetchEvents() {
      try {
        const response = await fetch(`/api/events?clubId=${clubId}`)
        if (response.ok) {
          const data = await response.json()
          // Add status based on date
          const eventsWithStatus = data.map((event: any) => ({
            ...event,
            status: new Date(event.date || event.startDate) > new Date() ? 'upcoming' : 'past'
          }))
          setEvents(eventsWithStatus)
        }
      } catch (error) {
        console.error("Failed to fetch events:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [clubId])

  const filteredEvents = events.filter((event) => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filter === "all" || event.status === filter
    return matchesSearch && matchesFilter
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Club Events</CardTitle>
            <CardDescription>Manage your club's events</CardDescription>
          </div>
          <Link href={`/clubs/${clubId}/events/create`}>
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Create Event
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
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
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading events...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">No events found</p>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "No events match your search criteria" : "You haven't created any events yet"}
              </p>
              <Link href={`/clubs/${clubId}/events/create`}>
                <Button className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Create Event
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((event) => (
                <Card key={event.id} className={event.status === "past" ? "opacity-70" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{event.title}</CardTitle>
                      <Badge variant={event.status === "upcoming" ? "default" : "secondary"}>
                        {event.status === "upcoming" ? "Upcoming" : "Past"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(event.date || event.startDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {new Date(event.date || event.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {event.endDate && ` - ${new Date(event.endDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{event.location || 'TBA'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {event.attendeeCount || event.attendees || 0} / {event.maxAttendees || 'Unlimited'} registered
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Link href={`/events/${event.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                    {event.status === "upcoming" && (
                      <Link href={`/events/${event.id}/manage`}>
                        <Button size="sm">Manage</Button>
                      </Link>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

