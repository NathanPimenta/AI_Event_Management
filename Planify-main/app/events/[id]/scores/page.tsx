"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { ScoreLeaderboard } from "@/components/materials/score-leaderboard"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"

interface EventScoresPageProps {
  params: Promise<{ 
    id: string
  }>
}

export default function EventScoresPage({ params }: EventScoresPageProps) {
  const { id: eventId } = React.use(params)
  const { user, loading } = useAuth()
  const [eventTitle, setEventTitle] = useState<string>("")
  const { toast } = useToast()

  useEffect(() => {
    if (!loading && user) {
      fetchEventTitle()
    }
  }, [eventId, user, loading])

  const fetchEventTitle = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}`)
      const data = await response.json()

      if (response.ok) {
        setEventTitle(data.title || "Event")
      }
    } catch (error) {
      console.error("Error fetching event title:", error)
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
            <h1 className="text-2xl font-bold">Event Scores & Leaderboard</h1>
            <p className="text-muted-foreground">View material evaluation results and rankings</p>
          </div>
        </div>

        {/* Leaderboard Component */}
        <ScoreLeaderboard 
          eventId={eventId} 
          eventTitle={eventTitle}
        />
      </div>
    </div>
  )
}