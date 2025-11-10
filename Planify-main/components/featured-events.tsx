"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Calendar, MapPin, Users } from "lucide-react"

export default function FeaturedEvents() {
  const [featuredEvents, setFeaturedEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchFeaturedEvents() {
      try {
        const response = await fetch('/api/events')
        if (response.ok) {
          const data = await response.json()
          // Get the first 3 events as featured
          setFeaturedEvents(data.slice(0, 3))
        }
      } catch (error) {
        console.error("Failed to fetch featured events:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchFeaturedEvents()
  }, [])

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2">Loading events...</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {featuredEvents.map((event) => (
        <Card key={event.id} className="overflow-hidden">
          <div className="aspect-video w-full overflow-hidden">
            <img
              src={event.image || "/placeholder.svg"}
              alt={event.title}
              className="object-cover w-full h-full transition-transform hover:scale-105"
            />
          </div>
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="text-xl">{event.title}</CardTitle>
              {event.tags && event.tags.length > 0 && (
                <div className="flex gap-1">
                  {event.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {event.communityName || event.community || 'Community Event'}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(event.date || event.startDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{event.location || 'TBA'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{event.attendeeCount || event.attendees || 0} attendees</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Link href={`/events/${event.id}`} className="w-full">
              <Button className="w-full">View Details</Button>
            </Link>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

